"""Pieces, identifiers, media and movements of a piece (catalogo-piezas, identificacion-piezas,
multimedia, ubicacion-movimientos, calidad-datos)."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.enums import TENURE_REGIME_LABELS, TenureRegimeLabel, code_of
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import LimitPageParams, limit_page_params, paginate
from app.api.refs import LocationRef, TermRef, translate_view_term
from app.api.stubs import (
    CHANGE_INCOMPLETE,
    CHANGE_PIECE_CRUD,
    example_of,
    implemented,
    not_implemented,
    stub,
)
from app.core.errors import NotFound, PermissionDenied, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog import service as catalog_service
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.catalog.queries import (
    CatalogReader,
    PieceFilters,
    Viewer,
    build_piece_query,
    get_piece,
)
from app.modules.catalog.schemas import (
    MergedFrom,
    MergedInto,
    PieceChildLink,
    PieceCreate,
    PieceDetail,
    PieceSearchResponse,
    PieceSort,
    PieceSummary,
    PieceUpdate,
    PieceValidationResult,
    SourceRecordOut,
)
from app.modules.collections.models import Collection, Term
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.schemas import (
    IdentifierCreate,
    IdentifierOut,
    InventoryCodeCorrection,
)
from app.modules.identification.service import retire_identifier, set_inventory_code
from app.modules.locations.models import Location, MovementType, PieceMovement
from app.modules.locations.schemas import MovementCreate, MovementOut
from app.modules.locations.service import UNSET as LOCATION_UNSET
from app.modules.locations.service import (
    assert_availability_coherent,
    correct_movement,
    verify_location,
)
from app.modules.locations.service import move_piece as move_piece_service
from app.modules.media import derivatives
from app.modules.media.models import MediaAsset
from app.modules.media.schemas import (
    DownloadUrlRequest,
    DownloadUrlResponse,
    MediaAssetCreate,
    MediaAssetOut,
    MediaAssetUpdate,
    StorageEstimateRequest,
    StorageEstimateResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.modules.media.service import (
    EXTENSION_BY_FORMAT,
    comodato_restriction_term_id,
    verify_image_stream,
)
from app.modules.quality.schemas import PieceAlert
from app.modules.users.sensitive_log import delivered_piece_fields, record_sensitive_access

router = APIRouter(prefix="/pieces", responses=COMMON_ERROR_RESPONSES)

NOT_FOUND = {404: {"model": ErrorResponse, "description": "La pieza no existe o fue eliminada."}}

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
Creator = Annotated[CurrentUser, Depends(require_permission("pieces.create"))]
Editor = Annotated[CurrentUser, Depends(require_permission("pieces.update"))]
IdentifierManager = Annotated[CurrentUser, Depends(require_permission("identifiers.manage"))]


def piece_filters(
    q: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Cualquier código (vigente o histórico, con o sin puntos, espacios o "
            "ceros) o parte de la denominación (RF-031).",
        ),
    ] = None,
    collection_id: Annotated[uuid.UUID | None, Query(description="Incluye subcolecciones.")] = None,
    without_collection: Annotated[bool | None, Query(description="true = piezas sueltas.")] = None,
    tenure_regime: Annotated[
        TenureRegimeLabel | None,
        Query(description="Régimen de tenencia: Propiedad, Comodato o Préstamo Temporal."),
    ] = None,
    category_term_id: uuid.UUID | None = None,
    material_term_id: uuid.UUID | None = None,
    conservation_status_term_id: uuid.UUID | None = None,
    location_id: Annotated[uuid.UUID | None, Query(description="Incluye sub-ubicaciones.")] = None,
    has_inventory_code: Annotated[bool | None, Query(description="false = piezas sin I.")] = None,
    author: Annotated[str | None, Query(max_length=200)] = None,
    provenance: Annotated[str | None, Query(max_length=200)] = None,
    period_text: Annotated[str | None, Query(max_length=200)] = None,
    sort: PieceSort = "denomination",
) -> PieceFilters:
    regime = (
        code_of(TENURE_REGIME_LABELS, tenure_regime, "tenure_regime")
        if tenure_regime is not None
        else None
    )
    return PieceFilters(
        q=q,
        collection_id=collection_id,
        without_collection=without_collection,
        tenure_regime=regime,
        category_term_id=category_term_id,
        material_term_id=material_term_id,
        conservation_status_term_id=conservation_status_term_id,
        location_id=location_id,
        has_inventory_code=has_inventory_code,
        author=author,
        provenance=provenance,
        period_text=period_text,
        sort=sort,
    )


# ------------------------------------------------------------------------- pieces
@router.get(
    "",
    response_model=PieceSearchResponse,
    summary="Listar piezas con filtros combinados (AND) y paginación",
    tags=["Piezas"],
    **implemented(),
)
def list_pieces(
    session: SessionDep,
    user: Reader,
    filters: Annotated[PieceFilters, Depends(piece_filters)],
    params: Annotated[LimitPageParams, Depends(limit_page_params)],
) -> PieceSearchResponse:
    pieces, total = paginate(session, build_piece_query(session, filters), params)
    items = CatalogReader(session, Viewer(user.permissions)).summaries(pieces)
    return PieceSearchResponse(total=total, page=params.page, limit=params.limit, items=items)


@router.post(
    "",
    response_model=PieceSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una pieza",
    tags=["Piezas"],
    **implemented(),
)
def create_piece(body: PieceCreate, session: SessionDep, user: Creator) -> PieceSummary:
    tenure = code_of(TENURE_REGIME_LABELS, body.tenure_regime, "tenure_regime")
    piece = catalog_service.create_piece(
        writer(session, user),
        denomination=body.denomination,
        tenure_regime=tenure,
        description=body.description,
        collection_id=body.collection_id,
        lender_name=body.lender_name,
        loan_agreement_ref=body.loan_agreement_ref,
        temporary_inventory_number=body.temporary_inventory_number,
        acquisition_method_term_id=body.acquisition_method_term_id,
        entry_date=body.entry_date,
        author=body.author,
        provenance=body.provenance,
        epoch_original_text=body.period.text if body.period else None,
        epoch_type=body.period.type if body.period else None,
        epoch_start_year=body.period.year_from if body.period else None,
        epoch_end_year=body.period.year_to if body.period else None,
        object_type_term_id=body.object_type_term_id,
        category_id=body.category_id,
        dimensions_text=body.dimensions_text,
        dimensions=[item.model_dump() for item in body.dimensions] if body.dimensions else None,
        conservation_state_id=body.conservation_state_id,
        recorded_by=body.recorded_by,
        notes=body.notes,
        parent_piece_id=body.parent_piece_id,
        availability_term_id=body.availability_term_id,
        current_location_id=None,
    )
    set_inventory_code(session, piece, body.code_i)
    session.commit()
    return CatalogReader(session, Viewer(user.permissions)).summaries([piece])[0]


@router.post(
    "/validate",
    response_model=PieceValidationResult,
    summary="Validar en tiempo real un formulario de ficha (RF-043)",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def validate_piece(
    body: PieceCreate,
    user: Creator,
    piece_id: Annotated[uuid.UUID | None, Query(description="Pieza en edición.")] = None,
) -> PieceValidationResult:
    raise not_implemented(CHANGE_PIECE_CRUD, PieceValidationResult)


def _merged_from(session: Session, piece_id: uuid.UUID) -> list[MergedFrom]:
    """Pieces merged into ``piece_id``: their append-only history stays on them (D4)."""
    absorbed = session.scalars(
        select(Piece)
        .where(Piece.merged_into_id == piece_id, Piece.deleted_at.is_not(None))
        .order_by(Piece.deleted_at)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    return [
        MergedFrom(
            piece_id=piece.id,
            denomination=piece.denomination,
            merged_at=piece.deleted_at,
            reason=piece.deletion_reason,
        )
        for piece in absorbed
    ]


@router.get(
    "/{piece_id}",
    response_model=PieceDetail,
    responses=NOT_FOUND,
    summary="Ficha de una pieza (campos sensibles según rol)",
    tags=["Piezas"],
    **implemented(),
)
def get_piece_by_id(
    piece_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    session: SessionDep,
    user: Reader,
) -> PieceDetail:
    detail = _piece_detail(piece_id, session, user)
    fields = delivered_piece_fields(detail)
    if fields:  # RNF-014: log what was handed over unmasked, after the response (never values)
        background.add_task(
            record_sensitive_access,
            request.app.state.session_factory,
            user_id=user.id,
            route=request.url.path,
            entity_type="piece",
            entity_ids=[piece_id],
            fields=fields,
        )
    return detail


def _piece_detail(piece_id: uuid.UUID, session: Session, user: CurrentUser) -> PieceDetail:
    reader = CatalogReader(session, Viewer(user.permissions))
    merged_from = _merged_from(session, piece_id)
    try:
        piece = get_piece(session, piece_id)
    except NotFound:
        # A merged piece is logically deleted but still answers with a link to the surviving
        # one (calidad-datos, «Consulta de la pieza absorbida»); any other deleted piece is 404.
        merged = session.get(Piece, piece_id, execution_options={INCLUDE_DELETED: True})
        if merged is None or merged.merged_into_id is None:
            raise
        link = MergedInto(
            piece_id=merged.merged_into_id,
            merged_at=merged.deleted_at,
            reason=merged.deletion_reason,
        )
        detail = reader.detail(merged)
        return detail.model_copy(update={"merged_into": link, "merged_from": merged_from})
    return reader.detail(piece).model_copy(update={"merged_from": merged_from})


@router.put(
    "/{piece_id}",
    response_model=PieceDetail,
    responses=NOT_FOUND,
    summary="Editar la ficha (auditoría campo a campo)",
    tags=["Piezas"],
    **implemented(),
)
def update_piece(
    piece_id: uuid.UUID, body: PieceUpdate, session: SessionDep, user: Editor
) -> PieceDetail:
    piece = get_piece(session, piece_id)
    writer(session, user)
    changes = body.model_dump(exclude_unset=True, exclude={"code_i", "material_term_ids"})
    if "period" in changes:
        period = changes.pop("period") or {}
        changes["epoch_original_text"] = period.get("text")
        changes["epoch_type"] = period.get("type")
        changes["epoch_start_year"] = period.get("year_from")
        changes["epoch_end_year"] = period.get("year_to")
    if "availability_term_id" in changes and changes["availability_term_id"] is not None:
        assert_availability_coherent(session, piece, changes["availability_term_id"])
    if changes:
        catalog_service.update_piece(session, piece, **changes)
    if "code_i" in body.model_fields_set:
        set_inventory_code(session, piece, body.code_i)
    session.commit()
    return CatalogReader(session, Viewer(user.permissions)).detail(piece)


@router.delete(
    "/{piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=NOT_FOUND,
    summary="Eliminar lógicamente una pieza con motivo (RN-005)",
    tags=["Piezas"],
    **implemented(),
)
def soft_delete_piece(
    piece_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("pieces.delete"))],
) -> None:
    piece = get_piece(session, piece_id)
    soft_delete(writer(session, user, reason), piece, reason)
    session.commit()


@router.post(
    "/{piece_id}/restore",
    response_model=PieceDetail,
    summary="Restaurar una pieza eliminada (Administrador)",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def restore_piece(
    piece_id: uuid.UUID,
    user: Annotated[CurrentUser, Depends(require_permission("pieces.restore"))],
    reason: Annotated[str | None, Query()] = None,
) -> PieceDetail:
    raise not_implemented(CHANGE_PIECE_CRUD, PieceDetail)


@router.get(
    "/{piece_id}/source-records",
    response_model=list[SourceRecordOut],
    responses=NOT_FOUND,
    summary="Datos de origen sin mapeo (payload, solo lectura)",
    tags=["Piezas"],
    **implemented(),
)
def list_source_records(
    piece_id: uuid.UUID, session: SessionDep, user: Reader
) -> list[SourceRecordOut]:
    get_piece(session, piece_id)
    rows = session.scalars(
        select(PieceSourceRecord)
        .where(PieceSourceRecord.piece_id == piece_id)
        .order_by(PieceSourceRecord.recorded_at)
    )
    return [SourceRecordOut.model_validate(row) for row in rows]


@router.get(
    "/{piece_id}/alerts",
    response_model=list[PieceAlert],
    summary="Alertas de información incompleta de la pieza (RF-019)",
    tags=["Calidad"],
    **stub(CHANGE_INCOMPLETE),
)
def list_piece_alerts(piece_id: uuid.UUID, user: Reader) -> list[PieceAlert]:
    raise not_implemented(CHANGE_INCOMPLETE, [example_of(PieceAlert)])


# -------------------------------------------------------------------- identifiers
@router.get(
    "/{piece_id}/identifiers",
    response_model=list[IdentifierOut],
    responses=NOT_FOUND,
    summary="Identificadores de la pieza (vigentes y, opcionalmente, históricos y dados de baja)",
    tags=["Identificadores"],
    **implemented(),
)
def list_piece_identifiers(
    piece_id: uuid.UUID,
    session: SessionDep,
    user: Reader,
    include_history: Annotated[
        bool, Query(description="Incluye códigos no vigentes y los dados de baja (RN-005).")
    ] = False,
) -> list[IdentifierOut]:
    get_piece(session, piece_id)
    statement = select(PieceIdentifier).where(PieceIdentifier.piece_id == piece_id)
    if include_history:
        statement = statement.execution_options(**{INCLUDE_DELETED: True})
    else:
        statement = statement.where(PieceIdentifier.is_current.is_(True))
    rows = session.scalars(
        statement.order_by(PieceIdentifier.identifier_type_code, PieceIdentifier.recorded_at)
    )
    return [IdentifierOut.model_validate(row) for row in rows]


@router.post(
    "/{piece_id}/identifiers",
    response_model=IdentifierOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un identificador externo (I bloqueado; comodato sin I)",
    tags=["Identificadores"],
    **stub(CHANGE_PIECE_CRUD),
)
def add_piece_identifier(
    piece_id: uuid.UUID,
    body: IdentifierCreate,
    user: Annotated[CurrentUser, Depends(require_permission("identifiers.manage"))],
) -> IdentifierOut:
    raise not_implemented(CHANGE_PIECE_CRUD, IdentifierOut)


@router.delete(
    "/{piece_id}/identifiers/{identifier_id}",
    response_model=IdentifierOut,
    status_code=status.HTTP_200_OK,
    responses={
        **NOT_FOUND,
        409: {"model": ErrorResponse, "description": "El código I no se elimina (RN-002)."},
    },
    summary="Dar de baja un código histórico mal asignado (baja lógica, RN-005)",
    tags=["Identificadores"],
    **implemented(),
)
def delete_piece_identifier(
    piece_id: uuid.UUID,
    identifier_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio (RN-005).")],
    session: SessionDep,
    user: IdentifierManager,
) -> IdentifierOut:
    """El identificador queda en el historial y en la auditoría; el de tipo I responde 409."""
    piece = get_piece(session, piece_id)
    identifier = session.scalar(
        select(PieceIdentifier).where(
            PieceIdentifier.id == identifier_id, PieceIdentifier.piece_id == piece_id
        )
    )
    if identifier is None:
        raise NotFound("El identificador no existe en esta pieza o ya fue dado de baja.")
    retire_identifier(writer(session, user, reason), piece, identifier, reason)
    session.commit()
    return IdentifierOut.model_validate(identifier)


@router.post(
    "/{piece_id}/identifiers/{identifier_id}/correction",
    response_model=IdentifierOut,
    summary="Corregir un código I con procedimiento auditado (Administrador, RN-002)",
    tags=["Identificadores"],
    **stub(CHANGE_PIECE_CRUD),
)
def correct_inventory_code(
    piece_id: uuid.UUID,
    identifier_id: uuid.UUID,
    body: InventoryCodeCorrection,
    user: Annotated[CurrentUser, Depends(require_permission("identifiers.correct_inventory_code"))],
) -> IdentifierOut:
    raise not_implemented(CHANGE_PIECE_CRUD, IdentifierOut)


# -------------------------------------------------------------------------- media
@router.get(
    "/{piece_id}/media",
    response_model=list[MediaAssetOut],
    responses=NOT_FOUND,
    summary="Fotografías de la pieza ordenadas (metadatos)",
    tags=["Multimedia"],
    **implemented(),
)
def list_piece_media(piece_id: uuid.UUID, session: SessionDep, user: Reader) -> list[MediaAssetOut]:
    get_piece(session, piece_id)
    assets = list(
        session.scalars(
            select(MediaAsset)
            .where(MediaAsset.piece_id == piece_id)
            .order_by(MediaAsset.sort_order, MediaAsset.created_at)
        )
    )
    reader = CatalogReader(session, Viewer(user.permissions))
    terms = reader.terms(
        term_id
        for asset in assets
        for term_id in (asset.view_type_term_id, asset.usage_restriction_term_id)
    )
    return [
        MediaAssetOut(
            id=asset.id,
            piece_id=asset.piece_id,
            original_filename=asset.original_filename,
            content_type=asset.content_type,
            size_bytes=asset.size_bytes,
            content_sha256=asset.content_sha256,
            width_px=asset.width_px,
            height_px=asset.height_px,
            view_type=translate_view_term(TermRef.model_validate(terms[asset.view_type_term_id]))
            if asset.view_type_term_id in terms
            else None,
            sort_order=asset.sort_order,
            is_primary=asset.is_primary,
            photographer=asset.photographer,
            taken_on=asset.taken_on,
            usage_restriction=TermRef.model_validate(terms[asset.usage_restriction_term_id])
            if asset.usage_restriction_term_id in terms
            else None,
            restriction_note=asset.restriction_note,
            download_url=None,
            created_at=asset.created_at,
        )
        for asset in assets
    ]


@router.post(
    "/{piece_id}/media/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Obtener URL prefirmada para subir una foto al almacenamiento",
    tags=["Multimedia"],
    **implemented(),
)
def create_media_upload_url(
    request: Request,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
    piece_id: uuid.UUID,
    body: UploadUrlRequest,
) -> UploadUrlResponse:
    # 1. Pieza existe
    get_piece(session, piece_id)

    # 2. Valida content_type declarado
    allowed = request.app.state.settings.media_allowed_types_set
    if body.content_type not in allowed:
        raise ValidationFailed(
            f'Tipo "{body.content_type}" no admitido. Admitidos: {", ".join(sorted(allowed))}.',
            code="unsupported_media_type",
            details={"field": "content_type", "allowed": sorted(allowed)},
        )

    # 3. Valida tamaño
    if body.size_bytes > request.app.state.settings.media_max_bytes:
        raise ValidationFailed(
            f"Archivo excede {request.app.state.settings.media_max_bytes} bytes.",
            code="file_too_large",
            details={"field": "size_bytes", "max": request.app.state.settings.media_max_bytes},
        )

    # 4. Duplicate check (si envía sha256)
    warning = None
    if body.content_sha256:
        exists = session.scalar(
            select(MediaAsset.id).where(
                MediaAsset.piece_id == piece_id,
                MediaAsset.content_sha256 == body.content_sha256,
                MediaAsset.deleted_at.is_(None),
            )
        )
        if exists:
            warning = "duplicate_content"

    # 5. Genera storage_key en pending/ + URL prefirmada
    asset_id = new_uuid()
    ext = body.content_type.split("/")[-1]  # "jpeg" | "png" | "tiff"
    storage_key = f"pieces/{piece_id}/pending/{asset_id}.{ext}"
    ttl = request.app.state.settings.media_upload_url_ttl_seconds
    presigned = request.app.state.storage.presign_put(storage_key, body.content_type, ttl)

    # 6. Respuesta
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl)
    resp_data = UploadUrlResponse(
        storage_key=storage_key,
        upload_url=presigned["url"],
        method=presigned["method"],
        headers=presigned["headers"],
        expires_at=expires_at,
    )
    response_headers = {"Content-Type": "application/json"}
    if warning:
        response_headers["X-Warning"] = warning
    return JSONResponse(
        content=resp_data.model_dump(mode="json"),
        headers=response_headers,
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/{piece_id}/media",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una foto ya subida (tipo de vista, orden, restricciones)",
    tags=["Multimedia"],
    **implemented(),
)
def register_media(
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
    piece_id: uuid.UUID,
    body: MediaAssetCreate,
) -> MediaAssetOut:
    # 1. Pieza existe
    get_piece(session, piece_id)

    # 2. HEAD object en storage (existe, tamaño, content-type)
    try:
        head = request.app.state.storage.head(body.storage_key)
    except FileNotFoundError as err:
        raise ValidationFailed(
            "El archivo no existe en el almacenamiento.", code="object_not_found"
        ) from err

    # 3. Stream + Pillow verify + SHA-256 recalc
    sha256, width, height, content_type = verify_image_stream(
        request.app.state.storage,
        body.storage_key,
        body.content_sha256,
    )

    # 4. Copia pending/ -> pieces/{id}/{media_id}/original.<ext>
    asset_id = new_uuid()
    ext = EXTENSION_BY_FORMAT.get(content_type.split("/")[-1], "jpg")
    final_key = f"pieces/{piece_id}/{asset_id}/original.{ext}"
    request.app.state.storage.copy(body.storage_key, final_key)
    request.app.state.storage.delete_pending(body.storage_key)

    # 5. Determina is_primary, sort_order
    max_order = session.scalar(
        select(func.max(MediaAsset.sort_order)).where(MediaAsset.piece_id == piece_id)
    )
    is_primary = max_order is None
    sort_order = (max_order + 1) if max_order is not None else 0

    # 6. Restricción comodato (hereda de colección si LOAN_FOR_USE)
    piece = session.get(Piece, piece_id)
    restriction_term_id: uuid.UUID | None = None
    restriction_note: str | None = None
    if piece.tenure_regime == TenureRegime.LOAN_FOR_USE:
        restriction_term_id = comodato_restriction_term_id(session)
        restriction_note = "Restricción contractual del comodato (RN-008)"

    # 7. Crea MediaAsset con auditoría MANUAL
    asset = MediaAsset(
        id=asset_id,
        piece_id=piece_id,
        storage_key=final_key,
        original_filename=body.original_filename,
        content_type=content_type,
        size_bytes=head["content_length"],
        content_sha256=sha256,
        width_px=width,
        height_px=height,
        view_type_term_id=body.view_type_term_id,
        sort_order=sort_order,
        is_primary=is_primary,
        usage_restriction_term_id=restriction_term_id,
        restriction_note=restriction_note,
    )
    session.add(asset)
    writer(session, user)
    session.commit()

    # 8. Derivados en BackgroundTask (thumb.webp 320px, display.webp 1600px)
    def _generate_derivatives() -> None:
        try:
            derivatives.generate_derivatives(
                request.app.state.storage, str(piece_id), str(asset_id), final_key
            )
        except (OSError, ValueError, RuntimeError):
            # Si falla, la foto queda registrada con extra_metadata.derivatives="failed"
            asset.extra_metadata = {"derivatives": "failed"}
            session.add(asset)
            session.commit()

    background_tasks.add_task(_generate_derivatives)

    # 9. Respuesta MediaAssetOut (mapeo igual que list_piece_media)
    terms = {
        term.id: term
        for term in session.scalars(
            select(Term).where(
                Term.id.in_(
                    [
                        term_id
                        for term_id in (body.view_type_term_id, restriction_term_id)
                        if term_id
                    ]
                )
            )
        )
    }
    view_term = terms.get(body.view_type_term_id)
    restriction_term = terms.get(restriction_term_id) if restriction_term_id else None
    return MediaAssetOut(
        id=asset.id,
        piece_id=asset.piece_id,
        original_filename=asset.original_filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        content_sha256=asset.content_sha256,
        width_px=asset.width_px,
        height_px=asset.height_px,
        view_type=translate_view_term(TermRef.model_validate(view_term)) if view_term else None,
        sort_order=asset.sort_order,
        is_primary=asset.is_primary,
        photographer=asset.photographer,
        taken_on=asset.taken_on,
        usage_restriction=TermRef.model_validate(restriction_term) if restriction_term else None,
        restriction_note=asset.restriction_note,
        download_url=None,
        created_at=asset.created_at,
    )


@router.patch(
    "/{piece_id}/media/{media_id}",
    response_model=MediaAssetOut,
    summary="Editar metadatos, orden o restricción de una foto",
    tags=["Multimedia"],
    **implemented(),
)
def update_media(
    piece_id: uuid.UUID,
    media_id: uuid.UUID,
    body: MediaAssetUpdate,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
) -> MediaAssetOut:
    get_piece(session, piece_id)
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.piece_id != piece_id or asset.deleted_at is not None:
        raise NotFound("La foto no existe en esta pieza.")

    # Si se marca como principal, desmarcar la anterior
    if body.is_primary is True:
        current_primary = session.scalar(
            select(MediaAsset).where(
                MediaAsset.piece_id == piece_id,
                MediaAsset.is_primary.is_(True),
                MediaAsset.id != media_id,
                MediaAsset.deleted_at.is_(None),
            )
        )
        if current_primary:
            current_primary.is_primary = False

    # Actualizar campos proporcionados
    if body.view_type_term_id is not None:
        asset.view_type_term_id = body.view_type_term_id
    if body.sort_order is not None:
        asset.sort_order = body.sort_order
    if body.is_primary is not None:
        asset.is_primary = body.is_primary
    if body.usage_restriction_term_id is not None:
        asset.usage_restriction_term_id = body.usage_restriction_term_id
    if body.restriction_note is not None:
        asset.restriction_note = body.restriction_note

    writer(session, user)
    session.commit()

    # Respuesta
    terms = {
        term.id: term
        for term in session.scalars(
            select(Term).where(
                Term.id.in_(
                    [
                        term_id
                        for term_id in (asset.view_type_term_id, asset.usage_restriction_term_id)
                        if term_id
                    ]
                )
            )
        )
    }
    view_term = terms.get(asset.view_type_term_id)
    restriction_term = (
        terms.get(asset.usage_restriction_term_id) if asset.usage_restriction_term_id else None
    )
    return MediaAssetOut(
        id=asset.id,
        piece_id=asset.piece_id,
        original_filename=asset.original_filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        content_sha256=asset.content_sha256,
        width_px=asset.width_px,
        height_px=asset.height_px,
        view_type=translate_view_term(TermRef.model_validate(view_term)) if view_term else None,
        sort_order=asset.sort_order,
        is_primary=asset.is_primary,
        photographer=asset.photographer,
        taken_on=asset.taken_on,
        usage_restriction=TermRef.model_validate(restriction_term) if restriction_term else None,
        restriction_note=asset.restriction_note,
        download_url=None,
        created_at=asset.created_at,
    )


@router.put(
    "/{piece_id}/media/order",
    response_model=list[MediaAssetOut],
    summary="Reordenar fotos de una pieza (lista completa de IDs)",
    tags=["Multimedia"],
    **implemented(),
)
def reorder_media(
    piece_id: uuid.UUID,
    body: list[uuid.UUID],
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
) -> list[MediaAssetOut]:
    get_piece(session, piece_id)
    # Obtener todas las fotos activas de la pieza
    assets = list(
        session.scalars(
            select(MediaAsset)
            .where(MediaAsset.piece_id == piece_id, MediaAsset.deleted_at.is_(None))
            .order_by(MediaAsset.sort_order, MediaAsset.created_at)
        )
    )
    asset_ids = [a.id for a in assets]
    # Validar que la lista enviada contenga exactamente los mismos IDs
    if set(body) != set(asset_ids):
        raise ValidationFailed(
            "La lista debe contener exactamente todos los IDs de fotos de la pieza.",
            code="invalid_reorder_list",
            details={"expected": [str(a) for a in asset_ids], "received": [str(a) for a in body]},
        )
    # Reordenar
    for idx, media_id in enumerate(body):
        asset = next(a for a in assets if a.id == media_id)
        asset.sort_order = idx
    writer(session, user)
    session.commit()
    # Respuesta ordenada
    terms = {
        term.id: term
        for term in session.scalars(
            select(Term).where(
                Term.id.in_(
                    [
                        term_id
                        for a in assets
                        for term_id in (a.view_type_term_id, a.usage_restriction_term_id)
                        if term_id
                    ]
                )
            )
        )
    }
    return [
        MediaAssetOut(
            id=a.id,
            piece_id=a.piece_id,
            original_filename=a.original_filename,
            content_type=a.content_type,
            size_bytes=a.size_bytes,
            content_sha256=a.content_sha256,
            width_px=a.width_px,
            height_px=a.height_px,
            view_type=translate_view_term(TermRef.model_validate(terms[a.view_type_term_id]))
            if a.view_type_term_id and a.view_type_term_id in terms
            else None,
            sort_order=a.sort_order,
            is_primary=a.is_primary,
            photographer=a.photographer,
            taken_on=a.taken_on,
            usage_restriction=TermRef.model_validate(terms[a.usage_restriction_term_id])
            if a.usage_restriction_term_id and a.usage_restriction_term_id in terms
            else None,
            restriction_note=a.restriction_note,
            download_url=None,
            created_at=a.created_at,
        )
        for a in sorted(assets, key=lambda x: x.sort_order)
    ]


@router.get(
    "/{piece_id}/media/{media_id}/download-url",
    response_model=DownloadUrlResponse,
    summary="Obtener URL prefirmada para descargar una foto",
    tags=["Multimedia"],
    **implemented(),
)
def get_media_download_url(
    request: Request,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("pieces.read"))],
    piece_id: uuid.UUID,
    media_id: uuid.UUID,
    body: DownloadUrlRequest,
) -> DownloadUrlResponse:
    piece = get_piece(session, piece_id)
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.piece_id != piece_id or asset.deleted_at is not None:
        raise NotFound("La foto no existe en esta pieza.")

    # Calcular restricción efectiva: foto > pieza > colección (comodato)
    effective_restriction_term_id: uuid.UUID | None = None
    restriction_origin: Literal["foto", "pieza", "colección", "ninguna"] = "ninguna"

    if asset.usage_restriction_term_id is not None:
        effective_restriction_term_id = asset.usage_restriction_term_id
        restriction_origin = "foto"
    elif piece.usage_restriction_term_id is not None:
        effective_restriction_term_id = piece.usage_restriction_term_id
        restriction_origin = "pieza"
    elif piece.collection_id is not None:
        collection = session.get(Collection, piece.collection_id)
        if collection and collection.default_usage_restriction_term_id is not None:
            effective_restriction_term_id = collection.default_usage_restriction_term_id
            restriction_origin = "colección"

    # Validar propósito y restricción
    if body.purpose == "external" and effective_restriction_term_id is not None:
        term = session.get(Term, effective_restriction_term_id)
        if term and term.extra and term.extra.get("blocks_external_download") is True:
            raise ValidationFailed(
                "Descarga externa bloqueada por restricción "
                f"'{term.label}' (origen: {restriction_origin}).",
                code="usage_restricted",
                details={"restriction": term.code, "origin": restriction_origin},
            )

    # Generar URL prefirmada
    ttl = request.app.state.settings.media_url_ttl_seconds
    presigned = request.app.state.storage.presign_get(asset.storage_key, ttl)

    # Respuesta
    terms = {
        term.id: term
        for term in session.scalars(select(Term).where(Term.id == effective_restriction_term_id))
    }
    effective_restriction = (
        TermRef.model_validate(terms[effective_restriction_term_id])
        if effective_restriction_term_id and effective_restriction_term_id in terms
        else None
    )

    return DownloadUrlResponse(
        download_url=presigned["url"],
        expires_at=datetime.now(UTC) + timedelta(seconds=ttl),
        effective_restriction=effective_restriction,
        restriction_origin=restriction_origin,
    )


@router.get(
    "/media/storage-estimate",
    response_model=StorageEstimateResponse,
    summary="Estimación del volumen fotográfico",
    tags=["Multimedia"],
    **implemented(),
)
def get_media_storage_estimate(
    request: Request,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("reports.view"))],
    query: Annotated[StorageEstimateRequest, Depends()],
) -> StorageEstimateResponse:
    # Current volume from database
    from app.modules.media.models import MediaAsset

    originals_stats = session.execute(
        select(
            func.coalesce(func.sum(MediaAsset.size_bytes), 0),
            func.count(MediaAsset.id),
        ).where(MediaAsset.deleted_at.is_(None))
    ).first()
    total_originals_bytes, photo_count = originals_stats or (0, 0)

    # Estimate derivatives: thumb (~20KB) + display (~300KB) per photo
    estimated_derivatives_per_photo = 320 * 1024  # ~320KB (thumb 20KB + display 300KB)
    estimated_derivatives_bytes = photo_count * estimated_derivatives_per_photo

    current_volume_bytes = total_originals_bytes + estimated_derivatives_bytes
    current_originals_bytes = total_originals_bytes
    current_derivatives_bytes = estimated_derivatives_bytes

    avg_photos_per_piece = (
        photo_count / session.scalar(select(func.count()).where(MediaAsset.deleted_at.is_(None)))
        if photo_count > 0
        else None
    )
    avg_mb_per_photo = (
        (total_originals_bytes / photo_count / 1024 / 1024) if photo_count > 0 else None
    )

    # Build projection if parameters provided
    projection = None
    has_projection_params = (
        query.pieces is not None
        or query.photos_per_piece is not None
        or query.mb_per_photo is not None
    )
    if has_projection_params:
        pieces = query.pieces or 0
        photos_per_piece = query.photos_per_piece or (avg_photos_per_piece or 0)
        mb_per_photo = query.mb_per_photo or (avg_mb_per_photo or 0)

        if pieces < 0 or photos_per_piece < 0 or mb_per_photo < 0:
            raise ValidationFailed(
                "Los parámetros no pueden ser negativos.",
                code="invalid_storage_estimate_params",
            )

        projected_originals = pieces * photos_per_piece * mb_per_photo * 1024 * 1024
        projected_derivatives = pieces * photos_per_piece * 320 * 1024  # 320KB per photo

        projection = {
            "pieces": pieces,
            "photos_per_piece": photos_per_piece,
            "mb_per_photo": mb_per_photo,
            "projected_originals_bytes": int(projected_originals),
            "projected_derivatives_bytes": int(projected_derivatives),
            "projected_total_bytes": int(projected_originals + projected_derivatives),
        }

    return StorageEstimateResponse(
        current_volume_bytes=current_volume_bytes,
        current_originals_bytes=current_originals_bytes,
        current_derivatives_bytes=current_derivatives_bytes,
        avg_photos_per_piece=avg_photos_per_piece,
        avg_mb_per_photo=avg_mb_per_photo,
        projection=projection,
    )


@router.delete(
    "/{piece_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirar una foto (eliminación lógica con motivo)",
    tags=["Multimedia"],
    **implemented(),
)
def retire_media(
    piece_id: uuid.UUID,
    media_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("media.retire"))],
) -> None:
    get_piece(session, piece_id)
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.piece_id != piece_id or asset.deleted_at is not None:
        raise NotFound("La foto no existe en esta pieza.")

    was_primary = asset.is_primary
    asset.deleted_at = datetime.now(UTC)
    asset.deletion_reason = reason
    asset.deleted_by_id = user.id
    asset.is_primary = False

    # Si era la principal, la siguiente en orden pasa a ser principal
    if was_primary:
        next_asset = session.scalar(
            select(MediaAsset)
            .where(
                MediaAsset.piece_id == piece_id,
                MediaAsset.deleted_at.is_(None),
                MediaAsset.id != media_id,
            )
            .order_by(MediaAsset.sort_order, MediaAsset.created_at)
        )
        if next_asset:
            next_asset.is_primary = True

    writer(session, user)
    session.commit()


# ---------------------------------------------------------------------- conjuntos
@router.get(
    "/{piece_id}/children",
    response_model=list[PieceSummary],
    responses=NOT_FOUND,
    summary="Listar las piezas componentes de un conjunto (RF-009)",
    tags=["Piezas"],
    **implemented(),
)
def get_piece_children(
    piece_id: uuid.UUID, session: SessionDep, user: Reader
) -> list[PieceSummary]:
    get_piece(session, piece_id)
    reader = CatalogReader(session, Viewer(user.permissions))
    return reader.children_of(piece_id)


@router.post(
    "/{piece_id}/children",
    response_model=PieceSummary,
    summary="Asociar una pieza existente como componente de un conjunto (RF-009)",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def add_piece_child(piece_id: uuid.UUID, body: PieceChildLink, user: Editor) -> PieceSummary:
    raise not_implemented(CHANGE_PIECE_CRUD, PieceSummary)


# ---------------------------------------------------------------------- movements
def _movement_out(reader: CatalogReader, movement: PieceMovement) -> MovementOut:
    def visible_ref(location_id: uuid.UUID | None) -> LocationRef | None:
        path, _exact = reader.visible_path(location_id)
        return LocationRef.model_validate(path[-1]) if path else None

    return MovementOut(
        id=movement.id,
        piece_id=movement.piece_id,
        movement_type=movement.movement_type,
        from_location=visible_ref(movement.from_location_id),
        to_location=visible_ref(movement.to_location_id),
        reason=movement.reason,
        corrects_movement_id=movement.corrects_movement_id,
        performed_by_label=movement.performed_by_label,
        occurred_at=movement.occurred_at,
    )


@router.get(
    "/{piece_id}/location-history",
    response_model=list[MovementOut],
    responses=NOT_FOUND,
    summary="Historial de movimientos y verificaciones (más reciente primero)",
    tags=["Ubicaciones"],
    **implemented(),
)
def get_piece_location_history(
    piece_id: uuid.UUID, session: SessionDep, user: Reader
) -> list[MovementOut]:
    get_piece(session, piece_id)
    reader = CatalogReader(session, Viewer(user.permissions))
    movements = session.scalars(
        select(PieceMovement)
        .where(PieceMovement.piece_id == piece_id)
        .order_by(PieceMovement.occurred_at.desc())
    )
    return [_movement_out(reader, movement) for movement in movements]


@router.post(
    "/{piece_id}/move",
    response_model=MovementOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un movimiento, verificación física o corrección",
    tags=["Ubicaciones"],
    **implemented(),
)
def move_piece(
    piece_id: uuid.UUID,
    body: MovementCreate,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("movements.register"))],
) -> MovementOut:
    piece = get_piece(session, piece_id)
    writer(session, user, body.reason)
    target_loc_id = body.to_location_id or body.destination_location_id
    expected_from = (
        body.expected_from_location_id
        if "expected_from_location_id" in body.model_fields_set
        else LOCATION_UNSET
    )
    if body.movement_type == MovementType.MOVE:
        if target_loc_id is None:
            raise ValidationFailed(
                "to_location_id o destination_location_id es obligatorio para un traslado.",
                code="destination_required",
            )
        destination = session.get(Location, target_loc_id)
        if destination is None or destination.deleted_at is not None:
            raise NotFound("La ubicación de destino no existe o fue eliminada.")
        movement = move_piece_service(
            session,
            piece,
            destination,
            body.reason,
            performed_by_label=user.full_name,
            expected_from_location_id=expected_from,
        )
    elif body.movement_type == MovementType.VERIFICATION:
        movement = verify_location(
            session,
            piece,
            expected_location_id=target_loc_id if target_loc_id is not None else LOCATION_UNSET,
        )
    elif body.movement_type == MovementType.CORRECTION:
        if not user.can("locations.manage"):
            raise PermissionDenied(
                "Solo un Administrador puede registrar un movimiento correctivo.",
                details={"permission": "locations.manage"},
            )
        if target_loc_id is None or body.corrects_movement_id is None:
            raise ValidationFailed(
                "to_location_id y corrects_movement_id son obligatorios para una corrección.",
                code="correction_requires_reference",
            )
        destination = session.get(Location, target_loc_id)
        if destination is None or destination.deleted_at is not None:
            raise NotFound("La ubicación de destino no existe o fue eliminada.")
        movement = correct_movement(
            session,
            piece,
            destination,
            corrects_movement_id=body.corrects_movement_id,
            reason=body.reason,
            performed_by_label=user.full_name,
        )
    else:
        raise ValidationFailed(
            f"Tipo de movimiento no admitido: {body.movement_type}.",
            code="invalid_movement_type",
        )
    session.commit()
    reader = CatalogReader(session, Viewer(user.permissions))
    return _movement_out(reader, movement)
