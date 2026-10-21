"""Spec usuarios-roles — Sesiones de servidor revocables, tal como las ve la API (ADR-009 D1)."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.models_base import utcnow
from app.models import AppUser
from app.modules.users.models import UserSession
from app.modules.users.sessions import SESSION_COOKIE, hash_token
from tests.api.conftest import SeededApi, create_user, login_client

ME = "/api/v1/auth/me"
PIECES = "/api/v1/pieces"


def _age_session(seeded_api: SeededApi, client: TestClient, **shift: timedelta) -> None:
    """Pretend the session was last used (or created) earlier."""
    token = client.cookies.get(SESSION_COOKIE)
    assert token
    with seeded_api.system_session() as db:
        row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
        assert row is not None
        if "idle" in shift:
            row.last_seen_at = utcnow() - shift["idle"]
        if "lifetime" in shift:
            row.expires_at = utcnow() - shift["lifetime"]
        db.commit()


def test_cookie_session_identifies_the_user(login_as) -> None:  # type: ignore[no-untyped-def]
    body = login_as("CATALOGUER").get(ME).json()
    assert body["roles"] == ["CATALOGUER"]
    assert "pieces.update" in body["permissions"]
    assert body["auth_mode"] == "session"


def test_forged_cookie_is_not_authenticated(seeded_api: SeededApi) -> None:
    client = TestClient(seeded_api.app, base_url="https://testserver")
    client.cookies.set(SESSION_COOKIE, "token-inventado-que-no-existe")
    response = client.get(PIECES)
    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"


def test_idle_session_answers_session_expired(seeded_api: SeededApi) -> None:
    client = login_client(seeded_api.app, seeded_api.engine, "CATALOGUER")
    assert client.get(PIECES).status_code == 200

    _age_session(seeded_api, client, idle=timedelta(minutes=31))
    response = client.get(PIECES)

    assert response.status_code == 401
    assert response.json()["code"] == "session_expired"
    again = client.get(PIECES)  # closed for good, not "unknown"
    assert again.status_code == 401 and again.json()["code"] == "session_revoked"


def test_session_past_its_absolute_lifetime_is_expired(seeded_api: SeededApi) -> None:
    client = login_client(seeded_api.app, seeded_api.engine, "CATALOGUER")
    _age_session(seeded_api, client, lifetime=timedelta(seconds=1))
    response = client.get(PIECES)
    assert response.status_code == 401 and response.json()["code"] == "session_expired"


def test_deactivated_user_loses_a_session_that_was_still_valid(seeded_api: SeededApi) -> None:
    user = create_user(seeded_api.engine, "baja.sesion@matp.local")
    client = login_client(seeded_api.app, seeded_api.engine, user.email)
    assert client.get(PIECES).status_code == 200

    with seeded_api.system_session() as db:
        target = db.get(AppUser, user.id)
        assert target is not None
        target.is_active = False
        db.commit()

    response = client.get(PIECES)
    assert response.status_code == 401
    assert response.json()["code"] == "session_revoked"


def test_temporary_password_only_reaches_me(seeded_api: SeededApi) -> None:
    user = create_user(seeded_api.engine, "primer.ingreso@matp.local", must_change_password=True)
    client = login_client(seeded_api.app, seeded_api.engine, user.email)

    me = client.get(ME)
    assert me.status_code == 200 and me.json()["must_change_password"] is True

    blocked = client.get(PIECES)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"
