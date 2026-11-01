"""Carga de multimedia en las rutas del contrato del equipo (`/media/*`; spec multimedia).

El contrato sube la foto en una sola llamada `multipart/form-data` (`uploadMediaAsset`). La ruta
por pieza con URL prefirmada (`/pieces/{piece_id}/media/upload-url`) se conserva como añadido
justificado en `docs/api/mapeo-endpoints-v1.md`: evita que el archivo pase por la API.
"""

import hashlib
import uuid
from io import BytesIO
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.batch_limits import ensure_batch_size
from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.enums import PHOTO_VIEW_TYPE_LABELS, code_of
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.refs import TermRef, translate_view_term
from app.api.stubs import implemented
from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.core.jobs import run_in_background
from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.queries import get_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.media.bulk_download import (
    build_bulk_download,
    bulk_download_of,
    create_bulk_download,
    is_expired,
)
from app.modules.media.models import BulkDownloadStatus, MediaAsset, MediaBulkDownload
from app.modules.media.schemas import (
    BulkDownloadJob,
    BulkDownloadRequest,
    MediaAssetOut,
    OmittedPhoto,
    StorageEstimateRequest,
    StorageEstimateResponse,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Multimedia"])

MediaUploader = Annotated[CurrentUser, Depends(require_permission("media.upload"))]
Exporter = Annotated[CurrentUser, Depends(require_permission("exports.run"))]

VIEW_TYPES = ", ".join(PHOTO_VIEW_TYPE_LABELS.values())

NOT_FOUND = {404: {"model": ErrorResponse, "description": "La pieza no existe o fue eliminada."}}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/tiff"}
ALLOWED_FORMATS = {"JPEG", "PNG", "TIFF"}
MIME_BY_FORMAT = {"JPEG": "image/jpeg", "PNG": "image/png", "TIFF": "image/tiff"}
EXTENSION_BY_FORMAT = {"JPEG": "jpg", "PNG": "png", "TIFF": "tiff"}


def _view_type_term_id(session: Session, view_type: str) -> uuid.UUID:
    """Código interno del tipo de vista a partir de la etiqueta del contrato (tarea 3.1)."""
    code = code_of(PHOTO_VIEW_TYPE_LABELS, view_type, "view_type")
    term = session.scalar(
        select(Term)
        .join(Vocabulary)
        .where(Vocabulary.code == VocabularyCode.PHOTO_VIEW_TYPE, Term.code == code)
    )
    if term is None:
        raise ValidationFailed(
            f'El tipo de vista "{view_type}" no existe en el vocabulario.',
            details={"field": "view_type"},
        )
    return term.id


def _verified_image(data: bytes) -> tuple[str, int, int, str, str]:
    """Tipo real (Pillow), dimensiones, huella SHA-256, MIME y extensión detectados del archivo.

    Lo registrado es exactamente lo subido: el MIME se deriva del formato detectado,
    no del declarado por el cliente.
    """
    if not data:
        raise ValidationFailed("El archivo está vacío.", details={"field": "file"})
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise ValidationFailed(
            "El archivo no es una imagen válida (JPEG, PNG o TIFF).",
            code="invalid_image",
            details={"field": "file"},
        ) from exc
    if image.format not in ALLOWED_FORMATS:
        raise ValidationFailed(
            f"Formato {image.format} no admitido. Valores admitidos: JPEG, PNG, TIFF.",
            code="unsupported_image_format",
            details={"field": "file", "format": str(image.format)},
        )
    assert image.format is not None
    width, height = image.size
    return (
        hashlib.sha256(data).hexdigest(),
        width,
        height,
        MIME_BY_FORMAT[image.format],
        EXTENSION_BY_FORMAT[image.format],
    )


def _comodato_restriction_term_id(session: Session) -> uuid.UUID:
    """Restricción de imágenes en comodato (RN-008): hereda `NO_PUBLICAR`."""
    term = session.scalar(
        select(Term)
        .join(Vocabulary)
        .where(
            Vocabulary.code == VocabularyCode.USAGE_RESTRICTION,
            Term.code == "NO_PUBLICAR",
        )
    )
    if term is None:
        raise BusinessRuleViolation(
            "Falta el vocabulario de restricciones de uso.",
            code="usage_restriction_missing",
        )
    return term.id


@router.post(
    "/media/upload",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
    responses=NOT_FOUND,
    summary="Subir una fotografía de una pieza al almacenamiento de objetos (RF-013)",
    **implemented(),
)
def upload_media_asset(
    request: Request,
    session: SessionDep,
    user: MediaUploader,
    piece_id: Annotated[uuid.UUID, Form(description="Pieza a la que pertenece la fotografía.")],
    view_type: Annotated[str, Form(description=f"Tipo de vista: {VIEW_TYPES}.")],
    file: Annotated[UploadFile, File(description="Imagen (JPEG, PNG o TIFF).")],
) -> MediaAssetOut:
    piece = get_piece(session, piece_id)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationFailed(
            f'Tipo de contenido "{file.content_type}" no admitido (se espera JPEG, PNG o TIFF).',
            code="unsupported_media_type",
            details={"field": "file", "allowed": sorted(ALLOWED_CONTENT_TYPES)},
        )
    data = file.file.read()
    digest, width, height, content_type, extension = _verified_image(data)
    view_type_term_id = _view_type_term_id(session, view_type)

    restriction_term_id: uuid.UUID | None = None
    restriction_note: str | None = None
    if piece.tenure_regime == TenureRegime.LOAN_FOR_USE:
        restriction_term_id = _comodato_restriction_term_id(session)
        restriction_note = "Restricción contractual del comodato (RN-008)"

    max_order = session.scalar(
        select(func.max(MediaAsset.sort_order)).where(MediaAsset.piece_id == piece.id)
    )
    asset_id = new_uuid()
    storage_key = f"pieces/{piece.id}/{asset_id}/original.{extension}"
    request.app.state.storage.put_bytes(storage_key, data, content_type)
    asset = MediaAsset(
        id=asset_id,
        piece_id=piece.id,
        storage_key=storage_key,
        original_filename=file.filename,
        content_type=content_type,
        size_bytes=len(data),
        content_sha256=digest,
        width_px=width,
        height_px=height,
        view_type_term_id=view_type_term_id,
        sort_order=(max_order + 1) if max_order is not None else 0,
        is_primary=max_order is None,
        usage_restriction_term_id=restriction_term_id,
        restriction_note=restriction_note,
    )
    session.add(asset)
    writer(session, user)
    session.commit()

    terms = {
        term.id: term
        for term in session.scalars(
            select(Term).where(
                Term.id.in_(
                    [term_id for term_id in (view_type_term_id, restriction_term_id) if term_id]
                )
            )
        )
    }
    view_term = terms.get(view_type_term_id)
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


def bulk_download_body(request: Request, body: BulkDownloadRequest) -> BulkDownloadRequest:
    """The package within ``MEDIA_BULK_DOWNLOAD_MAX_PIECES`` (task 1.2) [SUPUESTO AA1].

    A dependency, so the size is checked before the route is reached.
    """
    limit = request.app.state.settings.media_bulk_download_max_pieces
    ensure_batch_size(len(body.piece_ids), limit, "Un paquete de fotos")
    return body


def _bulk_download_out(request: Request, job: MediaBulkDownload) -> BulkDownloadJob:
    """The state of a package; once READY, a short-lived link to its ZIP (D1)."""
    url = None
    if job.status is BulkDownloadStatus.READY and job.storage_key:
        ttl = request.app.state.settings.media_url_ttl_seconds
        url = request.app.state.storage.presign_get(job.storage_key, ttl)
    return BulkDownloadJob(
        id=job.id,
        status=job.status.value,
        piece_count=len(job.piece_ids),
        included_photos=job.included_photos,
        omitted=[OmittedPhoto(**item) for item in job.omitted],
        download_url=url,
        expires_at=job.expires_at,
    )


@router.post(
    "/media/bulk-download",
    response_model=BulkDownloadJob,
    responses={
        409: {
            "model": ErrorResponse,
            "description": "`bulk_download_in_progress`: la persona ya tiene un paquete en "
            "preparación (`details.job_id`).",
        },
    },
    summary="Generar un paquete ZIP con las fotos de un grupo de piezas (RF-013, RN-008)",
    description="Responde `200` con el estado del trabajo (`PENDING`): el paquete se prepara en "
    "segundo plano y se consulta con `GET /media/bulk-download/{job_id}`, que entrega el enlace "
    "de descarga cuando está listo (diseño D1 de `descargas-masivas-y-enriquecimiento-lote`; el "
    "documento del equipo dice «Archivo ZIP generado», ver la fila 42 del mapeo). Las fotos cuya "
    "restricción efectiva prohíbe la descarga quedan fuera, con su restricción (RN-008).",
    **implemented(),
)
def bulk_download_media(
    user: Exporter,
    body: Annotated[BulkDownloadRequest, Depends(bulk_download_body)],
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
) -> BulkDownloadJob:
    job = create_bulk_download(writer(session, user), user.id, body.piece_ids)
    session.commit()
    run_in_background(
        background_tasks,
        build_bulk_download,
        request.app.state.session_factory,
        job.id,
        request.app.state.storage,
        ttl_hours=request.app.state.settings.media_bulk_download_ttl_hours,
    )
    return _bulk_download_out(request, job)


@router.get(
    "/media/bulk-download/{job_id}",
    response_model=BulkDownloadJob,
    responses={
        403: {
            "model": ErrorResponse,
            "description": "El rol no tiene el permiso requerido o el paquete lo pidió otra "
            "persona.",
        },
        404: {"model": ErrorResponse, "description": "No existe ese paquete."},
        410: {
            "model": ErrorResponse,
            "description": "El paquete caducó: el archivo ya no está disponible y el registro "
            "del trabajo se conserva.",
        },
    },
    summary="Estado de un paquete de fotos y su enlace de descarga (RF-013, RNF-005)",
    description="Operación añadida al contrato (D1 de `descargas-masivas-y-enriquecimiento-lote`): "
    "el estado del paquete y, cuando está listo, un enlace de corta duración "
    "(`MEDIA_URL_TTL_SECONDS`) a su ZIP, hasta que el paquete caduca "
    "(`MEDIA_BULK_DOWNLOAD_TTL_HOURS`). Solo lo consulta quien lo pidió.",
    **implemented(),
)
def get_bulk_download(
    job_id: uuid.UUID, request: Request, session: SessionDep, user: Exporter
) -> BulkDownloadJob:
    job = bulk_download_of(session, job_id, user.id)
    if job.status is BulkDownloadStatus.READY and job.storage_key and is_expired(job):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El paquete de fotos caducó y su archivo ya no está disponible; el registro "
            "se conserva. Pida un paquete nuevo.",
        )
    return _bulk_download_out(request, job)


# Thumbnail (~20 KB) and display copy (~300 KB) of each photo [SUPUESTO: average of the derivatives
# of a 4 MB JPEG; it only feeds the estimate].
DERIVATIVES_BYTES_PER_PHOTO = 320 * 1024


@router.get(
    "/media/storage-estimate",
    response_model=StorageEstimateResponse,
    summary="Estimación del volumen fotográfico",
    description="Volumen actual de las fotos activas (originales y derivados estimados) y, con "
    "`pieces`, `photos_per_piece` o `mb_per_photo`, la proyección de un volumen futuro; los "
    "parámetros que faltan toman los promedios reales (RNF-003). Parámetros negativos: 422.",
    **implemented(),
)
def get_media_storage_estimate(
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("reports.view"))],
    query: Annotated[StorageEstimateRequest, Depends()],
) -> StorageEstimateResponse:
    originals_bytes, photo_count, pieces_with_photos = session.execute(
        select(
            func.coalesce(func.sum(MediaAsset.size_bytes), 0),
            func.count(MediaAsset.id),
            func.count(func.distinct(MediaAsset.piece_id)),
        ).where(MediaAsset.deleted_at.is_(None))
    ).one()
    derivatives_bytes = photo_count * DERIVATIVES_BYTES_PER_PHOTO
    # Averages over the pieces that have photos: the others say nothing of how many a piece has.
    avg_photos_per_piece = photo_count / pieces_with_photos if pieces_with_photos else None
    avg_mb_per_photo = originals_bytes / photo_count / 1024 / 1024 if photo_count else None

    projection = None
    if any(
        value is not None for value in (query.pieces, query.photos_per_piece, query.mb_per_photo)
    ):
        pieces = query.pieces or 0
        photos_per_piece = query.photos_per_piece or avg_photos_per_piece or 0
        mb_per_photo = query.mb_per_photo or avg_mb_per_photo or 0
        photos = pieces * photos_per_piece
        projected_originals = int(photos * mb_per_photo * 1024 * 1024)
        projected_derivatives = int(photos * DERIVATIVES_BYTES_PER_PHOTO)
        projection = {
            "pieces": pieces,
            "photos_per_piece": photos_per_piece,
            "mb_per_photo": mb_per_photo,
            "projected_originals_bytes": projected_originals,
            "projected_derivatives_bytes": projected_derivatives,
            "projected_total_bytes": projected_originals + projected_derivatives,
        }

    return StorageEstimateResponse(
        current_volume_bytes=originals_bytes + derivatives_bytes,
        current_originals_bytes=originals_bytes,
        current_derivatives_bytes=derivatives_bytes,
        avg_photos_per_piece=avg_photos_per_piece,
        avg_mb_per_photo=avg_mb_per_photo,
        projection=projection,
    )
