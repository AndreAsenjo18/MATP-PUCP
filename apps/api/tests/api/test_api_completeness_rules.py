"""Spec calidad-datos — `GET`/`PUT /quality/completeness-rules` (design D2, tarea 1.3)."""

from tests.api.conftest import LoginAs


def test_get_completeness_rules_lists_the_seeded_defaults(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    response = client.get("/api/v1/quality/completeness-rules")
    assert response.status_code == 200
    rules = response.json()
    fields = {rule["field"] for rule in rules}
    assert "denomination" in fields
    assert "tenure_regime" in fields


def test_put_adds_a_recommended_field(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    current = client.get("/api/v1/quality/completeness-rules").json()
    updated = [*current, {"field": "provenance", "kind": "RECOMMENDED", "is_active": True}]
    response = client.put("/api/v1/quality/completeness-rules", json={"rules": updated})
    assert response.status_code == 200
    fields = {rule["field"]: rule for rule in response.json()}
    assert fields["provenance"] == {
        "field": "provenance",
        "kind": "RECOMMENDED",
        "is_active": True,
    }

    again = client.get("/api/v1/quality/completeness-rules").json()
    assert {rule["field"]: rule for rule in again}["provenance"]["is_active"] is True


def test_put_deactivates_fields_left_out_of_the_new_list(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    current = client.get("/api/v1/quality/completeness-rules").json()
    without_provenance = [rule for rule in current if rule["field"] != "provenance"]
    client.put("/api/v1/quality/completeness-rules", json={"rules": without_provenance})

    response = client.get("/api/v1/quality/completeness-rules").json()
    by_field = {rule["field"]: rule for rule in response}
    # Sigue existiendo (no se borra), pero queda inactiva.
    assert by_field["provenance"]["is_active"] is False


def test_put_unknown_field_is_422_with_allowed_fields(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    response = client.put(
        "/api/v1/quality/completeness-rules",
        json={"rules": [{"field": "no_existe", "kind": "REQUIRED", "is_active": True}]},
    )
    assert response.status_code == 422
    body = response.json()
    assert "denomination" in body["details"]["allowed"]


def test_internal_viewer_cannot_read_or_write_completeness_rules(login_as: LoginAs) -> None:
    client = login_as("INTERNAL_VIEWER")
    assert client.get("/api/v1/quality/completeness-rules").status_code == 403
    assert client.put("/api/v1/quality/completeness-rules", json={"rules": []}).status_code == 403


def test_collections_manager_cannot_write_completeness_rules(login_as: LoginAs) -> None:
    client = login_as("COLLECTIONS_MANAGER")
    assert client.put("/api/v1/quality/completeness-rules", json={"rules": []}).status_code == 403
