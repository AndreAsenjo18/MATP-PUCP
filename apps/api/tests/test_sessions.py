"""Server-side sessions: issue, resolve, expire and revoke (ADR-009 D1; RNF-012, RF-039)."""

from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AuthenticationRequired
from app.core.models_base import utcnow
from app.models import AppUser
from app.modules.users.models import AuthEvent, AuthEventType, UserSession
from app.modules.users.sessions import (
    HEARTBEAT_INTERVAL,
    RevokeReason,
    SessionExpired,
    SessionRevoked,
    as_utc,
    csrf_matches,
    csrf_token_for,
    hash_token,
    issue_session,
    resolve_session,
    revoke_session,
    revoke_user_sessions,
)


@pytest.fixture
def user(users: dict[str, AppUser]) -> AppUser:
    return users["CATALOGUER"]


def _events(session: Session, event: AuthEventType) -> list[AuthEvent]:
    return list(session.scalars(select(AuthEvent).where(AuthEvent.event == event)))


def test_only_the_digest_of_the_token_is_stored(
    session: Session, settings: Settings, user: AppUser
) -> None:
    issued = issue_session(session, settings, user.id, ip_address="10.0.0.5", user_agent="pytest")
    session.commit()

    row = session.scalars(select(UserSession)).one()
    assert row.token_hash == hash_token(issued.token) and len(row.token_hash) == 64
    stored = " ".join(str(getattr(row, column.key)) for column in UserSession.__table__.columns)
    assert issued.token not in stored and issued.csrf_token not in stored
    assert row.ip_address == "10.0.0.5" and row.user_agent == "pytest"


def test_tokens_are_long_and_never_repeat(
    session: Session, settings: Settings, user: AppUser
) -> None:
    tokens = {issue_session(session, settings, user.id).token for _ in range(20)}
    assert len(tokens) == 20
    assert all(len(token) >= 43 for token in tokens)  # 256 bits in url-safe base64


def test_absolute_expiry_is_fixed_when_the_session_is_issued(
    session: Session, settings: Settings, user: AppUser
) -> None:
    now = utcnow()
    issued = issue_session(session, settings, user.id, now=now)
    assert issued.expires_at == now + timedelta(hours=settings.session_max_hours)


def test_a_live_session_resolves_to_its_row(
    session: Session, settings: Settings, user: AppUser
) -> None:
    issued = issue_session(session, settings, user.id)
    session.commit()
    assert resolve_session(session, settings, issued.token).user_id == user.id


def test_an_unknown_token_is_not_authenticated(session: Session, settings: Settings) -> None:
    with pytest.raises(AuthenticationRequired) as caught:
        resolve_session(session, settings, "no-existe")
    assert caught.value.code == "authentication_required"


def test_idle_session_expires_and_is_closed_for_good(
    session: Session, settings: Settings, user: AppUser
) -> None:
    start = utcnow()
    issued = issue_session(session, settings, user.id, now=start)
    session.commit()

    later = start + timedelta(minutes=settings.session_idle_minutes, seconds=1)
    with pytest.raises(SessionExpired) as caught:
        resolve_session(session, settings, issued.token, now=later)
    assert caught.value.code == "session_expired"

    session.rollback()  # the request failed, yet the revocation must have been committed
    row = session.scalars(select(UserSession)).one()
    assert row.revoked_at is not None and row.revoked_reason == RevokeReason.IDLE_TIMEOUT
    assert [event.detail for event in _events(session, AuthEventType.SESSION_REVOKED)] == [
        "idle_timeout"
    ]
    with pytest.raises(SessionRevoked):
        resolve_session(session, settings, issued.token, now=later)


def test_activity_keeps_the_session_alive_until_the_absolute_limit(
    session: Session, settings: Settings, user: AppUser
) -> None:
    start = utcnow()
    issued = issue_session(session, settings, user.id, now=start)
    session.commit()
    step = timedelta(minutes=settings.session_idle_minutes - 1)
    limit = start + timedelta(hours=settings.session_max_hours)

    moment = start
    while moment + step < limit:
        moment += step
        resolve_session(session, settings, issued.token, now=moment)  # never idle

    with pytest.raises(SessionExpired) as caught:
        resolve_session(session, settings, issued.token, now=limit)
    assert "duración máxima" in caught.value.message
    session.rollback()
    assert session.scalars(select(UserSession)).one().revoked_reason == RevokeReason.MAX_LIFETIME


def test_heartbeat_moves_at_most_once_a_minute(
    session: Session, settings: Settings, user: AppUser
) -> None:
    start = utcnow()
    issued = issue_session(session, settings, user.id, now=start)
    session.commit()

    resolve_session(session, settings, issued.token, now=start + timedelta(seconds=30))
    assert as_utc(session.scalars(select(UserSession)).one().last_seen_at) == start

    touched = start + HEARTBEAT_INTERVAL
    resolve_session(session, settings, issued.token, now=touched)
    assert as_utc(session.scalars(select(UserSession)).one().last_seen_at) == touched


def test_logout_revokes_one_session_and_records_the_event(
    session: Session, settings: Settings, user: AppUser
) -> None:
    kept = issue_session(session, settings, user.id)
    closed = issue_session(session, settings, user.id)
    session.commit()

    revoke_session(session, closed.session, RevokeReason.LOGOUT)
    session.commit()

    with pytest.raises(SessionRevoked):
        resolve_session(session, settings, closed.token)
    assert resolve_session(session, settings, kept.token).user_id == user.id
    assert [event.user_id for event in _events(session, AuthEventType.LOGOUT)] == [user.id]


def test_revoke_user_sessions_closes_every_live_session(
    session: Session, settings: Settings, users: dict[str, AppUser]
) -> None:
    mine = [issue_session(session, settings, users["CATALOGUER"].id) for _ in range(3)]
    other = issue_session(session, settings, users["ADMIN"].id)
    session.commit()

    closed = revoke_user_sessions(session, users["CATALOGUER"].id, RevokeReason.USER_DEACTIVATED)
    session.commit()

    assert closed == 3
    for issued in mine:
        with pytest.raises(SessionRevoked):
            resolve_session(session, settings, issued.token)
    assert resolve_session(session, settings, other.token).user_id == users["ADMIN"].id
    assert revoke_user_sessions(session, users["CATALOGUER"].id, RevokeReason.ROLES_CHANGED) == 0


def test_revoke_user_sessions_can_spare_the_current_one(
    session: Session, settings: Settings, user: AppUser
) -> None:
    current = issue_session(session, settings, user.id)
    elsewhere = issue_session(session, settings, user.id)
    session.commit()

    closed = revoke_user_sessions(
        session,
        user.id,
        RevokeReason.PASSWORD_CHANGED,
        except_session_id=current.session.id,
    )
    session.commit()

    assert closed == 1
    assert resolve_session(session, settings, current.token).user_id == user.id
    with pytest.raises(SessionRevoked):
        resolve_session(session, settings, elsewhere.token)


def test_csrf_token_is_bound_to_its_session() -> None:
    first, second = "token-uno", "token-dos"
    assert csrf_token_for(first) == csrf_token_for(first)
    assert csrf_token_for(first) != csrf_token_for(second)
    assert csrf_matches(first, csrf_token_for(first))
    assert not csrf_matches(first, csrf_token_for(second))
    assert not csrf_matches(first, None) and not csrf_matches(first, "")
