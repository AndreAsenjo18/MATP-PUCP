"""Grouped change sets and their reversal (auditoria-trazabilidad; RNF-007, RF-040, RN-002).

Three operations of the change ``auditoria-y-soft-delete-transversal`` (task 2.3):

- ``GET  /audit/change-sets/{change_set_id}``          grouped summary (design D3);
- ``POST /audit/change-sets/{change_set_id}/revert-preview``  what the reversal would do;
- ``POST /audit/change-sets/{change_set_id}/revert``   applies it as a new change set.

The reversal replaces the stub of the same path declared in ``app/api/v1/admin.py``: when this
router is registered, that stub must be removed so the contract keeps one operation per path.

Permissions follow design D1 ([SUPUESTO B7]) and depend on the **origin** of the change set
being reverted, so they are enforced inside the service (``check_revert_permissions``) instead of
a fixed route dependency: manual editing needs ``pieces.update``, an import needs
``imports.revert``, any other origin needs an Administrator, and touching an inventory code also
needs ``identifiers.correct_inventory_code`` plus the Administrator role (RN-002).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, CurrentUserDep, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.stubs import implemented
from app.modules.audit.context import require_audit_context
from app.modules.audit.revert import plan_revert, summarize_change_set
from app.modules.audit.revert import revert_change_set as apply_revert
from app.modules.audit.revert_schemas import (
    ChangeSetSummaryOut,
    RevertChangeSetOut,
    RevertConfirmRequest,
    RevertConflictOut,
    RevertPreviewOut,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Auditoría"])

AuditReader = Annotated[CurrentUser, Depends(require_permission("audit.read"))]

NOT_FOUND = {404: {"model": ErrorResponse, "description": "El conjunto de cambios no existe."}}
REVERT_CONFLICTS = {
    409: {
        "model": ErrorResponse,
        "description": (
            "`already_reverted` (ya existe un conjunto de reversión), `revert_plan_changed` "
            "(los datos cambiaron tras la vista previa), `revert_has_conflicts` (hay cambios "
            "posteriores sin confirmar) o `nothing_to_revert`."
        ),
    }
}


@router.get(
    "/audit/change-sets/{change_set_id}",
    response_model=ChangeSetSummaryOut,
    responses=NOT_FOUND,
    summary="Resumen de un conjunto de cambios: quién, cuándo, origen y alcance (RF-040)",
    **implemented(),
)
def get_change_set(
    change_set_id: uuid.UUID, session: SessionDep, user: AuditReader
) -> ChangeSetSummaryOut:
    return ChangeSetSummaryOut.of(summarize_change_set(session, change_set_id))


@router.post(
    "/audit/change-sets/{change_set_id}/revert-preview",
    response_model=RevertPreviewOut,
    responses=NOT_FOUND,
    summary="Vista previa de una reversión: valores por restaurar, registros y conflictos",
    **implemented(),
)
def preview_change_set_revert(
    change_set_id: uuid.UUID, session: SessionDep, user: AuditReader
) -> RevertPreviewOut:
    """No escribe nada. Devuelve el `preview_token` que exige la confirmación (RNF-007)."""
    return RevertPreviewOut.of(plan_revert(session, change_set_id))


@router.post(
    "/audit/change-sets/{change_set_id}/revert",
    response_model=RevertChangeSetOut,
    responses={**NOT_FOUND, **REVERT_CONFLICTS},
    summary="Revertir un conjunto de cambios con una nueva entrada auditada (RNF-007)",
    **implemented(),
)
def revert_change_set(
    change_set_id: uuid.UUID,
    body: RevertConfirmRequest,
    session: SessionDep,
    user: CurrentUserDep,
) -> RevertChangeSetOut:
    """Aplica la reversión en una transacción, como un conjunto de cambios de tipo reversión.

    El permiso exigido depende del origen del conjunto revertido (design D1), así que lo
    verifica el servicio: aquí basta con una identidad válida.
    """
    writer(session, user, body.reason)
    outcome = apply_revert(
        session,
        change_set_id,
        require_audit_context(session),
        confirm_conflicts=body.confirm_conflicts,
        preview_token=body.preview_token,
        permissions=user.permissions,
    )
    session.commit()
    return RevertChangeSetOut(
        reverted_change_set_id=outcome.reverted_change_set_id,
        new_change_set_id=outcome.new_change_set_id,
        reverted_fields=outcome.reverted_fields,
        restored_entities=outcome.restored_entities,
        deleted_entities=outcome.deleted_entities,
        conflicts=[RevertConflictOut.of(conflict) for conflict in outcome.conflicts],
        notes=outcome.notes,
    )
