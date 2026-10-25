"""API schemas for the import reconciliation pipeline (spec importacion-datos; RF-021..RF-029).

Implemented by ``importacion-pipeline-reconciliacion``: ingestion, mapping, validation,
preview, decisions, approval, log and embedded images. Rollback waits for the revert engine of
``auditoria-y-soft-delete-transversal`` (task 5.2).
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.pagination import Page
from app.api.refs import EX_BATCH_ID, EX_DATETIME, EX_PIECE_ID, EX_USER_ID
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchStatus,
    ImportImage,
    ImportImageStatus,
    ImportRow,
    RowClassification,
    RowDecision,
)

_COUNTS = {"rows": 120, "NEW": 70, "UPDATE": 35, "POSSIBLE_DUPLICATE": 10, "CONFLICT": 5}
_SUMMARY = {"create": 70, "update": 35, "skip": 15, "summary_token": "0" * 32}


class ApprovalSummaryOut(BaseModel):
    """What applying the batch would do now; approve with its ``summary_token`` (D6)."""

    create: int = Field(description="Filas que crearán una pieza nueva.")
    update: int = Field(description="Filas que actualizarán una pieza existente.")
    skip: int = Field(
        description="Filas que no se aplicarán (rechazadas, excluidas, con errores o sin resolver)."
    )
    summary_token: str = Field(description="Huella del resumen; se envía al aprobar.")


class ImportBatchOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_BATCH_ID,
                    "source_name": "Sábana consultoría 2024/25 (sintética)",
                    "file_name": "sabana_sintetica_v1.xlsx",
                    "file_sha256": "0" * 64,
                    "template_id": None,
                    "status": "IN_PREVIEW",
                    "status_reason": None,
                    "uploaded_by_id": EX_USER_ID,
                    "approved_by_id": None,
                    "approved_at": None,
                    "stage_timestamps": {"UPLOADED": EX_DATETIME},
                    "counts": _COUNTS,
                    "sheet_name": "SABANA",
                    "sheet_names": ["SABANA"],
                    "header_row": 1,
                    "headers": ["CÓDIGOS", "DENOMINACIÓN", "OBS. CONSULTORÍA"],
                    "mapping": None,
                    "processing": False,
                    "progress": None,
                    "approval_summary": _SUMMARY,
                    "created_at": EX_DATETIME,
                }
            ]
        }
    )

    id: uuid.UUID
    source_name: str
    file_name: str
    file_sha256: str | None
    template_id: uuid.UUID | None
    status: ImportBatchStatus
    status_reason: str | None
    uploaded_by_id: uuid.UUID | None
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    stage_timestamps: dict[str, Any] | None
    counts: dict[str, int] | None = Field(
        description="Filas leídas, filas vacías omitidas y, tras validar, filas por clasificación."
    )
    sheet_name: str | None = None
    sheet_names: list[str] = Field(default_factory=list, description="Hojas del libro.")
    header_row: int | None = None
    headers: list[str] = Field(default_factory=list, description="Cabeceras leídas del archivo.")
    mapping: dict[str, Any] | None = Field(None, description="Mapeo de columnas confirmado.")
    processing: bool = Field(False, description="Hay una etapa ejecutándose en segundo plano.")
    progress: dict[str, Any] | None = Field(
        None, description="Etapa en curso y avance: `{stage, done, total}` (RF-021)."
    )
    approval_summary: ApprovalSummaryOut | None = Field(
        None, description="Resumen para aprobar; solo en previsualización (RF-027, RNF-010)."
    )
    created_at: datetime

    @classmethod
    def from_batch(
        cls, batch: ImportBatch, approval: dict[str, Any] | None = None
    ) -> "ImportBatchOut":
        raw = batch.counts or {}
        return cls(
            id=batch.id,
            source_name=batch.source_name,
            file_name=batch.file_name,
            file_sha256=batch.file_sha256,
            template_id=batch.template_id,
            status=batch.status,
            status_reason=batch.status_reason,
            uploaded_by_id=batch.uploaded_by_id,
            approved_by_id=batch.approved_by_id,
            approved_at=batch.approved_at,
            stage_timestamps=batch.stage_timestamps,
            counts={
                key: value
                for key, value in raw.items()
                if isinstance(value, int) and not isinstance(value, bool)
            },
            sheet_name=batch.sheet_name,
            sheet_names=list(raw.get("sheet_names") or []),
            header_row=batch.header_row,
            headers=list(raw.get("headers") or []),
            mapping=batch.mapping,
            processing=batch.processing_started_at is not None,
            progress=raw.get("progress"),
            approval_summary=ApprovalSummaryOut(**approval) if approval else None,
            created_at=batch.created_at,
        )


class ImportBatchCounters(BaseModel):
    """Counters of ``ImportBatchSummary.summary`` (contract ``endpoints-api-v1.yaml``)."""

    new_records: int
    updates: int
    conflicts: int


class ImportBatchSummary(BaseModel):
    """Response of ``POST /imports/upload`` as the team contract defines it (task 4.4, D8).

    How the four row classifications map to the three counters (I7) and the Spanish values of
    ``status`` (I8) stay open until ``importacion-pipeline-reconciliacion``.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "batch_id": EX_BATCH_ID,
                    "filename": "sabana_sintetica_v1.xlsx",
                    "total_rows": 120,
                    "summary": {"new_records": 70, "updates": 35, "conflicts": 5},
                    "status": None,
                }
            ]
        }
    )

    batch_id: uuid.UUID
    filename: str
    total_rows: int
    summary: ImportBatchCounters = Field(
        description="Agrupación de NEW, UPDATE, POSSIBLE_DUPLICATE y CONFLICT pendiente (I7)."
    )
    status: str | None = Field(
        None,
        description="Estado del lote con el código interno (`UPLOADED`, `FAILED_INGESTION`…); "
        "los valores en español siguen pendientes (I8).",
    )

    @classmethod
    def from_batch(cls, batch: ImportBatch) -> "ImportBatchSummary":
        counts = batch.counts or {}
        return cls(
            batch_id=batch.id,
            filename=batch.file_name,
            total_rows=int(counts.get("rows", 0)),
            summary=ImportBatchCounters(
                new_records=int(counts.get(RowClassification.NEW.value, 0)),
                updates=int(counts.get(RowClassification.UPDATE.value, 0)),
                conflicts=int(counts.get(RowClassification.CONFLICT.value, 0)),
            ),
            status=batch.status.value,
        )


class ColumnMapping(BaseModel):
    source_column: str = Field(description="Encabezado tal como aparece en el Excel.")
    target_field: str | None = Field(
        description="Campo de la ficha (`denomination`, `tenure_regime`, `collection`…), "
        "`identifier` (con `identifier_type_code`), `identifier:<TIPO>` o "
        "`terms:<VOCABULARIO>`; null = datos de origen."
    )
    identifier_type_code: str | None = None
    split_compound: bool = Field(
        False,
        description="La celda puede tener varios códigos (N7); cada parte toma el tipo que se "
        "reconoce en ella.",
    )
    transforms: list[str] = Field(
        default_factory=list,
        description="Transformaciones en orden (`trim`, `split:,`, `date:dd/mm/yyyy`…). Con "
        "transformaciones, correspondencias o destino `terms:` el mapeo del lote se guarda en "
        "la versión 1 (design D1).",
    )
    value_map: dict[str, str] | None = Field(
        None,
        description="Texto de origen → código de término, para la transformación `value_map`.",
    )


class MappingRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "template_id": None,
                    "sheet_name": "Hoja1",
                    "header_row": 1,
                    "columns": [
                        {
                            "source_column": "N° INVENTARIO",
                            "target_field": "identifier",
                            "identifier_type_code": "I",
                            "split_compound": True,
                        },
                        {"source_column": "DENOMINACION", "target_field": "denomination"},
                    ],
                    "defaults": {"tenure_regime": "Propiedad"},
                }
            ]
        }
    )

    template_id: uuid.UUID | None = Field(
        None,
        description="Plantilla guardada que define el mapeo (sin `columns`); `defaults` se "
        "aplican sobre los de la plantilla.",
    )
    sheet_name: str | None = Field(None, description="Otra hoja: se vuelve a leer el archivo.")
    header_row: int | None = Field(
        None, ge=1, description="Otra fila de cabeceras: se vuelve a leer el archivo."
    )
    columns: list[ColumnMapping] = Field(default_factory=list)
    defaults: dict[str, str] = Field(
        default_factory=dict,
        description="Valor para las filas sin dato: `tenure_regime` (Propiedad, Comodato, "
        "Préstamo Temporal) y `collection` (sigla).",
    )
    save_as_template_name: str | None = Field(
        None, description="Aún no disponible: cree la plantilla con `POST /import-templates`."
    )


class ValidationSummary(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "batch_id": EX_BATCH_ID,
                    "status": "VALIDATED",
                    "counts": _COUNTS,
                    "rows_with_errors": 7,
                    "unparseable_codes": 3,
                }
            ]
        }
    )

    batch_id: uuid.UUID
    status: ImportBatchStatus
    counts: dict[str, int]
    rows_with_errors: int
    unparseable_codes: int


class FieldDiff(BaseModel):
    field: str = Field(description="Campo de la ficha o `identifier:<TIPO>` (códigos nuevos).")
    current_value: Any | None
    incoming_value: Any | None
    default_action: Literal["accept", "keep"] | None = Field(
        None, description="`keep` cuando el archivo trae el campo vacío [SUPUESTO B10]."
    )


class ImportImageOut(BaseModel):
    """Image extracted from the workbook, pending until a person associates it (RF-029)."""

    id: uuid.UUID
    image_number: int
    anchor_row_number: int | None = Field(description="Fila del Excel donde está anclada.")
    import_row_id: uuid.UUID | None = Field(
        description="Fila del lote propuesta; null = bandeja sin asignar."
    )
    status: ImportImageStatus
    content_type: str
    size_bytes: int
    media_asset_id: uuid.UUID | None = Field(None, description="Foto registrada al asociarla.")
    preview_url: str | None = Field(None, description="URL temporal para ver la imagen.")

    @classmethod
    def from_image(cls, image: ImportImage, preview_url: str | None = None) -> "ImportImageOut":
        return cls(
            id=image.id,
            image_number=image.image_number,
            anchor_row_number=image.anchor_row_number,
            import_row_id=image.import_row_id,
            status=image.status,
            content_type=image.content_type,
            size_bytes=image.size_bytes,
            media_asset_id=image.media_asset_id,
            preview_url=preview_url,
        )


class ImportRowOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000611",
                    "batch_id": EX_BATCH_ID,
                    "source_row_number": 14,
                    "raw_data": {"N° INVENTARIO": "I 2362 / RA 28", "DENOMINACION": "Retablo"},
                    "mapped_data": {"fields": {"denomination": "Retablo ayacuchano"}},
                    "classification": "UPDATE",
                    "has_validation_errors": False,
                    "validation_errors": [],
                    "matches": [
                        {
                            "kind": "piece",
                            "piece_id": EX_PIECE_ID,
                            "identifiers": [
                                {"identifier_type": "I", "value": "I-2362", "via": "current"}
                            ],
                            "contradicts": [],
                        }
                    ],
                    "diff": [
                        {
                            "field": "denomination",
                            "current_value": "Retablo",
                            "incoming_value": "Retablo ayacuchano",
                            "default_action": "accept",
                        }
                    ],
                    "decision": "PENDING",
                    "decision_reason": None,
                    "target_piece_id": EX_PIECE_ID,
                    "resolution": None,
                    "action": "UPDATE",
                    "images": [],
                }
            ]
        }
    )

    id: uuid.UUID
    batch_id: uuid.UUID
    source_row_number: int
    raw_data: dict[str, Any]
    mapped_data: dict[str, Any] | None
    classification: RowClassification | None
    has_validation_errors: bool = False
    validation_errors: list[dict[str, Any]]
    matches: list[dict[str, Any]]
    diff: list[FieldDiff]
    decision: RowDecision
    decision_reason: str | None
    target_piece_id: uuid.UUID | None
    resolution: dict[str, Any] | None = Field(
        None,
        description="Resolución de una persona: `target_piece_id` o `as_new`, "
        "`field_decisions`, `decided_by_id`, `decided_at`.",
    )
    action: Literal["CREATE", "UPDATE", "SKIP"] | None = Field(
        None, description="Qué hará la aplicación del lote con la fila."
    )
    images: list[ImportImageOut] = Field(
        default_factory=list, description="Imágenes ancladas en la fila (RF-029)."
    )

    @classmethod
    def from_row(
        cls,
        row: ImportRow,
        *,
        action: str | None = None,
        images: list[ImportImageOut] | None = None,
    ) -> "ImportRowOut":
        return cls(
            id=row.id,
            batch_id=row.batch_id,
            source_row_number=row.source_row_number,
            raw_data=row.raw_data,
            mapped_data=row.mapped_data,
            classification=row.classification,
            has_validation_errors=row.has_validation_errors,
            validation_errors=row.validation_errors or [],
            matches=row.matches or [],
            diff=[
                FieldDiff(
                    field=name,
                    current_value=change.get("current"),
                    incoming_value=change.get("incoming"),
                    default_action=change.get("default_action"),
                )
                for name, change in (row.diff or {}).items()
            ],
            decision=row.decision,
            decision_reason=row.decision_reason,
            target_piece_id=row.target_piece_id,
            resolution=row.resolution,
            action=action,
            images=images or [],
        )


class ClassificationRule(BaseModel):
    order: int
    result: str = Field(description="Clasificación resultante o `validation_errors`.")
    description: str
    threshold: float | None = None


class ImportDiffsPage(Page[ImportRowOut]):
    """Preview of a batch: rows with their diff plus the rules that classified them (RF-025)."""

    classification_rules: list[ClassificationRule] = Field(
        description="Reglas y umbrales usados para clasificar las filas, en orden de evaluación."
    )
    unassigned_images: list[ImportImageOut] = Field(
        default_factory=list,
        description="Bandeja de imágenes sin fila: ancladas en filas sin datos (RF-029).",
    )


class RowDecisionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "decision": "ACCEPTED",
                    "reason": None,
                    "target_piece_id": EX_PIECE_ID,
                    "as_new": False,
                    "field_decisions": {"provenance": "accept", "author": "exclude"},
                }
            ]
        }
    )

    decision: Literal["ACCEPTED", "EXCLUDED", "REJECTED"]
    reason: str | None = Field(None, description="Obligatorio para REJECTED (RF-028).")
    target_piece_id: uuid.UUID | None = Field(
        None, description="Conflicto o posible duplicado: la fila actualiza esta pieza."
    )
    as_new: bool = Field(
        False, description="Conflicto o posible duplicado: la fila crea una pieza nueva."
    )
    field_decisions: dict[str, Literal["accept", "exclude"]] = Field(
        default_factory=dict,
        description="Por campo del diff: aceptar el valor entrante o conservar el actual.",
    )


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "summary_token": "0" * 32,
                    "confirm_counts": {"create": 70, "update": 35, "skip": 15},
                    "comment": "Revisado",
                }
            ]
        }
    )

    summary_token: str = Field(
        description="`approval_summary.summary_token` del resumen mostrado (RF-027, RNF-010)."
    )
    confirm_counts: dict[str, int] | None = Field(
        None, description="Totales que la persona confirmó en pantalla (informativo)."
    )
    comment: str | None = None


class ImageAssociateRequest(BaseModel):
    piece_id: uuid.UUID | None = Field(
        None,
        description="Pieza de destino; por defecto, la de la fila donde está anclada la imagen.",
    )
    view_type_term_id: uuid.UUID | None = None


class ImportLogEntry(BaseModel):
    source_row_number: int
    classification: RowClassification | None
    decision: RowDecision
    action: Literal["CREATE", "UPDATE", "SKIP"]
    reason: str | None
    resolution: dict[str, Any] | None = None
    target_piece_id: uuid.UUID | None


class ImportLog(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "batch": {"id": EX_BATCH_ID, "status": "APPLIED"},
                    "applied_rows": 105,
                    "rejected_rows": 15,
                    "entries": [
                        {
                            "source_row_number": 20,
                            "classification": "CONFLICT",
                            "decision": "REJECTED",
                            "action": "SKIP",
                            "reason": "Código I asignado a otra pieza.",
                            "resolution": None,
                            "target_piece_id": None,
                        }
                    ],
                    "download_url": f"/api/v1/imports/{EX_BATCH_ID}/log?format=xlsx",
                }
            ]
        }
    )

    batch: dict[str, Any] = Field(
        description="Archivo, hoja, mapeo, cargador, aprobador, marcas por etapa y conteos."
    )
    applied_rows: int | None = Field(description="Solo en lotes aplicados o revertidos.")
    rejected_rows: int | None = Field(
        description="Filas no aplicadas; null si el lote no llegó a leer filas."
    )
    entries: list[ImportLogEntry] = Field(
        description="Filas no aplicadas con su motivo y filas resueltas por una persona."
    )
    download_url: str | None = Field(None, description="La misma bitácora en Excel.")


class RevertRequest(BaseModel):
    reason: str = Field(min_length=3)
    confirm_conflicts: bool = Field(
        default=False,
        description="Revertir también los campos editados después de aplicar el lote. Sin "
        "esta confirmación, una edición posterior responde 409 `revert_has_conflicts` con la "
        "lista de conflictos (design D7).",
    )


class MappingTemplateOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000621",
                    "name": "Sábana consultoría (sintética)",
                    "source_name": "Consultoría 2024/25",
                    "header_signature": "a" * 64,
                    "columns": [{"source_column": "DENOMINACION", "target_field": "denomination"}],
                    "description": None,
                    "created_at": EX_DATETIME,
                }
            ]
        }
    )

    id: uuid.UUID
    name: str
    source_name: str
    header_signature: str
    columns: list[ColumnMapping]
    defaults: dict[str, str] = Field(
        default_factory=dict,
        description="Valores por defecto: `tenure_regime` (Propiedad, Comodato, Préstamo "
        "Temporal), `collection` (sigla) y `denomination`.",
    )
    description: str | None
    created_at: datetime


class MappingTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=200)
    headers: list[str] = Field(min_length=1)
    columns: list[ColumnMapping]
    defaults: dict[str, str] = Field(
        default_factory=dict,
        description="Valor para las filas sin dato: `tenure_regime` (Propiedad, Comodato, "
        "Préstamo Temporal), `collection` (sigla) y `denomination`.",
    )
    description: str | None = None


class MappingTemplateUpdate(BaseModel):
    """Partial edit; ``headers`` and ``columns`` go together, because the mapping is validated
    against the headers and the signature is computed from them (design D3)."""

    name: str | None = Field(None, min_length=1, max_length=200)
    source_name: str | None = Field(None, min_length=1, max_length=200)
    headers: list[str] | None = Field(None, min_length=1)
    columns: list[ColumnMapping] | None = None
    defaults: dict[str, str] | None = Field(
        None, description="Se envían con `headers` y `columns`; sin ellos se conservan."
    )
    description: str | None = None


class TemplateSuggestRequest(BaseModel):
    headers: list[str] = Field(min_length=1, description="Cabeceras del archivo, tal como vienen.")


class TemplateSuggestion(BaseModel):
    template: MappingTemplateOut
    score: float = Field(
        ge=0, le=1, description="1 = mismas cabeceras (en cualquier orden y con otras tildes)."
    )
    missing_columns: list[str] = Field(
        description="Columnas de la plantilla que el archivo no trae."
    )
    new_columns: list[str] = Field(
        description="Cabeceras del archivo que la plantilla no mapea: irán a los datos de origen."
    )


# --- Vista previa de normalización por columna (design D4) ---------------------------------


class TemplateDryRunRequest(BaseModel):
    batch_id: uuid.UUID = Field(description="Lote subido o mapeado del que se toma la muestra.")


class DryRunTraceStep(BaseModel):
    transform: str
    before: Any
    after: Any
    note: str | None = Field(
        None,
        description="`excel_date_cell` (celda de fecha de Excel, exenta del formato) o "
        "`not_recognized` (la propuesta no reconoció el texto).",
    )


class DryRunIdentifier(BaseModel):
    type_code: str
    original_value: str
    normalized_value: str | None
    status: Literal["NORMALIZED", "UNPARSEABLE"]
    is_absent: bool


class DryRunExample(BaseModel):
    source_row_number: int
    status: Literal["NORMALIZED", "UNPARSEABLE", "ABSENT", "SPLIT_PROPOSED"]
    original: Any = Field(description="La celda tal como viene en el archivo.")
    value: Any = Field(description="El valor después de las transformaciones.")
    trace: list[DryRunTraceStep] = Field(description="Cada transformación con su antes y después.")
    proposals: dict[str, Any] = Field(
        description="Campos propuestos (`epoch_*`, `dimensions`); nunca reemplazan el texto."
    )
    identifiers: list[DryRunIdentifier] = Field(description="Solo en columnas de identificadores.")
    matched_terms: dict[str, str] = Field(
        description="Valor → código de término; solo en columnas `terms:<VOCABULARIO>`."
    )
    unmatched_terms: list[str] = Field(
        description="Valores sin término; irían a los datos de origen de la fila."
    )
    errors: list[str]


class DryRunUnmatchedValue(BaseModel):
    value: str
    count: int = Field(description="Apariciones en la muestra.")


class DryRunColumn(BaseModel):
    mapping: ColumnMapping
    in_file: bool = Field(description="false si el lote no trae esta columna de la plantilla.")
    counts: dict[Literal["NORMALIZED", "UNPARSEABLE", "ABSENT", "SPLIT_PROPOSED"], int] = Field(
        description="Celdas no vacías de la muestra por estado: `NORMALIZED` y `UNPARSEABLE` "
        "(estados de normalización), `ABSENT` (marcador de ausencia como `S/N`) y "
        "`SPLIT_PROPOSED` (se propone separar la celda en varios valores)."
    )
    empty: int = Field(description="Celdas vacías de la muestra.")
    unmatched_values: list[DryRunUnmatchedValue] = Field(
        description="Valores sin término del vocabulario, los 20 más frecuentes [SUPUESTO T4]."
    )
    examples: list[DryRunExample] = Field(
        description="Hasta 5 celdas: primero una de cada estado, luego en orden de fila."
    )


class TemplateDryRunOut(BaseModel):
    template_id: uuid.UUID
    batch_id: uuid.UUID
    total_rows: int = Field(description="Filas leídas del lote.")
    sampled_rows: int = Field(description="Filas de la muestra: hasta 200 [SUPUESTO T3].")
    missing_columns: list[str] = Field(description="Columnas de la plantilla ausentes del lote.")
    columns: list[DryRunColumn]
