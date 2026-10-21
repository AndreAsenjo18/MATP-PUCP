"""Spec usuarios-roles — inicio y cierre de sesión, bloqueo, primer ingreso (task 2.3; ADR-009).

Each test that touches failure counters or locks owns its user: the seeded database is shared by
the whole test session, so state on a seeded user would leak into unrelated tests.
"""

import logging
from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import func, select

from app.core.models_base import utcnow
from app.main import create_app
from app.models import AppUser
from app.modules.users.models import AuthEvent, AuthEventType, UserSession
from app.modules.users.passwords import needs_rehash
from app.modules.users.sessions import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, as_utc
from tests.api.conftest import SeededApi, api_settings, create_user

LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
CHANGE = "/api/v1/auth/change-password"
PIECES = "/api/v1/pieces"
PASSWORD = "contrasena-de-prueba-2026"
BASE_URL = "https://testserver"


@pytest.fixture(scope="module")
def app(seeded_api: SeededApi) -> Iterator[FastAPI]:
    application = create_app(api_settings(), health_checks={}, engine=seeded_api.engine)
    with TestClient(application):
        yield application


@pytest.fixture(autouse=True)
def fresh_throttle(app: FastAPI) -> None:
    """The per-IP limiter is process memory shared by every test in the module."""
    app.state.login_throttle.reset()


@pytest.fixture
def browser(app: FastAPI) -> TestClient:
    """A client with an empty cookie jar, speaking https like the real site."""
    return TestClient(app, base_url=BASE_URL)


def _login(client: TestClient, username: str, password: str = PASSWORD):  # type: ignore[no-untyped-def]
    return client.post(LOGIN, json={"username": username, "password": password})


def _post(client: TestClient, path: str, **kwargs: object):  # type: ignore[no-untyped-def]
    """A write the way the web client sends it: echoing the CSRF cookie in the header."""
    headers = {CSRF_HEADER: client.cookies.get(CSRF_COOKIE) or ""}
    return client.post(path, headers=headers, **kwargs)  # type: ignore[arg-type]


def _events(seeded_api: SeededApi, event: AuthEventType, **filters: object) -> list[AuthEvent]:
    with seeded_api.session() as db:
        query = select(AuthEvent).where(AuthEvent.event == event)
        for column, value in filters.items():
            query = query.where(getattr(AuthEvent, column) == value)
        return list(db.scalars(query.order_by(AuthEvent.occurred_at)))


def _user(seeded_api: SeededApi, email: str) -> AppUser:
    with seeded_api.session() as db:
        user = db.scalar(select(AppUser).where(AppUser.email == email))
        assert user is not None
        db.expunge(user)
        return user


# ---------------------------------------------------------------------------------- login
def test_login_opens_a_session_and_sets_both_cookies(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(seeded_api.engine, "ingreso.ok@matp.local")

    response = _login(browser, user.email)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == user.email and body["roles"] == ["CATALOGUER"]
    assert body["auth_mode"] == "session" and body["must_change_password"] is False
    assert "pieces.update" in body["permissions"]
    session_cookie = browser.cookies.get(SESSION_COOKIE)
    assert session_cookie and session_cookie not in response.text  # the token is cookie-only
    assert body["csrf_token"] == browser.cookies.get(CSRF_COOKIE)

    headers = {line.split("=", 1)[0]: line for line in response.headers.get_list("set-cookie")}
    session_line = headers[SESSION_COOKIE].lower()
    assert (
        "httponly" in session_line and "secure" in session_line and "samesite=lax" in session_line
    )
    csrf_line = headers[CSRF_COOKIE].lower()
    assert "httponly" not in csrf_line and "secure" in csrf_line  # scripts must read the CSRF one

    assert browser.get(ME).json()["email"] == user.email
    assert browser.get(PIECES).status_code == 200
    assert _user(seeded_api, user.email).last_login_at is not None
    assert [e.user_id for e in _events(seeded_api, AuthEventType.LOGIN_OK, user_id=user.id)] == [
        user.id
    ]


def test_the_database_keeps_only_a_digest_of_the_cookie(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(seeded_api.engine, "huella@matp.local")
    _login(browser, user.email)
    token = browser.cookies.get(SESSION_COOKIE)
    assert token
    with seeded_api.session() as db:
        stored = db.scalars(select(UserSession.token_hash).where(UserSession.user_id == user.id))
        hashes = list(stored)
    assert len(hashes) == 1 and hashes[0] != token and token not in hashes[0]


def test_the_e_mail_is_matched_ignoring_case(seeded_api: SeededApi, browser: TestClient) -> None:
    create_user(seeded_api.engine, "Mayusculas.Mixtas@matp.local")
    assert _login(browser, "MAYUSCULAS.mixtas@MATP.local").status_code == 200


def test_every_kind_of_failure_gets_the_same_answer(seeded_api: SeededApi, app: FastAPI) -> None:
    """Spec: correo inexistente, contraseña incorrecta, cuenta inactiva y cuenta bloqueada."""
    active = create_user(seeded_api.engine, "falla.activa@matp.local")
    inactive = create_user(seeded_api.engine, "falla.inactiva@matp.local", is_active=False)
    answers = {
        "unknown": _login(TestClient(app, base_url=BASE_URL), "nadie@matp.local"),
        "wrong password": _login(
            TestClient(app, base_url=BASE_URL), active.email, "otra-clave-12345"
        ),
        "inactive": _login(TestClient(app, base_url=BASE_URL), inactive.email),
    }
    assert {r.status_code for r in answers.values()} == {401}
    assert len({r.text for r in answers.values()}) == 1, "las respuestas deben ser idénticas"
    body = next(iter(answers.values())).json()
    assert body["code"] == "invalid_credentials" and "incorrectos" in body["message"]
    assert all(SESSION_COOKIE not in r.headers.get("set-cookie", "") for r in answers.values())


def test_the_real_reason_of_a_failure_stays_in_the_ledger(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(seeded_api.engine, "motivo.real@matp.local")
    _login(browser, user.email, "otra-clave-12345")
    _login(browser, "no.existe@matp.local")

    mine = _events(seeded_api, AuthEventType.LOGIN_FAILED, user_id=user.id)
    assert [e.detail for e in mine] == ["bad_password"]
    unknown = [
        e
        for e in _events(seeded_api, AuthEventType.LOGIN_FAILED)
        if e.detail == "unknown_email" and e.user_id is None
    ]
    assert unknown and all(
        e.email_attempted_hash and len(e.email_attempted_hash) == 64 for e in unknown
    )


def test_fifth_consecutive_failure_locks_the_account_for_fifteen_minutes(
    seeded_api: SeededApi, app: FastAPI
) -> None:
    user = create_user(seeded_api.engine, "bloqueo.cinco@matp.local")
    for attempt in range(4):
        r = _login(TestClient(app, base_url=BASE_URL), user.email, f"incorrecta-{attempt}-xyz")
        assert r.status_code == 401
    assert _events(seeded_api, AuthEventType.LOCKED, user_id=user.id) == []

    fifth = _login(TestClient(app, base_url=BASE_URL), user.email, "incorrecta-5-xyz")

    assert fifth.status_code == 401
    locked = _events(seeded_api, AuthEventType.LOCKED, user_id=user.id)
    assert len(locked) == 1
    until = as_utc(_user(seeded_api, user.email).locked_until)  # type: ignore[arg-type]
    assert timedelta(minutes=14) < until - utcnow() <= timedelta(minutes=15)


def test_the_right_password_during_the_lock_is_refused_and_opens_no_session(
    seeded_api: SeededApi, app: FastAPI
) -> None:
    user = create_user(seeded_api.engine, "bloqueo.correcta@matp.local")
    for attempt in range(5):
        _login(TestClient(app, base_url=BASE_URL), user.email, f"incorrecta-{attempt}-xyz")

    client = TestClient(app, base_url=BASE_URL)
    response = _login(client, user.email, PASSWORD)

    assert response.status_code == 401 and response.json()["code"] == "invalid_credentials"
    assert SESSION_COOKIE not in client.cookies
    with seeded_api.session() as db:
        count = db.scalar(
            select(func.count()).select_from(UserSession).where(UserSession.user_id == user.id)
        )
    assert count == 0
    assert [e.detail for e in _events(seeded_api, AuthEventType.LOGIN_FAILED, user_id=user.id)][
        -1
    ] == "account_locked"


def test_the_account_opens_again_when_the_lock_expires(seeded_api: SeededApi, app: FastAPI) -> None:
    user = create_user(seeded_api.engine, "bloqueo.vence@matp.local")
    for attempt in range(5):
        _login(TestClient(app, base_url=BASE_URL), user.email, f"incorrecta-{attempt}-xyz")
    with seeded_api.system_session() as db:
        target = db.get(AppUser, user.id)
        assert target is not None
        target.locked_until = utcnow() - timedelta(seconds=1)
        db.commit()

    assert _login(TestClient(app, base_url=BASE_URL), user.email, PASSWORD).status_code == 200
    refreshed = _user(seeded_api, user.email)
    assert refreshed.failed_login_count == 0 and refreshed.locked_until is None


def test_a_good_login_resets_the_failure_counter(seeded_api: SeededApi, app: FastAPI) -> None:
    user = create_user(seeded_api.engine, "contador.reinicia@matp.local")
    for attempt in range(4):
        _login(TestClient(app, base_url=BASE_URL), user.email, f"incorrecta-{attempt}-xyz")
    assert _login(TestClient(app, base_url=BASE_URL), user.email).status_code == 200
    # Four more failures would lock only if the counter had not been reset.
    for attempt in range(4):
        _login(TestClient(app, base_url=BASE_URL), user.email, f"otra-{attempt}-xyz")
    assert _events(seeded_api, AuthEventType.LOCKED, user_id=user.id) == []


def test_ip_limiter_answers_429_after_twenty_attempts(app: FastAPI) -> None:
    client = TestClient(app, base_url=BASE_URL)
    for _ in range(20):
        assert _login(client, "nadie@matp.local").status_code == 401
    blocked = _login(client, "nadie@matp.local")
    assert blocked.status_code == 429 and blocked.json()["code"] == "too_many_attempts"


def test_synthetic_users_cannot_sign_in_in_production(seeded_api: SeededApi) -> None:
    synthetic = create_user(seeded_api.engine, "sintetico.prod@matp.local", is_synthetic=True)
    real = create_user(seeded_api.engine, "real.prod@matp.local")
    production = create_app(
        api_settings(app_env="production"), health_checks={}, engine=seeded_api.engine
    )
    # No `with`: outside APP_ENV=test the lifespan starts background workers that would share
    # this in-memory SQLite connection with the request thread.
    client = TestClient(production, base_url=BASE_URL)
    refused = _login(client, synthetic.email)
    allowed = _login(client, real.email)

    assert refused.status_code == 401 and refused.json()["code"] == "invalid_credentials"
    assert allowed.status_code == 200
    failed = _events(seeded_api, AuthEventType.LOGIN_FAILED, user_id=synthetic.id)
    assert [e.detail for e in failed] == ["synthetic_in_production"]


def test_an_outdated_password_hash_is_upgraded_at_login(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    weak = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=1024, parallelism=1),))
    user = create_user(seeded_api.engine, "rehash@matp.local", password=None)
    with seeded_api.system_session() as db:
        target = db.get(AppUser, user.id)
        assert target is not None
        target.password_hash = weak.hash(PASSWORD)
        db.commit()
    assert needs_rehash(_user(seeded_api, user.email).password_hash or "")

    assert _login(browser, user.email).status_code == 200

    assert not needs_rehash(_user(seeded_api, user.email).password_hash or "")


def test_no_password_reaches_the_logs_or_the_ledger(
    seeded_api: SeededApi, browser: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    secret = "frase-secreta-que-no-debe-aparecer-99"
    user = create_user(seeded_api.engine, "sin.rastro@matp.local")
    with caplog.at_level(logging.DEBUG):
        _login(browser, user.email, secret)
        _login(browser, "no.existe.rastro@matp.local", secret)
        _login(browser, user.email, PASSWORD)

    assert secret not in caplog.text and PASSWORD not in caplog.text
    with seeded_api.session() as db:
        rows = db.scalars(select(AuthEvent)).all()
        dump = " ".join(
            str(getattr(row, column.key)) for row in rows for column in AuthEvent.__table__.columns
        )
    assert secret not in dump and PASSWORD not in dump


# --------------------------------------------------------------------------------- logout
def test_logout_revokes_the_session_and_drops_the_cookies(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(seeded_api.engine, "salida@matp.local")
    _login(browser, user.email)
    stale = dict(browser.cookies)

    response = _post(browser, LOGOUT)

    assert response.status_code == 204
    cleared = " ".join(response.headers.get_list("set-cookie")).lower()
    assert SESSION_COOKIE in cleared and CSRF_COOKIE in cleared and "max-age=0" in cleared
    assert browser.cookies.get(SESSION_COOKIE) is None

    replay = TestClient(browser.app, base_url=BASE_URL)  # type: ignore[arg-type]
    for name, value in stale.items():
        replay.cookies.set(name, value)
    revoked = replay.get(PIECES)
    assert revoked.status_code == 401 and revoked.json()["code"] == "session_revoked"
    assert len(_events(seeded_api, AuthEventType.LOGOUT, user_id=user.id)) == 1


def test_logout_without_a_session_is_refused(browser: TestClient) -> None:
    assert browser.post(LOGOUT).status_code == 401


# --------------------------------------------------------------------- first login / change
def test_temporary_password_forces_a_change_before_anything_else(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(
        seeded_api.engine, "primer.ingreso.api@matp.local", must_change_password=True
    )

    signed_in = _login(browser, user.email)
    assert signed_in.status_code == 200 and signed_in.json()["must_change_password"] is True

    blocked = browser.get(PIECES)
    assert blocked.status_code == 403 and blocked.json()["code"] == "password_change_required"
    assert browser.get(ME).status_code == 200


def test_weak_new_password_is_rejected_with_every_problem(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(seeded_api.engine, "clave.debil@matp.local")
    _login(browser, user.email)

    response = _post(
        browser, CHANGE, json={"current_password": PASSWORD, "new_password": "museo2026"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "weak_password"
    assert "al menos 12 caracteres" in body["message"] and "demasiado común" in body["message"]


def test_wrong_current_password_changes_nothing(seeded_api: SeededApi, browser: TestClient) -> None:
    user = create_user(seeded_api.engine, "actual.mala@matp.local")
    _login(browser, user.email)

    response = _post(
        browser,
        CHANGE,
        json={
            "current_password": "no-es-la-actual-123",
            "new_password": "una frase larga y propia",
        },
    )

    assert response.status_code == 422 and response.json()["code"] == "current_password_incorrect"
    assert _login(TestClient(browser.app, base_url=BASE_URL), user.email).status_code == 200  # type: ignore[arg-type]


def test_changing_the_password_rotates_every_session(seeded_api: SeededApi, app: FastAPI) -> None:
    user = create_user(seeded_api.engine, "cambio.rota@matp.local", must_change_password=True)
    phone = TestClient(app, base_url=BASE_URL)
    laptop = TestClient(app, base_url=BASE_URL)
    _login(phone, user.email)
    _login(laptop, user.email)
    old_cookie = laptop.cookies.get(SESSION_COOKIE)

    response = _post(
        laptop,
        CHANGE,
        json={"current_password": PASSWORD, "new_password": "una frase larga y propia"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["must_change_password"] is False
    assert laptop.cookies.get(SESSION_COOKIE) != old_cookie  # fresh session for this device
    assert laptop.get(PIECES).status_code == 200  # no longer blocked
    gone = phone.get(PIECES)
    assert gone.status_code == 401 and gone.json()["code"] == "session_revoked"
    assert _login(TestClient(app, base_url=BASE_URL), user.email).status_code == 401  # old password
    assert (
        _login(
            TestClient(app, base_url=BASE_URL), user.email, "una frase larga y propia"
        ).status_code
        == 200
    )
    assert len(_events(seeded_api, AuthEventType.PASSWORD_CHANGED, user_id=user.id)) == 1
    assert _user(seeded_api, user.email).must_change_password is False


def test_the_new_password_must_differ_from_the_current_one(
    seeded_api: SeededApi, browser: TestClient
) -> None:
    user = create_user(
        seeded_api.engine, "misma.clave@matp.local", password="una frase larga y propia"
    )
    _login(browser, user.email, "una frase larga y propia")
    response = _post(
        browser,
        CHANGE,
        json={
            "current_password": "una frase larga y propia",
            "new_password": "una frase larga y propia",
        },
    )
    assert response.status_code == 422 and response.json()["code"] == "password_unchanged"
