"""Papelera de registros eliminados lógicamente (spec auditoria-trazabilidad; RNF-006, RN-005).

Operaciones añadidas por el change `auditoria-y-soft-delete-transversal` (diseño D2); no están
en `docs/fuentes/endpoints-api-v1.yaml` y se justifican en `docs/api/mapeo-endpoints-v1.md`.
"""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import Page, PageParams, page_params
from app.api.refs import EX_DATETIME, EX_TERM_ID, EX_USER_ID
from app.api.stubs import implemented
from app.modules.audit.trash import (
    TRASHABLE,
    TrashEntry,
    deleted_by_names,
    list_trash,
    restore_from_trash,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

# La papelera se abre con `trash.read` (Administrador y Gestor); el Catalogador no lo tiene, así
# que no puede abrirla (escenario «Usuario sin permiso»). Restaurar sigue siendo solo del
# Administrador: lo comprueba `soft_delete.restore` (`admin_required`). [SUPUESTO Ñ3, B7]
# Pendiente de confirmar qué otros roles pueden mirar la papelera sin restaurar.
TrashReader = Annotated[CurrentUser, Depends(require_permission("trash.read"))]

ENTITY_TYPES = ", ".join(sorted(TRASHABLE))


class TrashEntryOut(BaseModel):
    """Registro eliminado lógicamente, con quién lo eliminó, cuándo y por qué."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "entity_type": "term",
                    "entity_id": EX_TERM_ID,
                    "entity_label": "Totora",
                    "type_label": "Término de vocabulario",
                    "deleted_at": EX_DATETIME,
                    "deleted_by_id": EX_USER_ID,
                    "deleted_by_name": "Administradora de prueba (sintética)",
                    "deletion_reason": "Duplicado del término Totora",
                }
            ]
        }
    )

    entity_type: str
    entity_id: uuid.UUID
    entity_label: str = Field(description="Texto con el que se reconoce el registro.")
    type_label: str = Field(description="Nombre del tipo de entidad, en español.")
    deleted_at: datetime | None
    deleted_by_id: uuid.UUID | None
    deleted_by_name: str | None
    deletion_reason: str | None


class TrashRestoreResult(BaseModel):
    """Resultado de una restauración desde la papelera."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "entity_type": "term",
                    "entity_id": EX_TERM_ID,
                    "entity_label": "Totora",
                    "type_label": "Término de vocabulario",
                    "restored": True,
                    "previous_deletion_reason": "Duplicado del término Totora",
                }
            ]
        }
    )

    entity_type: str
    entity_id: uuid.UUID
    entity_label: str
    type_label: str
    restored: bool = True
    previous_deletion_reason: str | None


def _entry_out(entry: TrashEntry, names: dict[uuid.UUID, str]) -> TrashEntryOut:
    return TrashEntryOut(
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        entity_label=entry.entity_label,
        type_label=entry.type_label,
        deleted_at=entry.deleted_at,
        deleted_by_id=entry.deleted_by_id,
        deleted_by_name=names.get(entry.deleted_by_id) if entry.deleted_by_id else None,
        deletion_reason=entry.deletion_reason,
    )


@router.get(
    "/trash",
    response_model=Page[TrashEntryOut],
    summary="Listar los registros eliminados lógicamente, con motivo y responsable (RN-005)",
    tags=["Auditoría"],
    **implemented(),
)
def list_trash_entries(
    session: SessionDep,
    user: TrashReader,
    params: Annotated[PageParams, Depends(page_params)],
    entity_type: Annotated[
        str | None, Query(description=f"Tipo de entidad. Admitidos: {ENTITY_TYPES}.")
    ] = None,
    deleted_by: Annotated[uuid.UUID | None, Query(description="Quién eliminó.")] = None,
    deleted_from: Annotated[datetime | None, Query(alias="from")] = None,
    deleted_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> Page[TrashEntryOut]:
    entries, total = list_trash(
        session,
        entity_types=[entity_type] if entity_type else None,
        deleted_by=deleted_by,
        deleted_from=deleted_from,
        deleted_to=deleted_to,
        limit=params.page_size,
        offset=params.offset,
    )
    names = deleted_by_names(session, entries)
    return Page(
        items=[_entry_out(entry, names) for entry in entries],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.post(
    "/trash/{entity_type}/{entity_id}/restore",
    response_model=TrashRestoreResult,
    responses={
        404: {"model": ErrorResponse, "description": "El registro no existe."},
        409: {
            "model": ErrorResponse,
            "description": (
                "`restore_dependency`: alguna dependencia sigue eliminada (hay que restaurarla "
                "primero) o `not_deleted`: el registro no está en la papelera."
            ),
        },
    },
    summary="Restaurar un registro eliminado verificando sus dependencias (Administrador)",
    tags=["Auditoría"],
    **implemented(),
)
def restore_trash_entry(
    entity_type: Annotated[str, Path(description=f"Tipo de entidad. Admitidos: {ENTITY_TYPES}.")],
    entity_id: uuid.UUID,
    session: SessionDep,
    user: TrashReader,
    reason: Annotated[str | None, Query(description="Motivo de la restauración.")] = None,
) -> TrashRestoreResult:
    entry = restore_from_trash(writer(session, user, reason), entity_type, entity_id, reason)
    session.commit()
    return TrashRestoreResult(
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        entity_label=entry.entity_label,
        type_label=entry.type_label,
        previous_deletion_reason=entry.deletion_reason,
    )
