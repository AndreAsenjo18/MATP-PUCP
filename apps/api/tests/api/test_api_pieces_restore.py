"""POST /pieces/{piece_id}/restore (ficha-pieza-crud 2.6; RNF-006, RN-002, RN-005).

Spec catalogo-piezas, «Operaciones de escritura de la ficha con auditoría»; design D7. Every
piece a test restores is deleted again, so the active total of the seeded database does not
move. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog
from tests.api.conftest import SeededApi


def _new_piece(client: TestClient, denomination: str, **extra: Any) -> str:
    created = client.post(
        "/api/v1/pieces", json={"denomination": denomination, "tenure_regime": "Propiedad", **extra}
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _delete(admin: TestClient, piece_id: str) -> None:
    deleted = admin.delete(f"/api/v1/pieces/{piece_id}", params={"reason": "Registrada por error"})
    assert deleted.status_code == 204, deleted.text


def test_an_administrator_restores_a_deleted_piece_and_it_is_audited(
    seeded_api: SeededApi,
) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id = _new_piece(admin, "Pieza por restaurar (sintética)")
    _delete(admin, piece_id)

    restored = admin.post(
        f"/api/v1/pieces/{piece_id}/restore", params={"reason": "Se eliminó por error"}
    )

    assert restored.status_code == 200, restored.text
    assert restored.json()["id"] == piece_id
    assert admin.get(f"/api/v1/pieces/{piece_id}").status_code == 200
    with seeded_api.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(piece_id), AuditLog.action == AuditAction.RESTORE
            )
        ).all()
    assert entries and {entry.reason for entry in entries} == {"Se eliminó por error"}
    _delete(admin, piece_id)


def test_a_cataloguer_cannot_restore_and_the_piece_stays_deleted(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    piece_id = _new_piece(admin, "Pieza que sigue eliminada (sintética)")
    _delete(admin, piece_id)
    cataloguer = seeded_api.login_as("CATALOGUER")

    response = cataloguer.post(f"/api/v1/pieces/{piece_id}/restore")

    assert response.status_code == 403
    assert cataloguer.get(f"/api/v1/pieces/{piece_id}").status_code == 404


def test_the_code_i_of_a_deleted_piece_stays_reserved_so_restoring_keeps_it(
    seeded_api: SeededApi,
) -> None:
    """No active piece can take the code I of a deleted one (`identifier_of_deleted_piece` and the
    partial unique index), so the restoration finds it free and the piece gets it back. The check
    of `restore_from_trash` remains as the single criterion if that ever changes (RN-002)."""
    admin = seeded_api.login_as("ADMIN")
    deleted_id = _new_piece(admin, "Pieza eliminada con código I (sintética)", code_i="I-97001")
    _delete(admin, deleted_id)

    reuse = admin.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza que reusa el código",
            "tenure_regime": "Propiedad",
            "code_i": "I-97001",
        },
    )
    restored = admin.post(f"/api/v1/pieces/{deleted_id}/restore")

    assert reuse.status_code == 409, reuse.text
    assert reuse.json()["code"] == "identifier_of_deleted_piece"
    assert reuse.json()["details"]["piece_id"] == deleted_id
    assert restored.status_code == 200, restored.text
    assert restored.json()["code_i"] == "I-97001"
    _delete(admin, deleted_id)


def test_an_unknown_or_active_piece_is_not_restored(seeded_api: SeededApi) -> None:
    admin = seeded_api.login_as("ADMIN")
    active_id = _new_piece(admin, "Pieza activa (sintética)")

    unknown = admin.post(f"/api/v1/pieces/{uuid.uuid4()}/restore")
    active = admin.post(f"/api/v1/pieces/{active_id}/restore")

    assert unknown.status_code == 404
    assert (active.status_code, active.json()["code"]) == (409, "not_deleted")
    _delete(admin, active_id)
