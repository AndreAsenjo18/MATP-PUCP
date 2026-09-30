"""Small reference schemas embedded in several responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.enums import (
    LOCATION_LEVEL_LABELS,
    PHOTO_VIEW_TYPE_LABELS,
    LocationLevelLabel,
    serialize_label,
)

# Fixed synthetic UUIDs used in OpenAPI examples (never real data).
EX_PIECE_ID = "01920000-0000-7000-8000-000000000101"
EX_COLLECTION_ID = "01920000-0000-7000-8000-000000000201"
EX_TERM_ID = "01920000-0000-7000-8000-000000000301"
EX_LOCATION_ID = "01920000-0000-7000-8000-000000000401"
EX_USER_ID = "01920000-0000-7000-8000-000000000501"
EX_BATCH_ID = "01920000-0000-7000-8000-000000000601"
EX_IDENTIFIER_ID = "01920000-0000-7000-8000-000000000701"
EX_MEDIA_ID = "01920000-0000-7000-8000-000000000801"
EX_SUGGESTION_ID = "01920000-0000-7000-8000-000000000901"
EX_DATETIME = "2026-09-17T10:30:00Z"


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TermRef(ORMModel):
    id: uuid.UUID
    code: str
    label: str


class CollectionRef(ORMModel):
    id: uuid.UUID
    name: str
    acronym: str | None = None


class LocationRef(ORMModel):
    id: uuid.UUID
    level: LocationLevelLabel = Field(
        description="Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor."
    )
    code: str
    name: str

    @field_validator("level", mode="before")
    @classmethod
    def _level_to_label(cls, value: object) -> str | None:
        """Traduce el código interno de nivel a la etiqueta del contrato (3.2)."""
        label = serialize_label(LOCATION_LEVEL_LABELS, value)  # type: ignore[arg-type]
        assert label is not None, "level es obligatorio en LocationRef"
        return label


def translate_view_term(term: "TermRef | None") -> "TermRef | None":
    """Traduce el código interno del tipo de vista a la etiqueta del contrato (3.2).

    Los códigos fuera del contrato (p. ej. `Superior`) conservan su código propio.
    """
    if term is None:
        return None
    code = PHOTO_VIEW_TYPE_LABELS.get(term.code, term.code)
    if code == term.code:
        return term
    return TermRef(id=term.id, code=code, label=term.label)


class UserRef(ORMModel):
    id: uuid.UUID
    full_name: str


class DeletionInfo(BaseModel):
    deleted_at: datetime | None = None
    deletion_reason: str | None = None


class Masked(BaseModel):
    masked_fields: list[str] = Field(
        default_factory=list,
        description="Campos sensibles omitidos por el rol de quien consulta (RF-041).",
    )
