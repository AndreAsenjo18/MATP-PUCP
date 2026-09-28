"""API schemas for collections and vocabularies (spec colecciones-vocabularios)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_COLLECTION_ID, EX_DATETIME, EX_TERM_ID, ORMModel
from app.modules.catalog.enums import TenureRegime

_COLLECTION_EXAMPLE = {
    "id": EX_COLLECTION_ID,
    "parent_id": None,
    "name": "Colección MMZ (ficticia)",
    "acronym": "M.M.Z.",
    "acronym_normalized": "MMZ",
    "description": "Colección sintética de demostración.",
    "default_tenure_regime": "OWNED",
    "origin_description": None,
    "is_active": True,
    "piece_count": 54,
    "created_at": EX_DATETIME,
    "updated_at": EX_DATETIME,
    "masked_fields": ["origin_description"],
}


class CollectionOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True, json_schema_extra={"examples": [_COLLECTION_EXAMPLE]}
    )

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    acronym: str | None
    acronym_normalized: str | None
    description: str | None
    default_tenure_regime: TenureRegime
    origin_description: str | None = Field(
        description="Origen o donante. Sensible: requiere sensitive.donor_data (RF-041)."
    )
    is_active: bool
    piece_count: int = Field(0, description="Piezas vigentes directamente en la colección.")
    created_at: datetime
    updated_at: datetime
    masked_fields: list[str] = Field(default_factory=list)


class CollectionCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "Colección de retablos (ficticia)",
                    "acronym": "R.A.",
                    "parent_id": None,
                    "default_tenure_regime": "OWNED",
                }
            ]
        }
    )

    name: str = Field(min_length=1, max_length=300)
    acronym: str | None = Field(None, max_length=40)
    parent_id: uuid.UUID | None = None
    default_tenure_regime: TenureRegime = TenureRegime.OWNED
    description: str | None = None
    origin_description: str | None = None


class CollectionUpdate(BaseModel):
    """Only the fields sent are changed. ``parent_id: null`` moves it to the root."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"description": "Descripción revisada (sintética)."}]}
    )

    name: str | None = Field(None, min_length=1, max_length=300)
    acronym: str | None = Field(None, max_length=40)
    parent_id: uuid.UUID | None = None
    description: str | None = None
    origin_description: str | None = None
    is_active: bool | None = None


class VocabularyOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000311",
                    "code": "CONSERVATION_STATUS",
                    "name": "Estados de conservación",
                    "description": None,
                    "term_count": 4,
                }
            ]
        },
    )

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    term_count: int = 0


class VocabularyCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60, pattern=r"^[A-Z][A-Z0-9_]*$")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class TermOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": EX_TERM_ID,
                    "vocabulary_code": "CONSERVATION_STATUS",
                    "code": "REGULAR",
                    "label": "Regular",
                    "description": None,
                    "sort_order": 2,
                    "is_active": True,
                    "external_uri": None,
                }
            ]
        },
    )

    id: uuid.UUID
    vocabulary_code: str
    code: str
    label: str
    description: str | None
    sort_order: int
    is_active: bool
    external_uri: str | None


class TermCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"code": "FRAGMENTADO", "label": "Fragmentado"}]}
    )

    code: str = Field(min_length=1, max_length=80, pattern=r"^[A-Z0-9][A-Z0-9_]*$")
    label: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = 0
    external_uri: str | None = Field(None, max_length=500)


class TermUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"is_active": False}]})

    label: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = Field(
        None, description="Desactivar: sigue asignado a piezas existentes pero no se ofrece."
    )
    external_uri: str | None = Field(None, max_length=500)
