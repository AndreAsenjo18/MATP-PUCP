"""Loan and exhibition persistence model (RF-018, RN-005)."""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import PhysicalDeleteForbidden
from app.core.models_base import new_uuid
from app.models import AuditLog, Loan, LoanItem, Term, Vocabulary
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import VocabularyCode


def _loan_terms(session: Session) -> tuple[Term, Term]:
    type_vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.LOAN_TYPE)
    )
    status_vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.LOAN_STATUS)
    )
    assert type_vocabulary is not None and status_vocabulary is not None
    loan_type = Term(
        id=new_uuid(),
        vocabulary_id=type_vocabulary.id,
        code="TEST_EXHIBITION",
        label="Exposición de prueba",
    )
    status = Term(
        id=new_uuid(),
        vocabulary_id=status_vocabulary.id,
        code="TEST_ACTIVE",
        label="Vigente de prueba",
    )
    session.add_all((loan_type, status))
    session.flush()
    return loan_type, status


def test_reference_data_keeps_loan_vocabularies_configurable(reference) -> None:  # type: ignore[no-untyped-def]
    assert reference.terms[VocabularyCode.LOAN_TYPE] == {}
    assert reference.terms[VocabularyCode.LOAN_STATUS] == {}


def test_exhibition_can_include_multiple_pieces(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        first = create_piece(session, title="Retablo", tenure_regime=TenureRegime.OWNED)
        second = create_piece(session, title="Máscara", tenure_regime=TenureRegime.OWNED)
        loan_type, status = _loan_terms(session)
        loan = Loan(
            id=new_uuid(),
            type_term_id=loan_type.id,
            status_term_id=status.id,
            destination_label="Sala sintética",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 15),
        )
        loan.items.extend(
            (
                LoanItem(id=new_uuid(), piece_id=first.id),
                LoanItem(id=new_uuid(), piece_id=second.id),
            )
        )
        session.add(loan)
        session.commit()
    stored = session.get(Loan, loan.id)
    assert stored is not None
    assert {item.piece_id for item in stored.items} == {first.id, second.id}


def test_loan_date_range_and_piece_uniqueness_are_enforced(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Mate", tenure_regime=TenureRegime.OWNED)
        loan_type, status = _loan_terms(session)
        invalid = Loan(
            id=new_uuid(),
            type_term_id=loan_type.id,
            status_term_id=status.id,
            destination_label="Destino sintético",
            starts_on=date(2026, 10, 2),
            ends_on=date(2026, 10, 1),
        )
        session.add(invalid)
        with pytest.raises(IntegrityError):
            session.flush()
        session.rollback()

    with act_as("COLLECTIONS_MANAGER"):
        loan_type, status = _loan_terms(session)
        loan = Loan(
            id=new_uuid(),
            type_term_id=loan_type.id,
            status_term_id=status.id,
            destination_label="Destino sintético",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 2),
        )
        loan.items.extend(
            (LoanItem(id=new_uuid(), piece_id=piece.id), LoanItem(id=new_uuid(), piece_id=piece.id))
        )
        session.add(loan)
        with pytest.raises(IntegrityError):
            session.flush()
    session.rollback()


def test_loan_is_audited_and_soft_deleted(session: Session, act_as) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        loan_type, status = _loan_terms(session)
        loan = Loan(
            id=new_uuid(),
            type_term_id=loan_type.id,
            status_term_id=status.id,
            destination_label="Institución sintética",
            starts_on=date(2026, 10, 1),
            ends_on=date(2026, 10, 2),
        )
        session.add(loan)
        session.commit()
        assert session.scalars(select(AuditLog).where(AuditLog.entity_id == loan.id)).first()
        soft_delete(session, loan, "Registro de prueba")
        session.commit()

    loan_id = loan.id
    session.expunge_all()
    assert session.get(Loan, loan_id) is None
    deleted = session.get(Loan, loan_id, execution_options={INCLUDE_DELETED: True})
    assert deleted is not None and deleted.deletion_reason == "Registro de prueba"
    with act_as("ADMIN"):
        session.delete(deleted)
        with pytest.raises(PhysicalDeleteForbidden):
            session.flush()
    session.rollback()
