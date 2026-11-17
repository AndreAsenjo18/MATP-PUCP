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
    reason: str | None = Field(
        None,
        max_length=200,
        description="Por qué la propuesta es dudosa, en una frase, cuando la confianza es baja "
        "(p. ej. «Fecha puede ser la época o la fecha de registro»); null si es clara "
        "(change importacion-mapeo-asistido).",
    )


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


#: Campos que «Completar ficha» puede pedir (change `ia-completar-ficha`, D1). Ninguno es sensible.
CompletionField = Literal[
    "category", "materials", "provenance", "epoch", "dimensions_text", "conservation_status"
]
#: Los únicos que una foto puede probar (D2): los demás exigen una cita del texto.
IMAGE_EVIDENCE_FIELDS = frozenset({"category", "materials", "conservation_status"})
#: Confianza mínima para aceptar una propuesta que solo se apoya en la foto (D2).
IMAGE_MIN_CONFIDENCE = 0.8
COMPLETION_PROMPT_VERSION = "completar-ficha-v1"


class CompletionTexts(BaseModel):
    """Los únicos textos de la ficha que salen hacia el proveedor (RNF-014, D1)."""

    model_config = ConfigDict(extra="forbid")

    denomination: str = Field(min_length=1, max_length=500)
    description: str | None = Field(None, max_length=20000)
    notes: str | None = Field(None, max_length=20000)


class VocabularyOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=300)


class CompletionVocabularies(BaseModel):
    """Listas activas del museo: un término fuera de ellas no se propone (RIA-03, RN-010)."""

    model_config = ConfigDict(extra="forbid")

    category: list[VocabularyOption] = Field(default_factory=list)
    materials: list[VocabularyOption] = Field(default_factory=list)
    conservation_status: list[VocabularyOption] = Field(default_factory=list)


class CompletionImage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_type: Literal["image/webp", "image/jpeg", "image/png"]
    data_base64: str = Field(min_length=1, max_length=8_000_000)


class CompletePieceRequest(BaseModel):
    """Body of ``/v1/complete-piece``: only this piece's own text and photo (D1)."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "texts": {
                        "denomination": "Charango (sintético)",
                        "description": "Caja de resonancia de madera de cedro. Buen estado.",
                        "notes": None,
                    },
                    "fields": ["materials", "conservation_status", "epoch"],
                    "vocabularies": {
                        "materials": [{"code": "MADERA", "label": "Madera"}],
                        "conservation_status": [{"code": "BUENO", "label": "Bueno"}],
                    },
                    "image": None,
                }
            ]
        },
    )

    texts: CompletionTexts
    fields: list[CompletionField] = Field(min_length=1)
    vocabularies: CompletionVocabularies = Field(default_factory=CompletionVocabularies)
    image: CompletionImage | None = None


class CompletionEvidence(BaseModel):
    source: Literal["text", "image"]
    quote: str | None = Field(None, description="Fragmento literal del texto (source=text).")
    text_field: Literal["denomination", "description", "notes"] | None = Field(
        None, description="Texto de la ficha donde está la cita."
    )


class CompletionProposal(BaseModel):
    field: CompletionField
    value: Any = Field(
        description="Código del término (categoría, un material, estado de conservación) o "
        "texto (procedencia, época, medidas)."
    )
    label: str = Field(description="Cómo se muestra el valor (etiqueta del término o el texto).")
    confidence: float = Field(ge=0, le=1)
    evidence: CompletionEvidence


class CompletionResult(BaseModel):
    proposals: list[CompletionProposal]
    not_found: list[CompletionField] = Field(
        default_factory=list, description="Campos pedidos que la ficha no dice."
    )
    prompt_version: str = COMPLETION_PROMPT_VERSION


def _quote_field(texts: CompletionTexts, quote: str) -> str | None:
    for name in ("description", "notes", "denomination"):
        value = getattr(texts, name)
        if value and quote in value:
            return name
    return None


def verify_proposal(
    proposal: CompletionProposal, request: CompletePieceRequest
) -> CompletionProposal | None:
    """The same checks for every provider (D2): a requested field, a literal quote or an allowed
    photo reading, and terms only from the museum's lists. ``None`` drops the proposal."""
    if proposal.field not in request.fields:
        return None
    evidence = proposal.evidence
    if evidence.source == "text":
        quote = (evidence.quote or "").strip()
        where = _quote_field(request.texts, quote) if quote else None
        if where is None:
            return None
        evidence = CompletionEvidence(source="text", quote=quote, text_field=where)  # type: ignore[arg-type]
    else:
        if (
            request.image is None
            or proposal.field not in IMAGE_EVIDENCE_FIELDS
            or proposal.confidence < IMAGE_MIN_CONFIDENCE
        ):
            return None
        evidence = CompletionEvidence(source="image")
    options = getattr(request.vocabularies, proposal.field, None)
    value: Any = proposal.value
    label = proposal.label
    if options is not None:
        by_code = {o.code: o.label for o in options}
        by_label = {o.label.casefold(): o.code for o in options}

        def _code(raw: Any) -> str | None:
            if not isinstance(raw, str):
                return None
            if raw in by_code:
                return raw
            return by_label.get(raw.strip().casefold())

        # One term per proposal (each material carries its own quote and is accepted alone).
        code = _code(value[0] if isinstance(value, list) and len(value) == 1 else value)
        if code is None:
            return None
        value, label = code, by_code[code]
    else:
        if not isinstance(value, str) or not value.strip():
            return None
        value = value.strip()
        label = value
    return CompletionProposal(
        field=proposal.field,
        value=value,
        label=label,
        confidence=proposal.confidence,
        evidence=evidence,
    )


def finish_completion(
    proposals: list[CompletionProposal], request: CompletePieceRequest
) -> CompletionResult:
    """Verified proposals and the fields left without one. One proposal per field (the most
    confident), except materials: one per term, since a piece can have several."""
    best: dict[tuple[str, str], CompletionProposal] = {}
    for proposal in proposals:
        checked = verify_proposal(proposal, request)
        if checked is None:
            continue
        key = (checked.field, str(checked.value) if checked.field == "materials" else "")
        current = best.get(key)
        if current is None or checked.confidence > current.confidence:
            best[key] = checked
    fields = list(dict.fromkeys(request.fields))
    kept = [p for f in fields for (k, _), p in best.items() if k == f]
    missing = [f for f in fields if not any(k == f for k, _ in best)]
    return CompletionResult(proposals=kept, not_found=missing)


DuplicateVerdict = Literal["same", "distinct", "unsure"]
DUPLICATES_PROMPT_VERSION = "juicio-duplicados-v1"
#: Pairs per request (change ia-juicio-duplicados, D1): the caller sends about 20.
MAX_PAIRS_PER_REQUEST = 50
_VERDICTS = ("same", "distinct", "unsure")


class PairSide(BaseModel):
    """One side of a pair: only the catalog fields of the queue comparison (``COMPARISON_ROWS``)
    and the description. Never personal data (RNF-014): other fields are rejected."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["piece", "import_row"]
    denomination: str | None = Field(None, max_length=500)
    collection: str | None = Field(None, max_length=300)
    tenure_regime: str | None = Field(None, max_length=60)
    code_i: str | None = Field(None, max_length=120)
    other_codes: list[str] = Field(default_factory=list, max_length=50)
    author: str | None = Field(None, max_length=300)
    provenance: str | None = Field(None, max_length=300)
    period: str | None = Field(None, max_length=200)
    dimensions: str | None = Field(None, max_length=2000)
    description: str | None = Field(None, max_length=5000)


class DuplicatePair(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pair_id: str = Field(min_length=1, max_length=64)
    a: PairSide
    b: PairSide


class JudgeDuplicatesRequest(BaseModel):
    """Body of ``/v1/judge-duplicates`` (change ia-juicio-duplicados; RIA-02)."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "pairs": [
                        {
                            "pair_id": "par-1",
                            "a": {
                                "kind": "piece",
                                "denomination": "Retablo de San Marcos (sintético)",
                                "collection": "Colección RA",
                                "code_i": "I-0102",
                            },
                            "b": {
                                "kind": "import_row",
                                "denomination": "Retablo San Marcos",
                                "collection": "Colección RA",
                            },
                        }
                    ]
                }
            ]
        },
    )

    pairs: list[DuplicatePair] = Field(min_length=1, max_length=MAX_PAIRS_PER_REQUEST)


class DuplicateJudgment(BaseModel):
    pair_id: str
    verdict: DuplicateVerdict
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(max_length=300, description="Motivo en una frase, en español.")


class JudgeDuplicatesResult(BaseModel):
    verdicts: list[DuplicateJudgment]
    prompt_version: str = DUPLICATES_PROMPT_VERSION


def finish_judgments(raw: list[Any], request: JudgeDuplicatesRequest) -> JudgeDuplicatesResult:
    """The same checks for every provider (D4): a ``pair_id`` sent in this request, a verdict of
    the three, the confidence clipped to 0..1 and a short reason. One verdict per pair; a pair
    without a valid verdict is simply left out (the caller judges it again later)."""
    sent = [pair.pair_id for pair in request.pairs]
    kept: dict[str, DuplicateJudgment] = {}
    for item in raw:
        data = item.model_dump() if isinstance(item, BaseModel) else item
        if not isinstance(data, dict):
            continue
        pair_id = data.get("pair_id")
        verdict = data.get("verdict")
        verdict = verdict.strip().lower() if isinstance(verdict, str) else None
        if pair_id not in sent or pair_id in kept or verdict not in _VERDICTS:
            continue
        try:
            confidence = min(max(float(data.get("confidence", 0)), 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = 0.0
        reason = data.get("reason")
        reason = " ".join(reason.split())[:300] if isinstance(reason, str) else ""
        kept[pair_id] = DuplicateJudgment(
            pair_id=pair_id,
            verdict=verdict,  # type: ignore[arg-type]
            confidence=confidence,
            reason=reason or "Sin motivo.",
        )
    return JudgeDuplicatesResult(verdicts=[kept[p] for p in sent if p in kept])


class SuggestionEnvelope[T](BaseModel):
    function_code: Literal["RIA_01", "RIA_02", "RIA_03", "RIA_04"]
    provider: str
    model: str
    status: Literal["PENDING_REVIEW"] = "PENDING_REVIEW"
    requires_human_approval: Literal[True] = True
    result: T


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
