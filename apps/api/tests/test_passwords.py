"""Contraseñas: Argon2, rehash, política de 12 caracteres y redacción en logs.

Change de OpenSpec: autenticacion-y-matriz-permisos (tarea 2.1; ADR-009 decisión D2, RNF-013).
Requirement «Administración de usuarios con contraseña temporal» (escenario «Contraseña débil»)
y «Bloqueo temporal y registro de eventos de autenticación» (escenario «Contraseña en registros»).
"""

import logging

import pytest

from app.core.errors import ValidationFailed
from app.modules.users import passwords

GOOD_PASSWORD = "retablo-de-ayacucho-7"
SECRET = "contrasena-muy-secreta-42"


def test_hash_is_argon2_and_never_contains_the_password() -> None:
    digest = passwords.hash_password(GOOD_PASSWORD)
    assert digest.startswith("$argon2")
    assert GOOD_PASSWORD not in digest
    # Dos hashes de la misma contraseña difieren (sal aleatoria).
    assert digest != passwords.hash_password(GOOD_PASSWORD)


def test_verification_accepts_the_password_and_rejects_anything_else() -> None:
    digest = passwords.hash_password(GOOD_PASSWORD)
    valid, updated = passwords.verify_password(GOOD_PASSWORD, digest)
    assert valid is True
    assert updated is None
    assert passwords.verify_password(GOOD_PASSWORD + "x", digest) == (False, None)


def test_user_without_password_hash_never_verifies() -> None:
    """Una cuenta sin contraseña (solo SSO o sin activar) no inicia sesión."""
    assert passwords.verify_password(GOOD_PASSWORD, None) == (False, None)
    assert passwords.verify_password(GOOD_PASSWORD, "") == (False, None)


def test_hash_with_weaker_parameters_is_rehashed_on_login() -> None:
    """Si los parámetros de Argon2 suben, el hash guardado se reemplaza al iniciar sesión."""
    from pwdlib.hashers.argon2 import Argon2Hasher

    weak = Argon2Hasher(time_cost=1, memory_cost=8192, parallelism=1).hash(GOOD_PASSWORD)
    assert passwords.needs_rehash(weak) is True

    valid, updated = passwords.verify_password(GOOD_PASSWORD, weak)
    assert valid is True
    assert updated is not None and updated != weak
    assert passwords.needs_rehash(updated) is False
    # El hash renovado sigue validando la misma contraseña.
    assert passwords.verify_password(GOOD_PASSWORD, updated)[0] is True


def test_current_hash_does_not_need_rehashing() -> None:
    assert passwords.needs_rehash(passwords.hash_password(GOOD_PASSWORD)) is False


def test_weak_password_reports_length_and_commonness_together() -> None:
    """Escenario «Contraseña débil»: `museo2026` es corta y demasiado común a la vez."""
    problems = passwords.policy_problems("museo2026")
    assert len(problems) == 2
    assert any("12 caracteres" in problem for problem in problems)
    assert any("común" in problem for problem in problems)

    with pytest.raises(ValidationFailed) as excinfo:
        passwords.hash_password("museo2026")
    assert excinfo.value.code == "weak_password"
    assert excinfo.value.details["min_length"] == 12
    assert len(excinfo.value.details["problems"]) == 2


@pytest.mark.parametrize(
    "password",
    [
        "corta",  # menos de 12 caracteres
        "            ",  # solo espacios
        "contrasena12",  # de uso común
        "Contraseña!!",  # de uso común con acento y signos
        "123456789012",  # solo dígitos
        "museo" * 41,  # supera el máximo
    ],
)
def test_passwords_outside_the_policy_are_rejected(password: str) -> None:
    assert passwords.policy_problems(password)
    with pytest.raises(ValidationFailed):
        passwords.validate_password(password)


@pytest.mark.parametrize("password", [GOOD_PASSWORD, "doce-caracter", "Mate burilado 1952"])
def test_passwords_within_the_policy_are_accepted(password: str) -> None:
    assert passwords.policy_problems(password) == []


def test_password_equal_to_the_email_is_rejected() -> None:
    email = "catalogador@matp.local"
    problems = passwords.policy_problems(email.upper(), email=email)
    assert any("correo" in problem for problem in problems)
    assert passwords.policy_problems(GOOD_PASSWORD, email=email) == []


@pytest.mark.parametrize(
    "message",
    [
        "login payload password=%s",
        'body {"email": "a@b.c", "password": "%s"}',
        "credenciales contraseña: %s",
        "POST /auth/login?token=%s",
    ],
)
def test_logging_filter_removes_passwords(message: str, caplog: pytest.LogCaptureFixture) -> None:
    """Escenario «Contraseña en registros»: ninguna contraseña aparece en texto plano."""
    logger = logging.getLogger("matp.test.passwords")
    logger.addFilter(passwords.PasswordRedactingFilter())
    with caplog.at_level(logging.INFO, logger=logger.name):
        logger.info(message % SECRET)
    written = caplog.text
    assert SECRET not in written
    assert passwords.REDACTED in written


def test_logging_filter_also_cleans_the_arguments(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("matp.test.passwords.args")
    logger.addFilter(passwords.PasswordRedactingFilter())
    with caplog.at_level(logging.INFO, logger=logger.name):
        logger.info("intento de inicio de sesión: %s", f"password={SECRET}")
        logger.info("payload %(cuerpo)s", {"cuerpo": f'{{"clave": "{SECRET}"}}'})
    assert SECRET not in caplog.text
    assert caplog.text.count(passwords.REDACTED) == 2


def test_logging_filter_leaves_ordinary_messages_alone(
    caplog: pytest.LogCaptureFixture,
) -> None:
    logger = logging.getLogger("matp.test.passwords.prose")
    logger.addFilter(passwords.PasswordRedactingFilter())
    with caplog.at_level(logging.INFO, logger=logger.name):
        logger.info("la contraseña es obligatoria para iniciar sesión")
    assert "la contraseña es obligatoria para iniciar sesión" in caplog.text


def test_install_password_log_redaction_is_idempotent() -> None:
    """Crear la aplicación varias veces (una por prueba) no acumula filtros."""
    name = "matp.test.passwords.install"
    logger = logging.getLogger(name)
    try:
        passwords.install_password_log_redaction(name)
        passwords.install_password_log_redaction(name)
        installed = [
            flt for flt in logger.filters if isinstance(flt, passwords.PasswordRedactingFilter)
        ]
        assert len(installed) == 1
        assert any(
            isinstance(flt, passwords.PasswordRedactingFilter)
            for flt in logging.getLogger().filters
        )
    finally:
        for flt in list(logger.filters):
            logger.removeFilter(flt)
