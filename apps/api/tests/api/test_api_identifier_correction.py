"""POST /pieces/{piece_id}/identifiers/{identifier_id}/correction (ficha-pieza-crud 3.2).

Spec identificacion-piezas, «Operación de corrección auditada del código I»; design D6 (RF-003,
RN-002, A6). Every piece a test creates is deleted at the end. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from tests.api.conftest import SeededApi

REASON = "Transposición de dígitos en la sábana 2024 (sintética)"


def _piece_with_code_i(client: TestClient, code_i: str) -> tuple[str, str]:
    """A new owned piece with ``code_i``: its id and the id of the current code I."""
    created = client.post(
        "/api/v1/pieces",
        json={
            "denomination": f"Pieza {code_i} (sintética)",
            "tenure_regime": "Propiedad",
            "code_i": code_i,
        },
    )
    assert created.status_code == 201, created.text
    piece_id = created.json()["id"]
    identifiers = client.get(f"/api/v1/pieces/{piece_id}/identifiers").json()
    return piece_id, next(item["id"] for item in identifiers if item["identifier_type_code"] == "I")


def _correct(client: TestClient, piece_id: str, identifier_id: str, body: dict[str, Any]) -> Any:
    return client.post(
        f"/api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction", json=body
    )


def _delete(admin: TestClient, *piece_ids: str) -> None:
    for piece_id in piece_ids:
        deleted = admin.delete(f"/api/v1/pieces/{piece_id}", params={"reason": "Limpieza"})
        assert deleted.status_code == 204, deleted.text


def test_an_administrator_corrects_the_code_i_and_the_old_one_stays_searchable(
    seeded_api: SeededApi,
) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id, old_id = _piece_with_code_i(admin, "I-97263")

    response = _correct(admin, piece_id, old_id, {"new_value": "I 97236", "reason": REASON})

    assert response.status_code == 200, response.text
    new = response.json()
    assert (new["normalized_value"], new["is_current"], new["is_locked"]) == ("I-97236", True, True)
    assert admin.get(f"/api/v1/pieces/{piece_id}").json()["code_i"] == "I-97236"
    history = admin.get(
        f"/api/v1/pieces/{piece_id}/identifiers", params={"include_history": True}
    ).json()
    old = next(item for item in history if item["id"] == old_id)
    assert (old["is_current"], old["replaced_by_id"]) == (False, new["id"])
    hits = admin.get("/api/v1/search", params={"q": "I-97263"}).json()["items"]
    assert piece_id in {hit["piece"]["id"] for hit in hits}
    # The old code gets CORRECTION entries and the new one its creation, both with the reason,
    # the user and the value of each code.
    with seeded_api.session() as session:
        logged = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id.in_([uuid.UUID(old_id), uuid.UUID(new["id"])])
            )
        ).all()
    correction = [entry for entry in logged if entry.action == AuditAction.CORRECTION]
    created = [entry for entry in logged if str(entry.entity_id) == new["id"]]
    assert {entry.field for entry in correction} == {"is_current", "replaced_by_id"}
    assert {entry.reason for entry in correction + created} == {REASON}
    assert all(e.user_id and e.origin is AuditOrigin.MANUAL for e in correction + created)
    assert {
        str(entry.entity_id): entry.new_value
        for entry in logged
        if entry.field == "normalized_value"
    } == {old_id: "I-97263", new["id"]: "I-97236"}
    _delete(admin, piece_id)


def test_a_cataloguer_cannot_correct_and_nothing_changes(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id, old_id = _piece_with_code_i(admin, "I-97301")
    cataloguer = seeded_api.login_as("CATALOGUER")

    response = _correct(cataloguer, piece_id, old_id, {"new_value": "I-97310", "reason": REASON})

    assert response.status_code == 403
    assert cataloguer.get(f"/api/v1/pieces/{piece_id}").json()["code_i"] == "I-97301"
    _delete(admin, piece_id)


def test_a_correction_without_reason_is_422(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id, old_id = _piece_with_code_i(admin, "I-97401")

    missing = _correct(admin, piece_id, old_id, {"new_value": "I-97410"})
    empty = _correct(admin, piece_id, old_id, {"new_value": "I-97410", "reason": ""})

    assert (missing.status_code, empty.status_code) == (422, 422)
    assert admin.get(f"/api/v1/pieces/{piece_id}").json()["code_i"] == "I-97401"
    _delete(admin, piece_id)


def test_a_value_of_another_piece_active_or_deleted_is_409(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    deleted_id, _ = _piece_with_code_i(admin, "I-97501")
    _delete(admin, deleted_id)
    active_id, _ = _piece_with_code_i(admin, "I-97502")
    piece_id, old_id = _piece_with_code_i(admin, "I-97503")

    of_deleted = _correct(admin, piece_id, old_id, {"new_value": "I-97501", "reason": REASON})
    of_active = _correct(admin, piece_id, old_id, {"new_value": "I-97502", "reason": REASON})

    assert of_deleted.status_code == 409, of_deleted.text
    assert of_deleted.json()["code"] == "identifier_of_deleted_piece"
    assert of_deleted.json()["details"]["piece_id"] == deleted_id
    assert of_active.status_code == 409, of_active.text
    assert of_active.json()["details"]["piece_id"] == active_id
    assert admin.get(f"/api/v1/pieces/{piece_id}").json()["code_i"] == "I-97503"
    _delete(admin, piece_id, active_id)


def test_only_the_current_code_i_is_corrected(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id, old_id = _piece_with_code_i(admin, "I-97601")
    assert _correct(admin, piece_id, old_id, {"new_value": "I-97610", "reason": REASON}).is_success

    again = _correct(admin, piece_id, old_id, {"new_value": "I-97620", "reason": REASON})
    unknown = _correct(
        admin, piece_id, str(uuid.uuid4()), {"new_value": "I-97620", "reason": REASON}
    )

    assert (again.status_code, again.json()["code"]) == (409, "not_current_inventory_code")
    assert unknown.status_code == 404
    _delete(admin, piece_id)
