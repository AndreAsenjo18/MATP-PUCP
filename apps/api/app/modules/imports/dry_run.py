"""Normalization preview of a saved template over a sample of a batch (spec importacion-datos:
RF-023, RF-022, RNF-010; design D4).

Change ``plantillas-mapeo-y-normalizacion``, task 3.3. Read only: it maps the first
``SAMPLE_ROWS`` rows of the batch with ``apply_mapping`` and never writes rows, the batch or
the audit log. Each column of the template is mapped on its own, so the identifiers, term
matches and errors of a row belong to that column. Every non-empty cell gets one status:

- ``SPLIT_PROPOSED``  the cell gives several values (a proposal pending confirmation).
- ``ABSENT``          an absence marker such as ``S/N`` (N2).
- ``UNPARSEABLE``     a transformation or the target rejected it, an identifier is not
                      normalizable, a value has no term in the vocabulary or a ``propose_*``
                      transformation did not recognize the text.
- ``NORMALIZED``      anything else.

The normalizer runs with the current parameters of the session (design D4, D5): the absence
markers, separators and acronym aliases of ``normalization_setting`` and
``collection_acronym_alias``, or the defaults of the code when there are none.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.modules.identification.models import NormalizationStatus
from app.modules.imports.mapping import (
    ColumnSpecV1,
    FieldTarget,
    IdentifiersTarget,
    IdentifierTarget,
    MappedRow,
    MappingContext,
    MappingSpecV1,
    TermsTarget,
    _fold,
    apply_mapping,
    read_mapping,
)
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchStatus,
    ImportMappingTemplate,
    ImportRow,
)
from app.modules.imports.schemas import (
    ColumnMapping,
    DryRunColumn,
    DryRunExample,
    DryRunIdentifier,
    DryRunTraceStep,
    DryRunUnmatchedValue,
    TemplateDryRunOut,
)
from app.modules.imports.state import STATUS_LABELS
from app.modules.imports.transforms import NOTE_NOT_RECOGNIZED, TransformedValue

SAMPLE_ROWS = 200  # [SUPUESTO T3]
UNMATCHED_LIMIT = 20  # [SUPUESTO T4]
EXAMPLES_PER_COLUMN = 5
DRY_RUN_STATUSES = frozenset({ImportBatchStatus.UPLOADED, ImportBatchStatus.MAPPED})


class PreviewStatus(StrEnum):
    NORMALIZED = NormalizationStatus.NORMALIZED.value
    UNPARSEABLE = NormalizationStatus.UNPARSEABLE.value
    ABSENT = "ABSENT"
    SPLIT_PROPOSED = "SPLIT_PROPOSED"


@dataclass
class CellPreview:
    row_number: int
    status: PreviewStatus
    original: Any
    mapped: MappedRow
    transformed: TransformedValue | None
    errors: list[str]


@dataclass
class ColumnPreview:
    column: ColumnSpecV1
    in_file: bool
    counts: Counter[PreviewStatus] = field(default_factory=Counter)
    empty: int = 0
    # Values without a term grouped as terms are matched (case, accents, repeated spaces):
    # folded key -> spellings seen, in order of appearance.
    unmatched: dict[str, Counter[str]] = field(default_factory=dict)
    examples: list[CellPreview] = field(default_factory=list)

    @property
    def unmatched_values(self) -> list[tuple[str, int]]:
        """The most frequent groups of values without a term, each shown with its most frequent
        spelling; ties in order of appearance."""
        groups = sorted(self.unmatched.values(), key=lambda group: -group.total())
        return [(group.most_common(1)[0][0], group.total()) for group in groups[:UNMATCHED_LIMIT]]

    def add_unmatched(self, values: Sequence[str]) -> None:
        for value in values:
            self.unmatched.setdefault(_fold(value), Counter())[value] += 1

    def add_example(self, cell: CellPreview) -> None:
        """First an example of each status, then the next cells in row order."""
        if len(self.examples) < EXAMPLES_PER_COLUMN:
            self.examples.append(cell)
            return
        seen = Counter(example.status for example in self.examples)
        if seen[cell.status] == 0:
            repeated = next(
                index
                for index in range(len(self.examples) - 1, -1, -1)
                if seen[self.examples[index].status] > 1
            )
            del self.examples[repeated]
            self.examples.append(cell)


@dataclass
class DryRun:
    template: ImportMappingTemplate
    batch: ImportBatch
    total_rows: int
    sampled_rows: int
    missing_columns: list[str]
    columns: list[ColumnPreview]


def _is_empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _status(column: ColumnSpecV1, mapped: MappedRow) -> PreviewStatus:
    transformed = mapped.transformed.get(column.source)
    target = column.target
    if transformed is not None and transformed.error is not None:
        return PreviewStatus.UNPARSEABLE
    if isinstance(target, IdentifierTarget | IdentifiersTarget):
        identifiers = mapped.identifiers
        if len(identifiers) > 1 or (transformed is not None and transformed.split_proposed):
            return PreviewStatus.SPLIT_PROPOSED
        if (transformed is not None and transformed.is_absent) or all(
            identifier.is_absent for identifier in identifiers
        ):
            return PreviewStatus.ABSENT
        if any(identifier.status != NormalizationStatus.NORMALIZED for identifier in identifiers):
            return PreviewStatus.UNPARSEABLE
        return PreviewStatus.NORMALIZED
    if transformed is not None and transformed.split_proposed:
        return PreviewStatus.SPLIT_PROPOSED
    if transformed is not None and transformed.is_absent:
        return PreviewStatus.ABSENT
    if isinstance(target, TermsTarget):
        matches = mapped.term_matches.get(column.source)
        if matches is not None and matches.unmatched:
            return PreviewStatus.UNPARSEABLE
        return PreviewStatus.NORMALIZED
    if mapped.errors or (
        transformed is not None
        and any(step.note == NOTE_NOT_RECOGNIZED for step in transformed.trace)
    ):
        return PreviewStatus.UNPARSEABLE
    return PreviewStatus.NORMALIZED


def _ensure_previewable(batch: ImportBatch) -> list[str]:
    if batch.status not in DRY_RUN_STATUSES:
        raise ConflictError(
            f"El lote está en estado «{STATUS_LABELS[batch.status]}»: la vista previa de una "
            "plantilla solo se calcula sobre un lote subido o mapeado.",
            code="batch_not_previewable",
            details={
                "current_status": batch.status.value,
                "allowed": sorted(status.value for status in DRY_RUN_STATUSES),
            },
        )
    headers = (batch.counts or {}).get("headers")
    if headers is None:
        raise ConflictError(
            "El archivo todavía no se ha leído; espere a que termine la lectura.",
            code="batch_not_ingested",
        )
    return list(headers)


def run_dry_run(session: Session, template: ImportMappingTemplate, batch: ImportBatch) -> DryRun:
    """Preview ``template`` over the first ``SAMPLE_ROWS`` rows of ``batch``; writes nothing."""
    headers = _ensure_previewable(batch)
    spec = read_mapping(template.mapping)
    ctx = MappingContext(session)
    known = set(headers)
    previews = [ColumnPreview(column, column.source in known) for column in spec.columns]
    # One spec per column: what the row maps to is then what that column maps to.
    single = [MappingSpecV1(columns=[column]) for column in spec.columns]
    rows: Sequence[tuple[int, dict[str, Any] | None]] = session.execute(
        select(ImportRow.source_row_number, ImportRow.raw_data)
        .where(ImportRow.batch_id == batch.id)
        .order_by(ImportRow.source_row_number)
        .limit(SAMPLE_ROWS)
    ).all()
    for row_number, raw in rows:
        raw = raw or {}
        for preview, column_spec in zip(previews, single, strict=True):
            original = raw.get(preview.column.source)
            if _is_empty(original):
                preview.empty += 1
                continue
            mapped = apply_mapping(raw, column_spec, ctx)
            status = _status(preview.column, mapped)
            preview.counts[status] += 1
            matches = mapped.term_matches.get(preview.column.source)
            if matches is not None:
                preview.add_unmatched(matches.unmatched)
            preview.add_example(
                CellPreview(
                    row_number,
                    status,
                    original,
                    mapped,
                    mapped.transformed.get(preview.column.source),
                    [error.message for error in mapped.errors],
                )
            )
    total = session.scalar(
        select(func.count()).select_from(ImportRow).where(ImportRow.batch_id == batch.id)
    )
    return DryRun(
        template=template,
        batch=batch,
        total_rows=total or 0,
        sampled_rows=len(rows),
        missing_columns=[preview.column.source for preview in previews if not preview.in_file],
        columns=previews,
    )


def _value(cell: CellPreview, column: ColumnSpecV1) -> Any:
    """What the column gives the record: the transformed value, or the field as mapped."""
    if cell.transformed is not None:
        return cell.transformed.value
    if isinstance(column.target, FieldTarget):
        return cell.mapped.fields.get(column.target.name)
    return cell.original


def _example(cell: CellPreview, column: ColumnSpecV1) -> DryRunExample:
    transformed = cell.transformed
    matches = cell.mapped.term_matches.get(column.source)
    return DryRunExample(
        source_row_number=cell.row_number,
        status=cell.status.value,
        original=cell.original,
        value=_value(cell, column),
        trace=[
            DryRunTraceStep(
                transform=step.transform, before=step.before, after=step.after, note=step.note
            )
            for step in (transformed.trace if transformed is not None else [])
        ],
        proposals=dict(transformed.proposals) if transformed is not None else {},
        identifiers=[
            DryRunIdentifier(
                type_code=identifier.type_code,
                original_value=identifier.original_value,
                normalized_value=identifier.normalized_value,
                status=identifier.status.value,
                is_absent=identifier.is_absent,
            )
            for identifier in cell.mapped.identifiers
        ],
        matched_terms=dict(matches.matched) if matches is not None else {},
        unmatched_terms=list(matches.unmatched) if matches is not None else [],
        errors=cell.errors,
    )


def dry_run_out(result: DryRun, mappings: Sequence[ColumnMapping]) -> TemplateDryRunOut:
    """The preview as the API returns it; ``mappings`` are the template columns as the API
    sees them (``templates.column_mappings``), in the order of the spec."""
    return TemplateDryRunOut(
        template_id=result.template.id,
        batch_id=result.batch.id,
        total_rows=result.total_rows,
        sampled_rows=result.sampled_rows,
        missing_columns=result.missing_columns,
        columns=[
            DryRunColumn(
                mapping=mapping,
                in_file=preview.in_file,
                counts={status.value: preview.counts[status] for status in PreviewStatus},
                empty=preview.empty,
                unmatched_values=[
                    DryRunUnmatchedValue(value=value, count=count)
                    for value, count in preview.unmatched_values
                ],
                examples=[_example(cell, preview.column) for cell in preview.examples],
            )
            for preview, mapping in zip(result.columns, mappings, strict=True)
        ],
    )
