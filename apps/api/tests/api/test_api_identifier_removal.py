"""Baja lógica de identificadores en `DELETE /pieces/{id}/identifiers/{identifier_id}` (tarea 5.3).

Change alinear-api-endpoints-v1, decisiones D1 y C3: un código secundario mal asignado queda en el
historial y en la auditoría (RN-005); el código I responde 409 (RN-002).
"""

import uuid

from sqlalchemy import select

from app.models import AuditLog, PieceIdentifier
from app.modules.audit.models import AuditAction
from app.modules.identification.models import INVENTORY_CODE_TYPE
from tests.api.conftest import CATALOGUER, VIEWER, SeededApi, as_user

H = as_user(CATALOGUER)


def _current_identifier(seeded_api: SeededApi, *, inventory: bool) -> PieceIdentifier:
    type_filter = (
        PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE
        if inventory
        else PieceIdentifier.identifier_type_code != INVENTORY_CODE_TYPE
    )
    with seeded_api.session() as session:
        identifier = session.scalars(
            select(PieceIdentifier)
            .where(type_filter, PieceIdentifier.is_current.is_(True))
            .order_by(PieceIdentifier.id)
        ).first()
    assert identifier is not None, "El seed debe tener identificadores de ese tipo"
    return identifier


def _url(identifier: PieceIdentifier) -> str:
    return f"/api/v1/pieces/{identifier.piece_id}/identifiers/{identifier.id}"


def test_secondary_identifier_stays_in_history(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    identifier = _current_identifier(seeded_api, inventory=False)
    reason = "Código asignado por error en la digitación"

    response = client.delete(_url(identifier), params={"reason": reason}, headers=H)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(identifier.id)
    assert body["is_current"] is False
    assert body["deleted_at"] is not None
    assert body["deletion_reason"] == reason
    assert body["original_value"] == identifier.original_value

    listing = f"/api/v1/pieces/{identifier.piece_id}/identifiers"
    assert str(identifier.id) not in {i["id"] for i in client.get(listing, headers=H).json()}
    history = {
        i["id"]: i for i in client.get(listing, params={"include_history": True}, headers=H).json()
    }
    assert history[str(identifier.id)]["deletion_reason"] == reason

    with seeded_api.session() as session:
        audit = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == identifier.id, AuditLog.action == AuditAction.SOFT_DELETE
            )
        ).all()
    assert audit, "La baja lógica debe quedar en la auditoría"
    assert {row.reason for row in audit} == {reason}

    again = client.delete(_url(identifier), params={"reason": reason}, headers=H)
    assert again.status_code == 404


def test_inventory_code_cannot_be_removed(seeded_api: SeededApi) -> None:
    identifier = _current_identifier(seeded_api, inventory=True)
    response = seeded_api.client.delete(
        _url(identifier), params={"reason": "Intento de borrar el código I"}, headers=H
    )
    assert response.status_code == 409
    assert response.json()["code"] == "immutable_inventory_code"
    assert "RN-002" in response.json()["message"]
    with seeded_api.session() as session:
        unchanged = session.get(PieceIdentifier, identifier.id)
        assert unchanged is not None
        assert (unchanged.is_current, unchanged.deleted_at) == (True, None)


def test_reason_is_required(seeded_api: SeededApi) -> None:
    identifier = _current_identifier(seeded_api, inventory=False)
    assert seeded_api.client.delete(_url(identifier), headers=H).status_code == 422


def test_identifier_must_belong_to_the_piece(seeded_api: SeededApi) -> None:
    identifier = _current_identifier(seeded_api, inventory=False)
    other_piece = _current_identifier(seeded_api, inventory=True).piece_id
    if other_piece == identifier.piece_id:
        other_piece = uuid.uuid4()
    response = seeded_api.client.delete(
        f"/api/v1/pieces/{other_piece}/identifiers/{identifier.id}",
        params={"reason": "Pieza equivocada"},
        headers=H,
    )
    assert response.status_code == 404


def test_viewer_cannot_remove_identifiers(seeded_api: SeededApi) -> None:
    identifier = _current_identifier(seeded_api, inventory=False)
    response = seeded_api.client.delete(
        _url(identifier), params={"reason": "Sin permiso"}, headers=as_user(VIEWER)
    )
    assert response.status_code == 403
