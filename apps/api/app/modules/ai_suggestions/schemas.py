"""API schemas for AI suggestions (spec ia-asistiva; RIA-01..RIA-05, RN-009)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID, EX_SUGGESTION_ID, EX_USER_ID, ORMModel
from app.modules.ai_suggestions.models import AiFunction, SuggestionStatus


class AiSuggestionOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": EX_SUGGESTION_ID,
                    "function_code": "RIA_01",
                    "status": "PENDING",
                    "provider": "mock",
                    "model": "mock-deterministic-v1",
                    "piece_id": EX_PIECE_ID,
                    "import_batch_id": None,
                    "input_data": {"field": "notes", "text": "Alto 35 cm (sintético)"},
                    "output_data": {
                        "fields": [
                            {
                                "field": "dimensions",
                                "value": {"dimension": "alto", "value": 35, "unit": "cm"},
                                "source_fragment": "Alto 35 cm",
                                "confidence": 0.8,
                            }
                        ]
                    },
                    "approved_data": None,
                    "requested_by_id": EX_USER_ID,
                    "reviewed_by_id": None,
                    "reviewed_at": None,
                    "rejection_reason": None,
                    "created_at": EX_DATETIME,
                }
            ]
        },
    )

    id: uuid.UUID
    function_code: AiFunction
    status: SuggestionStatus
    provider: str
    model: str | None
    piece_id: uuid.UUID | None
    import_batch_id: uuid.UUID | None
    input_data: dict[str, Any]
    output_data: dict[str, Any]
    approved_data: dict[str, Any] | None
    requested_by_id: uuid.UUID | None
    reviewed_by_id: uuid.UUID | None
    reviewed_at: datetime | None
    rejection_reason: str | None
    created_at: datetime


class AiSuggestionCreate(BaseModel):
    """Asks the AI service for a proposal; it is stored as PENDING, never applied (RN-009)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"function_code": "RIA_01", "piece_id": EX_PIECE_ID, "field": "notes"}]
        }
    )

    function_code: AiFunction
    piece_id: uuid.UUID | None = None
    import_batch_id: uuid.UUID | None = None
    field: str | None = Field(None, description="Campo de texto libre de origen (RIA-01).")
    text: str | None = Field(None, description="Texto explícito si no se toma de la ficha.")


class AiSuggestionApproval(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "approved_data": {
                        "fields": [
                            {
                                "field": "dimensions",
                                "value": {"dimension": "alto", "value": 36, "unit": "cm"},
                            }
                        ]
                    },
                    "acknowledge_current_values": False,
                }
            ]
        }
    )

    approved_data: dict[str, Any] = Field(
        description="Datos aprobados (pueden estar editados; parcial = APPROVED parcial)."
    )
    acknowledge_current_values: bool = Field(
        False,
        description="Confirmación explícita si los campos cambiaron desde la sugerencia.",
    )


class AiSuggestionRejection(BaseModel):
    reason: str = Field(min_length=3, description="Motivo obligatorio (RN-009).")
