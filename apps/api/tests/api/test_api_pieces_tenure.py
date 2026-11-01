"""Tenure regime changes through PUT /pieces/{piece_id} (ficha-pieza-crud 2.5; RF-005, RN-003).

Spec catalogo-piezas, «Transiciones controladas del régimen de tenencia»; design D4: the reason
and the supporting document travel in the audit, never in a column of the sheet. The allowed
transitions are [SUPUESTO B3]. Every piece a test creates is deleted at the end. Synthetic data
only (RNF-014).
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog
from app.modules.catalog.tenure import LEGAL_OWNER_PUCP
from tests.api.conftest import SeededApi


def _new_piece(client: TestClient, denomination: str, tenure: str, **extra: Any) -> str:
    created = client.post(
        "/api/v1/pieces", json={"denomination": denomination, "tenure_regime": tenure, **extra}
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _put(client: TestClient, piece_id: str, body: dict[str, Any]) -> Any:
    version = client.get(f"/api/v1/pieces/{piece_id}").json()["version"]
    return client.put(f"/api/v1/pieces/{piece_id}", json=body, headers={"If-Match": str(version)})


def _regime(client: TestClient, piece_id: str) -> str:
    return client.get(f"/api/v1/pieces/{piece_id}").json()["tenure_regime"]


def _delete(seeded_api: SeededApi, piece_id: str) -> None:
    deleted = seeded_api.login_as("ADMIN").delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": "Limpieza de prueba"}
    )
    assert deleted.status_code == 204, deleted.text


def test_a_piece_with_code_i_cannot_move_to_loan_for_use(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    piece_id = _new_piece(manager, "Pieza inventariada (sintética)", "Propiedad", code_i="I-97101")

    response = _put(
        manager, piece_id, {"tenure_regime": "Comodato", "tenure_change_reason": "Prueba"}
    )

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "tenure_change_with_inventory_code"
    assert "RN-003" in response.json()["message"]
    assert _regime(manager, piece_id) == "Propiedad"
    _delete(seeded_api, piece_id)


def test_loan_for_use_to_owned_without_document_is_422(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    piece_id = _new_piece(manager, "Pieza en comodato (sintética)", "Comodato")

    response = _put(
        manager,
        piece_id,
        {"tenure_regime": "Propiedad", "tenure_change_reason": "Donación del comodante"},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "supporting_document_required"
    assert _regime(manager, piece_id) == "Comodato"
    _delete(seeded_api, piece_id)


def test_loan_for_use_to_owned_with_backing_is_audited_with_reason_and_document(
    seeded_api: SeededApi,
) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    piece_id = _new_piece(manager, "Pieza donada por el comodante (sintética)", "Comodato")

    response = _put(
        manager,
        piece_id,
        {
            "tenure_regime": "Propiedad",
            "tenure_change_reason": "Donación del comodante",
            "supporting_document_ref": "Resolución sintética 0001-2026",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["tenure_regime"], body["legal_owner"]) == ("Propiedad", LEGAL_OWNER_PUCP)
    assert "tenure_change_reason" not in body and "supporting_document_ref" not in body
    with seeded_api.session() as session:
        tenure_entry = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(piece_id),
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.field == "tenure_regime",
            )
        ).one()
        changed = set(
            session.scalars(
                select(AuditLog.field).where(AuditLog.change_set_id == tenure_entry.change_set_id)
            )
        )
    assert (
        tenure_entry.reason == "Donación del comodante | documento: Resolución sintética 0001-2026"
    )
    assert changed == {"tenure_regime", "legal_owner"}  # no column holds the reason or document
    _delete(seeded_api, piece_id)


def test_an_edit_without_tenure_regime_leaves_it_alone(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    piece_id = _new_piece(manager, "Pieza en comodato sin cambio (sintética)", "Comodato")

    response = _put(manager, piece_id, {"notes": "Solo una nota", "tenure_change_reason": "x"})

    assert response.status_code == 200, response.text
    assert response.json()["tenure_regime"] == "Comodato"
    _delete(seeded_api, piece_id)
