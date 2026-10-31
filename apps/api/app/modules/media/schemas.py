"""API schemas for photographs and documents (spec multimedia; RF-013, RF-014)."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_MEDIA_ID, EX_PIECE_ID, ORMModel, TermRef

_MEDIA_EXAMPLE = {
    "id": EX_MEDIA_ID,
    "piece_id": EX_PIECE_ID,
    "original_filename": "pieza_0001_frontal.jpg",
    "content_type": "image/jpeg",
    "size_bytes": 48213,
    "content_sha256": "0" * 64,
    "width_px": 1200,
    "height_px": 900,
    "view_type": {
        "id": "01920000-0000-7000-8000-000000000321",
        "code": "Frontal",
        "label": "Frontal",
    },
    "sort_order": 0,
    "is_primary": True,
    "photographer": "Fotógrafo sintético",
    "taken_on": "2025-03-10",
    "usage_restriction": None,
    "restriction_note": None,
    "download_url": "http://localhost:9000/matp-media/pieces/.../display.webp?X-Amz-Signature=...",
    "thumbnail_url": "http://localhost:9000/matp-media/pieces/.../thumb.webp?X-Amz-Signature=...",
    "created_at": EX_DATETIME,
}


class MediaAssetOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True, json_schema_extra={"examples": [_MEDIA_EXAMPLE]}
    )

    id: uuid.UUID
    piece_id: uuid.UUID
    original_filename: str | None
    content_type: str
    size_bytes: int
    content_sha256: str
    width_px: int | None
    height_px: int | None
    view_type: TermRef | None
    sort_order: int
    is_primary: bool
    photographer: str | None
    taken_on: date | None
    usage_restriction: TermRef | None = Field(description="Restricción de uso (RF-014, RN-008).")
    restriction_note: str | None
    download_url: str | None = Field(
        None,
        description="En el listado de la galería, URL prefirmada temporal de la copia de "
        "visualización (`display.webp`) para ver la foto dentro del sistema. La descarga externa "
        "va por `GET .../media/{media_id}/download-url`, que aplica la restricción de uso.",
    )
    thumbnail_url: str | None = Field(
        None,
        description="En el listado de la galería, URL prefirmada temporal de la miniatura "
        "(`thumb.webp`, 320 px).",
    )
    created_at: datetime


class UploadUrlRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"filename": "pieza_frontal.jpg", "content_type": "image/jpeg", "size_bytes": 48213}
            ]
        }
    )

    filename: str = Field(min_length=1, max_length=300)
    content_type: str = Field(pattern=r"^(image|application)/[a-z0-9.+-]+$")
    size_bytes: int = Field(gt=0)
    content_sha256: str | None = Field(None, min_length=64, max_length=64)


class UploadUrlResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "storage_key": f"pieces/{EX_PIECE_ID}/pieza_frontal.jpg",
                    "upload_url": "http://localhost:9000/matp-media/pieces/ejemplo",
                    "method": "PUT",
                    "headers": {"Content-Type": "image/jpeg"},
                    "expires_at": EX_DATETIME,
                }
            ]
        }
    )

    storage_key: str
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str] = Field(default_factory=dict)
    expires_at: datetime


class MediaAssetCreate(BaseModel):
    """Registers an object already uploaded with the pre-signed URL."""

    storage_key: str
    original_filename: str | None = None
    content_type: str
    size_bytes: int = Field(gt=0)
    content_sha256: str = Field(min_length=64, max_length=64)
    view_type_term_id: uuid.UUID | None = None
    sort_order: int = 0
    is_primary: bool = False
    photographer: str | None = None
    taken_on: date | None = None
    usage_restriction_term_id: uuid.UUID | None = None
    restriction_note: str | None = None
    extra_metadata: dict[str, Any] | None = None


class MediaAssetUpdate(BaseModel):
    view_type_term_id: uuid.UUID | None = None
    sort_order: int | None = None
    is_primary: bool | None = None
    usage_restriction_term_id: uuid.UUID | None = None
    restriction_note: str | None = None


class DownloadUrlRequest(BaseModel):
    """Request for download URL with purpose."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"purpose": "internal"},
                {"purpose": "external"},
            ]
        }
    )

    purpose: Literal["internal", "external"] = Field(
        default="internal",
        description="Uso previsto: internal (visualización) o external (descarga).",
    )


class DownloadUrlResponse(BaseModel):
    """Response with pre-signed download URL."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "download_url": "http://localhost:9000/matp-media/pieces/.../original.jpg?...",
                    "expires_at": EX_DATETIME,
                    "effective_restriction": {
                        "id": "01920000-0000-7000-8000-000000000333",
                        "code": "NO_PUBLICAR",
                        "label": "No publicar",
                    },
                    "restriction_origin": "colección",
                }
            ]
        }
    )

    download_url: str = Field(description="URL prefirmada para descarga.")
    expires_at: datetime = Field(description="Expiración de la URL.")
    effective_restriction: TermRef | None = Field(
        None, description="Restricción efectiva aplicada a la foto."
    )
    restriction_origin: Literal["foto", "pieza", "colección", "ninguna"] = Field(
        default="ninguna", description="Origen de la restricción efectiva."
    )


restriction_origin: Literal["foto", "pieza", "colección", "ninguna"] = Field(
    default="ninguna", description="Origen de la restricción efectiva."
)


class StorageEstimateRequest(BaseModel):
    """Query parameters for storage estimation."""

    pieces: int | None = Field(
        default=None, ge=0, description="Número de piezas para la proyección."
    )
    photos_per_piece: int | None = Field(
        default=None, ge=0, description="Fotos promedio por pieza para la proyección."
    )
    mb_per_photo: int | None = Field(
        default=None, ge=0, description="MB promedio por foto para la proyección."
    )


class StorageEstimateResponse(BaseModel):
    """Response with current storage volume and projection."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "current_volume_bytes": 1234567890,
                    "current_originals_bytes": 987654321,
                    "current_derivatives_bytes": 246913569,
                    "avg_photos_per_piece": 3.5,
                    "avg_mb_per_photo": 2.1,
                    "projection": {
                        "pieces": 20000,
                        "photos_per_piece": 5,
                        "mb_per_photo": 4,
                        "projected_originals_bytes": 400000000000,
                        "projected_derivatives_bytes": 50000000000,
                        "projected_total_bytes": 450000000000,
                    },
                }
            ]
        }
    )

    current_volume_bytes: int = Field(
        description="Volumen actual almacenado (originales + derivados)."
    )
    current_originals_bytes: int = Field(description="Tamaño total de originales activos.")
    current_derivatives_bytes: int = Field(
        description="Tamaño total de derivados (thumb + display)."
    )
    avg_photos_per_piece: float | None = Field(
        default=None, description="Promedio real de fotos por pieza."
    )
    avg_mb_per_photo: float | None = Field(
        default=None, description="Promedio real de MB por foto (originales)."
    )
    projection: dict | None = Field(
        default=None, description="Proyección de volumen según parámetros indicados."
    )


# Limits of the bulk operations: [SUPUESTO AA1] of descargas-masivas-y-enriquecimiento-lote.
MAX_BULK_DOWNLOAD_PIECES = 200


class BulkDownloadRequest(BaseModel):
    """Body of ``POST /media/bulk-download`` (D1 of descargas-masivas-y-enriquecimiento-lote)."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"piece_ids": [EX_PIECE_ID]}]})

    piece_ids: list[uuid.UUID] = Field(
        min_length=1,
        max_length=MAX_BULK_DOWNLOAD_PIECES,
        description="Piezas cuyas fotografías se empaquetan [SUPUESTO M1: máximo 200].",
    )


class OmittedPhoto(BaseModel):
    media_id: uuid.UUID
    piece_id: uuid.UUID
    restriction: str = Field(description="Restricción de uso efectiva que impide incluirla.")


class BulkDownloadJob(BaseModel):
    """State of a photo package; restricted photos are left out (RN-008)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000901",
                    "status": "READY",
                    "piece_count": 30,
                    "included_photos": 84,
                    "omitted": [],
                    "download_url": "http://localhost:9000/matp-media/exports/fotos.zip",
                    "expires_at": EX_DATETIME,
                }
            ]
        }
    )

    id: uuid.UUID
    status: Literal["PENDING", "RUNNING", "READY", "FAILED"]
    piece_count: int
    included_photos: int | None = None
    omitted: list[OmittedPhoto] = Field(default_factory=list)
    download_url: str | None = None
    expires_at: datetime | None = None
