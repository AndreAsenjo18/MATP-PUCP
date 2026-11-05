"""History of conservation assessments (spec colecciones-vocabularios: RF-012, RN-005, RN-010).

Every assessment is kept (``conservation_assessment`` is append-only). The current state of the
piece (``piece.conservation_state_id``) is the one of the most recent assessment by
``assessed_at``, not by insertion, so an old assessment recorded today joins the history without
changing the current state (colecciones-y-vocabularios-admin, design D3).
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import require_audit_context
from app.modules.catalog.models import ConservationAssessment, Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode


def _active_terms(session: Session) -> list[Term]:
    return list(
        session.scalars(
            select(Term)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(
                Vocabulary.code == VocabularyCode.CONSERVATION_STATUS,
                Term.is_active.is_(True),
                Term.deleted_at.is_(None),
            )
            .order_by(Term.sort_order, Term.label)
        )
    )


def _status_term(session: Session, term_id: uuid.UUID) -> Term:
    active = _active_terms(session)
    for term in active:
        if term.id == term_id:
            return term
    raise ValidationFailed(
        "El estado de conservación no es un término activo de la escala: elija uno de los "
        "estados disponibles.",
        code="invalid_conservation_term",
        details={
            "status_term_id": str(term_id),
            "available": [{"id": str(term.id), "label": term.label} for term in active],
        },
    )


def list_assessments(session: Session, piece: Piece) -> list[ConservationAssessment]:
    """Most recent first, by assessment date."""
    return list(
        session.scalars(
            select(ConservationAssessment)
            .where(ConservationAssessment.piece_id == piece.id)
            .order_by(ConservationAssessment.assessed_at.desc(), ConservationAssessment.id)
        )
    )


def record_assessment(
    session: Session,
    piece: Piece,
    *,
    status_term_id: uuid.UUID,
    assessed_at: datetime | None = None,
    assessed_by_label: str | None = None,
    notes: str | None = None,
) -> ConservationAssessment:
    """Insert an assessment and, if it is the most recent one, make it the current state."""
    ctx = require_audit_context(session)
    term = _status_term(session, status_term_id)
    when = assessed_at or utcnow()
    newer = session.scalar(
        select(ConservationAssessment.id)
        .where(
            ConservationAssessment.piece_id == piece.id,
            ConservationAssessment.assessed_at > when,
        )
        .limit(1)
    )
    assessment = ConservationAssessment(
        id=new_uuid(),
        piece_id=piece.id,
        status_term_id=term.id,
        assessed_at=when,
        assessed_by_user_id=ctx.user_id,
        assessed_by_label=(assessed_by_label or "").strip() or None,
        notes=notes,
    )
    session.add(assessment)
    if newer is None and piece.conservation_state_id != term.id:
        piece.conservation_state_id = term.id
    session.flush()
    return assessment
