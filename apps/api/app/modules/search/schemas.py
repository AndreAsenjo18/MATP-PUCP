"""API schemas for search, reports and exports (spec busqueda-reportes; RF-031..RF-037, RF-044)."""

import enum
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME
from app.modules.catalog.schemas import CodeBrief, PieceSummary


class SearchHit(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "piece": PieceSummary.model_config["json_schema_extra"]["examples"][0],  # type: ignore[index]
                    "match_type": "IDENTIFIER",
                    "matched_identifier": {
                        "identifier_type_code": "I",
                        "original_value": "I-0236",
                        "normalized_value": "I-236",
                    },
                }
            ]
        }
    )

    piece: PieceSummary
    match_type: Literal["IDENTIFIER", "TITLE"] = Field(
        description="IDENTIFIER: coincide un código (vigente o histórico); TITLE: la denominación."
    )
    matched_identifier: CodeBrief | None = None


class ReportType(enum.StrEnum):
    INVENTORY = "inventory"
    BY_COLLECTION = "by-collection"
    BY_LOCATION = "by-location"
    INCOMPLETE = "incomplete"
    VALUATION = "valuation"


class ExportFormat(enum.StrEnum):
    XLSX = "xlsx"
    CSV = "csv"


class ReportOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "report_type": "by-collection",
                    "title": "Inventario por colección",
                    "generated_at": EX_DATETIME,
                    "filters": {},
                    "columns": ["Colección", "Piezas", "Sin código I"],
                    "rows": [["Colección MMZ (ficticia)", 54, 30]],
                    "totals": {"Piezas": 298},
                    "download_url": None,
                }
            ]
        }
    )

    report_type: ReportType
    title: str
    generated_at: datetime
    filters: dict[str, Any]
    columns: list[str]
    rows: list[list[Any]]
    totals: dict[str, Any]
    download_url: str | None = None


class SearchExportRequest(BaseModel):
    """Exports the same result set as GET /pieces with the given filters (RF-036)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"filters": {"collection_id": None, "q": "MMZ"}, "format": "xlsx"}]
        }
    )

    filters: dict[str, Any] = Field(default_factory=dict)
    format: ExportFormat = ExportFormat.XLSX
    columns: list[str] | None = None


class ExportJob(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "status": "READY",
                    "format": "xlsx",
                    "row_count": 298,
                    "download_url": "http://localhost:9000/matp-media/exports/ejemplo.xlsx",
                    "expires_at": EX_DATETIME,
                    "masked_fields": ["lender_name"],
                }
            ]
        }
    )

    status: Literal["PENDING", "READY", "FAILED"]
    format: ExportFormat
    row_count: int | None
    download_url: str | None
    expires_at: datetime | None
    masked_fields: list[str] = Field(default_factory=list)
