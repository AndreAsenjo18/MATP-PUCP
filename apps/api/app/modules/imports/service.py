"""Import pipeline stages built on the pure modules (spec importacion-datos; design D1 to D5).

Stages are idempotent: each one deletes and recalculates its own intermediate results of the
batch. ``import_row`` rows before approval are staging data, not catalog information (D1), so
they are written and replaced with bulk Core statements; the batch log (RF-028) records what
was ingested and every human decision.
"""

import hashlib
import uuid
from collections import defaultdict
from collections.abc import Sequence
from pathlib import PurePath
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from app.core import jobs
from app.core.errors import ConflictError, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.modules.catalog.models import Piece
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.modules.imports.classify import (
    ClassifiedRow,
    ProvisionalSimilarityScorer,
    classify_batch,
    record_duplicate_candidates,
)
from app.modules.imports.ingest import (
    IngestedRow,
    IngestionFailed,
    IngestResult,
    file_format,
    ingest,
)
from app.modules.imports.mapping import (
    IDENTIFIER_TARGET,
    PIECE_FIELDS,
    MappedRow,
    MappingContext,
    MappingSpec,
    apply_mapping,
    validate_mapping,
)
from app.modules.imports.models import ImportBatch, ImportRow, RowClassification, RowDecision
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import STATUS_LABELS, lock_batch, transition
from app.modules.imports.worker import Progress, StageWork
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus

INSERT_CHUNK = 500
UPDATE_CHUNK = 500
CONTENT_TYPES = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
}
# Keys of ``import_batch.counts`` written by validation (recomputed on every run).
VALIDATION_COUNTS = (*(item.value for item in RowClassification), "ERRORS", "UNPARSEABLE_CODES")
MAPPABLE_STATUSES = frozenset({S.UPLOADED, S.MAPPED, S.IN_PREVIEW})


def ensure_idle(batch: ImportBatch) -> None:
    """A batch whose stage is still running (fresh heartbeat) cannot be changed."""
    if batch.processing_started_at is not None and not jobs.is_stale(batch.heartbeat_at):
        raise ConflictError(
            "El lote se está procesando; espere a que termine.",
            code="batch_processing",
            details={"progress": (batch.counts or {}).get("progress")},
        )


# --- Ingesta (D2) ---------------------------------------------------------------------------------
def original_key(batch_id: uuid.UUID, file_name: str) -> str:
    extension = PurePath(file_name).suffix.lower().lstrip(".") or "bin"
    return f"imports/{batch_id}/original.{extension}"


def create_batch(
    session: Session,
    storage: ObjectStorage,
    *,
    file_name: str,
    content: bytes,
    uploaded_by_id: uuid.UUID,
) -> ImportBatch:
    """Store the original file untouched and create the batch in ``UPLOADED``.

    An unsupported format is not rejected: the batch goes straight to ``FAILED_INGESTION`` with
    the reason, so the attempt stays in the log (RF-028).
    """
    batch_id = new_uuid()
    key = original_key(batch_id, file_name)
    failure: IngestionFailed | None = None
    fmt: str | None = None
    try:
        fmt = file_format(file_name)
    except IngestionFailed as exc:
        failure = exc
    storage.put_bytes(key, content, CONTENT_TYPES.get(fmt or "", "application/octet-stream"))
    batch = ImportBatch(
        id=batch_id,
        # [SUPUESTO] The contract upload form only has `file`: the source is named after it.
        source_name=file_name[:200],
        file_name=file_name[:300],
        file_storage_key=key,
        file_sha256=hashlib.sha256(content).hexdigest(),
        status=S.UPLOADED,
        uploaded_by_id=uploaded_by_id,
        stage_timestamps={S.UPLOADED.value: utcnow().isoformat()},
        counts={},
    )
    session.add(batch)
    session.flush()
    if failure is not None:
        transition(session, batch.id, S.FAILED_INGESTION, reason=failure.message)
    return batch


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


# --- Mapeo (D3) -----------------------------------------------------------------------------------
def reset_validation(session: Session, batch: ImportBatch) -> None:
    """Discard classification, diff and decisions: re-mapping invalidates the preview (D1)."""
    row_ids = select(ImportRow.id).where(ImportRow.batch_id == batch.id)
    session.execute(
        delete(DuplicateCandidate).where(
            DuplicateCandidate.import_row_id.in_(row_ids),
            DuplicateCandidate.status == DuplicateStatus.PENDING,
        )
    )
    session.execute(
        update(ImportRow)
        .where(ImportRow.batch_id == batch.id)
        .values(
            mapped_data=None,
            classification=None,
            has_validation_errors=False,
            validation_errors=None,
            matches=None,
            diff=None,
            decision=RowDecision.PENDING,
            decision_reason=None,
            target_piece_id=None,
        )
    )
    batch.counts = {
        key: value for key, value in (batch.counts or {}).items() if key not in VALIDATION_COUNTS
    }


def set_mapping(
    session: Session,
    storage: ObjectStorage,
    batch_id: uuid.UUID,
    spec: MappingSpec,
    *,
    sheet_name: str | None = None,
    header_row: int | None = None,
    max_rows: int | None = None,
) -> ImportBatch:
    """Check the mapping against the headers and move the batch to ``MAPPED``.

    Choosing another sheet or header row reads the original file again (D2). Re-mapping a batch
    in preview discards its validation.
    """
    batch = lock_batch(session, batch_id)
    ensure_idle(batch)
    if batch.status not in MAPPABLE_STATUSES:
        raise ConflictError(
            f"No se puede mapear un lote en estado «{STATUS_LABELS[batch.status]}».",
            code="invalid_batch_transition",
            details={
                "current_status": batch.status.value,
                "requested_status": S.MAPPED.value,
                "allowed_from": sorted(status.value for status in MAPPABLE_STATUSES),
            },
        )
    if "headers" not in (batch.counts or {}):
        raise ConflictError(
            "El archivo todavía no se ha leído; espere a que termine la lectura.",
            code="batch_not_ingested",
        )
    reread = (sheet_name is not None and sheet_name != batch.sheet_name) or (
        header_row is not None and header_row != batch.header_row
    )
    if reread:
        assert batch.file_storage_key is not None
        result = ingest(
            storage.get_bytes(batch.file_storage_key),
            batch.file_name,
            sheet_name=sheet_name or batch.sheet_name,
            header_row=header_row,
            max_rows=max_rows,
        )
        store_ingested_rows(session, batch, result)
    errors = validate_mapping(spec, list((batch.counts or {})["headers"]), MappingContext(session))
    if errors:
        raise ValidationFailed(
            "El mapeo de columnas tiene errores; corríjalos y vuelva a enviarlo.",
            code="invalid_mapping",
            details={"errors": [error.as_json() for error in errors]},
        )
    if not reread:
        reset_validation(session, batch)
    batch.mapping = spec.as_json()
    session.flush()
    return transition(session, batch.id, S.MAPPED)


# --- Validación, matching y clasificación (D4, D5) ------------------------------------------------
def _text(value: Any) -> str | None:
    if value is None:
        return None
    return " ".join(str(getattr(value, "value", value)).split()) or None


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    return str(getattr(value, "value", value))


def field_diff(
    piece: Piece,
    mapped: MappedRow,
    spec: MappingSpec,
    identifiers: Sequence[tuple[str, str, str]],
) -> dict[str, Any]:
    """``{field: {current, incoming, default_action}}`` for the fields the row would change.

    An empty incoming value never erases a current one by default (``keep``) [SUPUESTO B10].
    ``identifiers`` are ``(type, normalized, original)`` of the piece, current and historical;
    only codes the piece does not have yet appear, as ``identifier:<TYPE>``.
    """
    targets = {column.target for column in spec.columns} | set(spec.defaults)
    incoming_values: dict[str, Any] = {
        name: mapped.fields.get(name) for name in PIECE_FIELDS if name in targets
    }
    if "tenure_regime" in incoming_values:
        incoming_values["tenure_regime"] = mapped.tenure_regime
    current_values: dict[str, Any] = {name: getattr(piece, name) for name in incoming_values}
    if "collection" in targets:
        incoming_values["collection_id"] = mapped.collection_id
        current_values["collection_id"] = piece.collection_id

    diff: dict[str, Any] = {}
    for name, incoming in incoming_values.items():
        current = current_values[name]
        if _text(current) == _text(incoming):
            continue
        diff[name] = {
            "current": _json_value(current),
            "incoming": _json_value(incoming),
            "default_action": "keep" if incoming is None else "accept",
        }

    known: dict[str, set[str]] = defaultdict(set)
    current_by_type: dict[str, list[str]] = defaultdict(list)
    for type_code, normalized, original in identifiers:
        known[type_code].add(normalized)
        current_by_type[type_code].append(original)
    new_by_type: dict[str, list[str]] = defaultdict(list)
    for identifier in mapped.identifiers:
        is_new = identifier.normalized_value not in known[identifier.type_code]
        if identifier.is_matchable and is_new:
            new_by_type[identifier.type_code].append(identifier.original_value)
    for type_code, values in new_by_type.items():
        diff[f"{IDENTIFIER_TARGET}:{type_code}"] = {
            "current": sorted(current_by_type[type_code]),
            "incoming": values,
            "default_action": "accept",
        }
    return diff


def _update_targets(
    session: Session, piece_ids: set[uuid.UUID]
) -> tuple[dict[uuid.UUID, Piece], dict[uuid.UUID, list[tuple[str, str, str]]]]:
    pieces: dict[uuid.UUID, Piece] = {}
    identifiers: dict[uuid.UUID, list[tuple[str, str, str]]] = defaultdict(list)
    ordered = sorted(piece_ids)
    for start in range(0, len(ordered), UPDATE_CHUNK):
        chunk = ordered[start : start + UPDATE_CHUNK]
        for piece in session.scalars(select(Piece).where(Piece.id.in_(chunk))):
            pieces[piece.id] = piece
        rows = session.execute(
            select(
                PieceIdentifier.piece_id,
                PieceIdentifier.identifier_type_code,
                PieceIdentifier.normalized_value,
                PieceIdentifier.original_value,
            ).where(PieceIdentifier.piece_id.in_(chunk), PieceIdentifier.deleted_at.is_(None))
        )
        for piece_id, type_code, normalized, original in rows:
            identifiers[piece_id].append((type_code, normalized or "", original))
    return pieces, identifiers


def validate_stage() -> StageWork:
    """Stage work: map, match and classify every row, then leave the batch in preview.

    Idempotent: classification, diff, decisions and pending review links of the batch are
    recomputed from the stored raw rows on every run.
    """

    def work(session: Session, batch: ImportBatch, progress: Progress) -> None:
        if batch.mapping is None:
            raise ValidationFailed("El lote no tiene un mapeo de columnas.", code="mapping_missing")
        spec = MappingSpec.from_json(batch.mapping)
        ctx = MappingContext(session)
        rows = session.execute(
            select(ImportRow.id, ImportRow.source_row_number, ImportRow.raw_data)
            .where(ImportRow.batch_id == batch.id)
            .order_by(ImportRow.source_row_number)
        ).all()
        total = len(rows)
        reset_validation(session, batch)

        mapped = {number: apply_mapping(raw or {}, spec, ctx) for _id, number, raw in rows}
        classified = classify_batch(
            session,
            [mapped[number].row_input(number) for _id, number, _raw in rows],
            ProvisionalSimilarityScorer(session),
        )
        by_number: dict[int, ClassifiedRow] = {item.row_number: item for item in classified}
        pieces, identifiers = _update_targets(
            session,
            {
                item.target_piece_id
                for item in classified
                if item.classification == RowClassification.UPDATE and item.target_piece_id
            },
        )

        counts: dict[str, int] = dict.fromkeys(VALIDATION_COUNTS, 0)
        values: list[dict[str, Any]] = []
        for done, (row_id, number, _raw) in enumerate(rows, start=1):
            result, row = by_number[number], mapped[number]
            counts[result.classification.value] += 1
            counts["ERRORS"] += int(result.has_validation_errors)
            counts["UNPARSEABLE_CODES"] += sum(
                1
                for identifier in row.identifiers
                if not identifier.is_absent and identifier.status == NormalizationStatus.UNPARSEABLE
            )
            target = pieces.get(result.target_piece_id) if result.target_piece_id else None
            is_update = result.classification == RowClassification.UPDATE
            values.append(
                {
                    "id": row_id,
                    **result.row_values(),
                    "mapped_data": row.as_json(),
                    "diff": (
                        field_diff(target, row, spec, identifiers[target.id])
                        if target is not None and is_update
                        else None
                    ),
                }
            )
            if len(values) == UPDATE_CHUNK or done == total:
                session.execute(update(ImportRow), values)
                values = []
                progress.advance(done, total=total)
            if result.classification == RowClassification.POSSIBLE_DUPLICATE:
                record_duplicate_candidates(session, row_id, result.similar)

        batch.counts = {**(batch.counts or {}), **counts}
        session.flush()
        transition(session, batch.id, S.VALIDATED)
        transition(session, batch.id, S.IN_PREVIEW)

    return work
