"""Spec usuarios-roles — Protección contra falsificación de peticiones (task 2.4; ADR-009 D4)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.models import Collection
from app.modules.users.sessions import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE
from tests.api.conftest import SeededApi, create_user, login_client

COLLECTIONS = "/api/v1/collections"
LOGIN = "/api/v1/auth/login"
PASSWORD = "contrasena-de-prueba-2026"


def _cookie_only(seeded_api: SeededApi, role: str = "COLLECTIONS_MANAGER") -> TestClient:
    """A signed-in browser that does NOT add the CSRF header by itself, like a forged request."""
    client = login_client(seeded_api.app, seeded_api.engine, role)
    client.headers.pop(CSRF_HEADER)
    return client


def _collection_count(seeded_api: SeededApi) -> int:
    with seeded_api.session() as db:
        return db.scalar(select(func.count()).select_from(Collection)) or 0


def _create(client: TestClient, name: str, **kwargs: object):  # type: ignore[no-untyped-def]
    return client.post(COLLECTIONS, json={"name": name}, **kwargs)  # type: ignore[arg-type]


def test_a_write_without_the_token_header_is_rejected_and_changes_nothing(
    seeded_api: SeededApi,
) -> None:
    client = _cookie_only(seeded_api)
    before = _collection_count(seeded_api)

    response = _create(client, "Colección forjada (sintética)")

    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "csrf_failed" and body["details"] == {}
    assert _collection_count(seeded_api) == before


def test_a_different_token_is_rejected(seeded_api: SeededApi) -> None:
    client = _cookie_only(seeded_api)
    response = _create(client, "Colección forjada 2 (sintética)", headers={CSRF_HEADER: "otro"})
    assert response.status_code == 403 and response.json()["code"] == "csrf_failed"


def test_the_token_of_another_session_is_rejected(seeded_api: SeededApi) -> None:
    attacker = login_client(seeded_api.app, seeded_api.engine, "INTERNAL_VIEWER")
    victim = _cookie_only(seeded_api)
    foreign = attacker.cookies.get(CSRF_COOKIE)
    assert foreign
    victim.cookies.set(CSRF_COOKIE, foreign)  # even planted as a cookie, it is not this session's

    response = _create(victim, "Colección forjada 3 (sintética)", headers={CSRF_HEADER: foreign})

    assert response.status_code == 403


def test_the_header_must_also_match_the_csrf_cookie(seeded_api: SeededApi) -> None:
    client = login_client(seeded_api.app, seeded_api.engine, "COLLECTIONS_MANAGER")
    right_header = client.headers[CSRF_HEADER]
    client.cookies.delete(CSRF_COOKIE)  # double submit: the cookie half is missing
    response = _create(client, "Colección sin cookie csrf (sintética)")
    assert right_header and response.status_code == 403


def test_the_right_token_lets_the_write_through(seeded_api: SeededApi) -> None:
    client = login_client(seeded_api.app, seeded_api.engine, "COLLECTIONS_MANAGER")
    response = _create(client, "Colección legítima (sintética)")
    assert response.status_code == 201, response.text


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_every_unsafe_method_is_checked(seeded_api: SeededApi, method: str) -> None:
    client = _cookie_only(seeded_api)
    response = client.request(
        method.upper(), f"{COLLECTIONS}/01920000-0000-7000-8000-000000000999", json={}
    )
    assert response.status_code == 403 and response.json()["code"] == "csrf_failed"


def test_reading_does_not_need_the_token(seeded_api: SeededApi) -> None:
    assert _cookie_only(seeded_api).get(COLLECTIONS).status_code == 200


def test_without_a_session_cookie_there_is_nothing_to_forge(seeded_api: SeededApi) -> None:
    """No ambient credential: the request is simply unauthenticated, not a CSRF failure."""
    anonymous = TestClient(seeded_api.app, base_url="https://testserver")
    response = _create(anonymous, "Colección anónima (sintética)")
    assert response.status_code == 401 and response.json()["code"] == "authentication_required"


def test_login_is_exempt_even_with_a_stale_session_cookie(seeded_api: SeededApi) -> None:
    user = create_user(seeded_api.engine, "csrf.login.vencida@matp.local")
    browser = TestClient(seeded_api.app, base_url="https://testserver")
    browser.cookies.set(SESSION_COOKIE, "cookie-vieja-de-otra-sesion")
    browser.cookies.set(CSRF_COOKIE, "token-viejo")

    response = browser.post(LOGIN, json={"username": user.email, "password": PASSWORD})

    assert response.status_code == 200


def test_the_rejection_carries_cors_headers_for_the_web_origin(seeded_api: SeededApi) -> None:
    client = _cookie_only(seeded_api)
    response = _create(
        client, "Colección forjada 4 (sintética)", headers={"Origin": "http://localhost:3000"}
    )
    assert response.status_code == 403
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"
