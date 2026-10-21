"""Atomic application of an approved import batch (spec importacion-datos: RF-027, RF-008;
design D6).

Every row whose action is create or update goes through the catalog and identification
services, never direct SQL, so the same rules as manual entry apply (RN-002, RN-003, RN-004,
RN-006) together with their flush guards. All changes share one audit context with origin
``IMPORT``, the batch as reference and a single change set, kept in ``import_batch`` so the
batch can be reverted (D7). Each applied row leaves a ``piece_source_record`` with its unmapped
columns, the row number and the batch (RF-008).

The stage runs in one transaction (``worker.run_stage``): the first domain error rolls back
every row and the batch goes to ``FAILED_APPLY`` with the row and the rule that failed.
"""

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, DomainError, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import refined_context
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.catalog.service import change_tenure, create_piece, update_piece
from app.modules.identification.service import add_identifier
from app.modules.imports.decisions import RowAction, field_actions, row_action
from app.modules.imports.mapping import IDENTIFIER_TARGET, PIECE_FIELDS, MappedRow
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import transition
from app.modules.imports.worker import Progress, StageWork

# Fields a new piece takes from the row besides the denomination and the tenure regime.
CREATE_FIELDS = tuple(
    name for name in PIECE_FIELDS if name not in {"denomination", "tenure_regime"}
)
APPLIED_COUNTS = ("APPLIED_CREATED", "APPLIED_UPDATED", "APPLIED_SKIPPED")


class ApplyFailed(BusinessRuleViolation):
    code = "apply_failed"


def _source_label(batch: ImportBatch) -> str:
    return f"Importación: {batch.file_name}"[:200]


def _add_identifiers(
    session: Session, piece: Piece, identifiers: list[tuple[str, str]], source: str
) -> None:
    for type_code, original in dict.fromkeys(identifiers):
        add_identifier(session, piece, type_code, original, source=source)


def _new_identifiers(mapped: MappedRow) -> list[tuple[str, str]]:
    return [
        (identifier.type_code, identifier.original_value)
        for identifier in mapped.identifiers
        if not identifier.is_absent
    ]


def _create(session: Session, batch: ImportBatch, mapped: MappedRow) -> Piece:
    fields: dict[str, Any] = {
        name: mapped.fields[name] for name in CREATE_FIELDS if mapped.fields.get(name) is not None
    }
    if mapped.collection_id is not None:
        fields["collection_id"] = mapped.collection_id
    piece = create_piece(
        session,
        denomination=mapped.fields.get("denomination"),
        tenure_regime=mapped.tenure_regime,
        **fields,
    )
    _add_identifiers(session, piece, _new_identifiers(mapped), _source_label(batch))
    return piece


def _update(session: Session, batch: ImportBatch, row: ImportRow, mapped: MappedRow) -> Piece:
    assert row.target_piece_id is not None
    piece = session.get(Piece, row.target_piece_id)
    if piece is None:
        raise ValidationFailed(
            "La pieza destino fue eliminada después de la validación.", code="piece_not_found"
        )
    diff = row.diff or {}
    changes: dict[str, Any] = {}
    identifiers: list[tuple[str, str]] = []
    tenure: TenureRegime | None = None
    for name, action in field_actions(row).items():
        if action != "accept":
            continue
        incoming = diff[name].get("incoming")
        if name.startswith(f"{IDENTIFIER_TARGET}:"):
            type_code = name.split(":", 1)[1]
            identifiers += [(type_code, value) for value in incoming or []]
        elif name == "tenure_regime":
            tenure = TenureRegime(incoming) if incoming else None
        elif name == "collection_id":
            changes[name] = uuid.UUID(incoming) if incoming else None
        else:
            changes[name] = incoming
    if tenure is not None:
        change_tenure(session, piece, tenure, _source_label(batch))
    if changes:
        update_piece(session, piece, **changes)
    _add_identifiers(session, piece, identifiers, _source_label(batch))
    return piece


def apply_batch(session: Session, batch: ImportBatch, progress: Progress | None = None) -> None:
    """Apply every row of an approved batch and leave it ``APPLIED``; raises on the first error."""
    rows = session.scalars(
        select(ImportRow)
        .where(ImportRow.batch_id == batch.id)
        .order_by(ImportRow.source_row_number)
    ).all()
    # The batch row is written only after the loop: on PostgreSQL the heartbeat updates it from
    # another connection, which would wait forever for this transaction's row lock.
    change_set_id = batch.change_set_id or new_uuid()
    counts = dict.fromkeys(APPLIED_COUNTS, 0)
    created: list[dict[str, Any]] = []
    total = len(rows)
    with refined_context(session, change_set_id=change_set_id):
        for done, row in enumerate(rows, start=1):
            action, _reason = row_action(row)
            if action == RowAction.SKIP:
                counts["APPLIED_SKIPPED"] += 1
                continue
            mapped = MappedRow.from_json(row.mapped_data or {})
            try:
                if action == RowAction.CREATE:
                    piece = _create(session, batch, mapped)
                    created.append({"id": row.id, "target_piece_id": piece.id})
                    counts["APPLIED_CREATED"] += 1
                else:
                    piece = _update(session, batch, row, mapped)
                    counts["APPLIED_UPDATED"] += 1
                session.add(
                    PieceSourceRecord(
                        id=new_uuid(),
                        piece_id=piece.id,
                        import_batch_id=batch.id,
                        source_name=batch.source_name,
                        source_file_name=batch.file_name,
                        source_row_number=row.source_row_number,
                        payload=mapped.source_payload,
                    )
                )
                session.flush()
            except DomainError as exc:
                raise ApplyFailed(
                    f"Fila {row.source_row_number}: {exc.message} No se aplicó ninguna fila.",
                    details={"source_row_number": row.source_row_number, "rule": exc.code},
                ) from exc
            if progress is not None:
                progress.advance(done, total=total)
        batch.change_set_id = change_set_id
        session.flush()
    # Staging data: the new piece of each created row, for the log and the images (D8).
    for start in range(0, len(created), 500):
        session.execute(update(ImportRow), created[start : start + 500])
    batch.counts = {**(batch.counts or {}), **counts}
    session.flush()
    transition(session, batch.id, S.APPLIED)


def apply_stage() -> StageWork:
    def work(session: Session, batch: ImportBatch, progress: Progress) -> None:
        apply_batch(session, batch, progress)

    return work
