"""Duplicate review queue: listing, expired postponements and resolution of a pair.

Change deteccion-duplicados-y-cola-revision, tasks 3.1 to 3.3 (design D2, D4 and D5).
A ``POSTPONED`` pair returns to ``PENDING`` on the first queue read after its ``postponed_until``
date: there is no cron.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import _descendants
from app.modules.collections.models import Collection
from app.modules.quality.duplicates import load_profiles
from app.modules.quality.merge import merge_pieces
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus
from app.modules.quality.schemas import DuplicateOrigin
from app.modules.quality.scoring import comparison_fingerprint

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


#: Longest postponement accepted by the queue (design D5) [SUPUESTO: F3, G8].
MAX_POSTPONE_DAYS = 180
_CLOSED = {DuplicateStatus.MERGED, DuplicateStatus.SUPERSEDED}


class CandidateClosed(ConflictError):
    code = "candidate_closed"


class StaleCandidate(ConflictError):
    """One of the pieces was already merged or removed: the pair is superseded (design D4)."""

    code = "stale_candidate"


def _as_aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _check_postponement(until: datetime | None, now: datetime) -> datetime:
    if until is None:
        raise ValidationFailed(
            "Indique hasta qué fecha se pospone la revisión.", code="postponed_until_required"
        )
    until = _as_aware(until)
    if until <= now:
        raise ValidationFailed(
            "La fecha para posponer debe ser posterior a hoy.", code="postponed_until_in_past"
        )
    if until > now + timedelta(days=MAX_POSTPONE_DAYS):
        raise ValidationFailed(
            f"Solo se puede posponer hasta {MAX_POSTPONE_DAYS} días.",
            code="postpone_too_long",
            details={"max_days": MAX_POSTPONE_DAYS},
        )
    return until


def _current_fingerprint(session: Session, candidate: DuplicateCandidate) -> str | None:
    """Fingerprint of the compared values as they are now (design D2); None for import rows."""
    if candidate.piece_b_id is None:
        return candidate.compared_fingerprint
    profiles = {
        p.piece_id: p for p in load_profiles(session, [candidate.piece_a_id, candidate.piece_b_id])
    }
    a, b = profiles.get(candidate.piece_a_id), profiles.get(candidate.piece_b_id)
    if a is None or b is None:
        return candidate.compared_fingerprint
    return comparison_fingerprint(a, b)


def _is_gone(session: Session, piece_id: uuid.UUID | None) -> bool:
    if piece_id is None:
        return False
    piece = session.get(Piece, piece_id)
    return piece is None or piece.merged_into_id is not None


def resolve_candidate(
    session: Session,
    candidate_id: uuid.UUID,
    *,
    resolution: str,
    reviewer_id: uuid.UUID,
    note: str | None = None,
    postponed_until: datetime | None = None,
    surviving_piece_id: uuid.UUID | None = None,
    field_choices: dict[str, str] | None = None,
) -> DuplicateCandidate:
    """Resolve a pair as DISTINCT, POSTPONED or MERGED (requires a manual audit context; RN-005).

    A DISTINCT pair keeps the fingerprint of the compared values, so the detection proposes it
    again only when those values change (RF-030).
    """
    candidate = session.get(DuplicateCandidate, candidate_id)
    if candidate is None:
        raise NotFound("No existe ese candidato a duplicado.")
    if candidate.status in _CLOSED:
        raise CandidateClosed(
            "Ese par ya fue resuelto con una fusión y no puede cambiarse.",
            details={"status": candidate.status.value},
        )
    now = utcnow()
    if _is_gone(session, candidate.piece_a_id) or _is_gone(session, candidate.piece_b_id):
        candidate.status = DuplicateStatus.SUPERSEDED
        candidate.reviewed_by_id = reviewer_id
        candidate.reviewed_at = now
        session.flush()
        raise StaleCandidate(
            "Una de las piezas ya fue fusionada o dada de baja; el par queda reemplazado.",
            details={"candidate_id": str(candidate.id)},
        )
    if resolution == DuplicateStatus.MERGED:
        merge_pieces(
            session,
            candidate,
            surviving_id=surviving_piece_id,
            reviewer_id=reviewer_id,
            note=note,
            field_choices=field_choices,
        )
        return candidate
    if resolution == DuplicateStatus.DISTINCT:
        candidate.compared_fingerprint = _current_fingerprint(session, candidate)
        candidate.status = DuplicateStatus.DISTINCT
        candidate.postponed_until = None
    elif resolution == DuplicateStatus.POSTPONED:
        candidate.postponed_until = _check_postponement(postponed_until, now)
        candidate.status = DuplicateStatus.POSTPONED
    else:
        raise ValidationFailed(f"Resolución no admitida: {resolution}.", code="invalid_resolution")
    candidate.reviewed_by_id = reviewer_id
    candidate.reviewed_at = now
    candidate.resolution_note = note
    session.flush()
    return candidate
