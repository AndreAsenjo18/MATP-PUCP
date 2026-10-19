"""Import reconciliation pipeline (importacion-datos; RF-021..RF-029).

Implemented: ingestion, mapping, validation and preview (``importacion-pipeline-
reconciliacion`` 2.1, 3.1, 3.4). Decisions, approval, log and rollback are still stubs.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import Page, PageParams, page_params, paginate
from app.api.stubs import (
    CHANGE_IMPORTS,
    CHANGE_TEMPLATES,
    example_of,
    implemented,
    not_implemented,
    stub,
)
from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.modules.imports.classify import ProvisionalSimilarityScorer, classification_rules
from app.modules.imports.mapping import (
    IDENTIFIER_TARGET,
    PAYLOAD_TARGET,
    ColumnSpec,
    MappingSpec,
)
from app.modules.imports.models import ImportBatch, ImportBatchStatus, ImportRow, RowClassification
from app.modules.imports.schemas import (
    ApprovalRequest,
    ClassificationRule,
    ImportBatchOut,
    ImportBatchSummary,
    ImportDiffsPage,
    ImportLog,
    ImportRowOut,
    MappingRequest,
    MappingTemplateCreate,
    MappingTemplateOut,
    RevertRequest,
    RowDecisionRequest,
    ValidationSummary,
)
from app.modules.imports.service import (
    create_batch,
    ingest_stage,
    set_mapping,
    validate_stage,
)
from app.modules.imports.state import STATUS_LABELS
from app.modules.imports.worker import Stage, launch_stage

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Importación"])

Preparer = Annotated[CurrentUser, Depends(require_permission("imports.prepare"))]
Approver = Annotated[CurrentUser, Depends(require_permission("imports.approve"))]
Reverter = Annotated[CurrentUser, Depends(require_permission("imports.revert"))]

NOT_FOUND = {404: {"model": ErrorResponse, "description": "El lote no existe o fue eliminado."}}
PREVIEW_STATUSES = frozenset(
    {
        ImportBatchStatus.IN_PREVIEW,
        ImportBatchStatus.APPROVED,
        ImportBatchStatus.APPLIED,
        ImportBatchStatus.FAILED_APPLY,
        ImportBatchStatus.REVERTED,
        ImportBatchStatus.ABANDONED,
    }
)


def get_batch(session: SessionDep, batch_id: uuid.UUID) -> ImportBatch:
    batch = session.get(ImportBatch, batch_id)
    if batch is None or batch.deleted_at is not None:
        raise NotFound("El lote de importación no existe.", code="batch_not_found")
    return batch


def _read_upload(file: UploadFile, max_bytes: int) -> bytes:
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise ValidationFailed(
            f"El archivo supera el tamaño máximo de {max_bytes // (1024 * 1024)} MB por lote; "
            "divídalo en varios archivos.",
            code="file_too_large",
            details={"max_bytes": max_bytes},
        )
    return content


@router.post(
    "/imports/upload",
    response_model=ImportBatchSummary,
    status_code=status.HTTP_202_ACCEPTED,
    summary="1. Ingesta: subir un Excel y crear el lote",
    description="Guarda el archivo original sin modificarlo y lo lee en segundo plano; el "
    "avance se consulta en `GET /imports/{batch_id}`. Un formato no admitido o un archivo con "
    "más de IMPORT_MAX_ROWS filas deja el lote «fallido en ingesta» con el motivo.",
    **implemented(),
)
def upload_import_batch(
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: Preparer,
    file: Annotated[UploadFile, File(description="Archivo .xlsx o .csv de origen.")],
) -> ImportBatchSummary:
    settings = request.app.state.settings
    content = _read_upload(file, settings.import_max_bytes)
    writer(session, user)
    batch = create_batch(
        session,
        request.app.state.storage,
        file_name=file.filename or "archivo-sin-nombre",
        content=content,
        uploaded_by_id=user.id,
    )
    session.commit()
    if batch.status == ImportBatchStatus.UPLOADED:
        batch = launch_stage(
            session,
            background_tasks,
            request.app.state.session_factory,
            batch.id,
            Stage.INGEST,
            ingest_stage(content, max_rows=settings.import_max_rows),
            user.id,
        )
    return ImportBatchSummary.from_batch(batch)


@router.get(
    "/imports",
    response_model=Page[ImportBatchOut],
    summary="Listar lotes de importación",
    **implemented(),
)
def list_import_batches(
    session: SessionDep,
    user: Preparer,
    params: Annotated[PageParams, Depends(page_params)],
    batch_status: Annotated[ImportBatchStatus | None, Query(alias="status")] = None,
) -> Page[ImportBatchOut]:
    statement = (
        select(ImportBatch)
        .where(ImportBatch.deleted_at.is_(None))
        .order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc())
    )
    if batch_status is not None:
        statement = statement.where(ImportBatch.status == batch_status)
    batches, total = paginate(session, statement, params)
    return Page(
        items=[ImportBatchOut.from_batch(batch) for batch in batches],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get(
    "/imports/{batch_id}",
    response_model=ImportBatchOut,
    responses=NOT_FOUND,
    summary="Estado de un lote, con la etapa en curso y su avance",
    **implemented(),
)
def get_import(batch_id: uuid.UUID, session: SessionDep, user: Preparer) -> ImportBatchOut:
    return ImportBatchOut.from_batch(get_batch(session, batch_id))


def _mapping_spec(body: MappingRequest) -> MappingSpec:
    if body.template_id is not None or body.save_as_template_name is not None:
        raise ValidationFailed(
            "Las plantillas de mapeo todavía no están disponibles; indique las columnas.",
            code="templates_not_available",
            details={"change": CHANGE_TEMPLATES},
        )
    columns: list[ColumnSpec] = []
    for column in body.columns:
        target = column.target_field or PAYLOAD_TARGET
        identifier_type = column.identifier_type_code
        if target.startswith(f"{IDENTIFIER_TARGET}:"):
            target, identifier_type = IDENTIFIER_TARGET, target.split(":", 1)[1] or None
        columns.append(
            ColumnSpec(
                source=column.source_column,
                target=target,
                identifier_type=identifier_type if target == IDENTIFIER_TARGET else None,
                split_compound=column.split_compound,
            )
        )
    return MappingSpec(columns=columns, defaults=dict(body.defaults))


@router.put(
    "/imports/{batch_id}/mapping",
    response_model=ImportBatchOut,
    responses=NOT_FOUND,
    summary="2. Mapeo: asignar columnas (o aplicar una plantilla)",
    description="Asigna cada columna a un campo de la ficha, a un tipo de identificador o a "
    "los datos de origen; las columnas no listadas quedan como datos de origen (RF-008). "
    "Volver a mapear un lote en previsualización descarta su validación. Implementación "
    "mínima hasta `plantillas-mapeo-y-normalizacion` (design D3).",
    **implemented(),
)
def set_import_mapping(
    request: Request,
    batch_id: uuid.UUID,
    body: MappingRequest,
    session: SessionDep,
    user: Preparer,
) -> ImportBatchOut:
    spec = _mapping_spec(body)
    writer(session, user)
    batch = set_mapping(
        session,
        request.app.state.storage,
        batch_id,
        spec,
        sheet_name=body.sheet_name,
        header_row=body.header_row,
        max_rows=request.app.state.settings.import_max_rows,
    )
    session.commit()
    return ImportBatchOut.from_batch(batch)


@router.post(
    "/imports/{batch_id}/validate",
    response_model=ValidationSummary,
    status_code=status.HTTP_202_ACCEPTED,
    responses=NOT_FOUND,
    summary="3-4. Normalizar, validar y hacer matching multi-código",
    description="Lanza la validación en segundo plano y responde de inmediato; al terminar, el "
    "lote queda en previsualización con los conteos por clasificación (RF-026).",
    **implemented(),
)
def validate_import(
    request: Request,
    background_tasks: BackgroundTasks,
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
) -> ValidationSummary:
    get_batch(session, batch_id)
    batch = launch_stage(
        session,
        background_tasks,
        request.app.state.session_factory,
        batch_id,
        Stage.VALIDATE,
        validate_stage(),
        user.id,
    )
    counts = ImportBatchOut.from_batch(batch).counts or {}
    return ValidationSummary(
        batch_id=batch.id,
        status=batch.status,
        counts=counts,
        rows_with_errors=counts.get("ERRORS", 0),
        unparseable_codes=counts.get("UNPARSEABLE_CODES", 0),
    )


@router.get(
    "/imports/{batch_id}/diffs",
    response_model=ImportDiffsPage,
    responses=NOT_FOUND,
    summary="5. Previsualización con diff y clasificación de filas",
    description="Filas del lote con su clasificación, coincidencias, errores y diff campo a "
    "campo, más las reglas y umbrales usados para clasificarlas (RF-025, RF-026).",
    **implemented(),
)
def get_import_batch_diffs(
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
    params: Annotated[PageParams, Depends(page_params)],
    classification: RowClassification | None = None,
    only_errors: bool = False,
) -> ImportDiffsPage:
    batch = get_batch(session, batch_id)
    if batch.status not in PREVIEW_STATUSES:
        raise ConflictError(
            f"El lote está en estado «{STATUS_LABELS[batch.status]}»: valídelo para ver la "
            "previsualización.",
            code="batch_not_validated",
            details={"current_status": batch.status.value},
        )
    statement = (
        select(ImportRow)
        .where(ImportRow.batch_id == batch.id)
        .order_by(ImportRow.source_row_number)
    )
    if classification is not None:
        statement = statement.where(ImportRow.classification == classification)
    if only_errors:
        statement = statement.where(ImportRow.has_validation_errors.is_(True))
    rows, total = paginate(session, statement, params)
    return ImportDiffsPage(
        items=[ImportRowOut.from_row(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
        classification_rules=[
            ClassificationRule.model_validate(rule)
            for rule in classification_rules(ProvisionalSimilarityScorer(session))
        ],
    )


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
