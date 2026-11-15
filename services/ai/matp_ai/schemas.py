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


class SearchValidValues(BaseModel):
    """Valores vigentes del museo que la IA puede reconocer en una frase de búsqueda (change
    `busqueda-lenguaje-natural`, D2): cualquier valor que no aparezca aquí no se propone como
    filtro. Las listas vienen de los mismos catálogos que ya alimentan los filtros manuales.
    """

    collections: dict[str, str] = Field(
        default_factory=dict,
        description="Identificador de colección (sigla o id, lo decide quien llama) -> nombre.",
    )
    categories: list[str] = Field(default_factory=list, description="Categorías activas.")
    materials: list[str] = Field(default_factory=list, description="Materiales activos.")
    conservation_states: list[str] = Field(
        default_factory=list, description="Estados de conservación activos."
    )
    locations: list[str] = Field(default_factory=list, description="Nombres de ubicación vigentes.")
    tenure_regimes: list[str] = Field(
        default_factory=list, description="Etiquetas de régimen de tenencia."
    )
    alert_labels: dict[str, str] = Field(
        default_factory=dict,
        description="Código de alerta de completitud -> etiqueta en lenguaje llano, p. ej. "
        "MISSING_PHOTO -> 'sin foto'.",
    )


class SearchInterpretRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "text": "toros de cerámica de Puno que no tengan foto",
                    "valid_values": {
                        "collections": {"MMZ": "Colección MMZ"},
                        "categories": ["Figura zoomorfa"],
                        "materials": ["Cerámica"],
                        "conservation_states": ["Bueno", "Regular", "Malo"],
                        "locations": ["Depósito 1"],
                        "tenure_regimes": ["Propia", "Comodato", "Préstamo temporal"],
                        "alert_labels": {"MISSING_PHOTO": "sin foto"},
                    },
                }
            ]
        }
    )

    text: str = Field(max_length=2000, description="Frase en lenguaje natural, escrita o dictada.")
    valid_values: SearchValidValues

    @field_validator("text")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El texto es obligatorio.")
        return value


class SearchInterpretation(BaseModel):
    """Filtros que la IA reconoció, en el mismo vocabulario que el filtro único de búsqueda
    (`PieceFilter`, D2 de `design.md`): el backend valida cada valor contra el catálogo real y
    descarta lo que no exista o lo que el permiso de quien pregunta no permita (D3) antes de
    aplicarlo. Nunca incluye campos sensibles (valorización, comodante, préstamo): ni siquiera se
    le ofrece esa opción al modelo.
    """

    q: str | None = Field(
        None, description="Lo que sobra de la frase sin calzar con ningún filtro."
    )
    collection_key: str | None = None
    category: str | None = None
    material: str | None = None
    conservation_state: str | None = None
    location: str | None = None
    tenure_regime: str | None = None
    provenance: str | None = None
    author: str | None = None
    alert_code: str | None = Field(
        None,
        description="Código de alerta de completitud (p. ej. MISSING_PHOTO) de los que estén en "
        "valid_values.alert_labels.",
    )
    epoch_start_year: int | None = None
    epoch_end_year: int | None = None


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
