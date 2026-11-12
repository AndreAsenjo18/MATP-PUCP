"""Language-model provider, selected with AI_PROVIDER=llm (change ia-extraccion-texto-libre).

Speaks the OpenAI-compatible Chat Completions shape, so any provider that offers that
compatibility layer works through LLM_BASE_URL/LLM_API_KEY/LLM_MODEL without code changes —
Gemini's free tier (https://generativelanguage.googleapis.com/v1beta/openai/) included.

Only RIA-01 (``extract_structured``) is implemented for real. ``suggest_terms`` and
``describe`` (RIA-03/04, change ``ia-sugerencia-terminos``) stay unavailable.
"""

import json
from typing import Any

import httpx2 as httpx

from matp_ai.config import Settings
from matp_ai.providers.base import AIProvider, ProviderUnavailable
from matp_ai.schemas import (
    ColumnMappingCandidate,
    ColumnMappingResult,
    DescriptionResult,
    ExtractionResult,
    PieceContext,
    ProposedField,
    TermSuggestionResult,
)

_NOT_IMPLEMENTED = (
    "El proveedor de IA 'llm' aún no implementa esta función (change ia-sugerencia-terminos). "
    "Use AI_PROVIDER=mock; el resto del sistema sigue operando."
)

_SYSTEM_PROMPT = """Extraes datos estructurados de fichas de piezas de un museo peruano a \
partir de texto libre en español. Devuelve SOLO un objeto JSON, sin explicación ni markdown, \
con esta forma exacta:

{"fields": [
  {"field": "dimensions", "value": {"dimension": "alto|ancho|profundidad|diametro", \
"value": <numero>, "unit": "cm|mm|m"}, "source_fragment": "<fragmento literal del texto>", \
"confidence": <0 a 1>},
  {"field": "exhibitions", "value": {"description": "<texto>", "year": <anio entero>}, \
"source_fragment": "<fragmento literal>", "confidence": <0 a 1>},
  {"field": "conservation_status", "value": "BUENO|REGULAR|MALO|EN_RESTAURACION", \
"source_fragment": "<fragmento literal>", "confidence": <0 a 1>},
  {"field": "review_marks", "value": {"year": <anio entero o null>}, \
"source_fragment": "<fragmento literal>", "confidence": <0 a 1>}
]}

Reglas:
- "source_fragment" debe ser una subcadena EXACTA y literal del texto de entrada (sin \
parafrasear, sin traducir, sin corregir tildes).
- Si no hay datos reconocibles de ningún tipo, devuelve {"fields": []}.
- No inventes datos que no estén en el texto. No agregues campos fuera de los cuatro listados.
"""


class LLMProvider(AIProvider):
    name = "llm"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.llm_model or "sin-configurar"
        self.base_url = (settings.llm_base_url or "").rstrip("/")
        self._api_key = settings.llm_api_key or ""

    def extract_structured(self, text: str) -> ExtractionResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        raw = self._chat_completion(payload)
        fields = self._parse_fields(raw, text)
        message = None if fields else "No se reconocieron datos estructurados en el texto."
        return ExtractionResult(fields=fields, message=message)

    def suggest_terms(self, piece: PieceContext) -> TermSuggestionResult:
        raise ProviderUnavailable(_NOT_IMPLEMENTED)

    def describe(self, piece: PieceContext) -> DescriptionResult:
        raise ProviderUnavailable(_NOT_IMPLEMENTED)

    def suggest_column_mapping(
        self,
        headers: list[str],
        sample_rows: list[dict[str, object]],
        target_fields: dict[str, str],
    ) -> ColumnMappingResult:
        vocabulary = "\n".join(f'- "{field}": {label}' for field, label in target_fields.items())
        system_prompt = (
            "Mapeas encabezados de un Excel de un museo peruano a campos de un catálogo. "
            "Devuelve SOLO un objeto JSON, sin explicación ni markdown, con esta forma exacta:\n\n"
            '{"mappings": [{"column": "<encabezado EXACTO recibido>", '
            '"field": "<una clave de la lista, o null>", "confidence": <0 a 1>}]}\n\n'
            f"Campos válidos (clave: etiqueta):\n{vocabulary}\n\n"
            "Reglas:\n"
            '- Debe haber exactamente un elemento de "mappings" por cada encabezado recibido, en '
            "el mismo orden.\n"
            '- "field" MUST ser una de las claves listadas arriba, EXACTA, o null si ninguna '
            "corresponde. No inventes claves nuevas.\n"
            "- Dos columnas no deben proponer el mismo campo: si dos encabezados parecen el mismo "
            "campo, elige el más claro y deja null en el otro.\n"
            "- Usa la muestra de filas solo para desambiguar; no la repitas en la respuesta."
        )
        sample_text = json.dumps(sample_rows[:5], ensure_ascii=False)
        user_prompt = (
            f"Encabezados: {json.dumps(headers, ensure_ascii=False)}\nMuestra: {sample_text}"
        )
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        raw = self._chat_completion(payload)
        mappings = self._parse_column_mapping(raw, headers, target_fields)
        message = (
            None
            if any(m.field for m in mappings)
            else ("No se reconoció un campo claro para ninguna columna.")
        )
        return ColumnMappingResult(mappings=mappings, message=message)

    def _chat_completion(self, payload: dict[str, Any]) -> str:
        if not self.base_url or not self._api_key:
            raise ProviderUnavailable("LLM_BASE_URL/LLM_API_KEY no están configurados.")
        try:
            response = httpx.Client(timeout=20.0).post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise ProviderUnavailable(f"No se pudo contactar al proveedor de IA: {exc}") from exc
        if response.status_code >= 400:
            raise ProviderUnavailable(
                f"El proveedor de IA respondió {response.status_code}: {response.text[:300]}"
            )
        try:
            body = response.json()
            return str(body["choices"][0]["message"]["content"])
        except (KeyError, IndexError, ValueError) as exc:
            raise ProviderUnavailable(
                f"Respuesta del proveedor de IA con forma inesperada: {exc}"
            ) from exc

    def _parse_fields(self, raw: str, source_text: str) -> list[ProposedField]:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            data = json.loads(cleaned)
        except ValueError as exc:
            raise ProviderUnavailable(f"El proveedor de IA no devolvió JSON válido: {exc}") from exc
        fields: list[ProposedField] = []
        for item in data.get("fields", []) if isinstance(data, dict) else []:
            try:
                field = ProposedField.model_validate(item)
            except Exception:  # noqa: BLE001 — an un-parseable item is skipped, not fatal
                continue
            # Traceability (RN-009): never keep a proposal that can't be pointed back to the
            # text it supposedly came from.
            if not field.source_fragment or field.source_fragment not in source_text:
                continue
            fields.append(field)
        return fields

    def _parse_column_mapping(
        self, raw: str, headers: list[str], target_fields: dict[str, str]
    ) -> list[ColumnMappingCandidate]:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            data = json.loads(cleaned)
        except ValueError as exc:
            raise ProviderUnavailable(f"El proveedor de IA no devolvió JSON válido: {exc}") from exc
        raw_items = data.get("mappings", []) if isinstance(data, dict) else []
        by_column = {
            item.get("column"): item
            for item in raw_items
            if isinstance(item, dict) and item.get("column") in headers
        }
        used_fields: set[str] = set()
        candidates: list[ColumnMappingCandidate] = []
        for header in headers:
            item = by_column.get(header)
            field = item.get("field") if item else None
            # Trazabilidad (RN-009, mismo espíritu que extract_structured): nunca se propone un
            # campo que no esté en el vocabulario dado, ni se repite un campo en dos columnas.
            if field not in target_fields or field in used_fields:
                field = None
            confidence = item.get("confidence") if item else 0
            try:
                confidence = float(confidence)
            except (TypeError, ValueError):
                confidence = 0.0
            confidence = min(max(confidence, 0.0), 1.0)
            if field is not None:
                used_fields.add(field)
            candidates.append(
                ColumnMappingCandidate(
                    column=header, field=field, confidence=confidence if field else 0.0
                )
            )
        return candidates
