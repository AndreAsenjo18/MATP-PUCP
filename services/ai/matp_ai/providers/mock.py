"""Deterministic mock provider: no network, no randomness (RNF-008, risk RA04).

Rules and keyword lists are [SUPUESTO]: they only exist to make demos coherent.
"""

import re
import unicodedata
from difflib import SequenceMatcher

from matp_ai.providers.base import AIProvider
from matp_ai.schemas import (
    ColumnMappingCandidate,
    ColumnMappingResult,
    DescriptionResult,
    ExtractionResult,
    PieceContext,
    ProposedField,
    TermSuggestion,
    TermSuggestionResult,
)

_NUMBER = r"(\d+(?:[.,]\d+)?)"
_DIMENSION_RE = re.compile(
    rf"\b(alto|altura|ancho|largo|profundidad|di[aá]metro)\s*(?:de|:|=)?\s*{_NUMBER}\s*(cm|mm|m)\b",
    re.IGNORECASE,
)
_DIMENSION_BOX_RE = re.compile(
    rf"{_NUMBER}\s*[x×]\s*{_NUMBER}(?:\s*[x×]\s*{_NUMBER})?\s*(cm|mm|m)\b", re.IGNORECASE
)
_EXHIBITION_RE = re.compile(
    r"\b(?:exposici[oó]n|muestra|exhibid[oa]\s+en)\b[^.;\n]*?\b(1[89]\d{2}|20\d{2})\b",
    re.IGNORECASE,
)
_STATUS_RE = re.compile(r"\b(buen|regular|mal)\s+estado\b|\ben\s+restauraci[oó]n\b", re.IGNORECASE)
_REVIEW_RE = re.compile(r"\brevisad[oa](?:\s+en)?(?:\s+(\d{4}))?\b", re.IGNORECASE)

_DIMENSION_NAMES = {"altura": "alto", "diámetro": "diametro", "diametro": "diametro"}
_BOX_ORDER = ("alto", "ancho", "profundidad")  # [SUPUESTO] order of "A x B x C cm"
_STATUS_TERMS = {"buen": "BUENO", "regular": "REGULAR", "mal": "MALO"}

# [SUPUESTO] keyword -> (vocabulary, term code, label)
_KEYWORDS: list[tuple[str, str, str, str]] = [
    ("retablo", "CATEGORY", "RETABLO", "Retablo"),
    ("mate", "CATEGORY", "MATE_BURILADO", "Mate burilado"),
    ("mascara", "CATEGORY", "MASCARA", "Máscara"),
    ("vasija", "CATEGORY", "CERAMICA", "Cerámica"),
    ("ceramica", "CATEGORY", "CERAMICA", "Cerámica"),
    ("manta", "CATEGORY", "TEXTIL", "Textil"),
    ("tejido", "CATEGORY", "TEXTIL", "Textil"),
    ("textil", "CATEGORY", "TEXTIL", "Textil"),
    ("juguete", "CATEGORY", "JUGUETE", "Juguete popular"),
    ("charango", "CATEGORY", "INSTRUMENTO_MUSICAL", "Instrumento musical"),
    ("madera", "MATERIAL", "MADERA", "Madera"),
    ("arcilla", "MATERIAL", "ARCILLA", "Arcilla"),
    ("lana", "MATERIAL", "LANA", "Lana"),
    ("algodon", "MATERIAL", "ALGODON", "Algodón"),
    ("plata", "MATERIAL", "PLATA", "Plata"),
    ("calabaza", "MATERIAL", "CALABAZA", "Calabaza"),
    ("yeso", "MATERIAL", "YESO", "Yeso"),
    ("pasta de papa", "MATERIAL", "PASTA_PAPA", "Pasta de papa"),
    ("cuero", "MATERIAL", "CUERO", "Cuero"),
    ("policromad", "TECHNIQUE", "POLICROMADO", "Policromado"),
    ("tallad", "TECHNIQUE", "TALLADO", "Tallado"),
    ("burilad", "TECHNIQUE", "BURILADO", "Burilado"),
]


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _number(raw: str) -> float:
    value = float(raw.replace(",", "."))
    return int(value) if value.is_integer() else value


# [SUPUESTO] Encabezados frecuentes de los Excel del museo -> campo interno, tomados de las
# convenciones ya usadas en data/fixtures/lote_demo/ y lote_demo_ia/. Un alias solo se propone si
# su campo está en el ``target_fields`` que llega en la petición (el llamador decide el
# vocabulario válido; el proveedor nunca inventa un campo fuera de esa lista).
_HEADER_ALIASES: dict[str, str] = {
    "denominacion": "denomination",
    "descripcion": "description",
    "regimen": "tenure_regime",
    "regimen de tenencia": "tenure_regime",
    "coleccion": "collection",
    "autor": "author",
    "procedencia": "provenance",
    "epoca": "epoch_original_text",
    "medidas": "dimensions_text",
    "fecha de ingreso": "entry_date",
    "observaciones": "notes",
    "obs": "notes",
    "registrador": "recorded_by",
    "material": "terms:MATERIAL",
    "materiales": "terms:MATERIAL",
    "tecnica": "terms:TECHNIQUE",
    "codigos": "identifier",
    "codigo": "identifier",
}
_MAPPING_THRESHOLD = 0.72  # [SUPUESTO], igual de espíritu que SUGGEST_THRESHOLD de templates.py


def _best_field_for_header(header: str, target_fields: dict[str, str]) -> tuple[str | None, float]:
    folded = _fold(header.strip())
    alias = _HEADER_ALIASES.get(folded)
    if alias and alias in target_fields:
        return alias, 0.95
    best_field: str | None = None
    best_score = 0.0
    for field, label in target_fields.items():
        score = SequenceMatcher(None, folded, _fold(label)).ratio()
        score = max(score, SequenceMatcher(None, folded, _fold(field)).ratio())
        if score > best_score:
            best_field, best_score = field, score
    if best_score >= _MAPPING_THRESHOLD:
        return best_field, round(best_score, 2)
    return None, 0.0


class MockProvider(AIProvider):
    name = "mock"
    model = "mock-deterministic-v1"

    def extract_structured(self, text: str) -> ExtractionResult:
        fields: list[ProposedField] = []
        for match in _DIMENSION_RE.finditer(text):
            name = _fold(match.group(1))
            fields.append(
                ProposedField(
                    field="dimensions",
                    value={
                        "dimension": _DIMENSION_NAMES.get(name, name),
                        "value": _number(match.group(2)),
                        "unit": match.group(3).lower(),
                    },
                    source_fragment=match.group(0),
                    confidence=0.8,
                )
            )
        if not fields:
            for match in _DIMENSION_BOX_RE.finditer(text):
                numbers = [g for g in match.groups()[:3] if g is not None]
                for name, raw in zip(_BOX_ORDER, numbers, strict=False):
                    fields.append(
                        ProposedField(
                            field="dimensions",
                            value={
                                "dimension": name,
                                "value": _number(raw),
                                "unit": match.group(4).lower(),
                            },
                            source_fragment=match.group(0),
                            confidence=0.6,
                        )
                    )
        for match in _EXHIBITION_RE.finditer(text):
            fields.append(
                ProposedField(
                    field="exhibitions",
                    value={"description": match.group(0).strip(), "year": int(match.group(1))},
                    source_fragment=match.group(0).strip(),
                    confidence=0.6,
                )
            )
        for match in _STATUS_RE.finditer(text):
            key = (match.group(1) or "").lower()
            fields.append(
                ProposedField(
                    field="conservation_status",
                    value=_STATUS_TERMS.get(key, "EN_RESTAURACION"),
                    source_fragment=match.group(0),
                    confidence=0.7,
                )
            )
        for match in _REVIEW_RE.finditer(text):
            fields.append(
                ProposedField(
                    field="review_marks",
                    value={"year": int(match.group(1)) if match.group(1) else None},
                    source_fragment=match.group(0),
                    confidence=0.5,
                )
            )
        message = None if fields else "No se reconocieron datos estructurados en el texto."
        return ExtractionResult(fields=fields, message=message)

    def suggest_terms(self, piece: PieceContext) -> TermSuggestionResult:
        sources = [
            piece.title,
            piece.description or "",
            " ".join(piece.materials),
            piece.technique or "",
        ]
        folded = _fold(" ".join(sources))
        seen: set[tuple[str, str]] = set()
        suggestions: list[TermSuggestion] = []
        for keyword, vocabulary, code, label in _KEYWORDS:
            if re.search(rf"\b{re.escape(keyword)}", folded) and (vocabulary, code) not in seen:
                seen.add((vocabulary, code))
                in_title = keyword in _fold(piece.title)
                suggestions.append(
                    TermSuggestion(
                        vocabulary_code=vocabulary,
                        term_code=code,
                        label=label,
                        source_fragment=keyword,
                        confidence=0.75 if in_title else 0.55,
                    )
                )
        return TermSuggestionResult(suggestions=suggestions)

    def describe(self, piece: PieceContext) -> DescriptionResult:
        used = ["title"]
        parts = [piece.title.strip().rstrip(".")]
        if piece.category:
            parts.append(f"de la categoría {piece.category.lower()}")
            used.append("category")
        if piece.materials:
            parts.append("elaborada en " + ", ".join(m.lower() for m in piece.materials))
            used.append("materials")
        if piece.author:
            parts.append(f"atribuida a {piece.author}")
            used.append("author")
        if piece.provenance:
            parts.append(f"procedente de {piece.provenance}")
            used.append("provenance")
        if piece.period_text:
            parts.append(f"con datación «{piece.period_text}»")
            used.append("period_text")
        sentence = ", ".join(parts) + "."
        if piece.dimensions_text:
            sentence += f" Medidas registradas: {piece.dimensions_text}."
            used.append("dimensions_text")
        sentence += " Descripción preliminar generada automáticamente; requiere revisión humana."
        return DescriptionResult(text=sentence, used_fields=used)

    def suggest_column_mapping(
        self,
        headers: list[str],
        sample_rows: list[dict[str, object]],
        target_fields: dict[str, str],
    ) -> ColumnMappingResult:
        del (
            sample_rows
        )  # El mock decide solo por el encabezado; el proveedor real sí usa la muestra.
        used_fields: set[str] = set()
        mappings: list[ColumnMappingCandidate] = []
        for header in headers:
            field, confidence = _best_field_for_header(header, target_fields)
            if field in used_fields:
                # Dos columnas no compiten por el mismo campo en el mock: la primera se lo queda.
                field, confidence = None, 0.0
            if field is not None:
                used_fields.add(field)
            mappings.append(
                ColumnMappingCandidate(column=header, field=field, confidence=confidence)
            )
        message = None if used_fields else "No se reconoció un campo claro para ninguna columna."
        return ColumnMappingResult(mappings=mappings, message=message)
