"""API schemas for data quality (spec calidad-datos; RF-019, RF-030, RF-035, RIA-02)."""

import uuid
from datetime import date, datetime
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


class DuplicateImportRowIdentifier(BaseModel):
    """A code of the spreadsheet row, as it came and normalized."""

    type: str
    original_value: str
    normalized_value: str | None = None


class DuplicateImportRowOut(BaseModel):
    """The spreadsheet row of a pair, to compare it in the queue.

    Change revisar-duplicados-comparacion. Only catalogue-like fields: never the lender, the
    recorder, the notes or the source record, which may hold personal data (RNF-014).
    """

    batch_id: uuid.UUID
    batch_name: str
    source_row_number: int
    denomination: str | None = None
    collection_name: str | None = None
    tenure_regime: str | None = None
    author: str | None = None
    provenance: str | None = None
    period_text: str | None = None
    dimensions_text: str | None = None
    identifiers: list[DuplicateImportRowIdentifier] = Field(default_factory=list)
    resolution: Literal["piece", "new"] | None = Field(
        default=None, description="Lo que ya decidió su lote: una pieza destino o una pieza nueva."
    )
    editable: bool = Field(description="El lote aún admite decisiones sobre sus filas.")


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
    import_row: DuplicateImportRowOut | None = Field(
        default=None,
        description="La fila del Excel de un par con fila de importación, para compararla.",
    )


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


# ------------------------------------------------- juicio con IA (change ia-juicio-duplicados)
class AiJudgmentStart(BaseModel):
    """Body of ``POST /quality/duplicates/ai-runs``: a new run, or one resumed (D7)."""

    resume_run_id: uuid.UUID | None = Field(
        None, description="Corrida que se reanuda: solo se juzgan sus pares aún sin veredicto."
    )


class AiRunGroupCounts(BaseModel):
    same: int = Field(ge=0, description="Gemini cree que son la misma pieza.")
    distinct: int = Field(ge=0, description="Gemini cree que son distintas (incluye las reglas).")
    unsure: int = Field(ge=0, description="Gemini no está seguro, o la persona los sacó.")
    by_rule: int = Field(ge=0, description="De las distintas, cuántas decidió una regla.")


class AiDuplicateRunOut(BaseModel):
    """An AI judgment of the queue (RIA-02): progress, failed batches and pending pairs by group.
    Nothing is applied until a person approves a group (RN-009)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000931",
                    "status": "SUCCEEDED",
                    "total_pairs": 102,
                    "processed_pairs": 102,
                    "failed_batches": 0,
                    "started_at": EX_DATETIME,
                    "finished_at": EX_DATETIME,
                    "error_message": None,
                    "groups": {"same": 41, "distinct": 46, "unsure": 15, "by_rule": 6},
                    "min_confidence": 0.85,
                    "can_resume": False,
                }
            ]
        }
    )

    id: uuid.UUID
    status: QualityJobStatus
    total_pairs: int = Field(ge=0)
    processed_pairs: int = Field(ge=0)
    failed_batches: int = Field(ge=0, description="Lotes sin respuesta de la IA; se reanudan.")
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    groups: AiRunGroupCounts
    min_confidence: float = Field(ge=0, le=1, description="Umbral de los grupos (RN-010).")
    can_resume: bool = Field(description="Quedan pares de la corrida sin veredicto.")


class AiVerdictOut(BaseModel):
    verdict: Literal["same", "distinct", "unsure"]
    confidence: float = Field(ge=0, le=1)
    reason: str
    source: Literal["rule", "ai", "review"] = Field(
        description="`rule`: lo decidió una regla; `ai`: la IA; `review`: una persona lo sacó "
        "de su grupo."
    )


class AiGroupPairOut(BaseModel):
    candidate: DuplicateCandidateOut
    verdict: AiVerdictOut
    ready_to_merge: bool | None = Field(
        None,
        description="Solo en «misma pieza» con dos piezas: se fusiona al aprobar sin elegir "
        "valores. `false` = hay que elegirlos en la revisión par por par.",
    )
    merge_blocker: str | None = Field(None, description="Por qué no se fusiona al aprobar.")


class AiGroupApproval(BaseModel):
    excluded_candidate_ids: list[uuid.UUID] = Field(
        default_factory=list, description="Pares que se sacan del grupo: vuelven a la revisión."
    )
    confirmed_sample_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Pares de la muestra al azar que la persona confirmó (obligatorio en «misma "
        "pieza», D6).",
    )


class AiSkippedPair(BaseModel):
    candidate_id: uuid.UUID
    reason: str


class AiGroupApprovalOut(BaseModel):
    group: Literal["same", "distinct"]
    resolved: int = Field(ge=0, description="Pares marcados como distintos.")
    merged: int = Field(ge=0, description="Pares de dos piezas fusionados.")
    rows_decided: int = Field(ge=0, description="Filas de Excel resueltas hacia su pieza.")
    excluded: int = Field(ge=0, description="Pares sacados del grupo.")
    needs_choice: int = Field(
        ge=0, description="Pares «misma pieza» que esperan la elección de valores."
    )
    skipped: list[AiSkippedPair] = Field(default_factory=list)
