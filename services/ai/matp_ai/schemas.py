"""Contract of the AI service (spec ia-asistiva; RIA-01, RIA-03, RIA-04, RN-009).

Every response is a *proposal* pending human review: the service never writes to the catalog.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProposedField(BaseModel):
    field: str = Field(description="Campo de la ficha al que se propone el dato.")
    value: Any
    source_fragment: str | None = Field(description="Fragmento de texto que origina el dato.")
    confidence: float = Field(ge=0, le=1)


class ExtractRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "text": "Alto 35 cm, ancho 20 cm. Exhibida en la muestra de retablos 1998. "
                    "Regular estado.",
                    "source_field": "notes",
                }
            ]
        }
    )

    text: str = Field(max_length=20000, description="Texto libre (descripción, observaciones).")
    source_field: str | None = Field(None, description="Campo de origen, p. ej. notes.")

    @field_validator("text")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El texto es obligatorio.")
        return value


class ExtractionResult(BaseModel):
    fields: list[ProposedField]
    message: str | None = None


class PieceContext(BaseModel):
    """Non-sensitive piece data sent to a provider. Sensitive fields are not accepted (RF-041)."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "title": "Retablo ayacuchano de San Marcos (sintético)",
                    "description": "Caja de madera policromada con figuras de pasta de papa.",
                    "category": None,
                    "materials": ["madera"],
                    "provenance": "Ayacucho",
                    "period_text": "ca. 1950",
                    "author": None,
                    "dimensions_text": "35 x 20 x 12 cm",
                }
            ]
        },
    )

    piece_id: str | None = None
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(None, max_length=20000)
    category: str | None = None
    materials: list[str] = Field(default_factory=list)
    technique: str | None = None
    provenance: str | None = None
    period_text: str | None = None
    author: str | None = None
    dimensions_text: str | None = None


class TermSuggestion(BaseModel):
    vocabulary_code: str
    term_code: str
    label: str
    source_fragment: str
    confidence: float = Field(ge=0, le=1)


class TermSuggestionResult(BaseModel):
    suggestions: list[TermSuggestion]


class DescriptionResult(BaseModel):
    text: str
    used_fields: list[str]


class ColumnMappingRequest(BaseModel):
    """Body of ``/v1/suggest-column-mapping`` (change carga-masiva-con-ia): a column of an import
    file has no saved template to map it, so the AI proposes a destination from ``target_fields``.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "headers": ["DENOMINACIÓN", "CÓDIGOS", "OBSERVACIONES"],
                    "sample_rows": [
                        {
                            "DENOMINACIÓN": "Arpa andina",
                            "CÓDIGOS": "I-9201",
                            "OBSERVACIONES": "Mide 95 cm de alto.",
                        }
                    ],
                    "target_fields": {"denomination": "Denominación", "notes": "Observaciones"},
                }
            ]
        }
    )

    headers: list[str] = Field(min_length=1, max_length=100)
    sample_rows: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    target_fields: dict[str, str] = Field(
        description="Vocabulario de destino válido: campo interno -> etiqueta del contrato. "
        "La IA MUST NOT proponer un campo fuera de este diccionario."
    )

    @field_validator("headers")
    @classmethod
    def _not_blank_headers(cls, value: list[str]) -> list[str]:
        if any(not h.strip() for h in value):
            raise ValueError("Ningún encabezado puede estar vacío.")
        return value


class ColumnMappingCandidate(BaseModel):
    column: str = Field(description="Encabezado tal como viene en el archivo.")
    field: str | None = Field(
        None, description="Clave de ``target_fields`` propuesta, o null si no hay una clara."
    )
    confidence: float = Field(ge=0, le=1)


class ColumnMappingResult(BaseModel):
    mappings: list[ColumnMappingCandidate]
    message: str | None = None


class SuggestionEnvelope[T](BaseModel):
    function_code: Literal["RIA_01", "RIA_03", "RIA_04"]
    provider: str
    model: str
    status: Literal["PENDING_REVIEW"] = "PENDING_REVIEW"
    requires_human_approval: Literal[True] = True
    result: T


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
