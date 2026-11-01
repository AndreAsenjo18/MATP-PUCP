"""Row decisions and the approval summary of an import batch (spec importacion-datos: RF-025,
RF-026, RF-027, RN-002; design D5, D6).

What applying the batch does with each row (``row_action``):

- ``REJECTED`` or ``EXCLUDED`` rows, and rows with validation errors, are skipped.
- A row resolved by a person goes to its chosen piece (update) or becomes a new piece.
- A pending or accepted ``NEW`` row creates a piece and an ``UPDATE`` row updates its target:
  approving the batch with the summary on screen is the human approval of those rows
  [SUPUESTO B11], so a batch of thousands of rows does not need one click per row.
- ``CONFLICT`` and ``POSSIBLE_DUPLICATE`` rows without a resolution are skipped: they never
  reach the catalog without a person choosing what they are.

The approval summary counts those actions and its ``summary_token`` is a hash of the counts:
approving with a token that no longer matches is rejected with ``409 summary_changed`` (D6).
"""

import enum
import hashlib
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import utcnow
from app.modules.catalog.models import Piece
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.imports.catalog_photos import photo_approval_counts
from app.modules.imports.mapping import MappedRow, MappingSpec
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportRow,
    RowClassification,
    RowDecision,
)
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.service import ensure_idle, field_diff
from app.modules.imports.state import batch_kind, ensure_transition, lock_batch, transition

FieldAction = Literal["accept", "exclude"]
RESOLVABLE = frozenset({RowClassification.CONFLICT, RowClassification.POSSIBLE_DUPLICATE})


class RowAction(enum.StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    SKIP = "SKIP"


UNRESOLVED_REASONS: dict[RowClassification, str] = {
    RowClassification.CONFLICT: "Conflicto sin resolver: no se eligió la pieza destino ni se "
    "marcó como nueva.",
    RowClassification.POSSIBLE_DUPLICATE: "Posible duplicado sin resolver: no se eligió la "
    "pieza destino ni se marcó como nueva.",
}


def row_action(row: ImportRow) -> tuple[RowAction, str | None]:
    """What applying the batch does with ``row`` and, when skipped, why (for the log)."""
    if row.decision == RowDecision.REJECTED:
        return RowAction.SKIP, row.decision_reason or "Rechazada."
    if row.decision == RowDecision.EXCLUDED:
        return RowAction.SKIP, row.decision_reason or "Dejada fuera en la previsualización."
    if row.has_validation_errors:
        messages = "; ".join(error.get("message", "") for error in row.validation_errors or [])
        return RowAction.SKIP, f"Errores de validación: {messages}"
    resolution = row.resolution or {}
    if resolution.get("as_new"):
        return RowAction.CREATE, None
    if resolution.get("target_piece_id"):
        return RowAction.UPDATE, None
    if row.classification == RowClassification.NEW:
        return RowAction.CREATE, None
    if row.classification == RowClassification.UPDATE and row.target_piece_id is not None:
        return RowAction.UPDATE, None
    if row.classification in UNRESOLVED_REASONS:
        return RowAction.SKIP, UNRESOLVED_REASONS[row.classification]
    return RowAction.SKIP, "La fila no está clasificada; valide el lote."


def field_actions(row: ImportRow) -> dict[str, FieldAction]:
    """Effective action of each diff field: the person's choice, else the default (``keep`` →
    ``exclude``)."""
    chosen: dict[str, FieldAction] = (row.resolution or {}).get("field_decisions") or {}
    return {
        name: chosen.get(name, "exclude" if change.get("default_action") == "keep" else "accept")
        for name, change in (row.diff or {}).items()
    }


@dataclass(frozen=True)
class ApprovalSummary:
    create: int
    update: int
    skip: int
    # A ``PHOTOS`` batch (importacion-fotos-a-catalogo, task 6.2): what it applies and leaves out.
    photos: Mapping[str, int] | None = None

    @property
    def token(self) -> str:
        text = f"{self.create}:{self.update}:{self.skip}"
        if self.photos is not None:
            text += ":" + ",".join(f"{key}={value}" for key, value in sorted(self.photos.items()))
        return hashlib.sha256(text.encode()).hexdigest()[:32]

    @property
    def nothing_to_apply(self) -> bool:
        if self.photos is not None:
            return self.photos.get("to_apply", 0) == 0
        return self.create + self.update == 0

    def as_json(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "create": self.create,
            "update": self.update,
            "skip": self.skip,
            "summary_token": self.token,
        }
        if self.photos is not None:
            value["photos"] = dict(self.photos)
        return value


# Columns ``row_action`` reads: the summary never loads the raw or mapped data of the rows.
ACTION_COLUMNS = (
    ImportRow.decision,
    ImportRow.decision_reason,
    ImportRow.has_validation_errors,
    ImportRow.validation_errors,
    ImportRow.resolution,
    ImportRow.classification,
    ImportRow.target_piece_id,
)


def approval_summary(session: Session, batch_id: uuid.UUID) -> ApprovalSummary:
    batch = session.get(ImportBatch, batch_id)
    if batch is not None and batch_kind(batch) is ImportBatchKind.PHOTOS:
        return ApprovalSummary(0, 0, 0, photo_approval_counts(session, batch))
    counts = dict.fromkeys(RowAction, 0)
    for row in session.execute(select(*ACTION_COLUMNS).where(ImportRow.batch_id == batch_id)):
        counts[row_action(row)[0]] += 1  # type: ignore[arg-type]  # a Row with the same names
    return ApprovalSummary(
        counts[RowAction.CREATE], counts[RowAction.UPDATE], counts[RowAction.SKIP]
    )


def _editable_batch(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    """Lock a batch whose preview can be changed; a failed application goes back to preview."""
    batch = lock_batch(session, batch_id)
    ensure_idle(batch)
    if batch.status == S.FAILED_APPLY:
        return transition(session, batch.id, S.IN_PREVIEW, reason=batch.status_reason)
    ensure_transition(batch, S.IN_PREVIEW)
    return batch


def _inventory_codes_of(session: Session, piece_id: uuid.UUID) -> set[str]:
    return {
        value
        for value in session.scalars(
            select(PieceIdentifier.normalized_value).where(
                PieceIdentifier.piece_id == piece_id,
                PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
                PieceIdentifier.is_current,
                PieceIdentifier.deleted_at.is_(None),
            )
        )
        if value
    }


def _piece_identifiers(session: Session, piece_id: uuid.UUID) -> list[tuple[str, str, str]]:
    rows = session.execute(
        select(
            PieceIdentifier.identifier_type_code,
            PieceIdentifier.normalized_value,
            PieceIdentifier.original_value,
        ).where(PieceIdentifier.piece_id == piece_id, PieceIdentifier.deleted_at.is_(None))
    )
    return [(type_code, normalized or "", original) for type_code, normalized, original in rows]


def _incoming_inventory_codes(mapped: MappedRow) -> set[str]:
    return {
        identifier.normalized_value
        for identifier in mapped.identifiers
        if identifier.type_code == INVENTORY_CODE_TYPE
        and identifier.is_matchable
        and identifier.normalized_value
    }


def _resolve_to_piece(
    session: Session, batch: ImportBatch, row: ImportRow, piece_id: uuid.UUID
) -> dict[str, Any]:
    """Diff of the row against the chosen piece; RN-002 forbids changing its code I."""
    piece = session.get(Piece, piece_id)
    if piece is None:
        raise NotFound("La pieza destino no existe o está eliminada.", code="piece_not_found")
    mapped = MappedRow.from_json(row.mapped_data or {})
    current = _inventory_codes_of(session, piece.id)
    incoming = _incoming_inventory_codes(mapped)
    if current and incoming and not incoming & current:
        raise ValidationFailed(
            "La fila trae un código I distinto del de la pieza elegida; el código I no se "
            "cambia en una importación.",
            code="inventory_code_mismatch",
            details={"current": sorted(current), "incoming": sorted(incoming)},
        )
    assert batch.mapping is not None
    spec = MappingSpec.from_json(batch.mapping)
    return field_diff(piece, mapped, spec, _piece_identifiers(session, piece.id))


def _check_as_new(row: ImportRow) -> None:
    """A row whose code I already belongs to a piece cannot become a new piece (RN-002)."""
    for match in row.matches or []:
        if match.get("kind") != "piece":
            continue
        if any(item.get("identifier_type") == INVENTORY_CODE_TYPE for item in match["identifiers"]):
            raise ValidationFailed(
                "El código I de la fila ya pertenece a una pieza del catálogo; elija esa pieza "
                "como destino o rechace la fila.",
                code="inventory_code_in_use",
                details={"piece_id": match.get("piece_id")},
            )


def decide_row(
    session: Session,
    batch_id: uuid.UUID,
    row_id: uuid.UUID,
    *,
    decision: RowDecision,
    user_id: uuid.UUID,
    reason: str | None = None,
    target_piece_id: uuid.UUID | None = None,
    as_new: bool = False,
    field_decisions: dict[str, FieldAction] | None = None,
) -> ImportRow:
    """Record the decision of a person on one row (D5); the classification never changes."""
    batch = _editable_batch(session, batch_id)
    row = session.get(ImportRow, row_id)
    if row is None or row.batch_id != batch.id:
        raise NotFound("La fila no pertenece a este lote.", code="row_not_found")
    reason = reason.strip() if reason and reason.strip() else None
    if decision == RowDecision.REJECTED and reason is None:
        raise ValidationFailed(
            "Indique el motivo del rechazo: queda en la bitácora del lote.",
            code="reason_required",
        )
    if target_piece_id is not None and as_new:
        raise ValidationFailed(
            "Elija una pieza destino o márquela como nueva, no ambas.", code="invalid_resolution"
        )

    resolution: dict[str, Any] = dict(row.resolution or {})
    if target_piece_id is not None or as_new:
        if row.classification not in RESOLVABLE:
            raise ValidationFailed(
                "Solo las filas en conflicto o posible duplicado se resuelven eligiendo destino.",
                code="resolution_not_allowed",
            )
        resolution.pop("field_decisions", None)
        if as_new:
            _check_as_new(row)
            resolution.pop("target_piece_id", None)
            resolution["as_new"] = True
            row.target_piece_id = None
            row.diff = None
        else:
            assert target_piece_id is not None
            row.diff = _resolve_to_piece(session, batch, row, target_piece_id)
            row.target_piece_id = target_piece_id
            resolution.pop("as_new", None)
            resolution["target_piece_id"] = str(target_piece_id)

    if field_decisions:
        unknown = sorted(set(field_decisions) - set(row.diff or {}))
        if unknown:
            raise ValidationFailed(
                f"Estos campos no están en el diff de la fila: {', '.join(unknown)}.",
                code="unknown_diff_field",
                details={"fields": unknown},
            )
        resolution["field_decisions"] = {
            **(resolution.get("field_decisions") or {}),
            **field_decisions,
        }

    if decision == RowDecision.ACCEPTED:
        if row.has_validation_errors:
            raise ValidationFailed(
                "La fila tiene errores de validación y no se puede aceptar; corríjalos en el "
                "archivo o rechácela.",
                code="row_has_errors",
            )
        if row.classification in RESOLVABLE and not (
            resolution.get("as_new") or resolution.get("target_piece_id")
        ):
            raise ValidationFailed(
                "Resuelva la fila antes de aceptarla: elija la pieza destino o márquela como "
                "nueva.",
                code="conflict_unresolved",
            )

    resolution.update(decided_by_id=str(user_id), decided_at=utcnow().isoformat())
    row.resolution = resolution
    row.decision = decision
    row.decision_reason = reason
    session.flush()
    return row


def check_summary(session: Session, batch_id: uuid.UUID, summary_token: str) -> ApprovalSummary:
    """The summary the person confirmed must still be the current one (D6)."""
    summary = approval_summary(session, batch_id)
    if summary.token != summary_token:
        raise ConflictError(
            "El resumen cambió desde que lo revisó (otra persona modificó decisiones); revise "
            "el resumen actual y vuelva a aprobar.",
            code="summary_changed",
            details={"summary": summary.as_json()},
        )
    if summary.nothing_to_apply:
        message = (
            "El lote no tiene fotos asignadas a una pieza para aplicar."
            if summary.photos is not None
            else "El lote no tiene filas para aplicar."
        )
        raise ValidationFailed(message, code="nothing_to_apply")
    return summary


def approve(
    session: Session, batch_id: uuid.UUID, summary_token: str, user_id: uuid.UUID
) -> ImportBatch:
    """``IN_PREVIEW → APPROVED`` with the confirmed summary; the caller launches the apply."""
    batch = lock_batch(session, batch_id)
    ensure_idle(batch)
    if batch.status == S.FAILED_APPLY:
        batch = transition(session, batch.id, S.IN_PREVIEW, reason=batch.status_reason)
    ensure_transition(batch, S.APPROVED)
    summary = check_summary(session, batch.id, summary_token)
    batch.approved_by_id = user_id
    batch.approved_at = utcnow()
    batch.counts = {**(batch.counts or {}), "approved_summary": summary.as_json()}
    session.flush()
    return transition(session, batch.id, S.APPROVED)
