"""API schemas of the normalization parameters and acronym aliases (spec identificacion-piezas:
RN-010, RF-023; change plantillas-mapeo-y-normalizacion, task 2.3, design D5)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME

NormalizationSettingKey = Literal["absence_markers", "concatenation_separators"]


class ConcatenationSeparators(BaseModel):
    separators: list[str] = Field(
        description="Caracteres que separan varios códigos de una celda (`/`, `;`, `|`, `,`, "
        "salto de línea…). No se admite el espacio."
    )
    unsplit_markers: list[str] = Field(
        default_factory=list,
        description="Marcadores que no se separan aunque lleven un separador (`S/N`, `S/C`).",
    )


class NormalizationSettingOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "key": "absence_markers",
                    "value": ["", "-", "S/N", "S/C", "SINCODIGO"],
                    "is_default": False,
                    "updated_at": EX_DATETIME,
                }
            ]
        }
    )

    key: NormalizationSettingKey
    value: list[str] | ConcatenationSeparators = Field(
        description="`absence_markers`: lista de marcadores (se comparan sin espacios ni "
        "mayúsculas). `concatenation_separators`: separadores y marcadores que no se separan."
    )
    is_default: bool = Field(
        description="true = no hay valor guardado y rige el valor del código [SUPUESTO A5, A8]."
    )
    updated_at: datetime | None


class NormalizationSettingUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"value": ["", "-", "S/N", "S/C", "NO REGISTRA"]}]}
    )

    value: list[str] | ConcatenationSeparators


class AcronymAliasCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"alias": "R.E.P.", "collection_id": "01920000-0000-7000-8000-000000000201"}
            ]
        }
    )

    alias: str = Field(min_length=1, max_length=40, description="Sigla histórica, como se escribe.")
    collection_id: uuid.UUID


class AcronymAliasOut(BaseModel):
    id: uuid.UUID
    alias: str
    alias_normalized: str = Field(description="Sin puntos ni espacios, en mayúsculas (`REP`).")
    collection_id: uuid.UUID
    collection_name: str
    collection_acronym: str | None
    created_at: datetime


def setting_value(value: Any) -> list[str] | ConcatenationSeparators:
    return ConcatenationSeparators.model_validate(value) if isinstance(value, dict) else value
