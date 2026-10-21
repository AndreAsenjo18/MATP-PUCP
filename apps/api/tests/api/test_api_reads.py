"""Lecturas implementadas: tipos de identificador, ubicaciones, roles, IA y auditoría."""

from tests.api.conftest import LoginAs, SeededApi


def test_identifier_types(login_as: LoginAs) -> None:
    client = login_as("INTERNAL_VIEWER")
    types = client.get("/api/v1/identifier-types").json()
    inventory = next(item for item in types if item["code"] == "I")
    assert inventory["locks_on_assignment"] is True
    assert inventory["owned_pieces_only"] is True


def test_locations_for_storage_staff_include_exact_levels(login_as: LoginAs) -> None:
    client = login_as("STORAGE_STAFF")
    listed = client.get("/api/v1/locations").json()
    levels = {item["level"] for item in listed}
    assert {"Sede", "Depósito", "Mueble"} <= levels
    container = next(item for item in listed if item["level"] in {"Contenedor", "Nivel"})
    assert container["path"][0]["level"] == "Sede"
    detail = client.get(f"/api/v1/locations/{container['id']}")
    assert detail.status_code == 200
    hidden = login_as("INTERNAL_VIEWER").get(f"/api/v1/locations/{container['id']}")
    assert hidden.status_code == 404


def test_roles_and_permissions(login_as: LoginAs) -> None:
    client = login_as("INTERNAL_VIEWER")
    roles = {role["code"]: role for role in client.get("/api/v1/roles").json()}
    assert set(roles["INTERNAL_VIEWER"]["permissions"]) == {"pieces.read", "reports.view"}
    assert roles["EXTERNAL_RESEARCHER"]["is_enabled"] is False
    permissions = client.get("/api/v1/permissions").json()
    assert "audit.read" in {item["code"] for item in permissions}


def test_ai_suggestions_are_listed_as_pending(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("INTERNAL_VIEWER")
    body = client.get("/api/v1/ai/suggestions").json()
    assert body["total"] >= 1
    assert {item["status"] for item in body["items"]} == {"PENDING"}
    first = body["items"][0]
    detail = client.get(f"/api/v1/ai/suggestions/{first['id']}")
    assert detail.json()["output_data"] == first["output_data"]
    missing = client.get("/api/v1/ai/suggestions/00000000-0000-7000-8000-000000000000")
    assert missing.status_code == 404


def test_audit_requires_permission_and_filters(login_as: LoginAs) -> None:
    assert login_as("INTERNAL_VIEWER").get("/api/v1/audit-logs").status_code == 403
    body = (
        login_as("ADMIN")
        .get("/api/v1/audit-logs", params={"origin": "SYSTEM", "page_size": 5})
        .json()
    )
    assert body["total"] > 0
    assert len(body["items"]) == 5
    assert {item["origin"] for item in body["items"]} == {"SYSTEM"}
