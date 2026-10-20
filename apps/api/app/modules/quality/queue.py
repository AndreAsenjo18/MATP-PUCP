"""Duplicate review queue: listing with filters and reopening of expired postponements.

Change deteccion-duplicados-y-cola-revision, task 3.1 (design D5). A ``POSTPONED`` pair returns
to ``PENDING`` on the first queue read after its ``postponed_until`` date: there is no cron.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.models_base import utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import _descendants
from app.modules.collections.models import Collection
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus
from app.modules.quality.schemas import DuplicateOrigin

#: Actor shown in the audit log when a postponed pair reopens.
QUEUE_ACTOR = "Cola de duplicados"


def _is_due(until: datetime | None, now: datetime) -> bool:
    if until is None:
        return False
    if until.tzinfo is None:  # SQLite returns naive datetimes (stored as UTC)
        now = now.replace(tzinfo=None)
    return until <= now


def reopen_expired_postponements(session: Session, *, now: datetime | None = None) -> int:
    """Turn every POSTPONED pair whose date has passed back into PENDING (design D5)."""
    current = now or utcnow()
    due = [
        candidate
        for candidate in session.scalars(
            select(DuplicateCandidate).where(DuplicateCandidate.status == DuplicateStatus.POSTPONED)
        )
        if _is_due(candidate.postponed_until, current)
    ]
    if not due:
        return 0
    with audit_context(session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label=QUEUE_ACTOR)):
        for candidate in due:
            candidate.status = DuplicateStatus.PENDING
            candidate.postponed_until = None
        session.flush()
    return len(due)


def queue_query(
    session: Session,
    *,
    status: DuplicateStatus | None = None,
    collection_id: uuid.UUID | None = None,
    min_score: float | None = None,
    origin: DuplicateOrigin | None = None,
) -> Select[Any]:
    """Candidates matching the filters, best score first (RF-030).

    ``collection_id`` matches a pair when either piece belongs to that collection or to one of
    its subcollections; ``origin`` separates catalogue pairs from import rows.
    """
    statement = select(DuplicateCandidate)
    if status is not None:
        statement = statement.where(DuplicateCandidate.status == status)
    if min_score is not None:
        statement = statement.where(DuplicateCandidate.score >= min_score)
    if origin == "CATALOG":
        statement = statement.where(DuplicateCandidate.piece_b_id.is_not(None))
    elif origin == "IMPORT":
        statement = statement.where(DuplicateCandidate.import_row_id.is_not(None))
    if collection_id is not None:
        in_collection = select(Piece.id).where(
            Piece.collection_id.in_(_descendants(session, Collection, collection_id))
        )
        statement = statement.where(
            or_(
                DuplicateCandidate.piece_a_id.in_(in_collection),
                DuplicateCandidate.piece_b_id.in_(in_collection),
            )
        )
    return statement.order_by(DuplicateCandidate.score.desc(), DuplicateCandidate.created_at)
