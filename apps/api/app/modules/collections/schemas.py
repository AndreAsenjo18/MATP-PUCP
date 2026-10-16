"""API schemas for collections and vocabularies (spec colecciones-vocabularios)."""

import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.api.enums import TENURE_REGIME_LABELS, TenureRegimeLabel, code_of, serialize_label
from app.api.refs import EX_COLLECTION_ID, EX_DATETIME, EX_TERM_ID, ORMModel
from app.modules.catalog.enums import TenureRegime

_COLLECTION_EXAMPLE = {
    "id": EX_COLLECTION_ID,
    "code": "MMZ",
    "parent_id": None,
    "name": "Colección MMZ (ficticia)",
    "acronym": "M.M.Z.",
    "acronym_normalized": "MMZ",
    "description": "Colección sintética de demostración.",
    "default_tenure_regime": "Propiedad",
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
    code: str | None = Field(
        None, description="Código del contrato (`CollectionItem.code`): la sigla normalizada."
    )
    parent_id: uuid.UUID | None
    name: str
    acronym: str | None
    acronym_normalized: str | None
    description: str | None
    default_tenure_regime: TenureRegimeLabel = Field(
        description="Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal."
    )
    origin_description: str | None = Field(
        description="Origen o donante. Sensible: requiere sensitive.donor_data (RF-041)."
    )
    is_active: bool
    piece_count: int = Field(0, description="Piezas vigentes directamente en la colección.")
    created_at: datetime
    updated_at: datetime
    masked_fields: list[str] = Field(default_factory=list)

    @field_validator("default_tenure_regime", mode="before")
    @classmethod
    def _tenure_to_label(cls, value: object) -> str | None:
        """Emite la etiqueta en español del contrato aunque llegue el código interno."""
        return serialize_label(TENURE_REGIME_LABELS, value)  # type: ignore[arg-type]

    @model_validator(mode="after")
    def _code_from_acronym(self) -> Self:
        self.code = self.acronym_normalized
        return self


class CollectionCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "Colección de retablos (ficticia)",
                    "acronym": "R.A.",
                    "parent_id": None,
                    "default_tenure_regime": "Propiedad",
                }
            ]
        }
    )

    name: str = Field(min_length=1, max_length=300)
    acronym: str | None = Field(None, max_length=40)
    code: str | None = Field(
        None,
        max_length=40,
        description="Código del contrato (`CollectionItem.code`); equivale a `acronym`.",
    )
    parent_id: uuid.UUID | None = None
    default_tenure_regime: TenureRegimeLabel = Field(
        default="Propiedad",
        description="Régimen de tenencia en español: Propiedad, Comodato o Préstamo Temporal.",
    )
    description: str | None = None
    origin_description: str | None = None

    @field_validator("default_tenure_regime", mode="before")
    @classmethod
    def _tenure_from_label(cls, value: object) -> str | None:
        """Acepta la etiqueta del contrato (o el código interno) y devuelve la canónica."""
        if value is None:
            return None
        code = (
            value
            if isinstance(value, TenureRegime)
            else code_of(TENURE_REGIME_LABELS, str(value), "default_tenure_regime")
        )
        return TENURE_REGIME_LABELS[code]

    @model_validator(mode="after")
    def _acronym_from_code(self) -> Self:
        """`code` y `acronym` son la misma sigla; si llegan ambos deben coincidir."""
        if self.code is not None and self.acronym is not None and self.code != self.acronym:
            raise ValueError("`code` y `acronym` son la misma sigla: envíe solo uno.")
        if self.acronym is None:
            self.acronym = self.code
        return self


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
                    "parent_id": None,
                    "code": "REGULAR",
                    "name": "Regular",
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
    # Broader term (e.g. the craft line of a category); null at the root (RF-011).
    parent_id: uuid.UUID | None
    code: str
    name: str = Field(description="Nombre del contrato (`CollectionItem.name`): la etiqueta.")
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
    parent_id: uuid.UUID | None = Field(
        None, description="Término más general del mismo vocabulario; vacío en la raíz."
    )
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
