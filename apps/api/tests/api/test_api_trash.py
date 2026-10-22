"""Spec auditoria-trazabilidad — Papelera por API (tarea 3.1; RNF-006, RN-005).

Escenarios: restaurar un término de vocabulario eliminado, dependencia eliminada (foto cuya
pieza está eliminada) y usuario sin permiso (Catalogador).
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.media.models import MediaAsset
from tests.api.conftest import ADMIN, CATALOGUER, MANAGER, SeededApi, as_user

HA = as_user(ADMIN)
HM = as_user(MANAGER)
TERMS = "/api/v1/vocabularies/MATERIAL/terms"
# Los fixtures sintéticos ya traen «Totora»: la prueba usa su propio término de material.
TERM_CODE = "TOTORA_PRUEBA"
TERM_LABEL = "Totora de prueba (sintética)"


@pytest.fixture
def deleted_photo_of_a_deleted_piece(seeded_api: SeededApi) -> tuple[uuid.UUID, uuid.UUID]:
    """Fotografía y pieza eliminadas lógicamente (la pieza queda eliminada a propósito)."""
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        context = AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)
        with audit_context(session, context):
            piece = create_piece(
                session,
                denomination="Pieza con fotografía para la papelera (sintética)",
                tenure_regime=TenureRegime.OWNED,
            )
            media = MediaAsset(
                id=new_uuid(),
                piece_id=piece.id,
                storage_key=f"pieces/{piece.id}/papelera.jpg",
                original_filename="papelera.jpg",
                content_type="image/jpeg",
                size_bytes=2048,
                content_sha256="1" * 64,
            )
            session.add(media)
            session.flush()
            soft_delete(session, media, "Fotografía fuera de foco")
            soft_delete(session, piece, "Registrada por error")
            session.commit()
            return media.id, piece.id


def test_cataloguer_cannot_open_the_trash(client: TestClient) -> None:
    listed = client.get("/api/v1/trash", headers=as_user(CATALOGUER))
    assert listed.status_code == 403
    assert listed.json()["code"] == "permission_denied"
    restored = client.post(
        f"/api/v1/trash/piece/{uuid.uuid4()}/restore", headers=as_user(CATALOGUER)
    )
    assert restored.status_code == 403


def test_trash_lists_the_pieces_deleted_by_the_seed(client: TestClient) -> None:
    body = client.get("/api/v1/trash", params={"entity_type": "piece"}, headers=HA).json()
    assert body["total"] >= 1
    first = body["items"][0]
    assert first["entity_type"] == "piece"
    assert first["type_label"] == "Pieza"
    assert first["deletion_reason"]
    assert first["deleted_by_name"]


def test_restore_a_deleted_vocabulary_term(seeded_api: SeededApi) -> None:
    """Escenario «Restaurar un término de vocabulario eliminado» (material Totora)."""
    client = seeded_api.client
    created = client.post(TERMS, json={"code": TERM_CODE, "label": TERM_LABEL}, headers=HA)
    assert created.status_code == 201, created.text
    term_id = created.json()["id"]
    deleted = client.delete(
        f"{TERMS}/{term_id}", params={"reason": "Eliminado por error"}, headers=HA
    )
    assert deleted.status_code == 204

    trash = client.get("/api/v1/trash", params={"entity_type": "term"}, headers=HA).json()
    entry = next(item for item in trash["items"] if item["entity_id"] == term_id)
    assert entry["entity_label"] == TERM_LABEL
    assert entry["type_label"] == "Término de vocabulario"
    assert entry["deletion_reason"] == "Eliminado por error"

    restored = client.post(
        f"/api/v1/trash/term/{term_id}/restore",
        params={"reason": "Se eliminó por error"},
        headers=HA,
    )
    assert restored.status_code == 200, restored.text
    body = restored.json()
    assert body == {
        "entity_type": "term",
        "entity_id": term_id,
        "entity_label": TERM_LABEL,
        "type_label": "Término de vocabulario",
        "restored": True,
        "previous_deletion_reason": "Eliminado por error",
    }
    assert term_id in {item["id"] for item in client.get(TERMS, headers=HA).json()}
    audit = client.get(
        "/api/v1/audit-logs",
        params={"entity_type": "term", "entity_id": term_id, "action": "RESTORE"},
        headers=HA,
    ).json()
    assert audit["total"] >= 1
    assert audit["items"][0]["reason"] == "Se eliminó por error"
    # El término solo existía para la prueba: vuelve a la papelera.
    assert (
        client.delete(f"{TERMS}/{term_id}", params={"reason": "Fin de la prueba"}, headers=HA)
    ).status_code == 204


def test_restore_a_photo_whose_piece_is_deleted_answers_409(
    seeded_api: SeededApi, deleted_photo_of_a_deleted_piece: tuple[uuid.UUID, uuid.UUID]
) -> None:
    media_id, piece_id = deleted_photo_of_a_deleted_piece
    response = seeded_api.client.post(f"/api/v1/trash/media_asset/{media_id}/restore", headers=HA)
    assert response.status_code == 409, response.text
    body = response.json()
    assert body["code"] == "restore_dependency"
    assert body["details"]["dependency_entity_type"] == "piece"
    assert body["details"]["dependency_entity_id"] == str(piece_id)
    assert "Restáurela primero" in body["message"]


def test_restoring_is_reserved_to_the_administrator(
    seeded_api: SeededApi, deleted_photo_of_a_deleted_piece: tuple[uuid.UUID, uuid.UUID]
) -> None:
    media_id, piece_id = deleted_photo_of_a_deleted_piece
    assert seeded_api.client.get("/api/v1/trash", headers=HM).status_code == 200
    response = seeded_api.client.post(f"/api/v1/trash/piece/{piece_id}/restore", headers=HM)
    assert response.status_code == 403
    assert response.json()["code"] == "admin_required"
    assert media_id


def test_unknown_entity_type_and_active_record_are_rejected(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    unknown = client.post(f"/api/v1/trash/app_user/{uuid.uuid4()}/restore", headers=HA)
    assert unknown.status_code == 422
    assert unknown.json()["code"] == "unknown_entity_type"
    missing = client.post(f"/api/v1/trash/piece/{uuid.uuid4()}/restore", headers=HA)
    assert missing.status_code == 404
    active = client.get("/api/v1/pieces?limit=1", headers=HA).json()["items"][0]["id"]
    not_deleted = client.post(f"/api/v1/trash/piece/{active}/restore", headers=HA)
    assert not_deleted.status_code == 409
    assert not_deleted.json()["code"] == "not_deleted"
