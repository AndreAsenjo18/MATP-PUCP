"""Carga de multimedia en las rutas del contrato del equipo (`/media/*`; spec multimedia).

El contrato sube la foto en una sola llamada `multipart/form-data` (`uploadMediaAsset`). La ruta
por pieza con URL prefirmada (`/pieces/{piece_id}/media/upload-url`) se conserva como añadido
justificado en `docs/api/mapeo-endpoints-v1.md`: evita que el archivo pase por la API.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.api.deps import CurrentUser, require_permission
from app.api.enums import PHOTO_VIEW_TYPE_LABELS
from app.api.errors import COMMON_ERROR_RESPONSES
from app.api.stubs import CHANGE_BULK, CHANGE_MEDIA, not_implemented, stub
from app.modules.media.schemas import BulkDownloadJob, BulkDownloadRequest, MediaAssetOut

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Multimedia"])

MediaUploader = Annotated[CurrentUser, Depends(require_permission("media.upload"))]
Exporter = Annotated[CurrentUser, Depends(require_permission("exports.run"))]

VIEW_TYPES = ", ".join(PHOTO_VIEW_TYPE_LABELS.values())


@router.post(
    "/media/upload",
    response_model=MediaAssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Subir una fotografía de una pieza al almacenamiento de objetos (RF-013)",
    **stub(CHANGE_MEDIA),
)
def upload_media_asset(
    user: MediaUploader,
    piece_id: Annotated[uuid.UUID, Form(description="Pieza a la que pertenece la fotografía.")],
    view_type: Annotated[str, Form(description=f"Tipo de vista: {VIEW_TYPES}.")],
    file: Annotated[UploadFile, File(description="Imagen (JPEG, PNG o TIFF).")],
) -> MediaAssetOut:
    raise not_implemented(CHANGE_MEDIA, MediaAssetOut)


@router.post(
    "/media/bulk-download",
    response_model=BulkDownloadJob,
    summary="Generar un paquete ZIP con las fotos de un grupo de piezas (RF-013, RN-008)",
    **stub(CHANGE_BULK),
)
def bulk_download_media(body: BulkDownloadRequest, user: Exporter) -> BulkDownloadJob:
    """Se prepara en segundo plano; las fotos con restricción que lo prohíbe quedan fuera."""
    raise not_implemented(CHANGE_BULK, BulkDownloadJob)
