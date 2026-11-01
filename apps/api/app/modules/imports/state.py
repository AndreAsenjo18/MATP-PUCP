"""State machine of an import batch (spec importacion-datos: RF-021; design D1).

Every transition locks the batch row (``SELECT ... FOR UPDATE``) so two requests cannot move
the same batch at once, records when each state was reached in ``stage_timestamps`` and
rejects transitions not in ``TRANSITIONS`` with ``409 invalid_batch_transition``, telling the
user the current state and what can be done from it.

A ``PHOTOS`` batch (change importacion-fotos-a-catalogo, design D1) has no mapping nor validation:
it goes from ``UPLOADED`` to ``IN_PREVIEW`` once its photos are verified and matched, and then
on like a spreadsheet batch. ``ensure_transition`` picks the table by ``batch.kind``.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound
from app.core.models_base import utcnow
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchKind as K
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

PHOTO_TRANSITIONS: dict[S, frozenset[S]] = {
    **{status: frozenset() for status in S},
    S.UPLOADED: frozenset({S.IN_PREVIEW, S.ABANDONED}),
    S.IN_PREVIEW: frozenset({S.IN_PREVIEW, S.APPROVED, S.ABANDONED}),
    S.APPROVED: frozenset({S.APPLIED, S.FAILED_APPLY}),
    S.APPLIED: frozenset({S.REVERTED}),
    S.FAILED_APPLY: frozenset({S.IN_PREVIEW}),
}

TRANSITIONS_BY_KIND: dict[K, dict[S, frozenset[S]]] = {
    K.SPREADSHEET: TRANSITIONS,
    K.PHOTOS: PHOTO_TRANSITIONS,
}

#: States in which a batch admits new photos: while it is prepared, before approval (D2 of
#: importacion-masiva-fotografias; D1 of importacion-fotos-a-catalogo).
PHOTO_STATES_BY_KIND: dict[K, frozenset[S]] = {
    K.SPREADSHEET: frozenset({S.UPLOADED, S.MAPPED, S.VALIDATED, S.IN_PREVIEW}),
    K.PHOTOS: frozenset({S.UPLOADED, S.IN_PREVIEW}),
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


def allowed_transitions(status: S, kind: K = K.SPREADSHEET) -> list[S]:
    return sorted(TRANSITIONS_BY_KIND[kind][status], key=list(S).index)


def lock_batch(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    batch = session.scalar(
        select(ImportBatch)
        .where(ImportBatch.id == batch_id, ImportBatch.deleted_at.is_(None))
        .with_for_update()
    )
    if batch is None:
        raise NotFound("El lote de importación no existe.", code="batch_not_found")
    return batch


def batch_kind(batch: ImportBatch) -> K:
    """The kind of a batch; one not yet flushed has no default in the attribute."""
    return batch.kind or K.SPREADSHEET


KIND_LABELS: dict[K, str] = {K.SPREADSHEET: "con Excel", K.PHOTOS: "de solo fotografías"}


def require_kind(batch: ImportBatch, kind: K) -> None:
    """``409 batch_kind_mismatch`` when an operation of one kind of batch reaches the other: a
    ``PHOTOS`` batch has no mapping, validation nor rows (importacion-fotos-a-catalogo, D1)."""
    current = batch_kind(batch)
    if current == kind:
        return
    raise ConflictError(
        f"Esta operación es de un lote {KIND_LABELS[kind]} y el lote es {KIND_LABELS[current]}.",
        code="batch_kind_mismatch",
        details={"batch_kind": current.value, "required_kind": kind.value},
    )


def ensure_transition(batch: ImportBatch, target: S) -> None:
    kind = batch_kind(batch)
    if target in TRANSITIONS_BY_KIND[kind][batch.status]:
        return
    allowed = allowed_transitions(batch.status, kind)
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
