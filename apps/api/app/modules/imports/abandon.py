"""Descartar un lote que no se va a aprobar (change importacion-descartar-lote; RF-021, RN-005).

The batch moves to ``ABANDONED`` through the state machine (only from a state that allows it), so
nothing is deleted: its rows, decisions and file stay for the record and the batch log. The open
duplicate pairs of its rows leave the queue (``SUPERSEDED``): they would otherwise wait forever for
a row that will never reach the catalogue. Its photos are purged later by ``photo_purge``, as for
any closed batch.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.core.models_base import utcnow
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import lock_batch, transition
from app.modules.quality.import_rows import OPEN_STATUSES
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus

ABANDONED_NOTE = "Su lote se descartó: la fila no entrará al catálogo."
DEFAULT_REASON = "Descartado por quien prepara la carga."


def abandon_batch(
    session: Session, batch_id: uuid.UUID, *, user_id: uuid.UUID, reason: str | None = None
) -> tuple[ImportBatch, int]:
    """``(batch, closed pairs)``. ``409`` while a stage is running or from a closed state."""
    batch = lock_batch(session, batch_id)
    if batch.processing_started_at is not None:
        raise ConflictError(
            "El lote se está procesando: espere a que termine para descartarlo.",
            code="batch_processing",
        )
    text = reason.strip() if reason and reason.strip() else DEFAULT_REASON
    batch = transition(session, batch.id, S.ABANDONED, reason=text)
    now = utcnow()
    closed = 0
    for candidate in session.scalars(
        select(DuplicateCandidate).where(
            DuplicateCandidate.import_row_id.in_(
                select(ImportRow.id).where(ImportRow.batch_id == batch.id)
            ),
            DuplicateCandidate.status.in_(OPEN_STATUSES),
        )
    ):
        candidate.status = DuplicateStatus.SUPERSEDED
        candidate.reviewed_by_id = user_id
        candidate.reviewed_at = now
        candidate.resolution_note = ABANDONED_NOTE
        candidate.postponed_until = None
        closed += 1
    session.flush()
    return batch, closed
