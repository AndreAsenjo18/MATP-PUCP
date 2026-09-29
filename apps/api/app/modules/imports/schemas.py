"""API schemas for the import reconciliation pipeline (spec importacion-datos; RF-021..RF-029).

Contract only: the operations are stubs until ``importacion-pipeline-reconciliacion`` and
``plantillas-mapeo-y-normalizacion``.
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_BATCH_ID, EX_DATETIME, EX_PIECE_ID, EX_USER_ID
from app.modules.imports.models import ImportBatchStatus, RowClassification, RowDecision

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
    counts: dict[str, int] | None
    created_at: datetime


class ColumnMapping(BaseModel):
    source_column: str = Field(description="Encabezado tal como aparece en el Excel.")
    target_field: str | None = Field(
        description="Campo de la ficha o identificador (p. ej. identifier:I); null = payload."
    )
    identifier_type_code: str | None = None
    split_compound: bool = Field(False, description="La celda puede tener varios códigos (N7).")


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
                        {"source_column": "DENOMINACION", "target_field": "title"},
                    ],
                    "save_as_template_name": "Sábana consultoría (sintética)",
                }
            ]
        }
    )

    template_id: uuid.UUID | None = None
    sheet_name: str | None = None
    header_row: int = Field(1, ge=1)
    columns: list[ColumnMapping] = Field(default_factory=list)
    save_as_template_name: str | None = None


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
    field: str
    current_value: Any | None
    incoming_value: Any | None


class ImportRowOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000611",
                    "batch_id": EX_BATCH_ID,
                    "source_row_number": 14,
                    "raw_data": {"N° INVENTARIO": "I 2362 / RA 28", "DENOMINACION": "Retablo"},
                    "mapped_data": {"title": "Retablo"},
                    "classification": "UPDATE",
                    "validation_errors": [],
                    "matches": [{"piece_id": EX_PIECE_ID, "matched_by": "I-2362"}],
                    "diff": [
                        {"field": "title", "current_value": "Retablo", "incoming_value": "Retablo"}
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
    validation_errors: list[dict[str, Any]]
    matches: list[dict[str, Any]]
    diff: list[FieldDiff]
    decision: RowDecision
    decision_reason: str | None
    target_piece_id: uuid.UUID | None


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
