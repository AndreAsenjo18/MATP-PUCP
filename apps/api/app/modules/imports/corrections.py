"""Corregir un valor del archivo en la revisión (change importacion-corregir-celda; RF-025, RN-005).

A cell with a typo («I.-1814») is corrected on the stored row instead of uploading the file again.
The normalization rules stay strict: the person fixes the value. The original file is never
touched; the row keeps the first original value of each corrected cell in ``__corrections`` (with
who and when), and the change is audited like any update of ``import_row``. The batch goes back to
``MAPPED`` so it is validated again with the usual stage: a row's classification depends on the
other rows (the same code I twice), so the whole batch is recomputed, not just this row.
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import utcnow
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import ROW_KINDS, STATUS_LABELS, lock_batch, require_kind, transition

#: Key of the row's raw data where corrected cells keep their original value.
CORRECTIONS_KEY = "__corrections"
EDITABLE_STATUSES = frozenset({S.MAPPED, S.IN_PREVIEW})


def correct_cell(
    session: Session,
    batch_id: uuid.UUID,
    row_id: uuid.UUID,
    *,
    column: str,
    value: str | None,
    user_id: uuid.UUID,
) -> ImportBatch:
    """Write ``value`` in ``column`` of the row and leave the batch ready to validate again."""
    batch = lock_batch(session, batch_id)
    require_kind(batch, ROW_KINDS)
    if batch.processing_started_at is not None:
        raise ConflictError(
            "El lote se está procesando: espere a que termine para corregir un valor.",
            code="batch_processing",
        )
    if batch.status not in EDITABLE_STATUSES:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: ya no se corrigen sus valores.",
            code="batch_not_editable",
            details={"current_status": batch.status.value},
        )
    row = session.get(ImportRow, row_id)
    if row is None or row.batch_id != batch.id:
        raise NotFound("La fila no pertenece a este lote.", code="row_not_found")
    headers = list((batch.counts or {}).get("headers") or [])
    if column.startswith("__") or (headers and column not in headers):
        raise ValidationFailed(
            f"El archivo no tiene una columna «{column}».",
            code="unknown_column",
            details={"column": column},
        )
    text = value.strip() if isinstance(value, str) and value.strip() else None
    raw: dict[str, Any] = dict(row.raw_data or {})
    corrections: dict[str, Any] = dict(raw.get(CORRECTIONS_KEY) or {})
    first = corrections.get(column)
    original = first["original"] if isinstance(first, dict) else raw.get(column)
    corrections[column] = {
        "original": original,
        "value": text,
        "by": str(user_id),
        "at": utcnow().isoformat(),
    }
    raw[column] = text
    raw[CORRECTIONS_KEY] = corrections
    row.raw_data = raw
    if batch.status == S.IN_PREVIEW:
        batch = transition(session, batch.id, S.MAPPED)
    session.flush()
    return batch
