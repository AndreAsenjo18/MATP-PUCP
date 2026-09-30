"""Loan lifecycle rules (RF-018, RF-020)."""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ConflictError, ValidationFailed
from app.core.models_base import new_uuid
from app.models import Loan, Term, Vocabulary
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import VocabularyCode
from app.modules.identification.models import PieceIdentifier
from app.modules.locations.loan_service import cancel_loan, close_loan, confirm_loan, create_loan


def _term(session: Session, vocabulary_code: str, code: str) -> Term:
    vocabulary = session.scalar(select(Vocabulary).where(Vocabulary.code == vocabulary_code))
    assert vocabulary is not None
    term = Term(id=new_uuid(), vocabulary_id=vocabulary.id, code=code, label=code)
    session.add(term)
    session.flush()
    return term


def test_loan_rejects_invalid_dates(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_EXHIBITION")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        with pytest.raises(ValidationFailed, match="fecha de fin"):
            create_loan(
                session,
                type_term_id=loan_type.id,
                status_term_id=draft.id,
                destination_label="Sala",
                starts_on=date(2026, 10, 2),
                ends_on=date(2026, 10, 1),
                piece_ids=[new_uuid()],
            )


def test_confirm_rejects_overlapping_piece(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Retablo", tenure_regime=TenureRegime.OWNED)
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_EXHIBITION")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        active = _term(session, VocabularyCode.LOAN_STATUS, "TEST_ACTIVE")
        availability = session.scalar(
            select(Term)
            .join(Vocabulary)
            .where(
                Vocabulary.code == VocabularyCode.AVAILABILITY,
                Term.code == "EN_EXPOSICION_TEMPORAL",
            )
        )
        assert availability is not None
        first = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Sala A",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 10),
            piece_ids=[piece.id],
        )
        confirm_loan(session, first, status_term_id=active.id, availability_term_id=availability.id)
        second = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Sala B",
            starts_on=date(2026, 10, 5),
            ends_on=date(2026, 10, 15),
            piece_ids=[piece.id],
        )
        with pytest.raises(ConflictError) as error:
            confirm_loan(
                session, second, status_term_id=active.id, availability_term_id=availability.id
            )
        assert error.value.code == "loan_overlap"


def test_close_restores_location_based_availability(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Máscara", tenure_regime=TenureRegime.OWNED)
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_LOAN")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        active = _term(session, VocabularyCode.LOAN_STATUS, "TEST_ACTIVE")
        closed = _term(session, VocabularyCode.LOAN_STATUS, "TEST_CLOSED")
        availability = session.scalar(
            select(Term)
            .join(Vocabulary)
            .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == "EN_PRESTAMO")
        )
        assert availability is not None
        loan = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Institución sintética",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 2),
            piece_ids=[piece.id],
        )
        confirm_loan(session, loan, status_term_id=active.id, availability_term_id=availability.id)
        close_loan(session, loan, status_term_id=closed.id)
        session.commit()
    stored = session.get(Loan, loan.id)
    assert stored is not None and stored.closed_at is not None
    assert session.get(type(piece), piece.id).availability_term_id != availability.id


def test_cancel_preserves_loan_history(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Textil", tenure_regime=TenureRegime.OWNED)
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_LOAN")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        active = _term(session, VocabularyCode.LOAN_STATUS, "TEST_ACTIVE")
        cancelled = _term(session, VocabularyCode.LOAN_STATUS, "TEST_CANCELLED")
        availability = session.scalar(
            select(Term)
            .join(Vocabulary)
            .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == "EN_PRESTAMO")
        )
        assert availability is not None
        loan = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Institución sintética",
            starts_on=date(2026, 11, 1),
            ends_on=date(2026, 11, 2),
            piece_ids=[piece.id],
        )
        confirm_loan(session, loan, status_term_id=active.id, availability_term_id=availability.id)
        cancel_loan(session, loan, status_term_id=cancelled.id)
        session.commit()
    stored = session.get(Loan, loan.id)
    assert stored is not None and stored.cancelled_at is not None


def test_temporary_loan_participation_stays_out_of_permanent_inventory(
    session: Session, act_as
) -> None:  # type: ignore[no-untyped-def]
    """RN-004: a temporary incoming piece may participate but never gains an I code."""
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(
            session, title="Pieza visitante", tenure_regime=TenureRegime.TEMPORARY_LOAN
        )
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_EXHIBITION")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        loan = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Sala temporal",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 2),
            piece_ids=[piece.id],
        )
        session.flush()
    assert [item.piece_id for item in loan.items] == [piece.id]
    assert (
        session.scalars(select(PieceIdentifier).where(PieceIdentifier.piece_id == piece.id)).all()
        == []
    )


def test_loan_for_use_requires_agreement_reference_before_confirmation(
    session: Session, act_as
) -> None:  # type: ignore[no-untyped-def]
    """K1 [SUPUESTO]: comodato is blocked without its agreement reference (RN-008)."""
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(
            session, title="Pieza en comodato", tenure_regime=TenureRegime.LOAN_FOR_USE
        )
        loan_type = _term(session, VocabularyCode.LOAN_TYPE, "TEST_LOAN")
        draft = _term(session, VocabularyCode.LOAN_STATUS, "TEST_DRAFT")
        active = _term(session, VocabularyCode.LOAN_STATUS, "TEST_ACTIVE")
        availability = session.scalar(
            select(Term)
            .join(Vocabulary)
            .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == "EN_PRESTAMO")
        )
        assert availability is not None
        loan = create_loan(
            session,
            type_term_id=loan_type.id,
            status_term_id=draft.id,
            destination_label="Institución sintética",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 2),
            piece_ids=[piece.id],
        )
        with pytest.raises(BusinessRuleViolation) as error:
            confirm_loan(
                session, loan, status_term_id=active.id, availability_term_id=availability.id
            )
    assert error.value.code == "loan_for_use_contract_required"
