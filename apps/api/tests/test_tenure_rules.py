"""Tabla de transiciones del régimen de tenencia (change ficha-pieza-crud, tarea 1.2).

Una prueba por fila de la tabla de `app/modules/catalog/tenure.py` (design D4), con la PUCP como
única propietaria legal (RN-006) y la guarda de `before_flush` como segunda barrera.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import change_tenure, create_piece
from app.modules.catalog.tenure import find_transition, legal_owner_for
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.service import add_identifier
from tests.conftest import ActAs


def _piece(session: Session, regime: TenureRegime = TenureRegime.OWNED, **fields: object) -> Piece:
    denomination = str(fields.pop("denomination", "Pieza sintética"))
    return create_piece(session, denomination=denomination, tenure_regime=regime, **fields)


def _audit_entries(
    session: Session, piece: Piece, field: str, action: AuditAction | None = None
) -> list[AuditLog]:
    entries = list(
        session.scalars(
            select(AuditLog).where(AuditLog.entity_id == piece.id, AuditLog.field == field)
        )
    )
    if action is None:
        return entries
    return [entry for entry in entries if entry.action is action]


# --- La tabla cubre las filas del diseño (D4) ------------------------------------------------
@pytest.mark.parametrize(
    ("from_regime", "to_regime", "requires_reason", "requires_document"),
    [
        (TenureRegime.OWNED, TenureRegime.LOAN_FOR_USE, False, False),
        (TenureRegime.LOAN_FOR_USE, TenureRegime.OWNED, True, True),
        (TenureRegime.OWNED, TenureRegime.TEMPORARY_LOAN, False, False),
        (TenureRegime.LOAN_FOR_USE, TenureRegime.TEMPORARY_LOAN, False, False),
        (TenureRegime.TEMPORARY_LOAN, TenureRegime.OWNED, True, False),
        (TenureRegime.TEMPORARY_LOAN, TenureRegime.LOAN_FOR_USE, True, False),
    ],
)
def test_table_covers_every_transition(
    from_regime: TenureRegime,
    to_regime: TenureRegime,
    requires_reason: bool,
    requires_document: bool,
) -> None:
    transition = find_transition(from_regime, to_regime)
    assert transition is not None
    assert transition.requires_reason is requires_reason
    assert transition.requires_supporting_document is requires_document


# --- Fila 1: propiedad -> comodato ----------------------------------------------------------
def test_owned_to_loan_for_use_is_rejected_with_a_current_inventory_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            change_tenure(session, piece, TenureRegime.LOAN_FOR_USE, "Error de registro")
    assert excinfo.value.code == "tenure_change_with_inventory_code"
    assert piece.tenure_regime is TenureRegime.OWNED
    session.rollback()


def test_owned_to_loan_for_use_does_not_need_a_reason(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        change_tenure(session, piece, TenureRegime.LOAN_FOR_USE, None)
        session.commit()
    assert piece.tenure_regime is TenureRegime.LOAN_FOR_USE
    assert piece.legal_owner is None


# --- Fila 2: comodato -> propiedad ----------------------------------------------------------
def test_loan_for_use_to_owned_requires_reason_and_supporting_document(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session, TenureRegime.LOAN_FOR_USE)
        with pytest.raises(ValidationFailed) as excinfo:
            change_tenure(session, piece, TenureRegime.OWNED, None)
        assert excinfo.value.code == "reason_required"
        with pytest.raises(ValidationFailed) as excinfo:
            change_tenure(session, piece, TenureRegime.OWNED, "Donación posterior")
        assert excinfo.value.code == "supporting_document_required"
        change_tenure(
            session,
            piece,
            TenureRegime.OWNED,
            "Donación posterior",
            supporting_document_ref="Acta sintética 01",
        )
        session.commit()
    assert piece.tenure_regime is TenureRegime.OWNED
    assert piece.legal_owner == LEGAL_OWNER_PUCP
    entry = _audit_entries(session, piece, "tenure_regime", AuditAction.UPDATE)[0]
    assert (entry.old_value, entry.new_value) == ("LOAN_FOR_USE", "OWNED")
    assert entry.reason == "Donación posterior | documento: Acta sintética 01"


# --- Fila 3: * -> préstamo temporal --------------------------------------------------------
def test_temporary_loan_is_rejected_with_a_current_inventory_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            change_tenure(session, piece, TenureRegime.TEMPORARY_LOAN, "Préstamo")
    assert excinfo.value.code == "tenure_change_with_inventory_code"
    assert piece.tenure_regime is TenureRegime.OWNED
    session.rollback()


def test_temporary_loan_is_rejected_with_a_current_collection_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        add_identifier(session, piece, "COLECCION", "RA 28")
        with pytest.raises(BusinessRuleViolation) as excinfo:
            change_tenure(session, piece, TenureRegime.TEMPORARY_LOAN, "Préstamo")
    assert excinfo.value.code == "tenure_change_with_restricted_code"
    assert piece.tenure_regime is TenureRegime.OWNED
    session.rollback()


def test_temporary_loan_is_allowed_without_those_codes(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        change_tenure(session, piece, TenureRegime.TEMPORARY_LOAN, None)
        session.commit()
    assert piece.tenure_regime is TenureRegime.TEMPORARY_LOAN
    assert piece.legal_owner is None


# --- Fila 4: préstamo temporal -> propiedad/comodato ----------------------------------------
def test_leaving_temporary_loan_requires_a_reason(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session, TenureRegime.TEMPORARY_LOAN)
        with pytest.raises(ValidationFailed) as excinfo:
            change_tenure(session, piece, TenureRegime.OWNED, None)
    assert excinfo.value.code == "reason_required"
    session.rollback()


@pytest.mark.parametrize("new_regime", [TenureRegime.OWNED, TenureRegime.LOAN_FOR_USE])
def test_leaving_temporary_loan_keeps_the_number_as_a_not_current_identifier(
    session: Session, act_as: ActAs, new_regime: TenureRegime
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session, TenureRegime.TEMPORARY_LOAN, temporary_inventory_number="TEMP-7")
        change_tenure(session, piece, new_regime, "Devolución del préstamo")
        session.commit()
    assert piece.temporary_inventory_number == "TEMP-7"
    identifiers = list(
        session.scalars(select(PieceIdentifier).where(PieceIdentifier.piece_id == piece.id))
    )
    assert len(identifiers) == 1
    assert identifiers[0].identifier_type_code == "OTRO"
    assert identifiers[0].original_value == "TEMP-7"
    assert identifiers[0].is_current is False


# --- Reglas generales de la tabla -----------------------------------------------------------
def test_changing_to_the_same_regime_does_nothing(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        before = len(_audit_entries(session, piece, "tenure_regime"))
        change_tenure(session, piece, TenureRegime.OWNED, None)
        session.commit()
    assert len(_audit_entries(session, piece, "tenure_regime")) == before


def test_pucp_is_the_only_legal_owner_of_the_owned_pieces() -> None:
    assert legal_owner_for(TenureRegime.OWNED) == LEGAL_OWNER_PUCP
    assert legal_owner_for(TenureRegime.LOAN_FOR_USE) is None
    assert legal_owner_for(TenureRegime.TEMPORARY_LOAN) is None
    with pytest.raises(BusinessRuleViolation) as excinfo:
        legal_owner_for(TenureRegime.OWNED, "Coleccionista sintético")
    assert excinfo.value.code == "invalid_legal_owner"


def test_flush_guard_rejects_leaving_owned_with_a_current_inventory_code(
    session: Session, act_as: ActAs
) -> None:
    """La guarda de `before_flush` consulta la misma tabla (ninguna ruta la esquiva)."""
    with act_as("COLLECTIONS_MANAGER"):
        piece = _piece(session)
        add_identifier(session, piece, "I", "I-236")
        piece.tenure_regime = TenureRegime.LOAN_FOR_USE
        with pytest.raises(BusinessRuleViolation) as excinfo:
            session.flush()
    assert excinfo.value.code == "tenure_change_with_inventory_code"
    session.rollback()
