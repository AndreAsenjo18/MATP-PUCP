"""API schemas for the import reconciliation pipeline (spec importacion-datos; RF-021..RF-029).

Ingestion, mapping, validation and preview are implemented (``importacion-pipeline-
reconciliacion`` 2.1, 3.1 and 3.4); decisions, approval, log and rollback are still stubs.
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
    ImportRow,
    RowClassification,
    RowDecision,
)

_COUNTS = {"rows": 120, "NEW": 70, "UPDATE": 35, "POSSIBLE_DUPLICATE": 10, "CONFLICT": 5}


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
    created_at: datetime

    @classmethod
    def from_batch(cls, batch: ImportBatch) -> "ImportBatchOut":
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
        "`identifier` (con `identifier_type_code`) o `identifier:<TIPO>`; null = datos de origen."
    )
    identifier_type_code: str | None = None
    split_compound: bool = Field(
        False,
        description="La celda puede tener varios códigos (N7); cada parte toma el tipo que se "
        "reconoce en ella.",
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
        None, description="Plantillas: pendiente de `plantillas-mapeo-y-normalizacion`."
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
        None, description="Plantillas: pendiente de `plantillas-mapeo-y-normalizacion`."
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

    @classmethod
    def from_row(cls, row: ImportRow) -> "ImportRowOut":
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


class RowDecisionRequest(BaseModel):
    decision: Literal["ACCEPTED", "EXCLUDED", "REJECTED"]
    reason: str | None = Field(None, description="Obligatorio para REJECTED (RF-028).")
    target_piece_id: uuid.UUID | None = None


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"confirm_counts": _COUNTS, "comment": "Revisado"}]}
    )

    confirm_counts: dict[str, int] = Field(
        description="Totales que la persona confirmó en pantalla (RNF-010, RF-027)."
    )
    comment: str | None = None


class ImportLogEntry(BaseModel):
    source_row_number: int
    classification: RowClassification | None
    decision: RowDecision
    reason: str | None
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
                            "reason": "Código I asignado a otra pieza.",
                            "target_piece_id": None,
                        }
                    ],
                    "download_url": None,
                }
            ]
        }
    )

    batch: dict[str, Any]
    applied_rows: int
    rejected_rows: int
    entries: list[ImportLogEntry]
    download_url: str | None = Field(None, description="Rechazos descargables en Excel.")


class RevertRequest(BaseModel):
    reason: str = Field(min_length=3)


class MappingTemplateOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000621",
                    "name": "Sábana consultoría (sintética)",
                    "source_name": "Consultoría 2024/25",
                    "header_signature": "a" * 64,
                    "columns": [{"source_column": "DENOMINACION", "target_field": "title"}],
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
    description: str | None
    created_at: datetime


class MappingTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=200)
    headers: list[str] = Field(min_length=1)
    columns: list[ColumnMapping]
    description: str | None = None
