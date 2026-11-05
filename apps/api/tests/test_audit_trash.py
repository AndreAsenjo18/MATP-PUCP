"""Spec auditoria-trazabilidad — Papelera: verificadores de dependencias por tipo (diseño D2).

Tarea 3.1 del change `auditoria-y-soft-delete-transversal` (RNF-006, RN-005): cada tipo de
entidad declara qué debe estar activo para poder restaurarla, y la restauración se rechaza
indicando qué hay que restaurar primero.
"""

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.errors import PermissionDenied, ValidationFailed
from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.trash import (
    RestoreDependencyMissing,
    _inventory_code_conflict,
    list_trash,
    restore_from_trash,
)
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.collections.service import create_collection
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.modules.identification.normalization import TYPE_INVENTORY
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.service import create_location
from app.modules.media.models import MediaAsset
from tests.conftest import ActAs


def _piece(session: Session, denomination: str, **fields: object) -> Piece:
    return create_piece(
        session, denomination=denomination, tenure_regime=TenureRegime.OWNED, **fields
    )


def _inventory_code(session: Session, piece: Piece, value: str) -> PieceIdentifier:
    """Código I insertado sin pasar por el servicio: la prueba necesita el estado, no las reglas."""
    identifier = PieceIdentifier(
        id=new_uuid(),
        piece_id=piece.id,
        identifier_type_code=TYPE_INVENTORY,
        original_value=value,
        normalized_value=value,
        normalization_status=NormalizationStatus.NORMALIZED,
        is_current=True,
    )
    session.add(identifier)
    session.flush()
    return identifier


def _material_term(session: Session, label: str) -> Term:
    vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.MATERIAL)
    )
    assert vocabulary is not None
    term = Term(id=new_uuid(), vocabulary_id=vocabulary.id, code=label.upper(), label=label)
    session.add(term)
    session.flush()
    return term


def test_restore_a_deleted_term_needs_its_vocabulary_active(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        term = _material_term(session, "Totora")
        vocabulary = session.get(Vocabulary, term.vocabulary_id)
        assert vocabulary is not None
        soft_delete(session, term, "Eliminado por error")
        soft_delete(session, vocabulary, "Vocabulario eliminado por error")

        with pytest.raises(RestoreDependencyMissing) as blocked:
            restore_from_trash(session, "term", term.id)
        assert blocked.value.code == "restore_dependency"
        assert blocked.value.details["dependency_entity_type"] == "vocabulary"
        assert blocked.value.details["dependency_entity_id"] == str(vocabulary.id)
        assert "Materiales" in blocked.value.message

        restore_from_trash(session, "vocabulary", vocabulary.id)
        entry = restore_from_trash(session, "term", term.id, "Se eliminó por error")

    assert entry.entity_label == "Totora"
    assert entry.deletion_reason == "Eliminado por error"
    assert session.get(Term, term.id) is not None
    actions = set(
        session.scalars(
            select(AuditLog.action).where(
                AuditLog.entity_type == "term", AuditLog.entity_id == term.id
            )
        )
    )
    assert AuditAction.RESTORE in actions


def test_restore_a_photo_whose_piece_is_deleted_is_rejected(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        piece = _piece(session, "Pieza con fotografía (sintética)")
        media = MediaAsset(
            id=new_uuid(),
            piece_id=piece.id,
            storage_key=f"pieces/{piece.id}/frontal.jpg",
            original_filename="frontal.jpg",
            content_type="image/jpeg",
            size_bytes=1024,
            content_sha256="0" * 64,
        )
        session.add(media)
        session.flush()
        soft_delete(session, media, "Fotografía duplicada")
        soft_delete(session, piece, "Registrada por error")

        with pytest.raises(RestoreDependencyMissing) as blocked:
            restore_from_trash(session, "media_asset", media.id)
    assert blocked.value.details["dependency_entity_type"] == "piece"
    assert blocked.value.details["dependency_entity_id"] == str(piece.id)
    assert "Restáurela primero" in blocked.value.message


def test_restore_checks_the_parent_of_locations_collections_and_pieces(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        site = create_location(
            session, level=LocationLevel.SITE, code="SEDE-PRUEBA", name="Sede de prueba"
        )
        space = create_location(
            session,
            level=LocationLevel.SPACE,
            code="SALA-PRUEBA",
            name="Sala de prueba",
            parent=site,
        )
        parent_collection = create_collection(session, name="Colección madre (sintética)")
        child_collection = create_collection(
            session, name="Subcolección (sintética)", parent_id=parent_collection.id
        )
        piece = _piece(session, "Pieza de colección (sintética)", collection_id=child_collection.id)

        soft_delete(session, space, "Sala eliminada por error")
        soft_delete(session, site, "Sede eliminada por error")
        soft_delete(session, child_collection, "Subcolección eliminada por error")
        soft_delete(session, parent_collection, "Colección eliminada por error")
        soft_delete(session, piece, "Pieza eliminada por error")

        for entity_type, entity_id, dependency in (
            ("location", space.id, "location"),
            ("collection", child_collection.id, "collection"),
            ("piece", piece.id, "collection"),
        ):
            with pytest.raises(RestoreDependencyMissing) as blocked:
                restore_from_trash(session, entity_type, entity_id)
            assert blocked.value.details["dependency_entity_type"] == dependency

        restore_from_trash(session, "location", site.id)
        restore_from_trash(session, "location", space.id)
        restore_from_trash(session, "collection", parent_collection.id)
        restore_from_trash(session, "collection", child_collection.id)
        restore_from_trash(session, "piece", piece.id)

    assert session.get(Location, space.id) is not None
    assert session.get(Piece, piece.id) is not None


def test_restore_a_piece_whose_inventory_code_is_taken_is_rejected(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """RN-002: el índice único impide ese estado, así que la prueba lo simula sin el índice."""
    session.execute(text("DROP INDEX uq_piece_identifier_current_inventory_code"))
    with act_as("ADMIN"):
        deleted = _piece(session, "Pieza eliminada con código I (sintética)")
        _inventory_code(session, deleted, "I-7001")
        soft_delete(session, deleted, "Eliminada por error")
        active = _piece(session, "Pieza activa con el mismo código I (sintética)")
        _inventory_code(session, active, "I-7001")

        blocker = _inventory_code_conflict(session, deleted)
        assert blocker is not None
        assert blocker.entity_id == active.id
        assert "I-7001" in blocker.message

        with pytest.raises(RestoreDependencyMissing) as blocked:
            restore_from_trash(session, "piece", deleted.id)
    assert blocked.value.code == "restore_dependency"
    assert "RN-002" in blocked.value.message


def test_a_piece_with_a_free_inventory_code_restores(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        piece = _piece(session, "Pieza suelta con código I (sintética)")
        _inventory_code(session, piece, "I-7002")
        soft_delete(session, piece, "Eliminada por error")
        entry = restore_from_trash(session, "piece", piece.id, "Restauración de prueba")
    assert entry.entity_type == "piece"
    assert session.get(Piece, piece.id) is not None


def test_trash_lists_what_is_deleted_filtered_by_type_and_user(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session, "Pieza en la papelera (sintética)")
        soft_delete(session, piece, "Duplicada")
    with act_as("ADMIN"):
        collection = create_collection(session, name="Colección en la papelera (sintética)")
        soft_delete(session, collection, "Creada por error")

    everything, total = list_trash(session, limit=20, offset=0)
    assert total == len(everything) == 2
    assert [entry.entity_type for entry in everything] == ["collection", "piece"]
    assert everything[0].entity_label == "Colección en la papelera (sintética)"
    assert everything[0].type_label == "Colección"
    assert everything[1].deletion_reason == "Duplicada"

    pieces_only, total_pieces = list_trash(session, entity_types=["piece"], limit=20, offset=0)
    assert total_pieces == 1 and pieces_only[0].entity_id == piece.id

    mine, total_mine = list_trash(
        session, deleted_by=users["COLLECTIONS_MANAGER"].id, limit=20, offset=0
    )
    assert total_mine == 1 and mine[0].entity_id == piece.id

    nothing, total_nothing = list_trash(
        session, deleted_by=users["CATALOGUER"].id, limit=20, offset=0
    )
    assert (nothing, total_nothing) == ([], 0)


def test_restoring_needs_the_administrator_role(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        piece = _piece(session, "Pieza eliminada (sintética)")
        soft_delete(session, piece, "Eliminada por error")
    with act_as("COLLECTIONS_MANAGER"), pytest.raises(PermissionDenied) as denied:
        restore_from_trash(session, "piece", piece.id)
    assert denied.value.code == "admin_required"


def test_unknown_entity_types_are_rejected_with_the_supported_list(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"), pytest.raises(ValidationFailed) as rejected:
        restore_from_trash(session, "app_user", uuid.uuid4())
    assert rejected.value.code == "unknown_entity_type"
    assert "term" in rejected.value.details["supported"]
