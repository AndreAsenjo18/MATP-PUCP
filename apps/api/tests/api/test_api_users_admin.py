"""Spec usuarios-roles — administración de usuarios y de la matriz de permisos (tasks 3.1, 3.2).

The shared seeded database is global state, so every test that deactivates users or edits the
matrix works on users and a role copy of its own, and restores what it touched.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.pool import StaticPool

from app.core.db import make_session_factory
from app.main import create_app
from app.models import AppUser, Base
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.users.models import AuthEvent, AuthEventType, UserSession
from app.seed.synthetic import SeedOptions, run_seed
from tests.api.conftest import SeededApi, api_settings, create_user, login_client

USERS = "/api/v1/users"
PIECES = "/api/v1/pieces"
PASSWORD = "contrasena-de-prueba-2026"


def _admin(seeded_api: SeededApi) -> TestClient:
    return seeded_api.login_as("ADMIN")


def _create(client: TestClient, email: str, roles: list[str] | None = None, **extra: object):  # type: ignore[no-untyped-def]
    body = {"email": email, "full_name": "Persona de prueba", "roles": roles or ["CATALOGUER"]}
    return client.post(USERS, json={**body, **extra})


def test_create_user_returns_a_temporary_password_once(seeded_api: SeededApi) -> None:
    admin = _admin(seeded_api)
    created = _create(admin, "Nueva.Persona@matp.local")

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["email"] == "nueva.persona@matp.local"  # normalized
    assert body["roles"] == ["CATALOGUER"] and body["must_change_password"] is True
    assert len(body["temporary_password"]) >= 12

    again = admin.get(f"{USERS}/{body['id']}").json()
    assert again["temporary_password"] is None  # shown once, never queryable

    # The temporary password works for signing in, and then forces the change.
    browser = TestClient(seeded_api.app, base_url="https://testserver")
    login = browser.post(
        "/api/v1/auth/login",
        json={"username": body["email"], "password": body["temporary_password"]},
    )
    assert login.status_code == 200 and login.json()["must_change_password"] is True
    assert browser.get(PIECES).json()["code"] == "password_change_required"


def test_duplicate_email_with_other_capitalization_is_409(seeded_api: SeededApi) -> None:
    admin = _admin(seeded_api)
    assert _create(admin, "repetido@matp.local").status_code == 201
    response = _create(admin, "REPETIDO@Matp.Local")
    assert response.status_code == 409 and response.json()["code"] == "email_taken"


def test_the_disabled_researcher_role_cannot_be_assigned(seeded_api: SeededApi) -> None:
    response = _create(_admin(seeded_api), "investigador@matp.local", ["EXTERNAL_RESEARCHER"])
    assert response.status_code == 409 and response.json()["code"] == "role_disabled"


def test_unknown_role_and_weak_initial_password_are_422(seeded_api: SeededApi) -> None:
    admin = _admin(seeded_api)
    assert _create(admin, "rol.raro@matp.local", ["NO_EXISTE"]).status_code == 422
    weak = _create(admin, "clave.floja@matp.local", initial_password="123456789012")
    assert weak.status_code == 422 and weak.json()["code"] == "weak_password"


def test_only_user_managers_can_administer_users(seeded_api: SeededApi) -> None:
    viewer = seeded_api.login_as("CATALOGUER")
    assert viewer.get(USERS).status_code == 403
    assert _create(viewer, "sin.permiso@matp.local").status_code == 403


def test_list_hides_inactive_users_unless_asked(seeded_api: SeededApi) -> None:
    admin = _admin(seeded_api)
    gone = create_user(seeded_api.engine, "lista.baja@matp.local", is_active=False)
    emails = {u["email"] for u in admin.get(USERS, params={"page_size": 100}).json()["items"]}
    assert gone.email not in emails
    every = admin.get(USERS, params={"page_size": 100, "include_inactive": True}).json()["items"]
    assert gone.email in {u["email"] for u in every}


def test_deactivating_a_user_revokes_the_open_session_and_blocks_login(
    seeded_api: SeededApi,
) -> None:
    target = create_user(seeded_api.engine, "baja.admin@matp.local")
    cataloguer = login_client(seeded_api.app, seeded_api.engine, target.email)
    assert cataloguer.get(PIECES).status_code == 200

    response = _admin(seeded_api).patch(f"{USERS}/{target.id}", json={"is_active": False})

    assert response.status_code == 200 and response.json()["is_active"] is False
    assert cataloguer.get(PIECES).status_code == 401
    retry = TestClient(seeded_api.app, base_url="https://testserver").post(
        "/api/v1/auth/login", json={"username": target.email, "password": PASSWORD}
    )
    assert retry.status_code == 401
    with seeded_api.session() as db:  # deactivated, not deleted (RN-005)
        row = db.scalar(select(AppUser).where(AppUser.id == target.id))
        assert row is not None and row.deleted_at is None
        revoked = db.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == target.id, UserSession.revoked_at.is_not(None))
        )
        assert revoked == 1
        events = db.scalars(
            select(AuthEvent.detail).where(
                AuthEvent.user_id == target.id, AuthEvent.event == AuthEventType.SESSION_REVOKED
            )
        ).all()
        assert "user_deactivated" in events


def test_changing_roles_takes_effect_and_revokes_sessions(seeded_api: SeededApi) -> None:
    target = create_user(seeded_api.engine, "cambio.roles@matp.local")
    session = login_client(seeded_api.app, seeded_api.engine, target.email)

    response = _admin(seeded_api).put(
        f"{USERS}/{target.id}/role", json={"roles": ["INTERNAL_VIEWER"]}
    )

    assert response.status_code == 200 and response.json()["roles"] == ["INTERNAL_VIEWER"]
    assert session.get(PIECES).status_code == 401  # old sessions died with the old roles
    fresh = login_client(seeded_api.app, seeded_api.engine, target.email)
    assert fresh.get("/api/v1/auth/me").json()["roles"] == ["INTERNAL_VIEWER"]


def test_reset_password_gives_a_new_temporary_one(seeded_api: SeededApi) -> None:
    target = create_user(seeded_api.engine, "restablece@matp.local")
    response = _admin(seeded_api).patch(f"{USERS}/{target.id}", json={"reset_password": True})
    body = response.json()
    assert response.status_code == 200 and body["must_change_password"] is True
    browser = TestClient(seeded_api.app, base_url="https://testserver")
    ok = browser.post(
        "/api/v1/auth/login",
        json={"username": target.email, "password": body["temporary_password"]},
    )
    assert ok.status_code == 200


# --- Matrix and last administrator: a database of their own (the seed has one administrator) ---
@pytest.fixture(scope="module")
def solo() -> Iterator[SeededApi]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as db:
        summary = run_seed(db, SeedOptions(upload_media=False))
        db.commit()
    app = create_app(api_settings(), health_checks={}, engine=engine)
    yield SeededApi(engine=engine, app=app, client=TestClient(app), summary=summary)
    engine.dispose()


def _admin_id(api: SeededApi) -> str:
    return api.login_as("ADMIN").get("/api/v1/auth/me").json()["id"]


@pytest.mark.parametrize("change", [{"is_active": False}, {"roles": ["CATALOGUER"]}])
def test_last_administrator_is_protected(solo: SeededApi, change: dict) -> None:
    """Spec "Último administrador": 409 last_administrator y nada cambia."""
    admin = solo.login_as("ADMIN")
    response = admin.patch(f"{USERS}/{_admin_id(solo)}", json=change)

    assert response.status_code == 409
    assert response.json()["code"] == "last_administrator"
    me = admin.get("/api/v1/auth/me")  # still active, still signed in, still ADMIN
    assert me.status_code == 200 and "ADMIN" in me.json()["roles"]


def test_removing_the_admin_permission_from_the_only_admin_role_is_refused(
    solo: SeededApi,
) -> None:
    admin = solo.login_as("ADMIN")
    roles = {r["code"]: r for r in admin.get("/api/v1/roles").json()}
    without = [p for p in roles["ADMIN"]["permissions"] if p != "users.manage"]

    response = admin.put(
        "/api/v1/roles/ADMIN/permissions", json={"permissions": without, "reason": "Prueba"}
    )

    assert response.status_code == 409 and response.json()["code"] == "last_administrator"
    again = {r["code"]: r for r in admin.get("/api/v1/roles").json()}
    assert "users.manage" in again["ADMIN"]["permissions"]


def test_removing_export_takes_effect_on_the_next_request_and_is_audited(solo: SeededApi) -> None:
    cataloguer = solo.login_as("CATALOGUER")
    export = {"method": "POST", "url": "/api/v1/reports/export-excel"}
    assert cataloguer.request(**export, json={}).status_code != 403  # allowed today

    admin = solo.login_as("ADMIN")
    roles = {r["code"]: r for r in admin.get("/api/v1/roles").json()}
    kept = [p for p in roles["CATALOGUER"]["permissions"] if p != "exports.run"]
    response = admin.put(
        "/api/v1/roles/CATALOGUER/permissions",
        json={"permissions": kept, "reason": "Solo el gestor exporta"},
    )

    assert response.status_code == 200
    assert "exports.run" not in response.json()["permissions"]
    denied = cataloguer.request(**export, json={})  # same session, next request
    assert denied.status_code == 403 and denied.json()["details"]["permission"] == "exports.run"
    with solo.session() as db:
        removal = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_type == "role_permission",
                AuditLog.action == AuditAction.SOFT_DELETE,
                AuditLog.reason == "Solo el gestor exporta",
            )
        )
        assert removal is not None


def test_granting_a_permission_is_audited_and_unknown_ones_are_422(solo: SeededApi) -> None:
    admin = solo.login_as("ADMIN")
    roles = {r["code"]: r for r in admin.get("/api/v1/roles").json()}
    bad = admin.put(
        "/api/v1/roles/INTERNAL_VIEWER/permissions",
        json={"permissions": ["pieces.read", "no.existe"], "reason": "Prueba"},
    )
    assert bad.status_code == 422 and bad.json()["code"] == "unknown_permission"

    wider = [*roles["INTERNAL_VIEWER"]["permissions"], "exports.run"]
    ok = admin.put(
        "/api/v1/roles/INTERNAL_VIEWER/permissions",
        json={"permissions": wider, "reason": "Consulta puede exportar"},
    )
    assert ok.status_code == 200 and "exports.run" in ok.json()["permissions"]
    with solo.session() as db:
        grant = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_type == "role_permission", AuditLog.action == AuditAction.CREATE
            )
        )
        assert grant is not None


def test_unknown_role_is_404(solo: SeededApi) -> None:
    response = solo.login_as("ADMIN").put(
        "/api/v1/roles/NO_EXISTE/permissions", json={"permissions": [], "reason": "Prueba"}
    )
    assert response.status_code == 404
