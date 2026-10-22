"""API schemas for data quality (spec calidad-datos; RF-019, RF-030, RF-035, RIA-02)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID, EX_USER_ID
from app.modules.quality.completeness import AlertCode
from app.modules.quality.models import (
    CompletenessFieldKind,
    DuplicateStatus,
    QualityJobStatus,
    QualityJobType,
)

#: La única definición de los códigos de alerta vive en `quality.completeness.AlertCode`
#: (design D1); se expone aquí tal cual para que ficha, reporte, KPI y filtro de búsqueda nunca
#: se desincronicen (tarea 2.1 — unificado junto con el frontend de `ficha-pieza-crud`).
AlertType = AlertCode


class PieceAlert(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "type": "MISSING_PHOTO",
                    "message": "La pieza no tiene fotografías.",
                    "suggested_action": "Subir al menos una fotografía",
                    "fields": [],
                    "applies": True,
                }
            ]
        }
    )

    type: AlertType
    message: str
    suggested_action: str = Field(
        description="Acción sugerida para resolver la alerta (RNF-010, lenguaje claro)."
    )
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
                    "alerts": ["MISSING_INVENTORY_CODE", "MISSING_PHOTO"],
                }
            ]
        }
    )

    piece_id: uuid.UUID
    title: str
    collection_name: str | None
    alerts: list[AlertType]


class CompletenessRuleOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"field": "description", "kind": "RECOMMENDED", "is_active": True}]
        }
    )

    field: str
    kind: CompletenessFieldKind
    is_active: bool


class CompletenessRuleIn(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"field": "description", "kind": "RECOMMENDED", "is_active": True}]
        }
    )

    field: str = Field(
        description="Campo de `piece` a administrar (lista blanca; 422 si no existe)."
    )
    kind: CompletenessFieldKind
    is_active: bool = True


class CompletenessRulesUpdate(BaseModel):
    """Reemplaza el conjunto completo de reglas activas e inactivas (PUT, no PATCH parcial)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "rules": [
                        {"field": "denomination", "kind": "REQUIRED", "is_active": True},
                        {"field": "description", "kind": "RECOMMENDED", "is_active": True},
                    ]
                }
            ]
        }
    )

    rules: list[CompletenessRuleIn]


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


DuplicateOrigin = Literal["CATALOG", "IMPORT"]
MergeChoice = Literal["SURVIVING", "ABSORBED"]


class DuplicateSignal(BaseModel):
    """One explained reason of a candidate score (``quality.scoring.Signal``, design D1).

    Rows written before the detection rules (seed, imports) may carry only ``field`` and
    ``similarity``, so the rest is optional and unknown keys are kept.
    """

    model_config = ConfigDict(extra="allow")

    signal: str | None = Field(None, description="identifier, denomination, collection, …")
    field: str
    similarity: float
    weight: float | None = None
    contribution: float | None = None
    values: Any = Field(None, description="Valores comparados de ambas piezas.")


class DuplicateCandidateOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000911",
                    "piece_a_id": EX_PIECE_ID,
                    "piece_b_id": "01920000-0000-7000-8000-000000000102",
                    "import_row_id": None,
                    "score": 0.91,
                    "matched_fields": [
                        {
                            "signal": "identifier",
                            "field": "identifier:COLECCION",
                            "similarity": 1.0,
                            "weight": 0.35,
                            "contribution": 0.35,
                            "values": {"normalized": "MMZ 12", "a": "MMZ 012", "b": "M.M.Z. 012"},
                        },
                        {
                            "signal": "denomination",
                            "field": "denomination",
                            "similarity": 0.93,
                            "weight": 0.3,
                            "contribution": 0.279,
                            "values": {"a": "Retablo ayacuchano", "b": "RETABLO AYACUCHANO"},
                        },
                    ],
                    "status": "PENDING",
                    "detected_by": "rules",
                    "blocking_conflict": False,
                    "postponed_until": None,
                    "reviewed_at": None,
                    "resolution_note": None,
                }
            ]
        },
    )

    id: uuid.UUID
    piece_a_id: uuid.UUID
    piece_b_id: uuid.UUID | None
    import_row_id: uuid.UUID | None
    score: float = Field(ge=0, le=1)
    matched_fields: list[DuplicateSignal]
    status: DuplicateStatus
    detected_by: str
    blocking_conflict: bool = Field(
        description="Dos códigos I vigentes distintos: la fusión queda bloqueada (RN-002)."
    )
    postponed_until: datetime | None = Field(
        description="Un par pospuesto vuelve a pendiente al leer la cola después de esta fecha."
    )
    reviewed_at: datetime | None
    resolution_note: str | None


class DuplicateResolution(BaseModel):
    """Merge or mark distinct; nothing is ever deleted (RN-005)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"resolution": "DISTINCT", "note": "Piezas distintas del mismo taller"},
                {
                    "resolution": "POSTPONED",
                    "postponed_until": "2026-12-01T00:00:00Z",
                    "note": "Esperar la ficha física",
                },
                {
                    "resolution": "MERGED",
                    "surviving_piece_id": EX_PIECE_ID,
                    "field_choices": {"provenance": "ABSORBED"},
                    "note": "Misma pieza registrada en el libro y en la sábana",
                },
            ]
        }
    )

    resolution: Literal["MERGED", "DISTINCT", "POSTPONED"]
    surviving_piece_id: uuid.UUID | None = Field(None, description="Obligatorio para MERGED.")
    field_choices: dict[str, MergeChoice] | None = Field(
        None,
        description=(
            "Solo para MERGED: valor que queda en cada campo de la ficha. Sin elección queda el de "
            "la pieza conservada y, si está vacío, el de la absorbida."
        ),
    )
    postponed_until: datetime | None = Field(
        None,
        description="Obligatorio para POSTPONED: fecha futura, como máximo 180 días [SUPUESTO].",
    )
    note: str | None = None


class QualityJobOut(BaseModel):
    """State and progress of a full duplicate scan run in the background (design D3)."""

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000921",
                    "job_type": "FULL_SCAN",
                    "status": "RUNNING",
                    "requested_by_id": EX_USER_ID,
                    "started_at": EX_DATETIME,
                    "heartbeat_at": EX_DATETIME,
                    "finished_at": None,
                    "total_pieces": 298,
                    "processed_pieces": 120,
                    "pairs_evaluated": 610,
                    "candidates_created": 0,
                    "candidates_reopened": 0,
                    "duration_ms": None,
                    "error_message": None,
                }
            ]
        },
    )

    id: uuid.UUID
    job_type: QualityJobType
    status: QualityJobStatus
    requested_by_id: uuid.UUID | None
    started_at: datetime | None
    heartbeat_at: datetime | None
    finished_at: datetime | None
    total_pieces: int = Field(ge=0)
    processed_pieces: int = Field(ge=0)
    pairs_evaluated: int = Field(ge=0, description="Pares comparados; nunca todos contra todos.")
    candidates_created: int = Field(ge=0)
    candidates_reopened: int = Field(
        ge=0, description="Pares «distintos» que vuelven a la cola porque cambió su huella."
    )
    duration_ms: int | None
    error_message: str | None
