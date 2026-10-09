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
    "download_url": None,
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
        description="URL prefirmada temporal; null hasta fotografias-multiples-por-pieza.",
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


# Limits of the bulk operations: [SUPUESTO M1] of descargas-masivas-y-enriquecimiento-lote.
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
