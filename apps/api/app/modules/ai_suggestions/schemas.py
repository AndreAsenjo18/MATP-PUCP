"""API schemas for AI suggestions (spec ia-asistiva; RIA-01..RIA-05, RN-009)."""

import uuid
from datetime import datetime
from typing import Any, Literal

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


class CatalogingSuggestionRequest(BaseModel):
    """Body of ``POST /ai/suggest-cataloging``: the contract requires the piece (RIA-01)."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"piece_id": EX_PIECE_ID, "field": "notes"}]}
    )

    piece_id: uuid.UUID
    field: str | None = Field(None, description="Campo de texto libre de origen (RIA-01).")
    text: str | None = Field(None, description="Texto explícito si no se toma de la ficha.")


class ColumnMappingSuggestRequest(BaseModel):
    """Body of ``POST /ai/suggest-column-mapping`` (change carga-masiva-con-ia): se pide cuando
    ninguna plantilla guardada reconoció el archivo (RF-022, RF-048)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "headers": ["DENOMINACIÓN", "CÓDIGOS", "OBSERVACIONES"],
                    "sample_rows": [
                        {
                            "DENOMINACIÓN": "Arpa andina",
                            "CÓDIGOS": "I-9201",
                            "OBSERVACIONES": "Mide 95 cm de alto.",
                        }
                    ],
                }
            ]
        }
    )

    headers: list[str] = Field(min_length=1, max_length=100)
    sample_rows: list[dict[str, Any]] = Field(default_factory=list, max_length=20)


class ColumnMappingCandidateOut(BaseModel):
    column: str
    field: str | None = Field(None, description="Campo de destino propuesto, o null.")
    confidence: float = Field(ge=0, le=1)


class ColumnMappingSuggestionOut(BaseModel):
    """Nunca se persiste (a diferencia de ``AiSuggestionOut``): es una propuesta de mapeo, no un
    dato de catálogo; la persona la confirma o la corrige en «Ajustar columnas» antes de validar
    el lote (RN-009)."""

    mappings: list[ColumnMappingCandidateOut]
    message: str | None = None


class SearchOptionIn(BaseModel):
    """Una opción ya cargada por el frontend para sus filtros manuales (change
    `busqueda-lenguaje-natural`): se reenvía tal cual, sin volver a consultar el catálogo aquí."""

    id: uuid.UUID
    label: str


class InterpretSearchRequest(BaseModel):
    """Body de ``POST /ai/interpret-search``: las listas son las mismas que ya carga la pantalla
    de Búsqueda para sus desplegables (``SearchOptions`` del frontend)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "text": "toros de cerámica de Puno que no tengan foto",
                    "collections": [],
                    "categories": [
                        {"id": "01900000-0000-7000-8000-000000000001", "label": "Figura zoomorfa"}
                    ],
                    "materials": [
                        {"id": "01900000-0000-7000-8000-000000000002", "label": "Cerámica"}
                    ],
                    "conservation_states": [],
                    "locations": [],
                }
            ]
        }
    )

    text: str = Field(min_length=1, max_length=2000)
    collections: list[SearchOptionIn] = Field(default_factory=list)
    categories: list[SearchOptionIn] = Field(default_factory=list)
    materials: list[SearchOptionIn] = Field(default_factory=list)
    conservation_states: list[SearchOptionIn] = Field(default_factory=list)
    locations: list[SearchOptionIn] = Field(default_factory=list)


class InterpretedFilters(BaseModel):
    """Filtros ya resueltos contra las listas recibidas (ids reales, nunca inventados por el
    modelo — D2/D3 de `busqueda-lenguaje-natural`): el mismo vocabulario que ya usan los filtros
    manuales de Búsqueda, listos para aplicarse como los chips que ya existen."""

    q: str | None = None
    collection_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    material_id: uuid.UUID | None = None
    conservation_state_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    tenure_regime: str | None = Field(
        None, description="Etiqueta en español (Propia, Comodato, Préstamo temporal)."
    )
    provenance: str | None = None
    author: str | None = None
    alert_code: str | None = None
    epoch_start_year: int | None = None
    epoch_end_year: int | None = None


class CompletionEvidenceOut(BaseModel):
    source: Literal["text", "image"] = Field(
        description="`text`: cita literal de la ficha; `image`: leído de la foto principal."
    )
    quote: str | None = Field(None, description="Fragmento literal (solo `text`).")
    text_field: Literal["denomination", "description", "notes"] | None = None


class CompletionProposalOut(BaseModel):
    field: Literal[
        "category", "materials", "provenance", "epoch", "dimensions_text", "conservation_status"
    ] = Field(description="Dato propuesto, con el nombre que se usa al aprobar.")
    piece_field: str = Field(
        description="Campo de la ficha que completa, como en `IncompletePiece.missing_fields`."
    )
    value: str = Field(description="Código del término o el texto propuesto.")
    label: str = Field(description="Cómo se muestra (etiqueta del término o el texto).")
    term_id: uuid.UUID | None = Field(None, description="Término de la lista, si es de una.")
    confidence: float = Field(ge=0, le=1)
    evidence: CompletionEvidenceOut


class PieceCompletionOut(BaseModel):
    """«Completar ficha» (change `ia-completar-ficha`): propuestas PENDIENTES para los campos que
    le faltan a la pieza, cada una con su prueba. Nada se escribe hasta que la persona acepta y
    guarda (RN-009): lo aceptado se aprueba con `POST /ai/suggestions/{id}/approve`."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "suggestion_id": EX_SUGGESTION_ID,
                    "provider": "mock",
                    "model": "mock-deterministic-v1",
                    "prompt_version": "completar-ficha-v1",
                    "fields": ["materials", "epoch"],
                    "proposals": [
                        {
                            "field": "materials",
                            "piece_field": "materials",
                            "value": "MADERA",
                            "label": "Madera",
                            "term_id": "01900000-0000-7000-8000-000000000002",
                            "confidence": 0.8,
                            "evidence": {
                                "source": "text",
                                "quote": "madera de cedro",
                                "text_field": "description",
                            },
                        }
                    ],
                    "not_found": ["epoch_original_text"],
                    "image_used": False,
                    "reused": False,
                }
            ]
        }
    )

    suggestion_id: uuid.UUID | None = Field(
        None, description="Sugerencia pendiente; null si no había nada que pedir."
    )
    provider: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    fields: list[str] = Field(
        default_factory=list, description="Datos que se pidieron (los que le faltan a la pieza)."
    )
    proposals: list[CompletionProposalOut] = Field(default_factory=list)
    not_found: list[str] = Field(
        default_factory=list,
        description="Campos de la ficha (`missing_fields`) que la IA no encontró en la ficha.",
    )
    image_used: bool = Field(False, description="Si se leyó también la foto principal.")
    reused: bool = Field(
        False, description="La misma propuesta pendiente de antes; no se volvió a llamar a la IA."
    )


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
                        ],
                        "dimensions_text": "alto 36 cm x ancho 40 cm",
                    },
                    "acknowledge_current_values": False,
                }
            ]
        }
    )

    approved_data: dict[str, Any] = Field(
        description=(
            "Datos aprobados (pueden estar editados; parcial = APPROVED parcial). "
            "`dimensions_text` es opcional: si se envía, reemplaza también el texto libre de "
            '"Medidas" (decisión del equipo, 2026-11-04; la IA nunca lo toca por sí sola).'
        )
    )
    acknowledge_current_values: bool = Field(
        False,
        description="Confirmación explícita si los campos cambiaron desde la sugerencia.",
    )


class AiSuggestionRejection(BaseModel):
    reason: str = Field(min_length=3, description="Motivo obligatorio (RN-009).")


class BatchEnrichRequest(BaseModel):
    """Body of ``POST /ai/batch-enrich``: drafts for pieces without description (RIA-04)."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"piece_ids": [EX_PIECE_ID]}]})

    piece_ids: list[uuid.UUID] = Field(
        min_length=1,
        description="Piezas sin descripción; como máximo `AI_BATCH_ENRICH_MAX_PIECES` (50 por "
        "defecto) [SUPUESTO AA1], si no 422 `batch_too_large`.",
    )


class SkippedPiece(BaseModel):
    piece_id: uuid.UUID
    reason: str = Field(
        description="Por ejemplo «ya tiene descripción» o «metadatos insuficientes»."
    )


class AiBatchOut(BaseModel):
    """State of an AI batch; each draft is a PENDING suggestion, never applied (RN-009)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000902",
                    "status": "RUNNING",
                    "processed": 12,
                    "skipped": [],
                    "suggestion_ids": [EX_SUGGESTION_ID],
                }
            ]
        }
    )

    id: uuid.UUID
    status: Literal["PENDING", "RUNNING", "DONE", "PARTIAL", "FAILED"]
    processed: int
    skipped: list[SkippedPiece] = Field(default_factory=list)
    suggestion_ids: list[uuid.UUID] = Field(default_factory=list)
