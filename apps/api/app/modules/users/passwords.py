"""Password hashing, policy and log redaction (ADR-009, decision D2; RNF-013).

Hashing uses Argon2 through ``pwdlib``, the library the seed already uses, with the
parameters recommended by the library instead of hand-picked ones: when a future version
raises them, :func:`verify_password` reports that the stored hash must be rebuilt and the
login flow replaces it transparently (``needs_rehash``).

Policy (ADR-009): at least 12 characters, no composition requirements, and a password may
not be a common one nor the user's own e-mail address. The policy returns *every* problem it
finds, because the spec scenario "Contraseña débil" expects a single answer that mentions
both the minimum length and that the password is too common.

Nothing here ever logs or returns a password. :func:`install_password_log_redaction` installs
a logging filter that rewrites any record whose text looks like it carries one, so a stray
``logger.info("payload=%s", body)`` elsewhere in the code cannot leak a credential either.
"""

import logging
import re
import unicodedata
from functools import lru_cache

from app.core.errors import ValidationFailed
from app.modules.users.common_passwords import COMMON_PASSWORDS

PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 200  # Argon2 cost grows with the input; a sane upper bound (RNF-013).
REDACTED = "[REDACTADA]"

# Keys and labels that carry a secret, in both languages used by the project (ADR-002).
_SECRET_KEY = r"(?:password|passwd|pwd|contrase(?:n|ñ)a|clave|secret|secreto|token)\w*"
# `"password": "hunter2"` inside a JSON or dict dump, including a bare or numeric value.
_JSON_FIELD = re.compile(
    rf"(?i)(?P<key>[\"']{_SECRET_KEY}[\"']\s*:\s*)"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s,}\]]+)"
)
# `password=hunter2`, `password: hunter2`. Only `:` and `=` count as separators, so ordinary
# prose such as "password is required" keeps its words.
_ASSIGNMENT = re.compile(
    rf"(?i)(?P<key>\b{_SECRET_KEY}\b\s*[:=]\s*)(?P<quote>[\"']?)[^\s,;&}}\)\"']+(?P=quote)"
)


def redact_secrets(text: str) -> str:
    """Replace the value of anything that looks like a password with a marker."""
    text = _JSON_FIELD.sub(lambda match: f'{match["key"]}"{REDACTED}"', text)
    return _ASSIGNMENT.sub(
        lambda match: f"{match['key']}{match['quote']}{REDACTED}{match['quote']}", text
    )


class PasswordRedactingFilter(logging.Filter):
    """Logging filter that strips password values from messages and arguments (RNF-013).

    It is a filter rather than a formatter so it applies whatever handler is configured,
    including the ones uvicorn installs.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str) and record.msg:
            record.msg = redact_secrets(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    key: redact_secrets(value) if isinstance(value, str) else value
                    for key, value in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    redact_secrets(value) if isinstance(value, str) else value
                    for value in record.args
                )
        return True


def install_password_log_redaction(*logger_names: str) -> PasswordRedactingFilter:
    """Attach the filter to the root logger (and to any extra logger named here)."""
    log_filter = PasswordRedactingFilter()
    for logger in [logging.getLogger(), *(logging.getLogger(name) for name in logger_names)]:
        if not any(isinstance(existing, PasswordRedactingFilter) for existing in logger.filters):
            logger.addFilter(log_filter)
    return log_filter


@lru_cache(maxsize=1)
def _hasher():  # type: ignore[no-untyped-def]
    from pwdlib import PasswordHash

    return PasswordHash.recommended()


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _normalize(password: str) -> str:
    """Fold a password to the form the blocklist is written in (lowercase, unaccented)."""
    return _strip_accents(password.strip().lower())


def _base_word(normalized: str) -> str:
    """Drop a trailing year or digit run: "museo2026" and "museo!" both reduce to "museo"."""
    return re.sub(r"[\W_]+$", "", re.sub(r"\d+$", "", normalized))


def is_common_password(password: str) -> bool:
    normalized = _normalize(password)
    return normalized in COMMON_PASSWORDS or _base_word(normalized) in COMMON_PASSWORDS


def policy_problems(password: str, *, email: str | None = None) -> list[str]:
    """Return every policy violation, in Spanish, ready to show to the user."""
    problems: list[str] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        problems.append(f"La contraseña debe tener al menos {PASSWORD_MIN_LENGTH} caracteres.")
    if len(password) > PASSWORD_MAX_LENGTH:
        problems.append(f"La contraseña no puede superar {PASSWORD_MAX_LENGTH} caracteres.")
    if not password.strip():
        problems.append("La contraseña no puede estar vacía ni contener solo espacios.")
    if password.strip().isdigit():
        problems.append("La contraseña no puede estar formada solo por dígitos.")
    elif is_common_password(password):
        problems.append("La contraseña es demasiado común; elija una menos previsible.")
    if email and _normalize(password) == _normalize(email):
        problems.append("La contraseña no puede ser igual a su correo electrónico.")
    return problems


def validate_password(password: str, *, email: str | None = None) -> None:
    """Raise :class:`ValidationFailed` listing every problem; do nothing if the password passes."""
    problems = policy_problems(password, email=email)
    if problems:
        raise ValidationFailed(
            " ".join(problems),
            code="weak_password",
            details={"problems": problems, "min_length": PASSWORD_MIN_LENGTH},
        )


def hash_password(password: str, *, email: str | None = None, validate: bool = True) -> str:
    """Hash a password with Argon2 after checking the policy."""
    if validate:
        validate_password(password, email=email)
    return _hasher().hash(password)


def needs_rehash(password_hash: str) -> bool:
    """True when the stored hash was built with weaker parameters than the current ones."""
    return bool(_hasher().hashers[0].check_needs_rehash(password_hash))


def verify_password(password: str, password_hash: str | None) -> tuple[bool, str | None]:
    """Verify a password and, if its hash is outdated, return the hash to store instead.

    Returns ``(valid, updated_hash)``. ``updated_hash`` is ``None`` when nothing has to be
    rewritten. A user without a password hash (SSO-only or not yet activated) never verifies,
    and the comparison still runs through Argon2 so the answer takes the same time either way.
    """
    if not password_hash:
        _hasher().hash(password)  # keep the timing of an unknown account indistinguishable
        return False, None
    valid, updated = _hasher().verify_and_update(password, password_hash)
    return valid, updated
