"""API schemas for the piece record sheet (spec catalogo-piezas; RF-005..RF-009, RF-043)."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import (
    EX_COLLECTION_ID,
    EX_DATETIME,
    EX_LOCATION_ID,
    EX_PIECE_ID,
    EX_TERM_ID,
    CollectionRef,
    ORMModel,
    TermRef,
)
from app.modules.catalog.enums import PeriodType, TenureRegime
from app.modules.identification.schemas import IdentifierOut
from app.modules.locations.schemas import PieceLocation

PieceSort = Literal["title", "-title", "created_at", "-created_at"]

_COLLECTION_REF = {"id": EX_COLLECTION_ID, "name": "Colección MMZ (ficticia)", "acronym": "M.M.Z."}
_STATUS_REF = {"id": EX_TERM_ID, "code": "REGULAR", "label": "Regular"}
_CATEGORY_REF = {
    "id": "01920000-0000-7000-8000-000000000302",
    "code": "CERAMICA",
    "label": "Cerámica",
}
_CODE_EXAMPLE = {
    "identifier_type_code": "I",
    "original_value": "I-0236",
    "normalized_value": "I-236",
}


class Period(BaseModel):
    """Period as written plus its optional structured interpretation (RF-007)."""

    text: str | None = Field(None, description='Texto original, p. ej. "ca. 1950" o "s. XX".')
    type: PeriodType | None = None
    year_from: int | None = None
    year_to: int | None = None


class Dimension(BaseModel):
    dimension: str = Field(description="alto, ancho, profundidad, diámetro… [SUPUESTO]")
    value: float = Field(ge=0)
    unit: str = Field("cm", max_length=10)


class CodeBrief(BaseModel):
    identifier_type_code: str
    original_value: str
    normalized_value: str | None


class PieceChildLink(BaseModel):
    """Vincula una pieza existente como componente de un conjunto (contrato fase 2; RF-009)."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"child_piece_id": EX_PIECE_ID}]})

    child_piece_id: uuid.UUID = Field(description="Pieza que pasa a ser componente del conjunto.")


class PieceSummary(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_PIECE_ID,
                    "title": "Vasija ceremonial (sintética)",
                    "collection": _COLLECTION_REF,
                    "tenure_regime": "OWNED",
                    "inventory_code": "I-0236",
                    "codes": [_CODE_EXAMPLE],
                    "category": _CATEGORY_REF,
                    "conservation_status": _STATUS_REF,
                    "period_text": "ca. 1950",
                    "location_label": "Sede 1 (ficticia) › Depósito A (ficticio)",
                    "media_count": 2,
                    "has_location": True,
                    "updated_at": EX_DATETIME,
                }
            ]
        }
    )

    id: uuid.UUID
    title: str
    collection: CollectionRef | None
    tenure_regime: TenureRegime
    inventory_code: str | None = Field(description="Código I vigente tal como está escrito.")
    codes: list[CodeBrief] = Field(description="Identificadores vigentes.")
    category: TermRef | None
    conservation_status: TermRef | None
    period_text: str | None
    location_label: str | None = Field(
        description="Ruta de ubicación (sin niveles restringidos para el rol)."
    )
    media_count: int
    has_location: bool
    updated_at: datetime


class PieceDetail(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_PIECE_ID,
                    "title": "Vasija ceremonial (sintética)",
                    "description": "Descripción sintética de demostración.",
                    "collection": _COLLECTION_REF,
                    "tenure_regime": "LOAN_FOR_USE",
                    "legal_owner": None,
                    "lender_name": None,
                    "loan_agreement_ref": None,
                    "temporary_inventory_number": None,
                    "acquisition_method": None,
                    "entry_date": "1998-05-12",
                    "author": "Autor anónimo",
                    "provenance": "Ayacucho (sintético)",
                    "period": {
                        "text": "ca. 1950",
                        "type": "APPROXIMATE",
                        "year_from": 1945,
                        "year_to": 1955,
                    },
                    "object_type": None,
                    "category": _CATEGORY_REF,
                    "materials": [],
                    "dimensions_text": "35 x 20 cm",
                    "dimensions": [{"dimension": "alto", "value": 35, "unit": "cm"}],
                    "conservation_status": _STATUS_REF,
                    "recorded_by": "Registrador sintético",
                    "notes": None,
                    "parent_piece_id": None,
                    "availability": None,
                    "location": {
                        "location_id": EX_LOCATION_ID,
                        "path": [],
                        "is_exact": False,
                    },
                    "identifiers": [],
                    "inventory_code": None,
                    "media_count": 0,
                    "created_at": EX_DATETIME,
                    "updated_at": EX_DATETIME,
                    "masked_fields": ["lender_name", "loan_agreement_ref", "location.path"],
                }
            ]
        }
    )

    id: uuid.UUID
    title: str
    description: str | None
    collection: CollectionRef | None
    tenure_regime: TenureRegime
    legal_owner: str | None
    lender_name: str | None = Field(description="Comodante. Sensible (RF-041).")
    loan_agreement_ref: str | None = Field(description="Contrato de comodato. Sensible (RF-041).")
    temporary_inventory_number: str | None
    acquisition_method: TermRef | None
    entry_date: date | None
    author: str | None
    provenance: str | None
    period: Period
    object_type: TermRef | None
    category: TermRef | None
    materials: list[TermRef]
    dimensions_text: str | None
    dimensions: list[Dimension] | None
    conservation_status: TermRef | None
    recorded_by: str | None
    notes: str | None
    parent_piece_id: uuid.UUID | None
    availability: TermRef | None
    location: PieceLocation
    identifiers: list[IdentifierOut] = Field(description="Identificadores vigentes.")
    inventory_code: str | None
    media_count: int
    created_at: datetime
    updated_at: datetime
    masked_fields: list[str] = Field(default_factory=list)


class PieceWrite(BaseModel):
    description: str | None = None
    collection_id: uuid.UUID | None = None
    lender_name: str | None = None
    loan_agreement_ref: str | None = None
    temporary_inventory_number: str | None = None
    acquisition_method_term_id: uuid.UUID | None = None
    entry_date: date | None = None
    author: str | None = None
    provenance: str | None = None
    period: Period | None = None
    object_type_term_id: uuid.UUID | None = None
    category_term_id: uuid.UUID | None = None
    material_term_ids: list[uuid.UUID] | None = None
    dimensions_text: str | None = None
    dimensions: list[Dimension] | None = None
    conservation_status_term_id: uuid.UUID | None = None
    recorded_by: str | None = None
    notes: str | None = None
    parent_piece_id: uuid.UUID | None = None
    availability_term_id: uuid.UUID | None = None


class PieceCreate(PieceWrite):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "title": "Retablo de San Marcos (sintético)",
                    "tenure_regime": "OWNED",
                    "collection_id": EX_COLLECTION_ID,
                    "period": {"text": "s. XX"},
                    "identifiers": [{"identifier_type_code": "COLECCION", "value": "RA 28"}],
                }
            ]
        }
    )

    title: str = Field(min_length=1, max_length=500)
    tenure_regime: TenureRegime
    identifiers: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Identificadores iniciales ({identifier_type_code, value, source}).",
    )


class PieceUpdate(PieceWrite):
    """Only the fields sent are changed; codes are managed in /identifiers."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"notes": "Revisado (sintético)"}]})

    title: str | None = Field(None, min_length=1, max_length=500)


class FieldIssue(BaseModel):
    field: str
    code: str
    message: str
    severity: Literal["error", "warning"]


class PieceValidationResult(BaseModel):
    """Real-time validation of the manual form (RF-043)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "is_valid": False,
                    "issues": [
                        {
                            "field": "identifiers[0].value",
                            "code": "inventory_code_not_allowed",
                            "message": "Una pieza en comodato no puede recibir código I (RN-003).",
                            "severity": "error",
                        }
                    ],
                }
            ]
        }
    )

    is_valid: bool
    issues: list[FieldIssue]


class SourceRecordOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000111",
                    "piece_id": EX_PIECE_ID,
                    "import_batch_id": None,
                    "source_name": "Sábana consultoría 2024/25 (sintética)",
                    "source_file_name": "sabana_sintetica_v1.xlsx",
                    "source_row_number": 12,
                    "payload": {"OBSERVACIONES 2": "Revisado 2019 (sintético)"},
                    "recorded_at": EX_DATETIME,
                }
            ]
        },
    )

    id: uuid.UUID
    piece_id: uuid.UUID
    import_batch_id: uuid.UUID | None
    source_name: str
    source_file_name: str | None
    source_row_number: int | None
    payload: dict[str, Any] = Field(description="Columnas de origen sin mapeo (RF-008).")
    recorded_at: datetime


class DeletionRequest(BaseModel):
    reason: str = Field(min_length=3, description="Motivo obligatorio (RN-005).")
