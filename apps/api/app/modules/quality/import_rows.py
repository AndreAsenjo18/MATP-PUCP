"""The spreadsheet row of a duplicate pair, for the review queue.

Change revisar-duplicados-comparacion.

A pair between a catalogue piece and an import row used to show nothing of the row ("se decide en su
lote"), so the person could not compare. ``import_row_summaries`` reads, in one query per table, the
rows of a page of candidates and returns only the catalogue-like fields that the comparison needs.
It never exposes ``source_payload``, ``raw_data``, the lender, the recorder or the notes: those may
hold personal data (Ley 29733, RNF-014).

``close_row_candidates`` closes the open pairs of a row once its batch decides what the row is
(a target piece or a new piece): before, the pair stayed pending in the queue forever.
"""

import contextlib
import uuid
from collections.abc import Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import utcnow
from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import TRANSITIONS_BY_KIND, batch_kind
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus
from app.modules.quality.schemas import DuplicateImportRowIdentifier, DuplicateImportRowOut

OPEN_STATUSES = (DuplicateStatus.PENDING, DuplicateStatus.POSTPONED)


def _text(fields: dict[str, Any], key: str) -> str | None:
    value = fields.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _editable(batch: ImportBatch) -> bool:
    """The batch still accepts row decisions (the same rule as ``decide_row``)."""
    if batch.status == S.FAILED_APPLY:
        return True
    return S.IN_PREVIEW in TRANSITIONS_BY_KIND[batch_kind(batch)][batch.status]


def _resolution(row: ImportRow) -> str | None:
    resolution = row.resolution or {}
    if resolution.get("as_new"):
        return "new"
    if resolution.get("target_piece_id"):
        return "piece"
    return None


def import_row_summaries(
    session: Session, candidates: Iterable[DuplicateCandidate]
) -> dict[uuid.UUID, DuplicateImportRowOut]:
    """Summary of the import row of each candidate that has one, by row id."""
    row_ids = {candidate.import_row_id for candidate in candidates if candidate.import_row_id}
    if not row_ids:
        return {}
    rows = list(session.scalars(select(ImportRow).where(ImportRow.id.in_(row_ids))))
    batches = {
        batch.id: batch
        for batch in session.scalars(
            select(ImportBatch).where(ImportBatch.id.in_({row.batch_id for row in rows}))
        )
    }
    collection_ids = set()
    for row in rows:
        raw = (row.mapped_data or {}).get("collection_id")
        if raw:
            with contextlib.suppress(ValueError):
                collection_ids.add(uuid.UUID(str(raw)))
    names = (
        {
            collection.id: collection.name
            for collection in session.scalars(
                select(Collection).where(Collection.id.in_(collection_ids))
            )
        }
        if collection_ids
        else {}
    )
    summaries: dict[uuid.UUID, DuplicateImportRowOut] = {}
    for row in rows:
        batch = batches[row.batch_id]
        mapped = row.mapped_data or {}
        fields = mapped.get("fields") or {}
        collection_id = mapped.get("collection_id")
        try:
            collection_name = names.get(uuid.UUID(str(collection_id))) if collection_id else None
        except ValueError:
            collection_name = None
        identifiers = [
            DuplicateImportRowIdentifier(
                type=str(item.get("type")),
                original_value=str(item.get("original_value") or ""),
                normalized_value=item.get("normalized_value"),
            )
            for item in mapped.get("identifiers") or []
            if not item.get("is_absent") and item.get("original_value")
        ]
        summaries[row.id] = DuplicateImportRowOut(
            batch_id=batch.id,
            batch_name=batch.source_name or batch.file_name,
            source_row_number=row.source_row_number,
            denomination=_text(fields, "denomination"),
            collection_name=collection_name,
            tenure_regime=mapped.get("tenure_regime"),
            author=_text(fields, "author"),
            provenance=_text(fields, "provenance"),
            period_text=_text(fields, "epoch_original_text"),
            dimensions_text=_text(fields, "dimensions_text"),
            identifiers=identifiers,
            resolution=_resolution(row),
            editable=_editable(batch),
        )
    return summaries


def close_row_candidates(session: Session, row: ImportRow, *, reviewer_id: uuid.UUID) -> int:
    """Mark the open pairs of a resolved row as superseded, saying what the batch decided."""
    resolution = _resolution(row)
    if resolution is None:
        return 0
    if resolution == "new":
        note = "Resuelto en su lote: la fila entrará como pieza nueva."
    else:
        piece = session.get(Piece, row.target_piece_id) if row.target_piece_id else None
        note = (
            f"Resuelto en su lote: la fila corresponde a «{piece.denomination}»."
            if piece
            else "Resuelto en su lote: la fila corresponde a una pieza del catálogo."
        )
    now = utcnow()
    closed = 0
    for candidate in session.scalars(
        select(DuplicateCandidate).where(
            DuplicateCandidate.import_row_id == row.id, DuplicateCandidate.status.in_(OPEN_STATUSES)
        )
    ):
        candidate.status = DuplicateStatus.SUPERSEDED
        candidate.reviewed_by_id = reviewer_id
        candidate.reviewed_at = now
        candidate.resolution_note = note
        candidate.postponed_until = None
        closed += 1
    return closed
