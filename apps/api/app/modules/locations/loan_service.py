"""Loan and exhibition lifecycle rules (RF-018, RF-020)."""

import uuid
from collections.abc import Iterable
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import require_audit_context
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.locations.models import Loan, LoanItem


def _term_in_vocabulary(session: Session, term_id: uuid.UUID, vocabulary_code: str) -> Term:
    term = session.scalar(
        select(Term).join(Vocabulary).where(Term.id == term_id, Vocabulary.code == vocabulary_code)
    )
    if term is None:
        raise ValidationFailed(
            "El término no pertenece al vocabulario esperado.", code="invalid_term"
        )
    return term


def _pieces(session: Session, piece_ids: Iterable[uuid.UUID]) -> list[Piece]:
    provided_ids = list(piece_ids)
    ids = list(dict.fromkeys(provided_ids))
    if not ids:
        raise ValidationFailed(
            "El expediente debe incluir al menos una pieza.", code="pieces_required"
        )
    if len(ids) != len(provided_ids):
        raise ValidationFailed(
            "Una pieza no puede repetirse en el expediente.", code="duplicate_piece"
        )
    rows = list(session.scalars(select(Piece).where(Piece.id.in_(ids), Piece.deleted_at.is_(None))))
    if len(rows) != len(ids):
        raise NotFound("Una de las piezas no existe o fue eliminada.", code="piece_not_found")
    return rows


def create_loan(
    session: Session,
    *,
    type_term_id: uuid.UUID,
    status_term_id: uuid.UUID,
    destination_label: str,
    starts_on: date,
    ends_on: date,
    piece_ids: Iterable[uuid.UUID],
    responsible_user_id: uuid.UUID | None = None,
    document_reference: str | None = None,
) -> Loan:
    require_audit_context(session)
    if ends_on < starts_on:
        raise ValidationFailed(
            "La fecha de fin no puede ser anterior a la de inicio.", code="invalid_date_range"
        )
    if not destination_label.strip():
        raise ValidationFailed(
            "Indique la institución o sala de destino.", code="destination_required"
        )
    _term_in_vocabulary(session, type_term_id, VocabularyCode.LOAN_TYPE)
    _term_in_vocabulary(session, status_term_id, VocabularyCode.LOAN_STATUS)
    pieces = _pieces(session, piece_ids)
    loan = Loan(
        id=new_uuid(),
        type_term_id=type_term_id,
        status_term_id=status_term_id,
        destination_label=destination_label.strip(),
        responsible_user_id=responsible_user_id,
        document_reference=document_reference.strip() if document_reference else None,
        starts_on=starts_on,
        ends_on=ends_on,
    )
    loan.items = [LoanItem(id=new_uuid(), piece_id=piece.id) for piece in pieces]
    session.add(loan)
    session.flush()
    return loan


def _has_overlap(session: Session, loan: Loan) -> bool:
    piece_ids = [item.piece_id for item in loan.items]
    return (
        session.scalar(
            select(LoanItem.id)
            .join(Loan)
            .where(
                LoanItem.piece_id.in_(piece_ids),
                Loan.id != loan.id,
                Loan.confirmed_at.is_not(None),
                Loan.closed_at.is_(None),
                Loan.cancelled_at.is_(None),
                Loan.deleted_at.is_(None),
                Loan.starts_on <= loan.ends_on,
                Loan.ends_on >= loan.starts_on,
            )
            .limit(1)
        )
        is not None
    )


def confirm_loan(
    session: Session,
    loan: Loan,
    *,
    status_term_id: uuid.UUID,
    availability_term_id: uuid.UUID,
) -> None:
    require_audit_context(session)
    if loan.confirmed_at is not None:
        raise BusinessRuleViolation("El expediente ya está confirmado.", code="already_confirmed")
    _term_in_vocabulary(session, status_term_id, VocabularyCode.LOAN_STATUS)
    _term_in_vocabulary(session, availability_term_id, VocabularyCode.AVAILABILITY)
    if _has_overlap(session, loan):
        raise ConflictError(
            "Una pieza ya tiene un préstamo o exposición vigente.", code="loan_overlap"
        )
    pieces: list[Piece] = []
    for item in loan.items:
        piece = session.get(Piece, item.piece_id)
        if piece is None or piece.deleted_at is not None:
            raise NotFound("Una de las piezas no existe o fue eliminada.", code="piece_not_found")
        _validate_contract_restriction(piece)
        pieces.append(piece)
    loan.status_term_id = status_term_id
    loan.active_availability_term_id = availability_term_id
    loan.confirmed_at = utcnow()
    for piece in pieces:
        piece.availability_term_id = availability_term_id
    session.flush()


def _validate_contract_restriction(piece: Piece) -> None:
    """K1 [SUPUESTO]: a loan-for-use piece needs a recorded agreement before confirmation."""
    if piece.tenure_regime is TenureRegime.LOAN_FOR_USE and not piece.loan_agreement_ref:
        raise BusinessRuleViolation(
            "La pieza en comodato exige una referencia de convenio antes de confirmarla.",
            code="loan_for_use_contract_required",
        )


def close_loan(session: Session, loan: Loan, *, status_term_id: uuid.UUID) -> None:
    require_audit_context(session)
    if loan.confirmed_at is None or loan.closed_at is not None or loan.cancelled_at is not None:
        raise BusinessRuleViolation("El expediente no está vigente.", code="loan_not_active")
    _term_in_vocabulary(session, status_term_id, VocabularyCode.LOAN_STATUS)
    loan.status_term_id = status_term_id
    loan.closed_at = utcnow()
    for item in loan.items:
        piece = session.get(Piece, item.piece_id)
        if piece is not None:
            piece.availability_term_id = _default_availability(session, piece)
    session.flush()


def cancel_loan(session: Session, loan: Loan, *, status_term_id: uuid.UUID) -> None:
    """Cancel a confirmed future record while preserving its history (RF-020, RN-005)."""
    require_audit_context(session)
    if loan.confirmed_at is None or loan.closed_at is not None or loan.cancelled_at is not None:
        raise BusinessRuleViolation("El expediente no está vigente.", code="loan_not_active")
    _term_in_vocabulary(session, status_term_id, VocabularyCode.LOAN_STATUS)
    loan.status_term_id = status_term_id
    loan.cancelled_at = utcnow()
    for item in loan.items:
        piece = session.get(Piece, item.piece_id)
        if piece is not None:
            piece.availability_term_id = _default_availability(session, piece)
    session.flush()


def _default_availability(session: Session, piece: Piece) -> uuid.UUID:
    code = "EN_DEPOSITO" if piece.current_location_id is not None else "NO_LOCALIZADA"
    term = session.scalar(
        select(Term)
        .join(Vocabulary)
        .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == code)
    )
    if term is None:
        raise BusinessRuleViolation(
            "Falta el vocabulario de disponibilidad.", code="availability_missing"
        )
    return term.id
