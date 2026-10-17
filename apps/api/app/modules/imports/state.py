"""State machine of an import batch (spec importacion-datos: RF-021; design D1).

Every transition locks the batch row (``SELECT ... FOR UPDATE``) so two requests cannot move
the same batch at once, records when each state was reached in ``stage_timestamps`` and
rejects transitions not in ``TRANSITIONS`` with ``409 invalid_batch_transition``, telling the
user the current state and what can be done from it.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound
from app.core.models_base import utcnow
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S

TRANSITIONS: dict[S, frozenset[S]] = {
    S.UPLOADED: frozenset({S.MAPPED, S.FAILED_INGESTION, S.ABANDONED}),
    S.FAILED_INGESTION: frozenset(),
    S.MAPPED: frozenset({S.MAPPED, S.VALIDATED, S.ABANDONED}),
    S.VALIDATED: frozenset({S.IN_PREVIEW}),
    S.IN_PREVIEW: frozenset({S.IN_PREVIEW, S.MAPPED, S.APPROVED, S.ABANDONED}),
    S.APPROVED: frozenset({S.APPLIED, S.FAILED_APPLY}),
    S.APPLIED: frozenset({S.REVERTED}),
    S.FAILED_APPLY: frozenset({S.IN_PREVIEW}),
    S.ABANDONED: frozenset(),
    S.REVERTED: frozenset(),
}

STATUS_LABELS: dict[S, str] = {
    S.UPLOADED: "subido",
    S.FAILED_INGESTION: "fallido en ingesta",
    S.MAPPED: "mapeado",
    S.VALIDATED: "validado",
    S.IN_PREVIEW: "en previsualización",
    S.APPROVED: "aprobado",
    S.APPLIED: "aplicado",
    S.FAILED_APPLY: "fallido al aplicar",
    S.ABANDONED: "abandonado",
    S.REVERTED: "revertido",
}

# What the user does to reach each state, to explain a rejected transition in plain words.
ACTION_LABELS: dict[S, str] = {
    S.UPLOADED: "volver al estado subido",
    S.MAPPED: "mapear columnas",
    S.VALIDATED: "validar",
    S.IN_PREVIEW: "revisar la previsualización",
    S.APPROVED: "aprobar",
    S.APPLIED: "aplicar",
    S.FAILED_INGESTION: "marcar como fallido en ingesta",
    S.FAILED_APPLY: "marcar como fallido al aplicar",
    S.ABANDONED: "abandonar",
    S.REVERTED: "revertir",
}


def allowed_transitions(status: S) -> list[S]:
    return sorted(TRANSITIONS[status], key=list(S).index)


def lock_batch(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    batch = session.scalar(
        select(ImportBatch)
        .where(ImportBatch.id == batch_id, ImportBatch.deleted_at.is_(None))
        .with_for_update()
    )
    if batch is None:
        raise NotFound("El lote de importación no existe.", code="batch_not_found")
    return batch


def ensure_transition(batch: ImportBatch, target: S) -> None:
    if target in TRANSITIONS[batch.status]:
        return
    allowed = allowed_transitions(batch.status)
    actions = ", ".join(ACTION_LABELS[status] for status in allowed) or "ninguna"
    raise ConflictError(
        f"No se puede {ACTION_LABELS[target]} un lote en estado "
        f"«{STATUS_LABELS[batch.status]}». Acciones posibles: {actions}.",
        code="invalid_batch_transition",
        details={
            "current_status": batch.status.value,
            "requested_status": target.value,
            "allowed": [status.value for status in allowed],
        },
    )


def transition(
    session: Session,
    batch_id: uuid.UUID,
    target: S,
    *,
    reason: str | None = None,
    now: datetime | None = None,
) -> ImportBatch:
    """Move a batch to ``target``; ``reason`` becomes ``status_reason`` (``None`` clears it)."""
    batch = lock_batch(session, batch_id)
    ensure_transition(batch, target)
    batch.status = target
    batch.status_reason = reason
    batch.stage_timestamps = {
        **(batch.stage_timestamps or {}),
        target.value: (now or utcnow()).isoformat(),
    }
    session.flush()
    return batch
