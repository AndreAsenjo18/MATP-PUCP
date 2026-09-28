"""API schemas for identifiers (spec identificacion-piezas; RF-002, RF-003, RF-023, RN-010)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_IDENTIFIER_ID, EX_PIECE_ID, ORMModel
from app.modules.identification.models import NormalizationRule, NormalizationStatus

_IDENTIFIER_EXAMPLE = {
    "id": EX_IDENTIFIER_ID,
    "piece_id": EX_PIECE_ID,
    "identifier_type_code": "I",
    "original_value": "I-0236",
    "normalized_value": "I-236",
    "normalization_status": "NORMALIZED",
    "detected_format": "I_PREFIJO",
    "is_current": True,
    "is_locked": True,
    "source": "Libro de inventario (sintético)",
    "recorded_at": EX_DATETIME,
    "replaced_by_id": None,
    "notes": None,
}


class IdentifierOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True, json_schema_extra={"examples": [_IDENTIFIER_EXAMPLE]}
    )

    id: uuid.UUID
    piece_id: uuid.UUID
    identifier_type_code: str
    original_value: str = Field(description="Valor tal como está escrito en la fuente.")
    normalized_value: str | None
    normalization_status: NormalizationStatus
    detected_format: str | None
    is_current: bool
    is_locked: bool = Field(description="Código I bloqueado tras su asignación (RN-002).")
    source: str | None
    recorded_at: datetime
    replaced_by_id: uuid.UUID | None
    notes: str | None


class IdentifierCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"identifier_type_code": "COLECCION", "value": "M.M.Z. 015", "source": "Ficha"}
            ]
        }
    )

    identifier_type_code: str = Field(min_length=1, max_length=40)
    value: str = Field(min_length=1)
    source: str | None = Field(None, max_length=200)
    replaces_identifier_id: uuid.UUID | None = Field(
        None, description="Identificador no bloqueado del mismo tipo que pasa a histórico."
    )
    notes: str | None = None


class InventoryCodeCorrection(BaseModel):
    """Audited correction of a locked code I (Administrator only, RN-002)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"new_value": "I-2363", "reason": "Error de transcripción (sintético)"}]
        }
    )

    new_value: str = Field(min_length=1)
    reason: str = Field(min_length=3)


class IdentifierTypeOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "code": "I",
                    "label": "Código de inventario general (I)",
                    "description": None,
                    "normalization_rule": "INVENTORY",
                    "is_unique_when_current": True,
                    "locks_on_assignment": True,
                    "owned_pieces_only": True,
                    "allowed_for_temporary_loan": False,
                    "sort_order": 0,
                    "is_active": True,
                }
            ]
        },
    )

    code: str
    label: str
    description: str | None
    normalization_rule: NormalizationRule
    is_unique_when_current: bool
    locks_on_assignment: bool
    owned_pieces_only: bool
    allowed_for_temporary_loan: bool
    sort_order: int
    is_active: bool


class IdentifierTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Z][A-Z0-9_]*$")
    label: str = Field(min_length=1, max_length=200)
    description: str | None = None
    normalization_rule: NormalizationRule = NormalizationRule.GENERIC
    sort_order: int = 0


class IdentifierTypeUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class NormalizeRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"value": "I 2362 / M.M.Z. 015", "default_type": None}]}
    )

    value: str = Field(description="Celda o código tal como está escrito.", max_length=2000)
    default_type: str | None = Field(
        None, description="Tipo asumido si no se reconoce el formato (p. ej. COLECCION)."
    )


class NormalizedProposal(BaseModel):
    type_code: str | None
    original: str
    normalized: str | None
    status: NormalizationStatus
    detected_format: str | None
    is_absent: bool
    requires_confirmation: bool
    notes: list[str]


class NormalizeResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "value": "I 2362 / M.M.Z. 015",
                    "is_absence_marker": False,
                    "proposals": [
                        {
                            "type_code": "I",
                            "original": "I 2362",
                            "normalized": "I-2362",
                            "status": "NORMALIZED",
                            "detected_format": "I_PREFIJO",
                            "is_absent": False,
                            "requires_confirmation": True,
                            "notes": ["Celda con varios códigos: confirme la separación."],
                        }
                    ],
                }
            ]
        }
    )

    value: str
    is_absence_marker: bool = Field(description="Marcador de ausencia (S/N, s/c, -…) [SUPUESTO].")
    proposals: list[NormalizedProposal]
