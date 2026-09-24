"""API schemas for data quality (spec calidad-datos; RF-019, RF-030, RF-035, RIA-02)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID
from app.modules.quality.models import DuplicateStatus

AlertType = Literal[
    "WITHOUT_INVENTORY_CODE",
    "WITHOUT_PHOTO",
    "WITHOUT_LOCATION",
    "MISSING_REQUIRED_FIELDS",
    "UNPARSEABLE_CODE",
]


class PieceAlert(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "type": "WITHOUT_PHOTO",
                    "message": "La pieza no tiene fotografías.",
                    "fields": [],
                    "applies": True,
                }
            ]
        }
    )

    type: AlertType
    message: str
    fields: list[str] = Field(default_factory=list)
    applies: bool = Field(
        True, description="False cuando no aplica (p. ej. sin I en comodato no es alerta)."
    )


class IncompletePiece(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "piece_id": EX_PIECE_ID,
                    "title": "Vasija ceremonial (sintética)",
                    "collection_name": "Colección MMZ (ficticia)",
                    "alerts": ["WITHOUT_INVENTORY_CODE", "WITHOUT_PHOTO"],
                }
            ]
        }
    )

    piece_id: uuid.UUID
    title: str
    collection_name: str | None
    alerts: list[AlertType]


class CompletenessKpis(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "total_pieces": 298,
                    "without_inventory_code": 160,
                    "without_photo": 41,
                    "without_location": 96,
                    "missing_required_fields": 12,
                    "completeness_ratio": 0.62,
                    "by_collection": [
                        {"collection_name": "Colección MMZ (ficticia)", "completeness_ratio": 0.7}
                    ],
                    "computed_at": EX_DATETIME,
                }
            ]
        }
    )

    total_pieces: int
    without_inventory_code: int
    without_photo: int
    without_location: int
    missing_required_fields: int
    completeness_ratio: float = Field(ge=0, le=1)
    by_collection: list[dict[str, str | float | int | None]]
    computed_at: datetime


class DuplicateCandidateOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000911",
                    "piece_a_id": EX_PIECE_ID,
                    "piece_b_id": "01920000-0000-7000-8000-000000000102",
                    "import_row_id": None,
                    "score": 0.91,
                    "matched_fields": ["title", "provenance", "dimensions_text"],
                    "status": "PENDING",
                    "detected_by": "rules",
                    "reviewed_at": None,
                    "resolution_note": None,
                }
            ]
        }
    )

    id: uuid.UUID
    piece_a_id: uuid.UUID
    piece_b_id: uuid.UUID | None
    import_row_id: uuid.UUID | None
    score: float = Field(ge=0, le=1)
    matched_fields: list[str]
    status: DuplicateStatus
    detected_by: str
    reviewed_at: datetime | None
    resolution_note: str | None


class DuplicateResolution(BaseModel):
    """Merge or mark distinct; nothing is ever deleted (RN-005)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"resolution": "DISTINCT", "note": "Piezas distintas del mismo taller"}]
        }
    )

    resolution: Literal["MERGED", "DISTINCT", "POSTPONED"]
    surviving_piece_id: uuid.UUID | None = Field(None, description="Obligatorio para MERGED.")
    note: str | None = None
