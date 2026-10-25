"""API schemas for search, reports and exports (spec busqueda-reportes; RF-031..RF-037, RF-044)."""

import enum
import uuid
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
                    "match_reason": {
                        "kind": "identifier",
                        "type": "I",
                        "original": "I-0236",
                        "historical": False,
                    },
                }
            ]
        }
    )

    piece: PieceSummary
    match_type: Literal["IDENTIFIER", "TITLE"] = Field(
        description="IDENTIFIER: coincide un cdigo (vigente o histrico); TITLE: la denominacin."
    )
    matched_identifier: CodeBrief | None = None
    match_reason: dict[str, Any] | None = Field(
        default=None,
        description="Detalle estructurado de la coincidencia (identificador o campos de texto).",
    )


class SearchResultPage(BaseModel):
    """Respuesta de `GET /search` (contrato `PieceSearchResponse`, RF-031/RF-032).

    A diferencia de `Page[T]` (usada por los dems listados, `{..., page_size}`), el contrato de
    `/search` pide el campo de tamao de pgina como `limit`  se modela aparte en vez de tocar
    la paginacin compartida que usan otros endpoints (`app/api/pagination.py`).
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "items": [SearchHit.model_config["json_schema_extra"]["examples"][0]],  # type: ignore[index]
                    "total": 1,
                    "page": 1,
                    "limit": 20,
                    "suggestions": ["remove_filter:collection_code"],
                    "excluded_uninterpreted_period": 0,
                }
            ]
        }
    )

    items: list[SearchHit]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    limit: int = Field(ge=1)
    suggestions: list[str] | None = Field(
        default=None,
        description="Sugerencias de accin cuando no hay resultados (RF-031).",
    )
    active_filters: list[dict[str, Any]] | None = Field(
        default=None,
        description="Filtros activos descritos en lenguaje claro.",
    )
    excluded_uninterpreted_period: int | None = Field(
        default=None,
        description="Piezas con poca solo en texto excluidas por filtro de rango (RF-032).",
    )


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
                    "title": "Inventario por coleccin",
                    "generated_at": EX_DATETIME,
                    "filters": {},
                    "columns": ["Coleccin", "Piezas", "Sin cdigo I"],
                    "rows": [["Coleccin MMZ (ficticia)", 54, 30]],
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
                    "id": "00000000-0000-0000-0000-000000000001",
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

    id: uuid.UUID | None = None
    status: Literal["PENDING", "RUNNING", "READY", "FAILED"]
    format: ExportFormat
    row_count: int | None = None
    download_url: str | None = None
    expires_at: datetime | None = None
    masked_fields: list[str] = Field(default_factory=list)
    sha256: str | None = None
    error: str | None = None
