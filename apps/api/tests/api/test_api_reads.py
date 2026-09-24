"""Lecturas implementadas: tipos de identificador, ubicaciones, roles, IA y auditoría."""

from fastapi.testclient import TestClient

from tests.api.conftest import ADMIN, STORAGE, VIEWER, SeededApi, as_user


def test_identifier_types(client: TestClient) -> None:
    types = client.get("/api/v1/identifier-types", headers=as_user(VIEWER)).json()
    inventory = next(item for item in types if item["code"] == "I")
    assert inventory["locks_on_assignment"] is True
    assert inventory["owned_pieces_only"] is True


def test_locations_for_storage_staff_include_exact_levels(client: TestClient) -> None:
    listed = client.get("/api/v1/locations", headers=as_user(STORAGE)).json()
    levels = {item["level"] for item in listed}
    assert {"SITE", "SPACE", "FURNITURE"} <= levels
    container = next(item for item in listed if item["level"] in {"CONTAINER", "SHELF_LEVEL"})
    assert container["path"][0]["level"] == "SITE"
    detail = client.get(f"/api/v1/locations/{container['id']}", headers=as_user(STORAGE))
    assert detail.status_code == 200
    hidden = client.get(f"/api/v1/locations/{container['id']}", headers=as_user(VIEWER))
    assert hidden.status_code == 404


def test_roles_and_permissions(client: TestClient) -> None:
    roles = {
        role["code"]: role for role in client.get("/api/v1/roles", headers=as_user(VIEWER)).json()
    }
    assert set(roles["INTERNAL_VIEWER"]["permissions"]) == {"pieces.read", "reports.view"}
    assert roles["EXTERNAL_RESEARCHER"]["is_enabled"] is False
    permissions = client.get("/api/v1/permissions", headers=as_user(VIEWER)).json()
    assert "audit.read" in {item["code"] for item in permissions}


def test_ai_suggestions_are_listed_as_pending(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    body = client.get("/api/v1/ai/suggestions", headers=as_user(VIEWER)).json()
    assert body["total"] >= 1
    assert {item["status"] for item in body["items"]} == {"PENDING"}
    first = body["items"][0]
    detail = client.get(f"/api/v1/ai/suggestions/{first['id']}", headers=as_user(VIEWER))
    assert detail.json()["output_data"] == first["output_data"]
    missing = client.get(
        "/api/v1/ai/suggestions/00000000-0000-7000-8000-000000000000", headers=as_user(VIEWER)
    )
    assert missing.status_code == 404


def test_audit_requires_permission_and_filters(client: TestClient) -> None:
    assert client.get("/api/v1/audit-logs", headers=as_user(VIEWER)).status_code == 403
    body = client.get(
        "/api/v1/audit-logs", params={"origin": "SYSTEM", "page_size": 5}, headers=as_user(ADMIN)
    ).json()
    assert body["total"] > 0
    assert len(body["items"]) == 5
    assert {item["origin"] for item in body["items"]} == {"SYSTEM"}
