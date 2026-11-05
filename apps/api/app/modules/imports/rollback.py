"""Reversal of an applied import batch (spec importacion-datos: RNF-007, RN-005; design D7).

The batch keeps the change set of its application (``import_batch.change_set_id``, M10); the
reversal delegates on the engine of ``auditoria-y-soft-delete-transversal``: created pieces and
identifiers are deleted logically with the reason, updated fields get their previous value and
append-only rows (``piece_source_record``) stay as history. Later edits of the same fields are
conflicts: the engine answers ``409 revert_has_conflicts`` with the list until the caller
confirms them. Nothing is deleted physically.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.modules.audit.context import AuditContext
from app.modules.audit.revert import RevertOutcome, revert_change_set
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import ensure_transition, lock_batch, transition


@dataclass(frozen=True)
class BatchRollback:
    batch: ImportBatch
    outcome: RevertOutcome


def rollback_batch(
    session: Session,
    batch_id: uuid.UUID,
    ctx: AuditContext,
    *,
    confirm_conflicts: bool = False,
    permissions: frozenset[str] | None = None,
) -> BatchRollback:
    """Revert an ``APPLIED`` batch and leave it ``REVERTED``, in the caller's transaction."""
    batch = lock_batch(session, batch_id)
    ensure_transition(batch, S.REVERTED)
    if batch.change_set_id is None:  # pragma: no cover - every applied batch records it
        raise ConflictError(
            "El lote no registra el conjunto de cambios de su aplicación: no se puede revertir.",
            code="batch_without_change_set",
        )
    outcome = revert_change_set(
        session,
        batch.change_set_id,
        ctx,
        confirm_conflicts=confirm_conflicts,
        permissions=permissions,
    )
    reverted = transition(session, batch_id, S.REVERTED, reason=ctx.reason)
    return BatchRollback(batch=reverted, outcome=outcome)
