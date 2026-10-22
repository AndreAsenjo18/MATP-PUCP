"""Login, lockout and password change (ADR-009, decisions D2 and D3; RNF-012, RNF-013).

Every way a login can fail answers the client with the same message and status
(:class:`InvalidCredentials`): unknown e-mail, wrong password, inactive account, locked account
and synthetic users in production. The real reason only reaches the ``auth_event`` ledger, so
the endpoint cannot be used to find out which addresses exist. Failures are committed before the
error is raised, because the request session is rolled back when the request ends.

Lockout: ``LOGIN_MAX_FAILED_ATTEMPTS`` consecutive wrong passwords lock the account for
``LOGIN_LOCK_MINUTES``; the counter restarts when the lock is set. A correct password during
the lock is refused like any other failure and does not shorten it. On top of that a per-IP
limiter (:class:`LoginThrottle`, 20 attempts in 5 minutes, in memory) slows down an attacker who
walks through many accounts.
"""

import hashlib
import threading
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AuthenticationRequired, TooManyAttempts, ValidationFailed
from app.core.models_base import utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.identity import Credentials, get_identity_provider
from app.modules.users.models import AppUser, AuthEventType
from app.modules.users.passwords import hash_password, validate_password, verify_password
from app.modules.users.sessions import (
    IssuedSession,
    RevokeReason,
    as_utc,
    issue_session,
    record_event,
    revoke_user_sessions,
)

INVALID_CREDENTIALS_MESSAGE = "Correo o contraseña incorrectos."

# Per-IP limiter (design D3): at most this many login attempts in the window.
THROTTLE_MAX_ATTEMPTS = 20
THROTTLE_WINDOW = timedelta(minutes=5)


class InvalidCredentials(AuthenticationRequired):
    """The one answer for every failed login; it never says why."""

    code = "invalid_credentials"


class CurrentPasswordIncorrect(ValidationFailed):
    code = "current_password_incorrect"


class LoginThrottle:
    """Sliding-window attempt counter per IP, in this process' memory (design D3).

    State is lost on restart and not shared between workers: it only blunts a naive scan, the
    account lockout is what protects a single account. It is thread-safe because requests run
    in a thread pool.
    """

    def __init__(
        self, max_attempts: int = THROTTLE_MAX_ATTEMPTS, window: timedelta = THROTTLE_WINDOW
    ) -> None:
        self.max_attempts = max_attempts
        self.window = window
        self._attempts: dict[str, deque[datetime]] = {}
        self._lock = threading.Lock()

    def allow(self, ip: str | None, now: datetime) -> bool:
        """Count this attempt and say whether it may proceed."""
        key = ip or "unknown"
        with self._lock:
            attempts = self._attempts.setdefault(key, deque())
            while attempts and now - attempts[0] >= self.window:
                attempts.popleft()
            if len(attempts) >= self.max_attempts:
                return False
            attempts.append(now)
            if len(self._attempts) > 10_000:  # bound the memory a scan from many IPs can take
                self._prune(now)
            return True

    def _prune(self, now: datetime) -> None:
        for key in [k for k, v in self._attempts.items() if not v or now - v[-1] >= self.window]:
            del self._attempts[key]

    def reset(self) -> None:
        with self._lock:
            self._attempts.clear()


@dataclass(frozen=True)
class LoginResult:
    user: AppUser
    issued: IssuedSession


def email_digest(email: str) -> str:
    """SHA-256 of the lowercased address: failed attempts must not become an address list."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def _is_locked(user: AppUser, now: datetime) -> bool:
    return user.locked_until is not None and as_utc(user.locked_until) > now


def login(
    db: Session,
    settings: Settings,
    throttle: LoginThrottle | None,
    *,
    username: str,
    password: str,
    ip_address: str | None,
    user_agent: str | None,
    now: datetime | None = None,
) -> LoginResult:
    """Verify credentials and open a session, or raise the generic failure.

    Commits in both outcomes (the success also persists the session and the reset counters).
    """
    now = now or utcnow()
    identity = get_identity_provider(settings).authenticate(
        Credentials(email=username, password=password)
    )
    digest = email_digest(identity.email)
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="auth.login")

    with audit_context(db, context):
        if throttle is not None and not throttle.allow(ip_address, now):
            record_event(
                db,
                AuthEventType.LOGIN_FAILED,
                email_attempted_hash=digest,
                ip_address=ip_address,
                user_agent=user_agent,
                detail="ip_throttled",
                now=now,
            )
            db.commit()
            raise TooManyAttempts(
                "Demasiados intentos de inicio de sesión desde esta dirección. "
                "Espere unos minutos e intente de nuevo.",
                details={"retry_after_seconds": int(THROTTLE_WINDOW.total_seconds())},
            )

        user = db.scalar(select(AppUser).where(func.lower(AppUser.email) == identity.email))
        # Always run Argon2, also for unknown or blocked accounts, so timing gives nothing away.
        valid, upgraded_hash = verify_password(password, user.password_hash if user else None)

        reason = _failure_reason(settings, user, valid, now)
        if reason is not None:
            _register_failure(db, settings, user, reason, digest, ip_address, user_agent, now)
            db.commit()
            raise InvalidCredentials(INVALID_CREDENTIALS_MESSAGE)

        assert user is not None
        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = now
        if upgraded_hash:
            user.password_hash = upgraded_hash  # Argon2 parameters were raised (needs_rehash)
        issued = issue_session(
            db, settings, user.id, ip_address=ip_address, user_agent=user_agent, now=now
        )
        record_event(
            db,
            AuthEventType.LOGIN_OK,
            user_id=user.id,
            email_attempted_hash=digest,
            ip_address=ip_address,
            user_agent=user_agent,
            now=now,
        )
        db.commit()
        return LoginResult(user=user, issued=issued)


def _failure_reason(
    settings: Settings, user: AppUser | None, valid: bool, now: datetime
) -> str | None:
    if user is None:
        return "unknown_email"
    if not user.is_active:
        return "inactive"
    if user.is_synthetic and settings.app_env == "production":
        return "synthetic_in_production"
    if _is_locked(user, now):
        return "account_locked"
    if not valid:
        return "bad_password"
    return None


def _register_failure(
    db: Session,
    settings: Settings,
    user: AppUser | None,
    reason: str,
    digest: str,
    ip_address: str | None,
    user_agent: str | None,
    now: datetime,
) -> None:
    record_event(
        db,
        AuthEventType.LOGIN_FAILED,
        user_id=user.id if user else None,
        email_attempted_hash=digest,
        ip_address=ip_address,
        user_agent=user_agent,
        detail=reason,
        now=now,
    )
    if reason == "bad_password" and user is not None:
        _count_failure(db, settings, user, ip_address, user_agent, now)


def _count_failure(
    db: Session,
    settings: Settings,
    user: AppUser,
    ip_address: str | None,
    user_agent: str | None,
    now: datetime,
) -> None:
    """One more wrong password; the one that reaches the limit locks the account."""
    user.failed_login_count = (user.failed_login_count or 0) + 1
    if user.failed_login_count >= settings.login_max_failed_attempts:
        user.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
        user.failed_login_count = 0
        record_event(
            db,
            AuthEventType.LOCKED,
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            detail=f"locked_{settings.login_lock_minutes}_minutes",
            now=now,
        )


def change_password(
    db: Session,
    settings: Settings,
    user_id: uuid.UUID,
    *,
    current_password: str,
    new_password: str,
    ip_address: str | None,
    user_agent: str | None,
    now: datetime | None = None,
) -> LoginResult:
    """Replace the caller's password and rotate their sessions (RF-039, decision D2).

    Every session of the user is revoked, the one in use included, and a fresh one is issued
    for this device: a stolen cookie dies with the old password, and the person who just
    replaced a temporary password is not sent back to the login screen.
    """
    now = now or utcnow()
    user = db.get(AppUser, user_id)
    if user is None or not user.is_active:
        raise AuthenticationRequired("Su cuenta no está disponible.")
    context = AuditContext(
        origin=AuditOrigin.MANUAL, user_id=user.id, reason="Cambio de contraseña"
    )

    with audit_context(db, context):
        valid, _ = verify_password(current_password, user.password_hash)
        if not valid:
            # A stolen session must not be a free oracle for the current password.
            _count_failure(db, settings, user, ip_address, user_agent, now)
            record_event(
                db,
                AuthEventType.LOGIN_FAILED,
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                detail="bad_current_password",
                now=now,
            )
            db.commit()
            raise CurrentPasswordIncorrect("La contraseña actual no es correcta.")
        validate_password(new_password, email=user.email)
        if new_password == current_password:
            raise ValidationFailed(
                "La contraseña nueva debe ser distinta de la actual.", code="password_unchanged"
            )

        user.password_hash = hash_password(new_password, email=user.email)
        user.must_change_password = False
        user.failed_login_count = 0
        revoke_user_sessions(db, user.id, RevokeReason.PASSWORD_CHANGED, now=now)
        issued = issue_session(
            db, settings, user.id, ip_address=ip_address, user_agent=user_agent, now=now
        )
        record_event(
            db,
            AuthEventType.PASSWORD_CHANGED,
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            now=now,
        )
        db.commit()
        return LoginResult(user=user, issued=issued)
