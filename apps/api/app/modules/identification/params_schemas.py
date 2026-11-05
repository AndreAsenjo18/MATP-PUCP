"""API schemas of the normalization parameters and acronym aliases (spec identificacion-piezas:
RN-010, RF-023; change plantillas-mapeo-y-normalizacion, task 2.3, design D5)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.enums import TENURE_REGIME_LABELS
from app.api.refs import EX_DATETIME
from app.modules.catalog.enums import TenureRegime

NormalizationSettingKey = Literal[
    "absence_markers", "concatenation_separators", "tenure_aliases", "photo_camera_patterns"
]
# ``tenure_aliases``: acquisition method -> regime label (ajustes-lectura-importacion).
TenureAliases = dict[str, str]


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
    value: list[str] | ConcatenationSeparators | TenureAliases = Field(
        description="`absence_markers`: lista de marcadores (se comparan sin espacios ni "
        "mayúsculas). `concatenation_separators`: separadores y marcadores que no se separan. "
        "`tenure_aliases`: forma de adquisición → régimen de tenencia (Propiedad, Comodato o "
        "Préstamo Temporal), para deducir el régimen al importar una fila que no lo trae. "
        "`photo_camera_patterns`: expresiones regulares de nombres de cámara, que no traen "
        "código, además de `IMG_…`, `DSC_…`, `NNN-NNNN` y `NNLLNNNN` (RF-046)."
    )
    is_default: bool = Field(
        description="true = no hay valor guardado y rige el valor del código [SUPUESTO A5, A8]."
    )
    updated_at: datetime | None


class NormalizationSettingUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"value": ["", "-", "S/N", "S/C", "NO REGISTRA"]}]}
    )

    value: list[str] | ConcatenationSeparators | TenureAliases


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


def setting_value(key: str, value: Any) -> list[str] | ConcatenationSeparators | TenureAliases:
    if key == "tenure_aliases":  # stored with the regime codes, shown with the contract labels
        return {
            alias: TENURE_REGIME_LABELS[TenureRegime[code]]
            for alias, code in value.items()
            if code in TenureRegime.__members__
        }
    return ConcatenationSeparators.model_validate(value) if isinstance(value, dict) else value
