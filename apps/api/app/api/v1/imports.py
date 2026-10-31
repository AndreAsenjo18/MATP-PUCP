"""Import reconciliation pipeline (importacion-datos; RF-021..RF-029).

Implemented by ``importacion-pipeline-reconciliacion``: ingestion, mapping, validation and
preview (2.1, 3.1, 3.4), decisions, approval and log (4.1 to 4.3), embedded images (5.1) and
rollback on the revert engine of ``auditoria-y-soft-delete-transversal`` (5.2).
"""

import logging
import uuid
from typing import Annotated, Any

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import (
    LimitPageParams,
    Page,
    PageParams,
    limit_page_params,
    page_params,
    paginate,
)
from app.api.stubs import (
    CHANGE_TEMPLATES,
    implemented,
)
from app.core import jobs
from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, require_audit_context, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.imports import templates
from app.modules.imports.apply import apply_stage
from app.modules.imports.candidates import enrich_matches
from app.modules.imports.catalog_photo_matching import FolderRule
from app.modules.imports.catalog_photos import (
    folders_overview,
    reading_preview,
    save_reading,
    upload_correspondences,
)
from app.modules.imports.classify import ProvisionalSimilarityScorer, classification_rules
from app.modules.imports.decisions import approval_summary, approve, decide_row, row_action
from app.modules.imports.dry_run import dry_run_out, run_dry_run
from app.modules.imports.images import associate_image, batch_images
from app.modules.imports.log import XLSX_CONTENT_TYPE, build_log, log_workbook
from app.modules.imports.mapping import (
    IDENTIFIER_TARGET,
    PAYLOAD_TARGET,
    TERMS_TARGET,
    ColumnSpec,
    MappingConversionError,
    MappingSpec,
    from_column_mappings,
)
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportBatchStatus,
    ImportImage,
    ImportMappingTemplate,
    ImportPhotoStatus,
    ImportRow,
    PhotoMatchStatus,
    RowClassification,
    RowDecision,
)
from app.modules.imports.photo_review import OPERATION_LABELS, decide_photos, photos_query
from app.modules.imports.photo_review import summary as photo_summary
from app.modules.imports.photo_review import thumbnail_url as photo_thumbnail_url
from app.modules.imports.photo_upload import (
    DeclaredPhoto,
    PhotoLimits,
    complete_uploads,
    request_upload_urls,
)
from app.modules.imports.photo_verification import QUEUE as PHOTO_QUEUE
from app.modules.imports.rollback import rollback_batch
from app.modules.imports.schemas import (
    ApprovalRequest,
    ClassificationRule,
    CorrespondenceLineOut,
    CorrespondencesOut,
    FolderRuleRequest,
    ImageAssociateRequest,
    ImportBatchOut,
    ImportBatchSummary,
    ImportDiffsPage,
    ImportImageOut,
    ImportLog,
    ImportLogEntry,
    ImportPhotoOut,
    ImportPhotoSummary,
    ImportRowOut,
    MappingRequest,
    MappingTemplateCreate,
    MappingTemplateOut,
    MappingTemplateUpdate,
    PhotoBatchCreate,
    PhotoCompleteOut,
    PhotoCompleteRequest,
    PhotoDecisionLogEntry,
    PhotoDecisionOut,
    PhotoDecisionRequest,
    PhotoFolderOut,
    PhotoFoldersOut,
    PhotoReadingRule,
    PhotoStateOut,
    PhotoUploadItemOut,
    PhotoUploadUrlsOut,
    PhotoUploadUrlsRequest,
    ReadingPreviewOut,
    RevertRequest,
    RowDecisionRequest,
    TemplateDryRunOut,
    TemplateDryRunRequest,
    TemplateSuggestion,
    TemplateSuggestRequest,
    ValidationSummary,
)
from app.modules.imports.service import (
    create_batch,
    create_photo_batch,
    ingest_stage,
    set_mapping,
    validate_stage,
)
from app.modules.imports.state import STATUS_LABELS, lock_batch, require_kind
from app.modules.imports.worker import Stage, launch_stage
from app.modules.media import derivatives

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Importación"])
logger = logging.getLogger("matp.imports")

Preparer = Annotated[CurrentUser, Depends(require_permission("imports.prepare"))]
Approver = Annotated[CurrentUser, Depends(require_permission("imports.approve"))]
Reverter = Annotated[CurrentUser, Depends(require_permission("imports.revert"))]
MediaUploader = Annotated[CurrentUser, Depends(require_permission("media.upload"))]

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
# States whose approval summary is shown: the batch can still be approved (RF-027).
APPROVABLE_STATUSES = frozenset({ImportBatchStatus.IN_PREVIEW, ImportBatchStatus.FAILED_APPLY})


def get_batch(session: SessionDep, batch_id: uuid.UUID) -> ImportBatch:
    batch = session.get(ImportBatch, batch_id)
    if batch is None or batch.deleted_at is not None:
        raise NotFound("El lote de importación no existe.", code="batch_not_found")
    return batch


def get_spreadsheet_batch(session: SessionDep, batch_id: uuid.UUID) -> ImportBatch:
    """The batch of an Excel-only operation (mapping, validation, rows, embedded images): a
    ``PHOTOS`` batch answers ``409 batch_kind_mismatch`` (importacion-fotos-a-catalogo, D1)."""
    batch = get_batch(session, batch_id)
    require_kind(batch, ImportBatchKind.SPREADSHEET)
    return batch


KIND_CONFLICT = {
    409: {
        "model": ErrorResponse,
        "description": "`batch_kind_mismatch`: la operación no corresponde al tipo de lote.",
    }
}


def batch_out(session: SessionDep, batch: ImportBatch) -> ImportBatchOut:
    approval = (
        approval_summary(session, batch.id).as_json()
        if batch.status in APPROVABLE_STATUSES
        else None
    )
    out = ImportBatchOut.from_batch(batch, approval)
    if batch.status in APPROVABLE_STATUSES:
        # Rows a person already decided: validating again recalculates every row and drops them.
        decided = session.scalar(
            select(func.count())
            .select_from(ImportRow)
            .where(ImportRow.batch_id == batch.id, ImportRow.decision != RowDecision.PENDING)
        )
        out.counts = {**(out.counts or {}), "DECIDED": int(decided or 0)}
    return out


def _preview_url(storage: ObjectStorage, image: ImportImage) -> str | None:
    try:
        return storage.presign_get(image.storage_key)
    except (BotoCoreError, ClientError):  # a convenience: the image stays listed without it
        return None


def _generate_derivatives(
    storage: ObjectStorage, piece_id: uuid.UUID, asset_id: uuid.UUID, key: str
) -> None:
    """Thumbnails like a manual upload; the photo stays registered if they fail."""
    try:
        derivatives.generate_derivatives(storage, str(piece_id), str(asset_id), key)
    except (OSError, ValueError, RuntimeError, BotoCoreError, ClientError):
        logger.exception("No se generaron los derivados de la foto %s", asset_id)


def _row_out(
    row: ImportRow,
    images: list[ImportImageOut] | None = None,
    matches: list[dict[str, Any]] | None = None,
) -> ImportRowOut:
    return ImportRowOut.from_row(
        row, action=row_action(row)[0].value, images=images, matches=matches
    )


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
            ingest_stage(content, request.app.state.storage, max_rows=settings.import_max_rows),
            user.id,
        )
    return ImportBatchSummary.from_batch(batch)


@router.post(
    "/imports/photo-batches",
    response_model=ImportBatchOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un lote de solo fotografías para piezas existentes",
    description="Crea un lote sin Excel cuyas fotos se emparejan con las piezas ya registradas "
    "por sus identificadores vigentes (RF-046). Las fotos se suben con las mismas operaciones "
    "de `/imports/{batch_id}/photos/…`; las operaciones de Excel (mapeo, validación, filas) "
    "responden 409 `batch_kind_mismatch` en este lote (`importacion-fotos-a-catalogo`, D1).",
    **implemented(),
)
def create_import_photo_batch(
    body: PhotoBatchCreate, session: SessionDep, user: Preparer
) -> ImportBatchOut:
    writer(session, user)
    batch = create_photo_batch(session, name=body.name, uploaded_by_id=user.id)
    session.commit()
    return ImportBatchOut.from_batch(batch)


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
    return batch_out(session, get_batch(session, batch_id))


def _mapping_spec(body: MappingRequest, session: Session | None = None) -> MappingSpec:
    if body.save_as_template_name is not None:
        raise ValidationFailed(
            "Guardar el mapeo de un lote como plantilla todavía no está disponible; cree la "
            "plantilla con `POST /import-templates`.",
            code="templates_not_available",
            details={"change": CHANGE_TEMPLATES},
        )
    # Phase 2 of design D1: a template or v1-only fields make the batch mapping v1.
    if body.template_id is not None:
        if body.columns:
            raise ValidationFailed(
                "Indique una plantilla o las columnas, no ambas: la plantilla ya define el mapeo.",
                code="template_with_columns",
            )
        assert session is not None
        return templates.batch_spec(session, body.template_id, body.defaults)
    if any(
        column.transforms
        or column.value_map
        or (column.target_field or "").startswith(f"{TERMS_TARGET}:")
        for column in body.columns
    ):
        try:
            return MappingSpec.from_v1(from_column_mappings(body.columns, body.defaults))
        except MappingConversionError as exc:
            raise ValidationFailed(
                "El mapeo de columnas tiene errores; corríjalos y vuelva a enviarlo.",
                code="invalid_mapping",
                details={
                    "errors": [{"code": exc.code, "message": exc.message, "column": exc.column}]
                },
            ) from exc
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
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="2. Mapeo: asignar columnas (o aplicar una plantilla)",
    description="Asigna cada columna a un campo de la ficha, a un tipo de identificador o a "
    "los datos de origen; las columnas no listadas quedan como datos de origen (RF-008). "
    "Volver a mapear un lote en previsualización descarta su validación. Con `template_id` "
    "(sin `columns`) se aplica una plantilla guardada; con una plantilla, transformaciones, "
    "`value_map` o destinos `terms:<VOCABULARIO>` el lote guarda el mapeo en versión 1 "
    "(design D1, fase 2).",
    **implemented(),
)
def set_import_mapping(
    request: Request,
    batch_id: uuid.UUID,
    body: MappingRequest,
    session: SessionDep,
    user: Preparer,
) -> ImportBatchOut:
    get_spreadsheet_batch(session, batch_id)
    spec = _mapping_spec(body, session)
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
    batch.template_id = body.template_id  # the template the mapping came from, if any
    session.commit()
    return ImportBatchOut.from_batch(batch)


@router.post(
    "/imports/{batch_id}/validate",
    response_model=ValidationSummary,
    status_code=status.HTTP_202_ACCEPTED,
    responses={**NOT_FOUND, **KIND_CONFLICT},
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
    get_spreadsheet_batch(session, batch_id)
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
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="5. Previsualización con diff y clasificación de filas",
    description="Filas del lote con su clasificación, coincidencias, errores, diff campo a "
    "campo, la acción que hará la aplicación y sus imágenes, más las reglas y umbrales usados "
    "para clasificarlas y la bandeja de imágenes sin fila (RF-025, RF-026, RF-029).",
    **implemented(),
)
def get_import_batch_diffs(
    request: Request,
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
    params: Annotated[PageParams, Depends(page_params)],
    classification: RowClassification | None = None,
    only_errors: bool = False,
) -> ImportDiffsPage:
    batch = get_spreadsheet_batch(session, batch_id)
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
    storage: ObjectStorage = request.app.state.storage
    candidates = enrich_matches(session, rows)
    images: dict[uuid.UUID | None, list[ImportImageOut]] = {}
    for image in batch_images(session, batch.id):
        images.setdefault(image.import_row_id, []).append(
            ImportImageOut.from_image(image, _preview_url(storage, image))
        )
    return ImportDiffsPage(
        items=[_row_out(row, images.get(row.id), candidates.get(row.id)) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
        classification_rules=[
            ClassificationRule.model_validate(rule)
            for rule in classification_rules(ProvisionalSimilarityScorer(session))
        ],
        unassigned_images=images.get(None, []),
    )


@router.patch(
    "/imports/{batch_id}/rows/{row_id}",
    response_model=ImportRowOut,
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="Decidir sobre una fila (aceptar, excluir o rechazar con motivo)",
    description="Acepta, excluye o rechaza (con motivo) una fila; acepta o excluye campos del "
    "diff; resuelve un conflicto o posible duplicado eligiendo la pieza destino "
    "(`target_piece_id`) o marcándola como nueva (`as_new`). Una fila con errores o un "
    "conflicto sin resolver no se puede aceptar (422).",
    **implemented(),
)
def decide_import_row(
    batch_id: uuid.UUID,
    row_id: uuid.UUID,
    body: RowDecisionRequest,
    session: SessionDep,
    user: Preparer,
) -> ImportRowOut:
    get_spreadsheet_batch(session, batch_id)
    writer(session, user)
    row = decide_row(
        session,
        batch_id,
        row_id,
        decision=RowDecision(body.decision),
        user_id=user.id,
        reason=body.reason,
        target_piece_id=body.target_piece_id,
        as_new=body.as_new,
        field_decisions=dict(body.field_decisions),
    )
    session.commit()
    return _row_out(row, matches=enrich_matches(session, [row])[row.id])


@router.post(
    "/imports/{batch_id}/confirm",
    response_model=ImportBatchOut,
    responses=NOT_FOUND,
    summary="6. Aprobación explícita por rol autorizado (RF-027)",
    description="Aprueba el lote con el `summary_token` del resumen mostrado y lo aplica en "
    "segundo plano, en una sola transacción. Si el resumen cambió responde 409 "
    "`summary_changed` con el resumen actual. Si una fila viola una regla de dominio no se "
    "aplica ninguna y el lote queda «fallido al aplicar» con la fila y el motivo.",
    **implemented(),
)
def confirm_import_batch(
    request: Request,
    background_tasks: BackgroundTasks,
    batch_id: uuid.UUID,
    body: ApprovalRequest,
    session: SessionDep,
    user: Approver,
) -> ImportBatchOut:
    writer(session, user, reason=body.comment)
    approve(session, batch_id, body.summary_token, user.id)
    session.commit()
    batch = launch_stage(
        session,
        background_tasks,
        request.app.state.session_factory,
        batch_id,
        Stage.APPLY,
        apply_stage(
            request.app.state.storage,
            keep_originals=request.app.state.settings.media_keep_originals,
        ),
        user.id,
    )
    return ImportBatchOut.from_batch(batch)


@router.get(
    "/imports/{batch_id}/log",
    response_model=ImportLog,
    responses={
        **NOT_FOUND,
        200: {
            "content": {XLSX_CONTENT_TYPE: {}},
            "description": "Bitácora en JSON o, con `format=xlsx`, como hoja de cálculo.",
        },
    },
    summary="7. Bitácora de carga con motivos de rechazo (RF-028)",
    description="Archivo, hoja, mapeo, cargador, aprobador, marcas por etapa, conteos y cada "
    "fila no aplicada con su número de fila y motivo. `format=xlsx` la descarga en Excel.",
    **implemented(),
)
def get_import_log(
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
    output_format: Annotated[
        str, Query(alias="format", pattern="^(json|xlsx)$", description="`json` o `xlsx`.")
    ] = "json",
) -> ImportLog | Response:
    batch = get_batch(session, batch_id)
    log = build_log(session, batch)
    if output_format == "xlsx":
        return Response(
            content=log_workbook(log),
            media_type=XLSX_CONTENT_TYPE,
            headers={"Content-Disposition": f'attachment; filename="bitacora-{batch.id}.xlsx"'},
        )
    return ImportLog(
        batch=log["batch"],
        applied_rows=log["applied_rows"],
        rejected_rows=log["rejected_rows"],
        entries=[ImportLogEntry.model_validate(entry) for entry in log["entries"]],
        photo_decisions=[
            PhotoDecisionLogEntry.model_validate(item) for item in log["photo_decisions"]
        ],
        download_url=f"/api/v1/imports/{batch.id}/log?format=xlsx",
    )


@router.post(
    "/imports/{batch_id}/images/{image_id}/associate",
    response_model=ImportImageOut,
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="Asociar una imagen extraída del Excel a una pieza (RF-029)",
    description="Registra la imagen como foto de la pieza de su fila (o de `piece_id`) con "
    "referencia al lote, tras verificar tipo y huella. Solo después de aplicar el lote (409 "
    "antes): nunca se asocian automáticamente.",
    **implemented(),
)
def associate_import_image(
    request: Request,
    background_tasks: BackgroundTasks,
    batch_id: uuid.UUID,
    image_id: uuid.UUID,
    body: ImageAssociateRequest,
    session: SessionDep,
    user: MediaUploader,
) -> ImportImageOut:
    storage: ObjectStorage = request.app.state.storage
    batch = get_spreadsheet_batch(session, batch_id)
    asset = associate_image(
        session,
        storage,
        batch,
        image_id,
        user_id=user.id,
        piece_id=body.piece_id,
        view_type_term_id=body.view_type_term_id,
    )
    session.commit()
    background_tasks.add_task(
        _generate_derivatives, storage, asset.piece_id, asset.id, asset.storage_key
    )
    image = session.get(ImportImage, image_id)
    assert image is not None
    return ImportImageOut.from_image(image, _preview_url(storage, image))


PHOTOS_CONFLICT = {
    409: {"model": ErrorResponse, "description": "El lote ya no admite fotos (está aprobado)."}
}


@router.post(
    "/imports/{batch_id}/photos/upload-urls",
    response_model=PhotoUploadUrlsOut,
    responses={**NOT_FOUND, **PHOTOS_CONFLICT},
    summary="Fotografías del lote: pedir las URL de subida de una tanda",
    description="Registra hasta 100 archivos por llamada y devuelve, por archivo, una URL "
    "prefirmada para subirlo directo al almacenamiento. Si la huella SHA-256 ya está en el "
    "lote, el archivo vuelve como `already_registered` y no se sube otra vez: volver a soltar "
    "la misma carpeta reanuda una subida cortada. Un tipo o tamaño no admitido vuelve como "
    "`rejected` sin detener la tanda (RF-045; `importacion-masiva-fotografias`, diseño D2).",
    **implemented(),
)
def request_import_photo_upload_urls(
    request: Request,
    batch_id: uuid.UUID,
    body: PhotoUploadUrlsRequest,
    session: SessionDep,
    user: Preparer,
) -> PhotoUploadUrlsOut:
    writer(session, user)
    files = [DeclaredPhoto(**file.model_dump()) for file in body.files]
    items = request_upload_urls(
        session,
        request.app.state.storage,
        batch_id,
        files,
        PhotoLimits.from_settings(request.app.state.settings),
    )
    session.commit()
    return PhotoUploadUrlsOut(
        batch_id=batch_id, items=[PhotoUploadItemOut.from_item(item) for item in items]
    )


@router.post(
    "/imports/{batch_id}/photos/complete",
    response_model=PhotoCompleteOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={**NOT_FOUND, **PHOTOS_CONFLICT},
    summary="Fotografías del lote: avisar qué archivos terminaron de subirse",
    description="Las fotos pasan a `UPLOADED` y quedan en cola: en segundo plano se verifica el "
    "tipo real, el tamaño y la huella SHA-256 de cada archivo y se generan su miniatura y su "
    "copia de visualización; la foto queda `VERIFIED` o `REJECTED` con su motivo y se le propone "
    "una fila del lote. Repetir la llamada no cambia nada (`importacion-masiva-fotografias`, "
    "diseño D2).",
    **implemented(),
)
def complete_import_photo_uploads(
    batch_id: uuid.UUID,
    body: PhotoCompleteRequest,
    session: SessionDep,
    user: Preparer,
) -> PhotoCompleteOut:
    writer(session, user)
    photos = complete_uploads(session, batch_id, body.photo_ids)
    session.commit()
    jobs.notify(PHOTO_QUEUE)
    return PhotoCompleteOut(
        batch_id=batch_id, photos=[PhotoStateOut.from_photo(photo) for photo in photos]
    )


@router.get(
    "/imports/{batch_id}/photos",
    response_model=Page[ImportPhotoOut],
    responses=NOT_FOUND,
    summary="Fotografías del lote: bandeja con filtros y miniaturas",
    description="Fotos del lote con su fila o pieza propuesta o asignada, ordenadas por destino y "
    "posición, con la miniatura firmada de las verificadas y el motivo de las propuestas que no "
    "son directas. Se filtran por estado, propuesta, fila, pieza o carpeta "
    "(`importacion-masiva-fotografias`, diseño D4; `importacion-fotos-a-catalogo`, diseño D8).",
    **implemented(),
)
def list_import_photos(
    request: Request,
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
    params: Annotated[LimitPageParams, Depends(limit_page_params)],
    photo_status: Annotated[ImportPhotoStatus | None, Query(alias="status")] = None,
    match_status: Annotated[PhotoMatchStatus | None, Query()] = None,
    row_id: Annotated[uuid.UUID | None, Query()] = None,
    piece_id: Annotated[uuid.UUID | None, Query(description="Pieza propuesta o asignada.")] = None,
    folder: Annotated[
        str | None, Query(max_length=1000, description="Carpeta y sus subcarpetas (`a/b`).")
    ] = None,
) -> Page[ImportPhotoOut]:
    get_batch(session, batch_id)
    statement = photos_query(
        batch_id,
        status=photo_status,
        match_status=match_status,
        row_id=row_id,
        piece_id=piece_id,
        folder=folder,
    )
    photos, total = paginate(session, statement, params)
    storage: ObjectStorage = request.app.state.storage
    ttl = request.app.state.settings.media_url_ttl_seconds
    return Page(
        items=[
            ImportPhotoOut.from_photo(photo, photo_thumbnail_url(storage, photo, ttl))
            for photo in photos
        ],
        total=total,
        page=params.page,
        page_size=params.limit,
    )


@router.get(
    "/imports/{batch_id}/photos/summary",
    response_model=ImportPhotoSummary,
    responses=NOT_FOUND,
    summary="Fotografías del lote: conteos por estado y propuesta",
    **implemented(),
)
def summarize_import_photos(
    batch_id: uuid.UUID, session: SessionDep, user: Preparer
) -> ImportPhotoSummary:
    get_batch(session, batch_id)
    return ImportPhotoSummary(batch_id=batch_id, **photo_summary(session, batch_id))


@router.patch(
    "/imports/{batch_id}/photos",
    response_model=PhotoDecisionOut,
    responses={
        **NOT_FOUND,
        409: {"model": ErrorResponse, "description": "El lote ya no admite cambios en sus fotos."},
    },
    summary="Fotografías del lote: decidir sobre fotos (asignar, quitar, descartar…)",
    description="`assign` a una fila del lote (lote con Excel) o a una pieza no retirada (lote "
    "de solo fotografías), en el orden enviado y después de su última foto; `unassign`, "
    "`discard`, `restore`, `confirm_duplicate` y `reorder`. El emparejamiento automático ya no "
    "cambia las fotos decididas y cada decisión queda en la bitácora del lote con su autor. Una "
    "fila de otro lote, una fila en un lote de solo fotos, una pieza retirada o una foto sin "
    "verificar responde 422. Nada llega al catálogo hasta aprobar el lote "
    "(`importacion-masiva-fotografias`, diseño D4; `importacion-fotos-a-catalogo`, diseño D8).",
    **implemented(),
)
def decide_import_photos(
    request: Request,
    batch_id: uuid.UUID,
    body: PhotoDecisionRequest,
    session: SessionDep,
    user: Preparer,
) -> PhotoDecisionOut:
    _photo_writer(session, user, batch_id, f"Fotos del lote: {OPERATION_LABELS[body.op]}")
    photos = decide_photos(
        session, batch_id, body.op, body.photo_ids, row_id=body.row_id, piece_id=body.piece_id
    )
    session.commit()
    storage: ObjectStorage = request.app.state.storage
    ttl = request.app.state.settings.media_url_ttl_seconds
    return PhotoDecisionOut(
        batch_id=batch_id,
        photos=[
            ImportPhotoOut.from_photo(photo, photo_thumbnail_url(storage, photo, ttl))
            for photo in photos
        ],
    )


def _photo_writer(session: Session, user: CurrentUser, batch_id: uuid.UUID, reason: str) -> None:
    """A person's decision on the photos of a batch, audited with the batch as ``origin_ref``:
    the batch log lists them (importacion-fotos-a-catalogo, task 4.1)."""
    set_audit_context(
        session,
        AuditContext(
            origin=AuditOrigin.MANUAL, user_id=user.id, origin_ref=str(batch_id), reason=reason
        ),
    )


def _photo_batch(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    batch = get_batch(session, batch_id)
    require_kind(batch, ImportBatchKind.PHOTOS)
    return batch


def _folder_rule(rule: PhotoReadingRule) -> FolderRule:
    return FolderRule(
        mode=rule.mode,
        template=rule.template,
        collection_id=rule.collection_id,
        collection_set="collection_id" in rule.model_fields_set,
    )


def _folders_out(session: Session, batch: ImportBatch) -> PhotoFoldersOut:
    reading = PhotoReadingRule.model_validate(
        (batch.photo_reading or {}).get("default") or {"mode": "auto"}
    )
    return PhotoFoldersOut(
        batch_id=batch.id,
        default_rule=reading,
        folders=[
            PhotoFolderOut.model_validate(folder) for folder in folders_overview(session, batch)
        ],
    )


@router.get(
    "/imports/{batch_id}/photos/folders",
    response_model=PhotoFoldersOut,
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="Fotografías del lote: carpetas con su forma de lectura y su colección",
    description="Árbol de carpetas de un lote de solo fotografías con sus conteos por propuesta, "
    "el rango si es una carpeta de rango, la colección propuesta o confirmada, la regla de "
    "lectura vigente (y de qué carpeta la hereda) y la plantilla sugerida por la forma de sus "
    "nombres (`importacion-fotos-a-catalogo`, diseño D4, D5 y D11).",
    **implemented(),
)
def list_import_photo_folders(
    batch_id: uuid.UUID, session: SessionDep, user: Preparer
) -> PhotoFoldersOut:
    return _folders_out(session, _photo_batch(session, batch_id))


INVALID_TEMPLATE = {
    422: {
        "model": ErrorResponse,
        "description": "`invalid_photo_template`: la plantilla tiene un tipo que no existe, no "
        "identifica nada o usa `{n}` sin colección; `details` trae el motivo y los tipos válidos.",
    }
}


@router.post(
    "/imports/{batch_id}/photos/reading-preview",
    response_model=ReadingPreviewOut,
    responses={**NOT_FOUND, **KIND_CONFLICT, **INVALID_TEMPLATE},
    summary="Fotografías del lote: vista previa de cómo se leen los nombres de una carpeta",
    description="Lee hasta 20 nombres de la carpeta con la regla enviada (nombre → códigos → "
    "pieza o motivo) y cuenta los que no siguen la plantilla, sin guardar nada "
    "(`importacion-fotos-a-catalogo`, diseño D4).",
    **implemented(),
)
def preview_import_photo_reading(
    batch_id: uuid.UUID, body: FolderRuleRequest, session: SessionDep, user: Preparer
) -> ReadingPreviewOut:
    batch = _photo_batch(session, batch_id)
    return ReadingPreviewOut.model_validate(
        reading_preview(session, batch, body.folder, _folder_rule(body.rule))
    )


@router.put(
    "/imports/{batch_id}/photos/reading",
    response_model=PhotoFoldersOut,
    responses={**NOT_FOUND, **KIND_CONFLICT, **INVALID_TEMPLATE},
    summary="Fotografías del lote: guardar la forma de lectura de una carpeta",
    description="Guarda la regla de la carpeta (vacía = todo el lote), que vale también para sus "
    "subcarpetas sin regla propia, y vuelve a emparejar solo las fotos automáticas de esa "
    "carpeta: las asignadas a mano y las descartadas no cambian. Una plantilla inválida "
    "responde 422 y la carpeta conserva su regla (`importacion-fotos-a-catalogo`, diseño D4).",
    **implemented(),
)
def save_import_photo_reading(
    batch_id: uuid.UUID, body: FolderRuleRequest, session: SessionDep, user: Preparer
) -> PhotoFoldersOut:
    batch = _reviewable_photo_batch(session, user, batch_id, "forma de lectura")
    save_reading(session, batch, body.folder, _folder_rule(body.rule))
    session.commit()
    return _folders_out(session, batch)


def _reviewable_photo_batch(
    session: Session, user: CurrentUser, batch_id: uuid.UUID, what: str
) -> ImportBatch:
    """The locked ``PHOTOS`` batch, while its photos can still change (D4, D7)."""
    _photo_batch(session, batch_id)
    _photo_writer(session, user, batch_id, f"Fotos del lote: {what}")
    batch = lock_batch(session, batch_id)
    if batch.status not in {ImportBatchStatus.UPLOADED, ImportBatchStatus.IN_PREVIEW}:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: ya no se cambia su lectura.",
            code="batch_not_reviewable",
            details={"current_status": batch.status.value},
        )
    return batch


@router.post(
    "/imports/{batch_id}/photos/correspondences",
    response_model=CorrespondencesOut,
    responses={**NOT_FOUND, **KIND_CONFLICT},
    summary="Fotografías del lote: subir una lista de correspondencias archivo → código",
    description="CSV o Excel con las columnas `archivo` (nombre o ruta) y `codigo`, y `tipo` "
    "opcional. Propone la pieza de cada foto nombrada con prioridad sobre el nombre, sin tocar "
    "las asignaciones manuales, y la guarda en el lote para las lecturas siguientes. Las líneas "
    "sin foto, sin pieza o ambiguas (nombre repetido en varias carpetas) se informan con su "
    "motivo sin detener las demás (`importacion-fotos-a-catalogo`, diseño D7).",
    **implemented(),
)
def upload_import_photo_correspondences(
    request: Request,
    batch_id: uuid.UUID,
    session: SessionDep,
    user: Preparer,
    file: Annotated[UploadFile, File(description="Lista .csv o .xlsx.")],
) -> CorrespondencesOut:
    content = _read_upload(file, request.app.state.settings.import_max_bytes)
    batch = _reviewable_photo_batch(session, user, batch_id, "lista de correspondencias")
    results = upload_correspondences(session, batch, file.filename or "lista.csv", content)
    session.commit()
    counts = {key: sum(r.result == key for r in results) for key in CORRESPONDENCE_RESULTS}
    return CorrespondencesOut(
        batch_id=batch_id,
        **counts,
        lines=[
            CorrespondenceLineOut(
                line=r.line.number,
                file=r.line.file,
                code=r.line.code,
                result=r.result,  # type: ignore[arg-type]
                reason=r.reason,
                photo_ids=list(r.photo_ids),
            )
            for r in results
        ],
    )


CORRESPONDENCE_RESULTS = ("applied", "no_photo", "no_piece", "ambiguous")


@router.post(
    "/imports/{batch_id}/rollback",
    response_model=ImportBatchOut,
    responses={
        **NOT_FOUND,
        409: {
            "model": ErrorResponse,
            "description": "`invalid_batch_transition` (el lote no está aplicado), "
            "`already_reverted` o `revert_has_conflicts` (hay ediciones posteriores: repetir "
            "con `confirm_conflicts=true` tras revisar la lista).",
        },
    },
    summary="Revertir un lote aplicado (RNF-007)",
    description="Deshace la aplicación del lote como un nuevo conjunto de cambios auditado: las "
    "piezas e identificadores creados quedan eliminados lógicamente con el motivo, los campos "
    "actualizados recuperan su valor anterior y los datos de origen se conservan como "
    "historial. Nada se borra físicamente (RN-005). Solo el Administrador [SUPUESTO B7].",
    **implemented(),
)
def rollback_import_batch(
    batch_id: uuid.UUID, body: RevertRequest, session: SessionDep, user: Reverter
) -> ImportBatchOut:
    writer(session, user, reason=body.reason)
    result = rollback_batch(
        session,
        batch_id,
        require_audit_context(session),
        confirm_conflicts=body.confirm_conflicts,
        permissions=user.permissions,
    )
    session.commit()
    return batch_out(session, result.batch)


TEMPLATE_NOT_FOUND = {
    404: {"model": ErrorResponse, "description": "La plantilla no existe o fue eliminada."}
}


def template_out(template: ImportMappingTemplate) -> MappingTemplateOut:
    return MappingTemplateOut(
        id=template.id,
        name=template.name,
        source_name=template.source_name,
        header_signature=template.header_signature,
        columns=templates.column_mappings(template),
        defaults=templates.api_defaults(template),
        description=template.description,
        created_at=template.created_at,
    )


@router.get(
    "/import-templates",
    response_model=list[MappingTemplateOut],
    summary="Plantillas de mapeo reutilizables (RF-022)",
    description="Solo las plantillas activas. La sugerencia por cabeceras se pide con "
    "`POST /import-templates/suggest` (design D3).",
    **implemented(),
)
def list_import_templates(
    session: SessionDep,
    user: Preparer,
    source_name: Annotated[str | None, Query(description="Solo las de esta fuente.")] = None,
) -> list[MappingTemplateOut]:
    return [template_out(t) for t in templates.list_templates(session, source_name)]


@router.post(
    "/import-templates",
    response_model=MappingTemplateOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "Ya hay una plantilla activa con ese nombre."}
    },
    summary="Guardar una plantilla de mapeo",
    description="El mapeo se valida contra `headers`, de los que se calcula `header_signature` "
    "(design D3). Admite transformaciones, `value_map` y destinos `terms:<VOCABULARIO>`.",
    **implemented(),
)
def create_import_template(
    body: MappingTemplateCreate, session: SessionDep, user: Preparer
) -> MappingTemplateOut:
    template = templates.create_template(
        writer(session, user),
        name=body.name,
        source_name=body.source_name,
        headers=body.headers,
        columns=body.columns,
        description=body.description,
        defaults=body.defaults,
    )
    session.commit()
    return template_out(template)


@router.post(
    "/import-templates/suggest",
    response_model=list[TemplateSuggestion],
    summary="Sugerir plantillas para las cabeceras de un archivo (RF-022)",
    description="Hasta 3 plantillas activas [SUPUESTO T2] con puntaje ≥ 0,6 [SUPUESTO T1], de "
    "mayor a menor: 1 si las cabeceras coinciden (en cualquier orden, sin distinguir tildes ni "
    "mayúsculas); si no, `0,5 × Jaccard + 0,5 × similitud media por cabecera`, tomando como "
    "cabeceras de la plantilla las columnas de origen de su mapeo (design D3).",
    **implemented(),
)
def suggest_import_templates(
    body: TemplateSuggestRequest, session: SessionDep, user: Preparer
) -> list[TemplateSuggestion]:
    return [
        TemplateSuggestion(
            template=template_out(suggestion.template),
            score=suggestion.score,
            missing_columns=suggestion.missing_columns,
            new_columns=suggestion.new_columns,
        )
        for suggestion in templates.suggest_templates(session, body.headers)
    ]


@router.get(
    "/import-templates/{template_id}",
    response_model=MappingTemplateOut,
    responses=TEMPLATE_NOT_FOUND,
    summary="Detalle de una plantilla de mapeo",
    **implemented(),
)
def get_import_template(
    template_id: uuid.UUID, session: SessionDep, user: Preparer
) -> MappingTemplateOut:
    return template_out(templates.get_template(session, template_id))


@router.patch(
    "/import-templates/{template_id}",
    response_model=MappingTemplateOut,
    responses=TEMPLATE_NOT_FOUND,
    summary="Editar una plantilla de mapeo",
    description="`headers` y `columns` se envían juntos: el mapeo se vuelve a validar y la "
    "firma se recalcula. Los lotes ya procesados conservan su mapeo.",
    **implemented(),
)
def update_import_template(
    template_id: uuid.UUID, body: MappingTemplateUpdate, session: SessionDep, user: Preparer
) -> MappingTemplateOut:
    template = templates.update_template(
        writer(session, user),
        templates.get_template(session, template_id),
        name=body.name,
        source_name=body.source_name,
        headers=body.headers,
        columns=body.columns,
        description=body.description,
        description_set="description" in body.model_fields_set,
        defaults=body.defaults,
    )
    session.commit()
    return template_out(template)


@router.delete(
    "/import-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=TEMPLATE_NOT_FOUND,
    summary="Eliminar lógicamente una plantilla con motivo (RN-005)",
    description="La plantilla deja de listarse y sugerirse y pasa a la papelera; los lotes "
    "que la usaron conservan la referencia y el mapeo con que se procesaron.",
    **implemented(),
)
def delete_import_template(
    template_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: Approver,
) -> Response:
    template = templates.get_template(session, template_id)
    templates.delete_template(writer(session, user, reason), template, reason)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/import-templates/{template_id}/dry-run",
    response_model=TemplateDryRunOut,
    responses={
        404: {"model": ErrorResponse, "description": "La plantilla o el lote no existen."},
        409: {
            "model": ErrorResponse,
            "description": "El lote no está subido ni mapeado, o aún no se ha leído.",
        },
    },
    summary="Vista previa de normalización por columna de una plantilla (RF-023)",
    description="Aplica la plantilla guardada a las primeras 200 filas [SUPUESTO T3] de un lote "
    "subido o mapeado y cuenta, por columna, las celdas `NORMALIZED`, `UNPARSEABLE`, `ABSENT` "
    "y `SPLIT_PROPOSED`, con los 20 valores sin término más frecuentes [SUPUESTO T4] y "
    "ejemplos con su traza (design D4). No escribe nada: ni filas, ni lote, ni auditoría.",
    **implemented(),
)
def dry_run_import_template(
    template_id: uuid.UUID, body: TemplateDryRunRequest, session: SessionDep, user: Preparer
) -> TemplateDryRunOut:
    template = templates.get_template(session, template_id)
    result = run_dry_run(session, template, get_batch(session, body.batch_id))
    return dry_run_out(result, templates.column_mappings(template))
