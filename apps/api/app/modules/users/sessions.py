"""Server-side sessions: issue, resolve, expire and revoke (ADR-009, decision D1; RNF-012/013).

A session is an opaque 256-bit token held by the browser in an ``HttpOnly`` cookie. The database
only keeps its SHA-256 digest (``user_session.token_hash``), so a dump of the table cannot be
replayed as a cookie. A session dies in one of four ways, all recorded in ``revoked_reason``:

- explicit logout;
- idle timeout (``SESSION_IDLE_MINUTES``) or absolute lifetime (``SESSION_MAX_HOURS``);
- mass revocation when the user is deactivated or changes password or roles (RF-039).

Sessions are revoked, never deleted (RN-005). Functions that revoke on behalf of an operation
(``revoke_user_sessions``) leave the commit to the caller so the revocation lands in the same
transaction as the change that required it; the ones that run while *rejecting* a request
(an expired session) commit on their own because the request is about to fail and the session
would otherwise be rolled back.
"""

import enum
import hashlib
import hmac
import secrets
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.core.config import Settings
from app.core.errors import AuthenticationRequired
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import AuditContext, audit_context, get_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.models import AuthEvent, AuthEventType, UserSession

SESSION_COOKIE = "matp_session"
CSRF_COOKIE = "matp_csrf"
CSRF_HEADER = "X-CSRF-Token"

# `last_seen_at` moves at most once a minute, so reads do not turn into writes (design D1).
HEARTBEAT_INTERVAL = timedelta(minutes=1)

AUTH_ACTOR = "auth"


class RevokeReason(enum.StrEnum):
    LOGOUT = "logout"
    IDLE_TIMEOUT = "idle_timeout"
    MAX_LIFETIME = "max_lifetime"
    USER_DEACTIVATED = "user_deactivated"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET = "password_reset"
    ROLES_CHANGED = "roles_changed"


class SessionExpired(AuthenticationRequired):
    """The session outlived its idle or absolute limit; the client keeps the form and logs in."""

    code = "session_expired"


class SessionRevoked(AuthenticationRequired):
    """The session was closed on the server side (logout, deactivation, password change...)."""

    code = "session_revoked"


@dataclass(frozen=True)
class IssuedSession:
    """What the login response needs: the secrets exist only here, once, in memory."""

    token: str
    csrf_token: str
    session: UserSession

    @property
    def expires_at(self) -> datetime:
        return as_utc(self.session.expires_at)


def as_utc(value: datetime) -> datetime:
    """SQLite hands timezone-aware columns back naive; every stored instant is UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def csrf_token_for(session_token: str) -> str:
    """Anti-forgery token bound to the session (ADR-009, decision D4).

    It is derived from the session token instead of drawn at random, so the server can tell
    whether the value a request sends is the one issued for *this* session without storing it,
    and a token from another session (or one a sibling domain planted as a cookie) never matches.
    The derivation is one-way: the digest kept in the database cannot produce it.
    """
    return hashlib.sha256(b"matp-csrf:" + session_token.encode("utf-8")).hexdigest()


def csrf_matches(session_token: str, candidate: str | None) -> bool:
    """Constant-time comparison of a submitted CSRF value with the one for this session."""
    if not candidate:
        return False
    return hmac.compare_digest(csrf_token_for(session_token), candidate)


@contextmanager
def _auth_context(db: Session) -> Iterator[None]:
    """Writes need an audit context; keep the caller's, or act as the ``auth`` process."""
    if get_audit_context(db) is not None:
        yield
        return
    with audit_context(db, AuditContext(origin=AuditOrigin.SYSTEM, actor_label=AUTH_ACTOR)):
        yield


def record_event(
    db: Session,
    event: AuthEventType,
    *,
    user_id: uuid.UUID | None = None,
    email_attempted_hash: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    detail: str | None = None,
    now: datetime | None = None,
) -> AuthEvent:
    """Append an authentication event. It never receives a password (RNF-013)."""
    row = AuthEvent(
        id=new_uuid(),
        occurred_at=now or utcnow(),
        event=event,
        user_id=user_id,
        email_attempted_hash=email_attempted_hash,
        ip_address=_clip(ip_address, 45),
        user_agent=_clip(user_agent, 300),
        detail=_clip(detail, 120),
    )
    db.add(row)
    return row


def _clip(value: str | None, length: int) -> str | None:
    return value[:length] if value else value


def issue_session(
    db: Session,
    settings: Settings,
    user_id: uuid.UUID,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> IssuedSession:
    """Create a session for a user whose credentials were already verified.

    Nothing is committed: the login flow stores the session, the ``LOGIN_OK`` event and the
    reset failure counter together.
    """
    now = now or utcnow()
    token = secrets.token_urlsafe(32)  # 256 bits of entropy
    row = UserSession(
        id=new_uuid(),
        user_id=user_id,
        token_hash=hash_token(token),
        last_seen_at=now,
        expires_at=now + timedelta(minutes=settings.session_max_minutes),
        ip_address=_clip(ip_address, 45),
        user_agent=_clip(user_agent, 300),
    )
    with _auth_context(db):
        db.add(row)
        db.flush()
    return IssuedSession(token=token, csrf_token=csrf_token_for(token), session=row)


def set_session_cookies(response: Response, settings: Settings, issued: IssuedSession) -> None:
    """Hand the browser its session and CSRF cookies (ADR-009, decisions D1 and D4).

    The session cookie is ``HttpOnly`` so scripts never see the token; the CSRF cookie is the
    opposite on purpose, because the web client must read it to echo it in ``X-CSRF-Token``.
    ``Secure`` follows ``COOKIE_SECURE`` (only local development may turn it off).
    """
    max_age = settings.session_max_minutes * 60
    common = {"max_age": max_age, "path": "/", "secure": settings.cookie_secure, "samesite": "lax"}
    response.set_cookie(SESSION_COOKIE, issued.token, httponly=True, **common)  # type: ignore[arg-type]
    response.set_cookie(CSRF_COOKIE, issued.csrf_token, httponly=False, **common)  # type: ignore[arg-type]


def clear_session_cookies(response: Response, settings: Settings) -> None:
    for name, http_only in ((SESSION_COOKIE, True), (CSRF_COOKIE, False)):
        response.delete_cookie(
            name, path="/", secure=settings.cookie_secure, httponly=http_only, samesite="lax"
        )


def find_session(db: Session, token: str) -> UserSession | None:
    return db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))


def resolve_session(
    db: Session, settings: Settings, token: str, *, now: datetime | None = None
) -> UserSession:
    """Return the live session for a cookie token, or raise the right 401.

    Unknown token -> ``authentication_required``; revoked -> ``session_revoked``; past its idle
    or absolute limit -> ``session_expired`` (and the session is closed for good). A live
    session has its heartbeat refreshed, at most once a minute.
    """
    now = now or utcnow()
    row = find_session(db, token)
    if row is None:
        raise AuthenticationRequired("Debe iniciar sesión para acceder al sistema (uso interno).")
    if row.revoked_at is not None:
        raise SessionRevoked("Su sesión fue cerrada. Inicie sesión nuevamente.")

    idle_limit = as_utc(row.last_seen_at) + timedelta(minutes=settings.session_idle_minutes)
    if now >= as_utc(row.expires_at):
        _expire(db, row, RevokeReason.MAX_LIFETIME, now)
        raise SessionExpired("Su sesión superó la duración máxima. Inicie sesión nuevamente.")
    if now >= idle_limit:
        _expire(db, row, RevokeReason.IDLE_TIMEOUT, now)
        raise SessionExpired("Su sesión expiró por inactividad. Inicie sesión nuevamente.")

    if now - as_utc(row.last_seen_at) >= HEARTBEAT_INTERVAL:
        with _auth_context(db):
            row.last_seen_at = now
            db.commit()
    return row


def _expire(db: Session, row: UserSession, reason: RevokeReason, now: datetime) -> None:
    """Close an expired session and commit: the request that found it is about to fail."""
    with _auth_context(db):
        _revoke(db, row, reason, now)
        db.commit()


def _revoke(db: Session, row: UserSession, reason: RevokeReason, now: datetime) -> None:
    row.revoked_at = now
    row.revoked_reason = reason.value
    record_event(
        db,
        AuthEventType.LOGOUT if reason is RevokeReason.LOGOUT else AuthEventType.SESSION_REVOKED,
        user_id=row.user_id,
        ip_address=row.ip_address,
        user_agent=row.user_agent,
        detail=reason.value,
        now=now,
    )


def revoke_session(
    db: Session, row: UserSession, reason: RevokeReason, *, now: datetime | None = None
) -> None:
    """Revoke one session (logout). The caller commits."""
    if row.revoked_at is not None:
        return
    with _auth_context(db):
        _revoke(db, row, reason, now or utcnow())
        db.flush()


def revoke_user_sessions(
    db: Session,
    user_id: uuid.UUID,
    reason: RevokeReason,
    *,
    except_session_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> int:
    """Revoke every live session of a user at once (RF-039); returns how many were closed.

    ``except_session_id`` lets a user who changes their own password stay signed in on the
    device they used. Rows are loaded and updated one by one, not with a bulk ``UPDATE``,
    because each revocation must be audited. The caller commits.
    """
    now = now or utcnow()
    live = db.scalars(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    ).all()
    closed = 0
    with _auth_context(db):
        for row in live:
            if row.id == except_session_id:
                continue
            _revoke(db, row, reason, now)
            closed += 1
        if closed:
            db.flush()
    return closed
