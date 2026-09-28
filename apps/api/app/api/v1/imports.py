"""Import reconciliation pipeline (importacion-datos; RF-021..RF-029). Contract only (stubs)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.api.deps import CurrentUser, require_permission
from app.api.errors import COMMON_ERROR_RESPONSES
from app.api.pagination import Page, PageParams, page_params
from app.api.stubs import (
    CHANGE_IMPORTS,
    CHANGE_TEMPLATES,
    example_of,
    not_implemented,
    page_example,
    stub,
)
from app.modules.imports.models import ImportBatchStatus, RowClassification
from app.modules.imports.schemas import (
    ApprovalRequest,
    ImportBatchOut,
    ImportLog,
    ImportRowOut,
    MappingRequest,
    MappingTemplateCreate,
    MappingTemplateOut,
    RevertRequest,
    RowDecisionRequest,
    ValidationSummary,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Importación"])

Preparer = Annotated[CurrentUser, Depends(require_permission("imports.prepare"))]
Approver = Annotated[CurrentUser, Depends(require_permission("imports.approve"))]
Reverter = Annotated[CurrentUser, Depends(require_permission("imports.revert"))]


@router.post(
    "/imports/upload",
    response_model=ImportBatchOut,
    status_code=status.HTTP_201_CREATED,
    summary="1. Ingesta: subir un Excel y crear el lote",
    **stub(CHANGE_IMPORTS),
)
def upload_import_batch(
    user: Preparer,
    file: Annotated[UploadFile, File(description="Archivo .xlsx de origen.")],
    source_name: Annotated[str, Form(min_length=1, max_length=200)],
) -> ImportBatchOut:
    raise not_implemented(CHANGE_IMPORTS, ImportBatchOut)


@router.get(
    "/imports",
    response_model=Page[ImportBatchOut],
    summary="Listar lotes de importación",
    **stub(CHANGE_IMPORTS),
)
def list_import_batches(
    user: Preparer,
    params: Annotated[PageParams, Depends(page_params)],
    batch_status: Annotated[ImportBatchStatus | None, Query(alias="status")] = None,
) -> Page[ImportBatchOut]:
    raise not_implemented(CHANGE_IMPORTS, page_example(ImportBatchOut))


@router.get(
    "/imports/{batch_id}",
    response_model=ImportBatchOut,
    summary="Estado de un lote",
    **stub(CHANGE_IMPORTS),
)
def get_import(batch_id: uuid.UUID, user: Preparer) -> ImportBatchOut:
    raise not_implemented(CHANGE_IMPORTS, ImportBatchOut)


@router.put(
    "/imports/{batch_id}/mapping",
    response_model=ImportBatchOut,
    summary="2. Mapeo: asignar columnas (o aplicar una plantilla)",
    **stub(CHANGE_IMPORTS),
)
def set_import_mapping(batch_id: uuid.UUID, body: MappingRequest, user: Preparer) -> ImportBatchOut:
    raise not_implemented(CHANGE_IMPORTS, ImportBatchOut)


@router.post(
    "/imports/{batch_id}/validate",
    response_model=ValidationSummary,
    summary="3-4. Normalizar, validar y hacer matching multi-código",
    **stub(CHANGE_IMPORTS),
)
def validate_import(batch_id: uuid.UUID, user: Preparer) -> ValidationSummary:
    raise not_implemented(CHANGE_IMPORTS, ValidationSummary)


@router.get(
    "/imports/{batch_id}/diffs",
    response_model=Page[ImportRowOut],
    summary="5. Previsualización con diff y clasificación de filas",
    **stub(CHANGE_IMPORTS),
)
def get_import_batch_diffs(
    batch_id: uuid.UUID,
    user: Preparer,
    params: Annotated[PageParams, Depends(page_params)],
    classification: RowClassification | None = None,
    only_errors: bool = False,
) -> Page[ImportRowOut]:
    raise not_implemented(CHANGE_IMPORTS, page_example(ImportRowOut))


@router.patch(
    "/imports/{batch_id}/rows/{row_id}",
    response_model=ImportRowOut,
    summary="Decidir sobre una fila (aceptar, excluir o rechazar con motivo)",
    **stub(CHANGE_IMPORTS),
)
def decide_import_row(
    batch_id: uuid.UUID, row_id: uuid.UUID, body: RowDecisionRequest, user: Preparer
) -> ImportRowOut:
    raise not_implemented(CHANGE_IMPORTS, ImportRowOut)


@router.post(
    "/imports/{batch_id}/confirm",
    response_model=ImportBatchOut,
    summary="6. Aprobación explícita por rol autorizado (RF-027)",
    **stub(CHANGE_IMPORTS),
)
def confirm_import_batch(
    batch_id: uuid.UUID, body: ApprovalRequest, user: Approver
) -> ImportBatchOut:
    raise not_implemented(CHANGE_IMPORTS, ImportBatchOut)


@router.get(
    "/imports/{batch_id}/log",
    response_model=ImportLog,
    summary="7. Bitácora de carga con motivos de rechazo (RF-028)",
    **stub(CHANGE_IMPORTS),
)
def get_import_log(batch_id: uuid.UUID, user: Preparer) -> ImportLog:
    raise not_implemented(CHANGE_IMPORTS, ImportLog)


@router.post(
    "/imports/{batch_id}/rollback",
    response_model=ImportBatchOut,
    summary="Revertir un lote aplicado (RNF-007)",
    **stub(CHANGE_IMPORTS),
)
def rollback_import_batch(
    batch_id: uuid.UUID, body: RevertRequest, user: Reverter
) -> ImportBatchOut:
    raise not_implemented(CHANGE_IMPORTS, ImportBatchOut)


@router.get(
    "/import-templates",
    response_model=list[MappingTemplateOut],
    summary="Plantillas de mapeo reutilizables (RF-022)",
    **stub(CHANGE_TEMPLATES),
)
def list_import_templates(
    user: Preparer,
    header_signature: Annotated[
        str | None, Query(description="Sugiere plantillas para estos encabezados.")
    ] = None,
) -> list[MappingTemplateOut]:
    raise not_implemented(CHANGE_TEMPLATES, [example_of(MappingTemplateOut)])


@router.post(
    "/import-templates",
    response_model=MappingTemplateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Guardar una plantilla de mapeo",
    **stub(CHANGE_TEMPLATES),
)
def create_import_template(body: MappingTemplateCreate, user: Preparer) -> MappingTemplateOut:
    raise not_implemented(CHANGE_TEMPLATES, MappingTemplateOut)
