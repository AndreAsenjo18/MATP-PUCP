"""Pieces, identifiers, media and movements of a piece (catalogo-piezas, identificacion-piezas,
multimedia, ubicacion-movimientos, calidad-datos)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import Page, PageParams, page_params, paginate
from app.api.refs import LocationRef, TermRef
from app.api.stubs import (
    CHANGE_INCOMPLETE,
    CHANGE_LOCATIONS,
    CHANGE_MEDIA,
    CHANGE_PIECE_CRUD,
    example_of,
    implemented,
    not_implemented,
    stub,
)
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import PieceSourceRecord
from app.modules.catalog.queries import (
    CatalogReader,
    PieceFilters,
    Viewer,
    build_piece_query,
    get_piece,
)
from app.modules.catalog.schemas import (
    PieceChildLink,
    PieceCreate,
    PieceDetail,
    PieceSort,
    PieceSummary,
    PieceUpdate,
    PieceValidationResult,
    SourceRecordOut,
)
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.schemas import (
    IdentifierCreate,
    IdentifierOut,
    InventoryCodeCorrection,
)
from app.modules.locations.models import PieceMovement
from app.modules.locations.schemas import MovementCreate, MovementOut
from app.modules.media.models import MediaAsset
from app.modules.media.schemas import (
    MediaAssetCreate,
    MediaAssetOut,
    MediaAssetUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.modules.quality.schemas import PieceAlert

router = APIRouter(prefix="/pieces", responses=COMMON_ERROR_RESPONSES)

NOT_FOUND = {404: {"model": ErrorResponse, "description": "La pieza no existe o fue eliminada."}}

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
Creator = Annotated[CurrentUser, Depends(require_permission("pieces.create"))]
Editor = Annotated[CurrentUser, Depends(require_permission("pieces.update"))]


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
    tenure_regime: TenureRegime | None = None,
    category_term_id: uuid.UUID | None = None,
    material_term_id: uuid.UUID | None = None,
    conservation_status_term_id: uuid.UUID | None = None,
    location_id: Annotated[uuid.UUID | None, Query(description="Incluye sub-ubicaciones.")] = None,
    has_inventory_code: Annotated[bool | None, Query(description="false = piezas sin I.")] = None,
    author: Annotated[str | None, Query(max_length=200)] = None,
    provenance: Annotated[str | None, Query(max_length=200)] = None,
    period_text: Annotated[str | None, Query(max_length=200)] = None,
    sort: PieceSort = "title",
) -> PieceFilters:
    return PieceFilters(
        q=q,
        collection_id=collection_id,
        without_collection=without_collection,
        tenure_regime=tenure_regime,
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
    response_model=Page[PieceSummary],
    summary="Listar piezas con filtros combinados (AND) y paginación",
    tags=["Piezas"],
    **implemented(),
)
def list_pieces(
    session: SessionDep,
    user: Reader,
    filters: Annotated[PieceFilters, Depends(piece_filters)],
    params: Annotated[PageParams, Depends(page_params)],
) -> Page[PieceSummary]:
    pieces, total = paginate(session, build_piece_query(session, filters), params)
    items = CatalogReader(session, Viewer(user.permissions)).summaries(pieces)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post(
    "",
    response_model=PieceDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una pieza",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def create_piece(body: PieceCreate, user: Creator) -> PieceDetail:
    raise not_implemented(CHANGE_PIECE_CRUD, PieceDetail)


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


@router.get(
    "/{piece_id}",
    response_model=PieceDetail,
    responses=NOT_FOUND,
    summary="Ficha de una pieza (campos sensibles según rol)",
    tags=["Piezas"],
    **implemented(),
)
def get_piece_by_id(piece_id: uuid.UUID, session: SessionDep, user: Reader) -> PieceDetail:
    piece = get_piece(session, piece_id)
    return CatalogReader(session, Viewer(user.permissions)).detail(piece)


@router.put(
    "/{piece_id}",
    response_model=PieceDetail,
    summary="Editar la ficha (auditoría campo a campo)",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def update_piece(piece_id: uuid.UUID, body: PieceUpdate, user: Editor) -> PieceDetail:
    raise not_implemented(CHANGE_PIECE_CRUD, PieceDetail)


@router.delete(
    "/{piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar lógicamente una pieza con motivo (RN-005)",
    tags=["Piezas"],
    **stub(CHANGE_PIECE_CRUD),
)
def soft_delete_piece(
    piece_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    user: Annotated[CurrentUser, Depends(require_permission("pieces.delete"))],
) -> None:
    raise not_implemented(CHANGE_PIECE_CRUD)


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
    summary="Identificadores de la pieza (vigentes y, opcionalmente, históricos)",
    tags=["Identificadores"],
    **implemented(),
)
def list_piece_identifiers(
    piece_id: uuid.UUID,
    session: SessionDep,
    user: Reader,
    include_history: Annotated[bool, Query(description="Incluye códigos no vigentes.")] = False,
) -> list[IdentifierOut]:
    get_piece(session, piece_id)
    statement = select(PieceIdentifier).where(PieceIdentifier.piece_id == piece_id)
    if not include_history:
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
    status_code=status.HTTP_200_OK,
    summary="Dar de baja un código histórico mal asignado (baja lógica, RN-005)",
    tags=["Identificadores"],
    **stub(CHANGE_PIECE_CRUD),
)
def delete_piece_identifier(
    piece_id: uuid.UUID,
    identifier_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio (RN-005).")],
    user: Editor,
) -> IdentifierOut:
    """El identificador queda en el historial y en la auditoría; el de tipo I responde 409."""
    raise not_implemented(CHANGE_PIECE_CRUD, IdentifierOut)


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
            view_type=TermRef.model_validate(terms[asset.view_type_term_id])
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
    summary="Obtener URL prefirmada para subir una foto al almacenamiento",
    tags=["Multimedia"],
    **stub(CHANGE_MEDIA),
)
def create_media_upload_url(
    piece_id: uuid.UUID,
    body: UploadUrlRequest,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
) -> UploadUrlResponse:
    raise not_implemented(CHANGE_MEDIA, UploadUrlResponse)


@router.post(
    "/{piece_id}/media",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una foto ya subida (tipo de vista, orden, restricciones)",
    tags=["Multimedia"],
    **stub(CHANGE_MEDIA),
)
def register_media(
    piece_id: uuid.UUID,
    body: MediaAssetCreate,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
) -> MediaAssetOut:
    raise not_implemented(CHANGE_MEDIA, MediaAssetOut)


@router.patch(
    "/{piece_id}/media/{media_id}",
    response_model=MediaAssetOut,
    summary="Editar metadatos, orden o restricción de una foto",
    tags=["Multimedia"],
    **stub(CHANGE_MEDIA),
)
def update_media(
    piece_id: uuid.UUID,
    media_id: uuid.UUID,
    body: MediaAssetUpdate,
    user: Annotated[CurrentUser, Depends(require_permission("media.upload"))],
) -> MediaAssetOut:
    raise not_implemented(CHANGE_MEDIA, MediaAssetOut)


@router.delete(
    "/{piece_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirar una foto (eliminación lógica con motivo)",
    tags=["Multimedia"],
    **stub(CHANGE_MEDIA),
)
def retire_media(
    piece_id: uuid.UUID,
    media_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3)],
    user: Annotated[CurrentUser, Depends(require_permission("media.retire"))],
) -> None:
    raise not_implemented(CHANGE_MEDIA)


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

    def visible_ref(location_id: uuid.UUID | None) -> LocationRef | None:
        path, _exact = reader.visible_path(location_id)
        return LocationRef.model_validate(path[-1]) if path else None

    return [
        MovementOut(
            id=movement.id,
            piece_id=movement.piece_id,
            movement_type=movement.movement_type,
            from_location=visible_ref(movement.from_location_id),
            to_location=visible_ref(movement.to_location_id),
            reason=movement.reason,
            performed_by_label=movement.performed_by_label,
            occurred_at=movement.occurred_at,
        )
        for movement in movements
    ]


@router.post(
    "/{piece_id}/move",
    response_model=MovementOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un movimiento o verificación física",
    tags=["Ubicaciones"],
    **stub(CHANGE_LOCATIONS),
)
def move_piece(
    piece_id: uuid.UUID,
    body: MovementCreate,
    user: Annotated[CurrentUser, Depends(require_permission("movements.register"))],
) -> MovementOut:
    raise not_implemented(CHANGE_LOCATIONS, MovementOut)
