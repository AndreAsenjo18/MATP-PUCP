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
    CompletePieceRequest,
    CompletionEvidence,
    CompletionProposal,
    CompletionResult,
    DescriptionResult,
    DuplicateJudgment,
    ExtractionResult,
    JudgeDuplicatesRequest,
    JudgeDuplicatesResult,
    PieceContext,
    ProposedField,
    SearchInterpretation,
    SearchValidValues,
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

# «Completar ficha» (change ia-completar-ficha). Reglas [SUPUESTO] solo para que la demostración sea
# coherente: cada propuesta sale de un fragmento literal de la ficha, nunca de otra cosa.
_DIMENSION_AFTER_RE = re.compile(
    rf"{_NUMBER}\s*(cm|mm|m)\s+de\s+(alto|altura|ancho|largo|profundidad|di[aá]metro)\b",
    re.IGNORECASE,
)
_PLACE = r"[A-ZÁÉÍÓÚÑ][\w-]+(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][\w-]+)*"
_PROVENANCE_RE = re.compile(
    rf"\b(?:elaborad[oa]s?|hech[oa]s?|fabricad[oa]s?|procedentes?|provenientes?|originari[oa]s?)"
    rf"\s+(?:en|de)\s+({_PLACE})"
)
_YEAR = r"(?:1[5-9]\d{2}|20\d{2})\b"
_EPOCH_RE = re.compile(
    r"\b(?:(?i:siglos?)\s+[XVI]+\b(?:\s*(?:-|al?|y)\s*[XVI]+\b)?"
    + r"|(?i:ca\.|circa|hacia)\s*"
    + _YEAR
    + r"|(?i:d[eé]cada\s+de)\s+"
    + _YEAR
    + r"|(?i:a[nñ]os)\s+"
    + _YEAR
    + r")"
)
_TEXT_ORDER = ("description", "notes", "denomination")
_CATEGORY_ORDER = ("denomination", "description", "notes")
_STATUS_CODES = {"buen": "BUENO", "regular": "REGULAR", "mal": "MALO"}


def _folded_with_index(text: str) -> tuple[str, list[int]]:
    """``text`` folded (lower case, no accents) and, for each folded char, its original index."""
    chars: list[str] = []
    index: list[int] = []
    for position, char in enumerate(text):
        for folded in _fold(char):
            chars.append(folded)
            index.append(position)
    return "".join(chars), index


def _find_label(text: str, label: str) -> tuple[int, int] | None:
    """Span, in ``text``, of ``label`` as a whole word, ignoring case and accents."""
    folded, index = _folded_with_index(text)
    match = re.search(rf"\b{re.escape(_fold(label))}\b", folded)
    if not match or match.end() == match.start():
        return None
    return index[match.start()], index[match.end() - 1] + 1


def _texts(request: CompletePieceRequest, order: tuple[str, ...]) -> list[tuple[str, str]]:
    return [(n, getattr(request.texts, n)) for n in order if getattr(request.texts, n)]


def _proposal(field: str, value: str, label: str, quote: str, confidence: float):  # type: ignore[no-untyped-def]
    return CompletionProposal(
        field=field,  # type: ignore[arg-type]
        value=value,
        label=label,
        confidence=confidence,
        evidence=CompletionEvidence(source="text", quote=quote),
    )


#: Below this confidence a proposed column is doubtful and says why (importacion-mapeo-asistido).
MAPPING_SURE_CONFIDENCE = 0.8


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
            reason = (
                f"«{header}» solo se parece a «{target_fields[field]}»: confírmelo."
                if field is not None and confidence < MAPPING_SURE_CONFIDENCE
                else None
            )
            mappings.append(
                ColumnMappingCandidate(
                    column=header, field=field, confidence=confidence, reason=reason
                )
            )
        message = None if used_fields else "No se reconoció un campo claro para ninguna columna."
        return ColumnMappingResult(mappings=mappings, message=message)

    def interpret_search(self, text: str, valid_values: SearchValidValues) -> SearchInterpretation:
        folded = _fold(text)
        result: dict[str, object] = {}
        remainder = text

        def _consume(label: str) -> None:
            # [SUPUESTO] quita la primera coincidencia literal (sin distinguir mayúsculas) del
            # texto que sobra; si no calza exacto (p. ej. por tildes distintas) se deja tal cual —
            # el residuo solo se usa como búsqueda de texto libre adicional, no es crítico.
            nonlocal remainder
            match = re.search(re.escape(label), remainder, re.IGNORECASE)
            if match:
                remainder = (remainder[: match.start()] + remainder[match.end() :]).strip()

        for code, name in valid_values.collections.items():
            if "collection_key" not in result and (_fold(code) in folded or _fold(name) in folded):
                result["collection_key"] = code
                _consume(name)

        def _match_first(options: list[str], key: str) -> None:
            for label in options:
                if _fold(label) in folded:
                    result[key] = label
                    _consume(label)
                    return

        _match_first(valid_values.categories, "category")
        _match_first(valid_values.materials, "material")
        _match_first(valid_values.conservation_states, "conservation_state")
        _match_first(valid_values.locations, "location")
        _match_first(valid_values.tenure_regimes, "tenure_regime")

        for code, label in valid_values.alert_labels.items():
            if _fold(label) in folded:
                result["alert_code"] = code
                _consume(label)
                break

        result["q"] = remainder.strip() or None
        return SearchInterpretation(**result)

    def complete_piece(self, request: CompletePieceRequest) -> CompletionResult:
        """Reads only the piece's text; the photo, if any, is ignored (nothing deterministic to
        say about it). Each proposal quotes the literal fragment it comes from (D2)."""
        wanted = set(request.fields)
        proposals: list[CompletionProposal] = []

        if "category" in wanted:
            proposals.extend(self._category(request))
        if "materials" in wanted:
            for option in request.vocabularies.materials:
                for _name, text in _texts(request, _TEXT_ORDER):
                    span = _find_label(text, option.label)
                    if span:
                        start, end = span
                        # «madera de cedro»: the detail stays in the quote, the value is the term.
                        detail = re.match(r"\s+de\s+[^\W\d_]+", text[end:])
                        quote = text[start : end + (detail.end() if detail else 0)]
                        proposals.append(
                            _proposal("materials", option.code, option.label, quote, 0.8)
                        )
                        break
        if "conservation_status" in wanted:
            for _name, text in _texts(request, _TEXT_ORDER):
                match = _STATUS_RE.search(text)
                if match:
                    code = _STATUS_CODES.get((match.group(1) or "").lower(), "EN_RESTAURACION")
                    proposals.append(
                        _proposal("conservation_status", code, code, match.group(0), 0.7)
                    )
                    break
        if "provenance" in wanted:
            for _name, text in _texts(request, _TEXT_ORDER):
                match = _PROVENANCE_RE.search(text)
                if match:
                    place = match.group(1)
                    proposals.append(_proposal("provenance", place, place, match.group(0), 0.7))
                    break
        if "epoch" in wanted:
            for _name, text in _texts(request, _TEXT_ORDER):
                match = _EPOCH_RE.search(text)
                if match:
                    epoch = match.group(0)
                    proposals.append(_proposal("epoch", epoch, epoch, epoch, 0.75))
                    break
        if "dimensions_text" in wanted:
            proposals.extend(self._dimensions(request))
        # The service runs ``finish_completion`` on this: labels and codes are checked there.
        return CompletionResult(
            proposals=proposals,
            not_found=[f for f in request.fields if all(p.field != f for p in proposals)],
        )

    def _category(self, request: CompletePieceRequest) -> list[CompletionProposal]:
        for _name, text in _texts(request, _CATEGORY_ORDER):
            for option in request.vocabularies.category:
                span = _find_label(text, option.label)
                if span:
                    quote = text[span[0] : span[1]]
                    return [_proposal("category", option.code, option.label, quote, 0.8)]
            # The same keyword list as RIA-03: «charango» says «Instrumento musical».
            codes = {o.code: o.label for o in request.vocabularies.category}
            for keyword, vocabulary, code, _label in _KEYWORDS:
                if vocabulary != "CATEGORY" or code not in codes:
                    continue
                span = _find_label(text, keyword)
                if span:
                    quote = text[span[0] : span[1]]
                    return [_proposal("category", code, codes[code], quote, 0.6)]
        return []

    def _dimensions(self, request: CompletePieceRequest) -> list[CompletionProposal]:
        for _name, text in _texts(request, _TEXT_ORDER):
            parts: list[tuple[int, int, str]] = []
            for match in _DIMENSION_RE.finditer(text):
                name = _DIMENSION_NAMES.get(_fold(match.group(1)), _fold(match.group(1)))
                parts.append(
                    (match.start(), match.end(), f"{name} {match.group(2)} {match.group(3)}")
                )
            for match in _DIMENSION_AFTER_RE.finditer(text):
                name = _DIMENSION_NAMES.get(_fold(match.group(3)), _fold(match.group(3)))
                parts.append(
                    (match.start(), match.end(), f"{name} {match.group(1)} {match.group(2)}")
                )
            if not parts:
                match = _DIMENSION_BOX_RE.search(text)
                if match:
                    parts.append((match.start(), match.end(), match.group(0)))
            if not parts:
                continue
            parts.sort()
            start, end = parts[0][0], parts[-1][1]
            if end - start > 160:  # too far apart to be one quote: keep the first one only
                parts, end = parts[:1], parts[0][1]
            value = " x ".join(p[2] for p in parts)
            return [_proposal("dimensions_text", value, value, text[start:end], 0.8)]
        return []

    def judge_duplicates(self, request: JudgeDuplicatesRequest) -> JudgeDuplicatesResult:
        """Deterministic rules [SUPUESTO], only to make demos coherent (D1): different code I ->
        distinct; same denomination and collection -> same; very different denominations ->
        distinct; anything else -> unsure."""
        verdicts: list[DuplicateJudgment] = []
        for pair in request.pairs:
            a, b = pair.a, pair.b
            name_a, name_b = _fold(a.denomination or ""), _fold(b.denomination or "")
            similarity = SequenceMatcher(None, name_a, name_b).ratio() if name_a and name_b else 0
            same_collection = _fold(a.collection or "") == _fold(b.collection or "")
            if a.code_i and b.code_i and _fold(a.code_i) != _fold(b.code_i):
                verdict, confidence, reason = (
                    "distinct",
                    0.95,
                    "Cada registro tiene un código I distinto.",
                )
            elif similarity >= 0.9 and same_collection:
                verdict, confidence, reason = (
                    "same",
                    0.9,
                    "Tienen la misma denominación y la misma colección, y nada los contradice.",
                )
            elif similarity < 0.5:
                verdict, confidence, reason = (
                    "distinct",
                    0.88,
                    "Las denominaciones describen objetos distintos.",
                )
            else:
                verdict, confidence, reason = (
                    "unsure",
                    0.55,
                    "La denominación se parece, pero los datos no alcanzan para decidir.",
                )
            verdicts.append(
                DuplicateJudgment(
                    pair_id=pair.pair_id, verdict=verdict, confidence=confidence, reason=reason
                )
            )
        return JudgeDuplicatesResult(verdicts=verdicts)
