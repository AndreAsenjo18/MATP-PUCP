"""Spec usuarios-roles — Identidad provisional de desarrollo sin exposición pública (RF-042)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.main import create_app
from app.models import AppUser, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.locations.models import Location, LocationLevel
from tests.api.conftest import (
    ADMIN,
    CATALOGUER,
    VIEWER,
    SeededApi,
    api_settings,
    as_user,
)


def test_anonymous_request_gets_no_catalog_data(client: TestClient) -> None:
    response = client.get("/api/v1/pieces")
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "authentication_required"
    assert "items" not in body


def test_unknown_user_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/pieces", headers=as_user("nadie@matp.local"))
    assert response.status_code == 401


def test_non_synthetic_user_is_rejected(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
        with audit_context(session, context):
            session.add(
                AppUser(
                    id=new_uuid(),
                    email="persona.real@example.org",
                    full_name="Cuenta no sintética",
                    is_synthetic=False,
                )
            )
            session.commit()
    response = seeded_api.client.get("/api/v1/pieces", headers=as_user("persona.real@example.org"))
    assert response.status_code == 401


@pytest.mark.parametrize("app_env", ["development", "production"])
def test_dev_header_is_only_accepted_under_app_env_test(
    seeded_api: SeededApi, app_env: str
) -> None:
    """Spec "Retiro de la identidad provisional de desarrollo" (ADR-009 D7)."""
    app = create_app(api_settings(app_env=app_env), health_checks={}, engine=seeded_api.engine)
    with TestClient(app) as client:
        response = client.get("/api/v1/pieces", headers=as_user(ADMIN))
        health = client.get("/health/live")
    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"
    assert health.status_code == 200


def test_user_id_is_accepted_as_identity(client: TestClient) -> None:
    me = client.get("/api/v1/auth/me", headers=as_user(CATALOGUER)).json()
    again = client.get("/api/v1/auth/me", headers=as_user(me["id"]))
    assert again.status_code == 200
    assert again.json()["email"] == CATALOGUER
    assert me["roles"] == ["CATALOGUER"]
    assert "pieces.update" in me["permissions"]
    assert me["auth_mode"] == "dev-header"


def test_insufficient_permission_is_forbidden(client: TestClient) -> None:
    response = client.post(
        "/api/v1/collections",
        json={"name": "Colección no permitida (sintética)"},
        headers=as_user(VIEWER),
    )
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "permission_denied"
    assert body["details"]["permission"] == "collections.manage"
    listed = client.get("/api/v1/collections", headers=as_user(ADMIN)).json()
    assert all(item["name"] != "Colección no permitida (sintética)" for item in listed)


def _loan_piece_with_exact_location(seeded_api: SeededApi) -> str:
    with seeded_api.session() as session:
        deep_levels = select(Location.id).where(
            Location.level.in_(
                [LocationLevel.FURNITURE, LocationLevel.SHELF_LEVEL, LocationLevel.CONTAINER]
            )
        )
        piece = session.scalar(
            select(Piece)
            .where(
                Piece.tenure_regime == TenureRegime.LOAN_FOR_USE,
                Piece.lender_name.is_not(None),
                Piece.current_location_id.in_(deep_levels),
            )
            .limit(1)
        )
        assert piece is not None, "El seed debe tener comodatos con ubicación exacta"
        return str(piece.id)


def test_sensitive_fields_are_masked_for_internal_viewer(seeded_api: SeededApi) -> None:
    piece_id = _loan_piece_with_exact_location(seeded_api)
    client = seeded_api.client

    viewer = client.get(f"/api/v1/pieces/{piece_id}", headers=as_user(VIEWER)).json()
    assert viewer["lender_name"] is None
    assert viewer["loan_agreement_ref"] is None
    assert {"lender_name", "loan_agreement_ref", "location.path"} <= set(viewer["masked_fields"])
    assert viewer["location"]["is_exact"] is False
    assert {node["level"] for node in viewer["location"]["path"]} <= {"Sede", "Depósito"}

    admin = client.get(f"/api/v1/pieces/{piece_id}", headers=as_user(ADMIN)).json()
    assert admin["lender_name"] == "Comodante sintético AJB"
    assert admin["masked_fields"] == []
    assert admin["location"]["is_exact"] is True
    assert len(admin["location"]["path"]) > len(viewer["location"]["path"])

    listed = client.get("/api/v1/locations", headers=as_user(VIEWER)).json()
    assert {item["level"] for item in listed} <= {"Sede", "Depósito"}


def test_auth_login_remains_stub(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@matp.local",
            "password": "clave-ficticia-para-prueba",
        },
    )

    assert response.status_code == 501


def test_auth_me_returns_user_role_and_permissions(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers=as_user(CATALOGUER),
    )

    assert response.status_code == 200

    body = response.json()
    assert body["email"] == CATALOGUER
    assert "CATALOGUER" in body["roles"]
    assert "pieces.update" in body["permissions"]
    assert body["auth_mode"] == "dev-header"


def test_auth_me_rejects_anonymous_user(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"


def test_auth_endpoints_openapi_contract(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200

    paths = response.json()["paths"]

    login = paths["/api/v1/auth/login"]["post"]
    assert login["operationId"] == "login"
    assert login["x-status"] == "stub"
    assert login["x-change"] == "autenticacion-y-matriz-permisos"

    me = paths["/api/v1/auth/me"]["get"]
    assert me["operationId"] == "getMe"
    assert me["x-status"] == "implemented"
