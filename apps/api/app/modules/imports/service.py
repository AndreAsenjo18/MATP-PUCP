"""Import pipeline stages built on the pure modules (spec importacion-datos; design D1, D2).

Stages are idempotent: each one deletes and recalculates its own intermediate results of the
batch. ``import_row`` rows before approval are staging data, not catalog information (D1), so
they are written and replaced with bulk Core statements; the batch log (RF-028) records what
was ingested and every human decision.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.imports.ingest import IngestedRow, IngestResult, ingest
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.worker import Progress, StageWork
from app.modules.quality.models import DuplicateCandidate

INSERT_CHUNK = 500


def clear_rows(session: Session, batch: ImportBatch) -> None:
    """Remove the staging rows of a batch and the pending review links that point to them."""
    row_ids = select(ImportRow.id).where(ImportRow.batch_id == batch.id)
    session.execute(delete(DuplicateCandidate).where(DuplicateCandidate.import_row_id.in_(row_ids)))
    session.execute(delete(ImportRow).where(ImportRow.batch_id == batch.id))


def store_ingested_rows(
    session: Session, batch: ImportBatch, result: IngestResult, progress: Progress | None = None
) -> int:
    """Replace the rows of the batch with ``result``; running it again gives the same rows."""
    clear_rows(session, batch)
    rows: Sequence[IngestedRow] = result.rows
    total = len(rows)
    for start in range(0, total, INSERT_CHUNK):
        chunk = rows[start : start + INSERT_CHUNK]
        session.execute(
            insert(ImportRow),
            [
                {
                    "id": new_uuid(),
                    "batch_id": batch.id,
                    "source_row_number": row.row_number,
                    "raw_data": row.raw_data,
                }
                for row in chunk
            ],
        )
        if progress is not None:
            progress.advance(start + len(chunk), total=total)
    batch.sheet_name = result.sheet_name
    batch.header_row = result.header_row
    counts: dict[str, Any] = {
        key: value for key, value in (batch.counts or {}).items() if key == "progress"
    }
    counts.update(
        rows=total,
        skipped_empty_rows=result.skipped_empty_rows,
        headers=result.headers,
        sheet_names=result.sheet_names,
    )
    batch.counts = counts
    session.flush()
    return total


def ingest_stage(
    content: bytes,
    *,
    sheet_name: str | None = None,
    header_row: int | None = None,
    max_rows: int | None = None,
) -> StageWork:
    """Stage work that reads the original file and stores its rows (batch stays ``UPLOADED``)."""

    def work(session: Session, batch: ImportBatch, progress: Progress) -> None:
        result = ingest(
            content,
            batch.file_name,
            sheet_name=sheet_name,
            header_row=header_row,
            max_rows=max_rows,
        )
        store_ingested_rows(session, batch, result, progress)

    return work
