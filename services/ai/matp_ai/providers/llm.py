"""Language-model provider, selected with AI_PROVIDER=llm (change ia-extraccion-texto-libre).

Speaks the OpenAI-compatible Chat Completions shape, so any provider that offers that
compatibility layer works through LLM_BASE_URL/LLM_API_KEY/LLM_MODEL without code changes —
Gemini's free tier (https://generativelanguage.googleapis.com/v1beta/openai/) included.

Implemented for real: RIA-01 (``extract_structured``), the column mapping of the bulk load, the
search interpretation (RIA-06) and «Completar ficha» (``complete_piece``, change
``ia-completar-ficha``), which may send the piece's photo as an image. ``suggest_terms`` and
``describe`` (RIA-03/04, change ``ia-sugerencia-terminos``) stay unavailable.
"""

import json
import time
from typing import Any

import httpx2 as httpx

from matp_ai.config import Settings
from matp_ai.providers.base import AIProvider, ProviderUnavailable
from matp_ai.schemas import (
    COMPLETION_PROMPT_VERSION,
    DUPLICATES_PROMPT_VERSION,
    IMAGE_MIN_CONFIDENCE,
    ColumnMappingCandidate,
    ColumnMappingResult,
    CompletePieceRequest,
    CompletionProposal,
    CompletionResult,
    DescriptionResult,
    ExtractionResult,
    JudgeDuplicatesRequest,
    JudgeDuplicatesResult,
    LedgerPageExtraction,
    LedgerPageImage,
    LedgerRowExtraction,
    PieceContext,
    ProposedField,
    SearchInterpretation,
    SearchValidValues,
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


#: «Completar ficha» (change ia-completar-ficha, D4). Versión: ``COMPLETION_PROMPT_VERSION``.
_COMPLETION_FIELD_RULES = {
    "category": "el código EXACTO de una de estas categorías (código: nombre): {options}",
    "materials": "un elemento por cada material, con el código EXACTO de uno de estos materiales "
    "(código: nombre): {options}",
    "conservation_status": "el código EXACTO de uno de estos estados de conservación "
    "(código: nombre): {options}",
    "provenance": "el lugar de procedencia tal como lo escribe la ficha",
    "epoch": 'la época o fecha tal como la escribe la ficha (por ejemplo "siglo XX" o "ca. 1950")',
    "dimensions_text": 'las medidas en un texto breve, por ejemplo "alto 35 cm x ancho 20 cm"',
}


def _completion_system_prompt(request: CompletePieceRequest) -> str:
    def _options(field: str) -> str:
        items = getattr(request.vocabularies, field, [])
        return json.dumps({o.code: o.label for o in items}, ensure_ascii=False)

    rules = "\n".join(
        f'- "{field}": ' + _COMPLETION_FIELD_RULES[field].format(options=_options(field))
        for field in dict.fromkeys(request.fields)
    )
    image_rule = (
        '- Se adjunta una foto de la pieza. Solo para "category", "materials" o '
        '"conservation_status" puedes usar {"source": "image"} sin cita, y solo si se ve con '
        f"claridad (confianza {IMAGE_MIN_CONFIDENCE} o más).\n"
        if request.image is not None
        else ""
    )
    return (
        "Completas la ficha de una pieza de un museo peruano leyendo SOLO lo que dice su propia "
        "ficha"
        + (" y su foto" if request.image is not None else "")
        + ". No uses conocimiento general ni externo. Devuelve SOLO un objeto JSON, sin "
        "explicación ni markdown, con esta forma exacta:\n\n"
        '{"proposals": [{"field": "<campo>", "value": "<valor>", "confidence": <0 a 1>, '
        '"evidence": {"source": "text", "quote": "<fragmento literal de la ficha>"}}], '
        '"not_found": ["<campo>"]}\n\n'
        f'Campos pedidos y qué va en "value":\n{rules}\n\n'
        "Reglas:\n"
        '- "quote" MUST ser una subcadena EXACTA y literal de la ficha: sin parafrasear, sin '
        "traducir y sin corregir tildes ni mayúsculas.\n"
        + image_rule
        + "- Sin prueba no hay propuesta. Si la ficha no dice un campo, ponlo en "
        '"not_found". No deduzcas datos por el estilo, la técnica ni lo que suele ser '
        "habitual: por ejemplo, no propongas una época que la ficha no escribe.\n"
        "- No propongas campos que no estén en la lista de campos pedidos."
    )


#: Lectura del libro de registros (change digitalizacion-libro-registros, D2/D3).
_LEDGER_SYSTEM_PROMPT = """Transcribes fotos de libros de registros manuscritos de un museo peruano.
Devuelve SOLO un objeto JSON válido, sin explicaciones ni markdown, con esta forma:
{"rows": [{"inventory_code": null, "denomination": null, "description": null,
"author": null, "provenance": null, "conservation_state": null,
"entry_date": null, "additional_code": null, "confidence": 0.0}]}

Reglas obligatorias:
- EXAMINA LA ESTRUCTURA DE ESTA FOTO ANTES DE LEER LAS FILAS. Hay varios libros y las columnas
  derechas CAMBIAN DE ORDEN: nunca presupongas que la columna 2, 3, 4 o 5 significa lo mismo.
  Usa encabezados visibles, líneas verticales y el TIPO DE VALOR para reconocer cada campo.
- Una foto puede mostrar DOS PÁGINAS ENFRENTADAS: cada registro empieza en la página izquierda
  y continúa en la misma línea horizontal en la derecha. Une por alineación de fila, sin cruzar
  registros vecinos. Si el encabezado no se ve, evalúa el contenido sin inventar datos.
- Estado de conservación es un juicio como Bueno/Buena, Regular, Deteriorado/a, Restaurado/a.
  Un código como ELA 250-CEL o una sigla como M.H.O. o M.B.V. NO es un estado de conservación.
  Los códigos y siglas van en additional_code; no pongas «Buena» en additional_code.
- La fecha va en entry_date, literalmente como está escrita (p. ej. 14.3.80 o 7-4-2002).
  NO asumas el siglo ni la conviertas a ISO sin evidencia.
- Extrae author cuando la descripción indique expresamente «Autor: Nombre» o «Autora: Nombre».
  NO inventes autor a partir de «Taller Tineo», procedencia, personaje representado o estilo.
  En description conserva la transcripción original, incluida la atribución; el sistema puede
  separarla luego conservando el original como evidencia.
- Una fila por registro visible en el orden original. Una foto de doble página no son dos listas
  de piezas. No inventes filas ni dupliques registros entre las dos páginas.
- Cuando una celda sea ilegible, vacía o no se pueda asociar con certeza a un encabezado, usa
  null, nunca adivines. Baja confidence si hay dudas de alineación, autor o columnas.
- inventory_code es el código I de la pieza tal como está escrito; denomination es una propuesta
  breve del tipo de objeto, no una copia de description; description transcribe literalmente.
- No deduzcas la colección: el usuario la asignará durante la revisión."""


#: Juicio de duplicados (change ia-juicio-duplicados, D1). Versión: ``DUPLICATES_PROMPT_VERSION``.
_JUDGE_SYSTEM_PROMPT = """Eres catalogador de un museo peruano. Para cada par de registros \
decides si describen la misma pieza física. Usa SOLO los datos de cada registro: no uses \
conocimiento externo. Devuelve SOLO un objeto JSON, sin explicación ni markdown, con esta forma \
exacta:

{"verdicts": [{"pair_id": "<el pair_id recibido>", "verdict": "same|distinct|unsure", \
"confidence": <0 a 1>, "reason": "<una frase en español>"}]}

Reglas:
- Un veredicto por cada par recibido, con su mismo "pair_id".
- "same" solo si los datos coinciden en lo esencial y ninguno los contradice.
- "distinct" si algún dato los contradice con claridad: códigos I distintos, medidas, épocas o \
procedencias incompatibles, o denominaciones de objetos distintos.
- "unsure" si faltan datos o hay dudas razonables. No adivines.
- "confidence" refleja tu duda real; no pongas 1 si hay algo que no cuadra.
- "reason" cita en una frase los datos que deciden, sin inventar ninguno.
"""


#: The provider is overloaded or limiting requests: worth asking again (Gemini answers 503
#: «high demand» for minutes at a time). Anything else is definitive.
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
#: Waits before the 2nd and 3rd attempts, in seconds.
RETRY_WAITS = (1.5, 4.0)
#: No new attempt once this much time went by: the screen must not hang.
RETRY_BUDGET_SECONDS = 25.0


def _sleep(seconds: float) -> None:
    time.sleep(seconds)


def _ledger_text(item: dict[str, Any], key: str) -> str | None:
    value = item.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


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
            '"field": "<una clave de la lista, o null>", "confidence": <0 a 1>, '
            '"reason": "<por qué dudas, o null>"}]}\n\n'
            f"Campos válidos (clave: etiqueta):\n{vocabulary}\n\n"
            "Reglas:\n"
            '- Debe haber exactamente un elemento de "mappings" por cada encabezado recibido, en '
            "el mismo orden.\n"
            '- "field" MUST ser una de las claves listadas arriba, EXACTA, o null si ninguna '
            "corresponde. No inventes claves nuevas.\n"
            "- Dos columnas no deben proponer el mismo campo: si dos encabezados parecen el mismo "
            "campo, elige el más claro y deja null en el otro.\n"
            "- Usa la muestra de filas solo para desambiguar; no la repitas en la respuesta.\n"
            '- Si "confidence" es menor que 0.8, "reason" explica la duda en una frase corta en '
            'español para una persona del museo (por ejemplo: "Fecha" puede ser la época de la '
            'pieza o la fecha de registro). Si estás seguro, "reason" es null.'
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

    def interpret_search(self, text: str, valid_values: SearchValidValues) -> SearchInterpretation:
        def _dump(value: object) -> str:
            return json.dumps(value, ensure_ascii=False)

        system_prompt = (
            "Traduces una frase de búsqueda en español, de un sistema de un museo peruano, a "
            "filtros ya existentes. Devuelve SOLO un objeto JSON, sin explicación ni markdown, con "
            "esta forma exacta (todas las claves opcionales, usa null si no aplica):\n\n"
            '{"q": "<texto que sobra, para buscar como texto libre, o null>", '
            '"collection_key": "<una de las siglas listadas, o null>", '
            '"category": "<una de las categorías listadas, o null>", '
            '"material": "<uno de los materiales listados, o null>", '
            '"conservation_state": "<uno de los estados listados, o null>", '
            '"location": "<una de las ubicaciones listadas, o null>", '
            '"tenure_regime": "<uno de los regímenes listados, o null>", '
            '"provenance": "<procedencia mencionada en la frase, o null>", '
            '"author": "<autor mencionado en la frase, o null>", '
            '"alert_code": "<uno de los códigos de alerta listados, o null>", '
            '"epoch_start_year": <año entero o null>, "epoch_end_year": <año entero o null>}\n\n'
            f"Colecciones válidas (sigla: nombre): {_dump(valid_values.collections)}\n"
            f"Categorías válidas: {_dump(valid_values.categories)}\n"
            f"Materiales válidos: {_dump(valid_values.materials)}\n"
            f"Estados de conservación válidos: {_dump(valid_values.conservation_states)}\n"
            f"Ubicaciones válidas: {_dump(valid_values.locations)}\n"
            f"Regímenes de tenencia válidos: {_dump(valid_values.tenure_regimes)}\n"
            f"Alertas válidas (código: lo que significa): {_dump(valid_values.alert_labels)}\n\n"
            "Reglas:\n"
            "- Cada valor que devuelvas MUST ser EXACTO a uno de los listados arriba. Si la frase "
            "menciona algo que no está en ninguna lista, no lo devuelvas en ese campo.\n"
            '- Quita muletillas ("eh", "o sea") y corrige errores de dictado antes de decidir, '
            "pero no inventes datos que no estén en la frase.\n"
            '- Deja en "q" solo lo que no corresponda a ningún filtro de la lista. Palabras '
            'genéricas ("pieza", "objeto", "obra") y de pedido ("muéstrame") no van en "q".'
        )
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        raw = self._chat_completion(payload)
        return self._parse_search_interpretation(raw, valid_values)

    def complete_piece(self, request: CompletePieceRequest) -> CompletionResult:
        texts = request.texts
        lines = [f"Denominación: {texts.denomination}"]
        if texts.description:
            lines.append(f"Descripción: {texts.description}")
        if texts.notes:
            lines.append(f"Observaciones: {texts.notes}")
        user_text = "Ficha de la pieza:\n" + "\n".join(lines)
        user_content: Any = user_text
        if request.image is not None:
            # OpenAI-compatible multimodal message; Gemini accepts the image as a data URL.
            user_content = [
                {"type": "text", "text": user_text},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{request.image.media_type};base64,{request.image.data_base64}"
                    },
                },
            ]
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _completion_system_prompt(request)},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        data = self._json_object(self._chat_completion(payload))
        proposals: list[CompletionProposal] = []
        for item in data.get("proposals", []) if isinstance(data, dict) else []:
            try:
                proposals.append(CompletionProposal.model_validate({"label": "", **item}))
            except Exception:  # noqa: BLE001 — an un-parseable item is skipped, not fatal
                continue
        # ``not_found`` is recomputed by the service from what survives verification (D2).
        return CompletionResult(proposals=proposals, prompt_version=COMPLETION_PROMPT_VERSION)

    def extract_ledger_page(self, image: LedgerPageImage) -> LedgerPageExtraction:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _LEDGER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe todas las filas visibles."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image.media_type};base64,{image.data_base64}"
                            },
                        },
                    ],
                },
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        data = self._json_object(self._chat_completion(payload))
        raw_rows = data.get("rows", []) if isinstance(data, dict) else []
        rows: list[LedgerRowExtraction] = []
        for item in raw_rows if isinstance(raw_rows, list) else []:
            if not isinstance(item, dict):
                continue
            try:
                confidence = min(max(float(item.get("confidence", 0)), 0.0), 1.0)
            except (TypeError, ValueError):
                confidence = 0.0
            rows.append(
                LedgerRowExtraction(
                    inventory_code=_ledger_text(item, "inventory_code"),
                    denomination=_ledger_text(item, "denomination"),
                    description=_ledger_text(item, "description"),
                    author=_ledger_text(item, "author"),
                    provenance=_ledger_text(item, "provenance"),
                    conservation_state=_ledger_text(item, "conservation_state"),
                    entry_date=_ledger_text(item, "entry_date"),
                    additional_code=_ledger_text(item, "additional_code"),
                    confidence=confidence,
                )
            )
        return LedgerPageExtraction(rows=rows)

    def judge_duplicates(self, request: JudgeDuplicatesRequest) -> JudgeDuplicatesResult:
        pairs = [pair.model_dump(exclude_none=True) for pair in request.pairs]
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({"pairs": pairs}, ensure_ascii=False)},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        data = self._json_object(self._chat_completion(payload))
        raw = data.get("verdicts", []) if isinstance(data, dict) else []
        # Kept as received: the service checks every item with ``finish_judgments`` (D4).
        return JudgeDuplicatesResult.model_construct(
            verdicts=raw if isinstance(raw, list) else [],
            prompt_version=DUPLICATES_PROMPT_VERSION,
        )

    def _json_object(self, raw: str) -> Any:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except ValueError as exc:
            raise ProviderUnavailable(f"El proveedor de IA no devolvió JSON válido: {exc}") from exc

    def _chat_completion(self, payload: dict[str, Any]) -> str:
        """One answer of the model. A temporary failure of the provider (overload, rate limit, no
        answer) is retried with growing waits, within ``RETRY_BUDGET_SECONDS``; a definitive one
        (bad key, unknown model, bad request) is not (fix ia-reintentos-gemini)."""
        if not self.base_url or not self._api_key:
            raise ProviderUnavailable("LLM_BASE_URL/LLM_API_KEY no están configurados.")
        started = time.monotonic()
        attempt = 0
        while True:
            attempt += 1
            try:
                response = httpx.Client(timeout=20.0).post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
            except httpx.HTTPError as exc:
                failure = ProviderUnavailable(f"No se pudo contactar al proveedor de IA: {exc}")
                retryable = True
            else:
                if response.status_code < 400:
                    break
                failure = ProviderUnavailable(
                    f"El proveedor de IA respondió {response.status_code}: {response.text[:300]}"
                )
                retryable = response.status_code in RETRYABLE_STATUS
            waited = time.monotonic() - started
            if not retryable or attempt >= len(RETRY_WAITS) + 1 or waited >= RETRY_BUDGET_SECONDS:
                raise failure
            _sleep(RETRY_WAITS[attempt - 1])
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
            reason = item.get("reason") if item else None
            reason = reason.strip()[:200] if isinstance(reason, str) and reason.strip() else None
            candidates.append(
                ColumnMappingCandidate(
                    column=header,
                    field=field,
                    confidence=confidence if field else 0.0,
                    reason=reason if field else None,
                )
            )
        return candidates

    def _parse_search_interpretation(
        self, raw: str, valid_values: SearchValidValues
    ) -> SearchInterpretation:
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
        if not isinstance(data, dict):
            return SearchInterpretation()

        def _valid_choice(value: Any, options: list[str]) -> str | None:
            return value if isinstance(value, str) and value in options else None

        def _valid_year(value: Any) -> int | None:
            try:
                return int(value) if value is not None else None
            except (TypeError, ValueError):
                return None

        collection_key = data.get("collection_key")
        if not isinstance(collection_key, str) or collection_key not in valid_values.collections:
            collection_key = None
        alert_code = data.get("alert_code")
        if not isinstance(alert_code, str) or alert_code not in valid_values.alert_labels:
            alert_code = None
        q = data.get("q")

        # Trazabilidad (D2/D3, mismo espíritu que extract_structured): cada valor se valida contra
        # la lista recibida, nunca se confía en lo que diga el modelo a ciegas.
        return SearchInterpretation(
            q=q if isinstance(q, str) and q.strip() else None,
            collection_key=collection_key,
            category=_valid_choice(data.get("category"), valid_values.categories),
            material=_valid_choice(data.get("material"), valid_values.materials),
            conservation_state=_valid_choice(
                data.get("conservation_state"), valid_values.conservation_states
            ),
            location=_valid_choice(data.get("location"), valid_values.locations),
            tenure_regime=_valid_choice(data.get("tenure_regime"), valid_values.tenure_regimes),
            provenance=data.get("provenance") if isinstance(data.get("provenance"), str) else None,
            author=data.get("author") if isinstance(data.get("author"), str) else None,
            alert_code=alert_code,
            epoch_start_year=_valid_year(data.get("epoch_start_year")),
            epoch_end_year=_valid_year(data.get("epoch_end_year")),
        )
