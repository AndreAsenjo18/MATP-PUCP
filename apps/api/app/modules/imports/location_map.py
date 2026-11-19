"""Ubicaciones del archivo que no existen (change importacion-aplicar-vocabularios, D4).

A location written in the file that matches no location of the museum («Deposito N° 1») is a
warning of its rows. In the review the person points it to an existing location (or one created
there): the correspondence is stored in the batch mapping as the ``value_map`` of the location
column («Deposito N° 1» → the code of the location), so validating again resolves every row that
wrote it, and saving the mapping as a format keeps it for the next file.
"""

import copy
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.modules.imports.mapping import LOCATION_FIELD, _fold
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import ROW_KINDS, STATUS_LABELS, lock_batch, require_kind, transition
from app.modules.locations.models import Location, LocationLevel

EDITABLE_STATUSES = frozenset({S.MAPPED, S.IN_PREVIEW})
UNRESOLVED_CODES = frozenset({"location_not_found", "location_ambiguous"})


def unresolved_locations(session: Session, batch_id: uuid.UUID) -> list[tuple[str, int]]:
    """``(text, rows)`` of each location of the file that matched no single location. Spellings
    that differ only in case, accents or spaces are one location (the correspondence covers them
    all), shown with the first spelling found."""
    counts: Counter[str] = Counter()
    shown: dict[str, str] = {}
    for mapped in session.scalars(
        select(ImportRow.mapped_data)
        .where(ImportRow.batch_id == batch_id)
        .order_by(ImportRow.source_row_number)
    ):
        data = mapped or {}
        text = data.get("location_text")
        warnings = data.get("warnings") or []
        if text and any(warning.get("code") in UNRESOLVED_CODES for warning in warnings):
            key = _fold(text)
            shown.setdefault(key, text)
            counts[key] += 1
    return sorted(((shown[key], rows) for key, rows in counts.items()), key=lambda i: (-i[1], i[0]))


def _is_location_column(column: dict[str, Any]) -> bool:
    target = column.get("target")
    if isinstance(target, dict):
        return target.get("kind") == "field" and target.get("name") == LOCATION_FIELD
    return column.get("target_field") == LOCATION_FIELD


def map_location(
    session: Session, batch_id: uuid.UUID, *, text: str, location_id: uuid.UUID
) -> ImportBatch:
    """Store «``text`` → this location» in the batch mapping and leave it ready to validate."""
    batch = lock_batch(session, batch_id)
    require_kind(batch, ROW_KINDS)
    if batch.processing_started_at is not None:
        raise ConflictError(
            "El lote se está procesando: espere a que termine.", code="batch_processing"
        )
    if batch.status not in EDITABLE_STATUSES:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: ya no se cambia su mapeo.",
            code="batch_not_editable",
            details={"current_status": batch.status.value},
        )
    location = session.get(Location, location_id)
    if location is None or location.deleted_at is not None or not location.is_active:
        raise NotFound("La ubicación no existe o no está activa.", code="location_not_found")
    if location.level is LocationLevel.SITE:
        raise ValidationFailed(
            "Elija al menos un espacio dentro de la sede (un depósito, una sala…).",
            code="space_required",
        )
    mapping = copy.deepcopy(batch.mapping or {})
    columns = [c for c in mapping.get("columns") or [] if _is_location_column(c)]
    if not columns:
        raise ConflictError(
            "El mapeo del lote no tiene una columna de ubicación.", code="no_location_column"
        )
    key = text.strip()
    for column in columns:
        column["value_map"] = {**(column.get("value_map") or {}), key: location.code}
        transforms = list(column.get("transforms") or [])
        if "value_map" not in transforms:
            transforms.append("value_map")
        column["transforms"] = transforms
    batch.mapping = mapping
    if batch.status == S.IN_PREVIEW:
        batch = transition(session, batch.id, S.MAPPED)
    session.flush()
    return batch
