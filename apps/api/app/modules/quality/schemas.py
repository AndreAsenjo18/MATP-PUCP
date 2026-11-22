"""API schemas for data quality (spec calidad-datos; RF-019, RF-030, RF-035, RIA-02)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID
from app.modules.quality.completeness import AlertCode
from app.modules.quality.models import (
    CompletenessFieldKind,
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
                    "missing_fields": ["category_id", "materials"],
                }
            ]
        }
    )

    piece_id: uuid.UUID
    title: str
    collection_name: str | None
    alerts: list[AlertType]
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Campos obligatorios y recomendados vacíos, con el nombre de las reglas de "
        "completitud (p. ej. category_id, materials).",
    )


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


class AlertKpi(BaseModel):
    """Numerador y denominador explícitos de una alerta (design D3): nunca solo un porcentaje,
    para que se pueda auditar y nunca se divida entre cero."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "alert": "MISSING_INVENTORY_CODE",
                    "numerator": 100,
                    "denominator": 250,
                    "completeness_ratio": 0.6,
                }
            ]
        }
    )

    alert: AlertType
    numerator: int = Field(ge=0)
    denominator: int = Field(ge=0)
    completeness_ratio: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="`null` cuando el denominador es 0 (no aplica; spec «Colección solo "
        "comodato»).",
    )


class CollectionKpis(BaseModel):
    collection_id: uuid.UUID
    collection_name: str
    alerts: list[AlertKpi]


class CompletenessKpis(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "total_pieces": 300,
                    "alerts": [
                        {
                            "alert": "MISSING_INVENTORY_CODE",
                            "numerator": 100,
                            "denominator": 250,
                            "completeness_ratio": 0.6,
                        }
                    ],
                    "by_collection": [
                        {
                            "collection_id": EX_PIECE_ID,
                            "collection_name": "Colección AJB (ficticia, en comodato)",
                            "alerts": [
                                {
                                    "alert": "MISSING_INVENTORY_CODE",
                                    "numerator": 0,
                                    "denominator": 0,
                                    "completeness_ratio": None,
                                }
                            ],
                        }
                    ],
                    "computed_at": EX_DATETIME,
                }
            ]
        }
    )

    total_pieces: int
    alerts: list[AlertKpi]
    by_collection: list[CollectionKpis]
    computed_at: datetime


class SnapshotPointOut(BaseModel):
    """Un punto de la evolución diaria (design D5): la instantánea de una alerta en un día."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "taken_on": "2026-10-01",
                    "alert": "MISSING_PHOTO",
                    "numerator": 41,
                    "denominator": 298,
                    "completeness_ratio": 0.86,
                }
            ]
        }
    )

    taken_on: date
    alert: AlertType
    numerator: int = Field(ge=0)
    denominator: int = Field(ge=0)
    completeness_ratio: float | None = Field(default=None, ge=0, le=1)


class DashboardHistory(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "collection_id": None,
                    "points": [
                        {
                            "taken_on": "2026-10-01",
                            "alert": "MISSING_PHOTO",
                            "numerator": 41,
                            "denominator": 298,
                            "completeness_ratio": 0.86,
                        }
                    ],
                }
            ]
        }
    )

    collection_id: uuid.UUID | None
    points: list[SnapshotPointOut]


MergeChoice = Literal["SURVIVING", "ABSORBED"]
