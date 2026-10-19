"""Incremental duplicate detection after a piece or an identifier is created or edited.

Change deteccion-duplicados-y-cola-revision, task 2.4 (design D3). Nothing in the catalogue or
identification services changes: a session listener notices, in the same transaction, the
writes that can change a comparison and enqueues the piece in ``quality_job_item``:

- a new piece, or an edit of a compared field (denomination, collection, author, provenance,
  epoch, dimensions);
- a new identifier, or an edit of its normalized value, type, validity or logical removal.

After the commit the ``quality-incremental`` worker (``app.core.jobs``) is woken up; it detects
the pairs of the queued pieces with the same rules as the full scan and stores them with
``scan.sync_candidates``. Without a running worker (tests, scripts) the queue stays in the
database and ``process_pending_items`` drains it; a full scan recovers whatever is left.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.core.jobs import SessionFactory, notify, register_worker
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.tracking import column_changes
from app.modules.catalog.models import Piece
from app.modules.identification.models import PieceIdentifier
from app.modules.quality.duplicates import find_candidates
from app.modules.quality.models import (
    QualityJobItem,
    QualityJobItemReason,
    QualityJobItemStatus,
)
from app.modules.quality.scan import DETECTION_ACTOR, sync_candidates

logger = logging.getLogger(__name__)

#: Name of the worker that drains ``quality_job_item``.
QUEUE = "quality-incremental"
#: Items processed per drain; the rest wait for the next one.
BATCH_SIZE = 500
#: An item that fails this many times is left as FAILED for the next full scan.
MAX_ATTEMPTS = 3

COMPARED_PIECE_FIELDS = frozenset(
    {
        "denomination",
        "collection_id",
        "author",
        "provenance",
        "epoch_start_year",
        "epoch_end_year",
        "dimensions",
    }
)
COMPARED_IDENTIFIER_FIELDS = frozenset(
    {"normalized_value", "identifier_type_code", "is_current", "deleted_at"}
)

_QUEUED = "quality_incremental_queued"


def _identifier_piece_id(identifier: PieceIdentifier) -> uuid.UUID | None:
    if identifier.piece_id is not None:
        return identifier.piece_id
    return identifier.piece.id if identifier.piece is not None else None


def _changed_pieces(session: Session) -> dict[uuid.UUID, QualityJobItemReason]:
    reasons: dict[uuid.UUID, QualityJobItemReason] = {}
    for obj in session.new:
        if isinstance(obj, Piece):
            reasons[obj.id] = QualityJobItemReason.PIECE_CREATED
        elif isinstance(obj, PieceIdentifier) and (piece_id := _identifier_piece_id(obj)):
            reasons.setdefault(piece_id, QualityJobItemReason.IDENTIFIER_CHANGED)
    for obj in session.dirty:
        if isinstance(obj, Piece) and COMPARED_PIECE_FIELDS & column_changes(obj).keys():
            reasons.setdefault(obj.id, QualityJobItemReason.PIECE_UPDATED)
        elif (
            isinstance(obj, PieceIdentifier)
            and COMPARED_IDENTIFIER_FIELDS & column_changes(obj).keys()
            and (piece_id := _identifier_piece_id(obj))
        ):
            reasons.setdefault(piece_id, QualityJobItemReason.IDENTIFIER_CHANGED)
    return reasons


def _enqueue_changed_pieces(session: Session, _flush_context: Any, _instances: Any) -> None:
    """Before each flush: queue every piece whose compared data changes (once per transaction)."""
    queued: set[uuid.UUID] = session.info.setdefault(_QUEUED, set())
    for piece_id, reason in _changed_pieces(session).items():
        if piece_id in queued:
            continue
        session.add(
            QualityJobItem(
                id=new_uuid(),
                piece_id=piece_id,
                reason=reason,
                status=QualityJobItemStatus.PENDING,
                attempts=0,
            )
        )
        queued.add(piece_id)


def _wake_worker(session: Session) -> None:
    if session.info.pop(_QUEUED, None):
        notify(QUEUE)


def _forget_queued(session: Session) -> None:
    session.info.pop(_QUEUED, None)


_installed = False


def install_incremental_detection() -> None:
    """Idempotently register the session listeners (called from ``app.persistence.install``)."""
    global _installed
    if _installed:
        return
    event.listen(Session, "before_flush", _enqueue_changed_pieces)
    event.listen(Session, "after_commit", _wake_worker)
    event.listen(Session, "after_rollback", _forget_queued)
    _installed = True


def process_pending_items(factory: SessionFactory, *, limit: int = BATCH_SIZE) -> int:
    """Detect the pairs of the queued pieces and store them; returns the items processed."""
    session = factory()
    try:
        items = session.scalars(
            select(QualityJobItem)
            .where(QualityJobItem.status == QualityJobItemStatus.PENDING)
            .order_by(QualityJobItem.created_at)
            .limit(limit)
        ).all()
        if not items:
            return 0
        item_ids = [item.id for item in items]
        piece_ids = {item.piece_id for item in items}
        try:
            context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=DETECTION_ACTOR)
            with audit_context(session, context):
                detection = find_candidates(session, piece_ids=piece_ids)
                sync_candidates(session, detection.candidates)
                now = utcnow()
                for item in items:
                    item.status = QualityJobItemStatus.DONE
                    item.attempts += 1
                    item.processed_at = now
                session.commit()
        except Exception as exc:
            logger.exception("Falló la detección incremental de %d piezas", len(piece_ids))
            session.rollback()
            for item in session.scalars(
                select(QualityJobItem).where(QualityJobItem.id.in_(item_ids))
            ):
                item.attempts += 1
                item.last_error = f"{type(exc).__name__}: {exc}"[:1000]
                if item.attempts >= MAX_ATTEMPTS:
                    item.status = QualityJobItemStatus.FAILED
            session.commit()
            return 0
        return len(items)
    finally:
        session.close()


def register_incremental_jobs() -> None:
    register_worker(QUEUE, process_pending_items, interval=30.0)
