"""Descartar un lote que no se va a aprobar (change importacion-descartar-lote; RF-021, RN-005).

The batch moves to ``ABANDONED`` through the state machine (only from a state that allows it), so
nothing is deleted: its rows, decisions and file stay for the record and the batch log. Its photos
are purged later by ``photo_purge``, as for any closed batch. (Closing the duplicate pairs of its
rows went away with the duplicate queue, change retirar-cola-duplicados.)
"""

import uuid

from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import lock_batch, transition

DEFAULT_REASON = "Descartado por quien prepara la carga."


def abandon_batch(
    session: Session, batch_id: uuid.UUID, *, user_id: uuid.UUID, reason: str | None = None
) -> ImportBatch:
    """The abandoned batch. ``409`` while a stage is running or from a closed state."""
    batch = lock_batch(session, batch_id)
    if batch.processing_started_at is not None:
        raise ConflictError(
            "El lote se está procesando: espere a que termine para descartarlo.",
            code="batch_processing",
        )
    text = reason.strip() if reason and reason.strip() else DEFAULT_REASON
    batch = transition(session, batch.id, S.ABANDONED, reason=text)
    session.flush()
    return batch
