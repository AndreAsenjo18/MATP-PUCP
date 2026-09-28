"""Spec identificacion-piezas: RF-001..004, RN-001..004 (código I inmutable, comodato sin I)."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    BusinessRuleViolation,
    ImmutableInventoryCode,
    PermissionDenied,
    ValidationFailed,
)
from app.core.models_base import new_uuid
from app.models import AuditLog, Piece, PieceIdentifier
from app.modules.audit.models import AuditAction
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import change_tenure, create_piece
from app.modules.identification.models import NormalizationStatus
from app.modules.identification.service import add_identifier, correct_locked_identifier
from tests.conftest import ActAs


def _piece(
    session: Session, tenure: TenureRegime = TenureRegime.OWNED, title: str = "Pieza"
) -> Piece:
    return create_piece(session, title=title, tenure_regime=tenure)


def test_piece_without_codes_gets_internal_uuid(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        session.commit()
    assert piece.id is not None
    assert session.get(Piece, piece.id) is piece
    assert piece.identifiers == []


def test_two_pieces_can_share_a_historical_inc_code(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        first, second = _piece(session, title="A"), _piece(session, title="B")
        add_identifier(session, first, "INC_RN", "1234")
        add_identifier(session, second, "INC_RN", "INC 1234")
        session.commit()
    assert first.id != second.id


def test_multiple_identifiers_keep_original_and_normalized(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-0236", source="Libro de inventario")
        add_identifier(session, piece, "COLECCION", "M.M.Z. 015", source="Excel")
        add_identifier(session, piece, "INC_RN", "RN 123456", source="Ministerio")
        session.commit()
    rows = {i.identifier_type_code: i for i in piece.identifiers}
    assert rows["I"].original_value == "I-0236" and rows["I"].normalized_value == "I-236"
    assert rows["I"].is_locked and rows["I"].is_current
    assert rows["COLECCION"].normalized_value == "MMZ 15" and not rows["COLECCION"].is_locked
    assert rows["INC_RN"].detected_format == "INC_6_DIGITOS"
    assert rows["INC_RN"].source == "Ministerio"


def test_replacing_non_inventory_code_keeps_history_searchable(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        old = add_identifier(session, piece, "INC_RN", "4521")
        new = add_identifier(session, piece, "INC_RN", "RN 004521", replaces=old)
        session.commit()
    assert not old.is_current and old.replaced_by_id == new.id
    found = session.scalars(
        select(PieceIdentifier.piece_id).where(PieceIdentifier.normalized_value == "4521")
    ).all()
    assert found == [piece.id]


def test_unknown_identifier_type_lists_available_types(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        with pytest.raises(ValidationFailed) as excinfo:
            add_identifier(session, piece, "SURDOC", "123")
    assert excinfo.value.code == "unknown_identifier_type"
    assert "I, COLECCION, INC_RN" in excinfo.value.message


@pytest.mark.parametrize("value", ["", "   ", None])
def test_empty_identifier_is_rejected(session: Session, act_as: ActAs, value: str | None) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        with pytest.raises(ValidationFailed) as excinfo:
            add_identifier(session, piece, "COLECCION", value)
    assert excinfo.value.code == "empty_identifier"


def test_unparseable_inc_code_is_kept_for_review(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        identifier = add_identifier(session, piece, "INC_RN", "???")
    assert identifier.normalization_status is NormalizationStatus.UNPARSEABLE
    assert identifier.original_value == "???"
    assert identifier.normalized_value is None


# --- RN-002: immutable inventory code ---------------------------------------------------------
def test_direct_edit_of_assigned_inventory_code_is_rejected(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        identifier = add_identifier(session, piece, "I", "I-236")
        session.commit()
        identifier.original_value = "I-237"
        identifier.normalized_value = "I-237"
        with pytest.raises(ImmutableInventoryCode):
            session.flush()
    session.rollback()


def test_even_admin_cannot_edit_inventory_code_without_correction_procedure(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        identifier = add_identifier(session, piece, "I", "I-236")
        session.commit()
    with act_as("ADMIN"):
        identifier.is_current = False
        with pytest.raises(ImmutableInventoryCode):
            session.flush()
    session.rollback()


def test_inventory_code_cannot_be_soft_deleted(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        identifier = add_identifier(session, piece, "I", "I-236")
        session.commit()
        with pytest.raises(ImmutableInventoryCode):
            soft_delete(session, identifier, "Intento de borrar el código I")
    session.rollback()


def test_second_inventory_code_is_rejected(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
        with pytest.raises(ImmutableInventoryCode) as excinfo:
            add_identifier(session, piece, "I", "I-300")
    assert "Administrador" in excinfo.value.message


def test_admin_correction_is_audited_and_keeps_old_value(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        old = add_identifier(session, piece, "I", "I-236")
        session.commit()
    with act_as("ADMIN"):
        new = correct_locked_identifier(session, piece, "I", "I 0263", "Error de transcripción")
        session.commit()
    assert new.normalized_value == "I-263" and new.is_current and new.is_locked
    assert not old.is_current and old.replaced_by_id == new.id and old.original_value == "I-236"
    corrections = session.scalars(
        select(AuditLog).where(AuditLog.action == AuditAction.CORRECTION)
    ).all()
    assert corrections
    assert {entry.reason for entry in corrections} == {"Error de transcripción"}
    old_entry = next(e for e in corrections if e.entity_id == old.id and e.field == "is_current")
    assert (old_entry.old_value, old_entry.new_value) == (True, False)
    assert all(entry.user_id is not None for entry in corrections)


def test_correction_requires_reason(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
    with act_as("ADMIN"), pytest.raises(ValidationFailed) as excinfo:
        correct_locked_identifier(session, piece, "I", "I-263", "  ")
    assert excinfo.value.code == "reason_required"


def test_correction_requires_admin(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
    with act_as("COLLECTIONS_MANAGER"), pytest.raises(PermissionDenied):
        correct_locked_identifier(session, piece, "I", "I-263", "Motivo")


def test_duplicate_inventory_code_names_existing_piece(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        first = _piece(session, title="Primera")
        add_identifier(session, first, "I", "I-236")
        second = _piece(session, title="Segunda")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            add_identifier(session, second, "I", "I 0236")
    assert excinfo.value.code == "duplicate_identifier"
    assert excinfo.value.details["piece_id"] == str(first.id)


def test_database_partial_unique_index_on_current_inventory_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        first, second = _piece(session, title="A"), _piece(session, title="B")
        for piece in (first, second):  # bypass the service on purpose
            session.add(
                PieceIdentifier(
                    id=new_uuid(),
                    piece_id=piece.id,
                    identifier_type_code="I",
                    original_value="I-236",
                    normalized_value="I-236",
                    normalization_status=NormalizationStatus.NORMALIZED,
                    is_locked=True,
                )
            )
        with pytest.raises(IntegrityError):
            session.flush()
    session.rollback()


def test_inventory_code_of_deleted_piece_is_not_reused(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        deleted = _piece(session, title="Eliminada")
        add_identifier(session, deleted, "I", "I-500")
        soft_delete(session, deleted, "Registrada por error")
        other = _piece(session, title="Nueva")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            add_identifier(session, other, "I", "I-500")
    assert excinfo.value.code == "identifier_of_deleted_piece"


@pytest.mark.parametrize("marker", ["S/N", "s/c", "-", "0"])
def test_absence_marker_is_not_an_inventory_code(
    session: Session, act_as: ActAs, marker: str
) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session)
        with pytest.raises(ValidationFailed) as excinfo:
            add_identifier(session, piece, "I", marker)
    assert excinfo.value.code == "absence_marker"


# --- RN-003 / RN-004: tenure restrictions -----------------------------------------------------
def test_loan_for_use_piece_cannot_receive_inventory_code(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session, TenureRegime.LOAN_FOR_USE)
        collection_code = add_identifier(session, piece, "COLECCION", "AJB 12")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            add_identifier(session, piece, "I", "I-700")
    assert collection_code.normalized_value == "AJB 12"
    assert excinfo.value.code == "identifier_not_allowed_for_tenure"
    assert "comodato" in excinfo.value.message


def test_flush_guard_blocks_inventory_code_on_loan_for_use_bypassing_service(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session, TenureRegime.LOAN_FOR_USE)
        session.add(
            PieceIdentifier(
                id=new_uuid(),
                piece_id=piece.id,
                identifier_type_code="I",
                original_value="I-700",
                normalized_value="I-700",
                normalization_status=NormalizationStatus.NORMALIZED,
            )
        )
        with pytest.raises(BusinessRuleViolation):
            session.flush()
    session.rollback()


@pytest.mark.parametrize("type_code", ["I", "COLECCION"])
def test_temporary_loan_gets_neither_inventory_nor_collection_code(
    session: Session, act_as: ActAs, type_code: str
) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session, TenureRegime.TEMPORARY_LOAN)
        with pytest.raises(BusinessRuleViolation):
            add_identifier(session, piece, type_code, "RA 5" if type_code == "COLECCION" else "I-5")


def test_owned_piece_with_inventory_code_cannot_become_loan_for_use(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            change_tenure(session, piece, TenureRegime.LOAN_FOR_USE, "Error")
    assert excinfo.value.code == "tenure_change_with_inventory_code"
    session.rollback()


def test_loan_for_use_becomes_owned_and_then_accepts_inventory_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session, TenureRegime.LOAN_FOR_USE)
        with pytest.raises(ValidationFailed):
            change_tenure(session, piece, TenureRegime.OWNED, None)
        change_tenure(session, piece, TenureRegime.OWNED, "Donación posterior, acta sintética 01")
        identifier = add_identifier(session, piece, "I", "I-801")
        session.commit()
    assert identifier.is_locked
    entry = session.scalars(
        select(AuditLog).where(
            AuditLog.entity_id == piece.id,
            AuditLog.field == "tenure_regime",
            AuditLog.action == AuditAction.UPDATE,
        )
    ).one()
    assert (entry.old_value, entry.new_value) == ("LOAN_FOR_USE", "OWNED")
    assert entry.reason == "Donación posterior, acta sintética 01"
