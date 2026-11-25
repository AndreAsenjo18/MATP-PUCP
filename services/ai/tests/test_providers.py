"""Spec ia-asistiva — Contrato del proveedor de IA (RIA-01, RIA-03, RIA-04, RN-009)."""

import os
from typing import Any

import pytest

from matp_ai.config import load_settings
from matp_ai.providers import LLMProvider, MockProvider, ProviderUnavailable, get_provider
from matp_ai.schemas import LedgerPageImage, PieceContext, SearchValidValues

TEXT = "Alto 35 cm, ancho 20 cm. Exhibida en la muestra de retablos 1998. Regular estado."


def test_factory_selects_provider_by_setting() -> None:
    assert isinstance(get_provider(load_settings(ai_provider="mock")), MockProvider)
    llm = load_settings(ai_provider="llm", llm_api_key="clave-ficticia", llm_model="modelo-x")
    assert isinstance(get_provider(llm), LLMProvider)


def test_extraction_is_deterministic_and_traceable() -> None:
    provider = MockProvider()
    first = provider.extract_structured(TEXT)
    assert first == MockProvider().extract_structured(TEXT)
    by_field: dict[str, list] = {}
    for item in first.fields:
        by_field.setdefault(item.field, []).append(item)
    assert [d.value for d in by_field["dimensions"]] == [
        {"dimension": "alto", "value": 35, "unit": "cm"},
        {"dimension": "ancho", "value": 20, "unit": "cm"},
    ]
    assert by_field["dimensions"][0].source_fragment == "Alto 35 cm"
    assert by_field["exhibitions"][0].value["year"] == 1998
    assert by_field["conservation_status"][0].value == "REGULAR"
    assert all(item.source_fragment and item.source_fragment in TEXT for item in first.fields)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("35 x 20 x 12 cm", ["alto", "ancho", "profundidad"]),
        ("Diámetro: 14,5 cm", ["diametro"]),
        ("altura 2 m", ["alto"]),
    ],
)
def test_dimension_formats(text: str, expected: list[str]) -> None:
    fields = MockProvider().extract_structured(text).fields
    assert [f.value["dimension"] for f in fields if f.field == "dimensions"] == expected


def test_review_marks_and_restoration() -> None:
    fields = MockProvider().extract_structured("Pieza en restauración. Revisado en 2019").fields
    assert {f.field: f.value for f in fields} == {
        "conservation_status": "EN_RESTAURACION",
        "review_marks": {"year": 2019},
    }


def test_text_without_recognizable_data() -> None:
    result = MockProvider().extract_structured("Pieza donada por la familia (sintético).")
    assert result.fields == []
    assert result.message


def test_suggest_terms_and_describe() -> None:
    piece = PieceContext(
        title="Retablo ayacuchano (sintético)",
        description="Caja de madera policromada con figuras de pasta de papa.",
        provenance="Ayacucho",
        period_text="ca. 1950",
    )
    codes = {
        (s.vocabulary_code, s.term_code) for s in MockProvider().suggest_terms(piece).suggestions
    }
    assert {("CATEGORY", "RETABLO"), ("MATERIAL", "MADERA"), ("MATERIAL", "PASTA_PAPA")} <= codes
    assert ("TECHNIQUE", "POLICROMADO") in codes
    description = MockProvider().describe(piece)
    assert description.text.startswith("Retablo ayacuchano (sintético)")
    assert "requiere revisión humana" in description.text
    assert description.used_fields == ["title", "provenance", "period_text"]
    assert description == MockProvider().describe(piece)


_TARGET_FIELDS = {
    "denomination": "Denominación",
    "provenance": "Procedencia",
    "notes": "Observaciones",
    "dimensions_text": "Medidas (texto)",
}


def test_mock_column_mapping_by_alias() -> None:
    result = MockProvider().suggest_column_mapping(
        headers=["DENOMINACIÓN", "PROCEDENCIA", "OBSERVACIONES"],
        sample_rows=[],
        target_fields=_TARGET_FIELDS,
    )
    by_column = {m.column: m.field for m in result.mappings}
    assert by_column == {
        "DENOMINACIÓN": "denomination",
        "PROCEDENCIA": "provenance",
        "OBSERVACIONES": "notes",
    }
    assert result.message is None


def test_mock_column_mapping_unrecognized_column() -> None:
    result = MockProvider().suggest_column_mapping(
        headers=["FOTO"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    assert result.mappings[0].field is None
    assert result.mappings[0].confidence == 0.0
    assert result.message


def test_mock_column_mapping_never_proposes_outside_target_fields() -> None:
    result = MockProvider().suggest_column_mapping(
        headers=["OBSERVACIONES"], sample_rows=[], target_fields={}
    )
    assert result.mappings[0].field is None


def test_mock_column_mapping_does_not_repeat_a_field() -> None:
    result = MockProvider().suggest_column_mapping(
        headers=["OBSERVACIONES", "OBS"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    fields = [m.field for m in result.mappings]
    assert fields.count("notes") == 1


def test_llm_without_base_url_is_unavailable() -> None:
    """RIA-03/04 stay unimplemented regardless of configuration."""
    settings = load_settings(ai_provider="llm", llm_api_key="clave-ficticia", llm_model="modelo-x")
    provider = LLMProvider(settings)
    with pytest.raises(ProviderUnavailable):
        provider.extract_structured(TEXT)
    with pytest.raises(ProviderUnavailable):
        provider.describe(PieceContext(title="x"))


class _FakeResponse:
    def __init__(self, status_code: int, body: Any) -> None:
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self) -> Any:
        return self._body


def _llm_provider(
    monkeypatch: pytest.MonkeyPatch, content: str, status_code: int = 200
) -> LLMProvider:
    settings = load_settings(
        ai_provider="llm",
        llm_base_url="https://example-llm.test/v1",
        llm_api_key="clave-ficticia",
        llm_model="modelo-x",
    )
    provider = LLMProvider(settings)

    def fake_post(
        self: Any, url: str, *, headers: dict[str, str], json: dict[str, Any]
    ) -> _FakeResponse:
        if status_code != 200:
            return _FakeResponse(status_code, {"error": "boom"})
        return _FakeResponse(200, {"choices": [{"message": {"content": content}}]})

    import httpx2

    from matp_ai.providers import llm

    monkeypatch.setattr(httpx2.Client, "post", fake_post)
    monkeypatch.setattr(llm, "_sleep", lambda _seconds: None)
    return provider


def test_llm_extract_structured_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"fields": [{"field": "dimensions", '
        '"value": {"dimension": "alto", "value": 35, "unit": "cm"}, '
        '"source_fragment": "Alto 35 cm", "confidence": 0.9}]}'
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.extract_structured(TEXT)
    assert len(result.fields) == 1
    assert result.fields[0].value == {"dimension": "alto", "value": 35, "unit": "cm"}
    assert result.fields[0].source_fragment == "Alto 35 cm"


def test_llm_extract_structured_drops_hallucinated_fragment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = (
        '{"fields": [{"field": "dimensions", '
        '"value": {"dimension": "alto", "value": 99, "unit": "cm"}, '
        '"source_fragment": "texto que no está en el original", "confidence": 0.9}]}'
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.extract_structured(TEXT)
    assert result.fields == []
    assert result.message


def test_llm_extract_structured_no_data(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _llm_provider(monkeypatch, '{"fields": []}')
    result = provider.extract_structured("Pieza donada por la familia (sintético).")
    assert result.fields == []
    assert result.message


def test_llm_extract_structured_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _llm_provider(monkeypatch, "", status_code=500)
    with pytest.raises(ProviderUnavailable):
        provider.extract_structured(TEXT)


def test_llm_extract_structured_invalid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _llm_provider(monkeypatch, "esto no es JSON")
    with pytest.raises(ProviderUnavailable):
        provider.extract_structured(TEXT)


def test_llm_column_mapping_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"mappings": ['
        '{"column": "DENOMINACIÓN", "field": "denomination", "confidence": 0.9}, '
        '{"column": "OBSERVACIONES", "field": "notes", "confidence": 0.8}'
        "]}"
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.suggest_column_mapping(
        headers=["DENOMINACIÓN", "OBSERVACIONES"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    assert {m.column: m.field for m in result.mappings} == {
        "DENOMINACIÓN": "denomination",
        "OBSERVACIONES": "notes",
    }


def test_llm_column_mapping_drops_hallucinated_field(monkeypatch: pytest.MonkeyPatch) -> None:
    content = '{"mappings": [{"column": "FOTO", "field": "photo_filename", "confidence": 0.9}]}'
    provider = _llm_provider(monkeypatch, content)
    result = provider.suggest_column_mapping(
        headers=["FOTO"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    # "photo_filename" no está en _TARGET_FIELDS: una clave inventada o fuera de vocabulario
    # nunca se propone (mismo espíritu que el fragmento alucinado de extract_structured).
    assert result.mappings[0].field is None


def test_llm_column_mapping_missing_column_in_response(monkeypatch: pytest.MonkeyPatch) -> None:
    content = '{"mappings": [{"column": "DENOMINACIÓN", "field": "denomination", "confidence": 1}]}'
    provider = _llm_provider(monkeypatch, content)
    result = provider.suggest_column_mapping(
        headers=["DENOMINACIÓN", "OBSERVACIONES"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    # Hay exactamente un resultado por encabezado recibido, aunque el proveedor haya omitido uno.
    assert [m.column for m in result.mappings] == ["DENOMINACIÓN", "OBSERVACIONES"]
    assert result.mappings[1].field is None


def test_llm_column_mapping_never_repeats_a_field(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"mappings": ['
        '{"column": "OBSERVACIONES", "field": "notes", "confidence": 0.9}, '
        '{"column": "OBS", "field": "notes", "confidence": 0.9}'
        "]}"
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.suggest_column_mapping(
        headers=["OBSERVACIONES", "OBS"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    fields = [m.field for m in result.mappings]
    assert fields.count("notes") == 1


@pytest.mark.skipif(
    not os.environ.get("MATP_LLM_LIVE_TEST_API_KEY"),
    reason="Prueba en vivo: requiere MATP_LLM_LIVE_TEST_API_KEY, MATP_LLM_LIVE_TEST_BASE_URL y "
    "MATP_LLM_LIVE_TEST_MODEL (nunca corre en CI, consume cuota real del proveedor).",
)
def test_llm_extract_structured_live() -> None:
    settings = load_settings(
        ai_provider="llm",
        llm_base_url=os.environ["MATP_LLM_LIVE_TEST_BASE_URL"],
        llm_api_key=os.environ["MATP_LLM_LIVE_TEST_API_KEY"],
        llm_model=os.environ["MATP_LLM_LIVE_TEST_MODEL"],
    )
    provider = LLMProvider(settings)
    result = provider.extract_structured(TEXT)
    assert any(f.field == "dimensions" for f in result.fields)


def test_piece_context_rejects_sensitive_fields() -> None:
    with pytest.raises(ValueError, match="lender_name"):
        PieceContext.model_validate({"title": "x", "lender_name": "Comodante"})


_VALID_VALUES = SearchValidValues(
    collections={"MMZ": "Colección MMZ"},
    categories=["Figura zoomorfa"],
    materials=["Cerámica"],
    conservation_states=["Bueno", "Regular", "Malo"],
    locations=["Depósito 1"],
    tenure_regimes=["Propia", "Comodato", "Préstamo temporal"],
    alert_labels={"MISSING_PHOTO": "sin foto"},
)


def test_mock_interpret_search_is_deterministic() -> None:
    text = "figuras zoomorfas de ceramica sin foto en deposito 1"
    provider = MockProvider()
    first = provider.interpret_search(text, _VALID_VALUES)
    second = provider.interpret_search(text, _VALID_VALUES)
    assert first == second


def test_mock_interpret_search_matches_known_values() -> None:
    result = MockProvider().interpret_search("ceramica sin foto en deposito 1", _VALID_VALUES)
    assert result.material == "Cerámica"
    assert result.alert_code == "MISSING_PHOTO"
    assert result.location == "Depósito 1"


def test_mock_interpret_search_nothing_recognizable_keeps_text_as_q() -> None:
    result = MockProvider().interpret_search("algo que no calza con nada conocido", _VALID_VALUES)
    assert result.q == "algo que no calza con nada conocido"
    assert result.material is None
    assert result.category is None


def test_llm_interpret_search_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"material": "Cerámica", "alert_code": "MISSING_PHOTO", '
        '"location": "Depósito 1", "q": null}'
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.interpret_search("cerámica sin foto en depósito 1", _VALID_VALUES)
    assert result.material == "Cerámica"
    assert result.alert_code == "MISSING_PHOTO"
    assert result.location == "Depósito 1"
    assert result.q is None


def test_llm_interpret_search_drops_hallucinated_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un valor que el modelo inventa fuera de ``valid_values`` nunca llega al filtro (D2/D3)."""
    content = '{"material": "Oro macizo", "collection_key": "NO-EXISTE", "alert_code": "FAKE_CODE"}'
    provider = _llm_provider(monkeypatch, content)
    result = provider.interpret_search("piezas de oro", _VALID_VALUES)
    assert result.material is None
    assert result.collection_key is None
    assert result.alert_code is None


def test_llm_interpret_search_invalid_json_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _llm_provider(monkeypatch, "esto no es JSON")
    with pytest.raises(ProviderUnavailable):
        provider.interpret_search("cualquier cosa", _VALID_VALUES)


# --- Reintentos ante la sobrecarga del proveedor (fix ia-reintentos-gemini) ------------------
def _sequenced_provider(
    monkeypatch: pytest.MonkeyPatch, statuses: list[int], content: str = '{"fields": []}'
) -> tuple[LLMProvider, list[int], list[float]]:
    from matp_ai.providers import llm

    settings = load_settings(
        ai_provider="llm",
        llm_base_url="https://example-llm.test/v1",
        llm_api_key="clave-ficticia",
        llm_model="modelo-x",
    )
    calls: list[int] = []
    waits: list[float] = []
    pending = list(statuses)

    def fake_post(
        self: Any, url: str, *, headers: dict[str, str], json: dict[str, Any]
    ) -> _FakeResponse:
        status = pending.pop(0)
        calls.append(status)
        if status != 200:
            return _FakeResponse(status, {"error": {"code": status, "message": "high demand"}})
        return _FakeResponse(200, {"choices": [{"message": {"content": content}}]})

    import httpx2

    monkeypatch.setattr(httpx2.Client, "post", fake_post)
    monkeypatch.setattr(llm, "_sleep", waits.append)
    return LLMProvider(settings), calls, waits


def test_llm_retries_a_temporary_overload_and_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    provider, calls, waits = _sequenced_provider(monkeypatch, [503, 429, 200])
    result = provider.extract_structured(TEXT)
    assert calls == [503, 429, 200]
    assert waits == [1.5, 4.0]
    assert result.fields == []


def test_llm_gives_up_after_three_attempts(monkeypatch: pytest.MonkeyPatch) -> None:
    provider, calls, _waits = _sequenced_provider(monkeypatch, [503, 503, 503])
    with pytest.raises(ProviderUnavailable, match="503"):
        provider.extract_structured(TEXT)
    assert calls == [503, 503, 503]


def test_llm_does_not_retry_a_definitive_error(monkeypatch: pytest.MonkeyPatch) -> None:
    provider, calls, waits = _sequenced_provider(monkeypatch, [404])
    with pytest.raises(ProviderUnavailable, match="404"):
        provider.extract_structured(TEXT)
    assert calls == [404]
    assert waits == []


# --- Motivo de la duda (change importacion-mapeo-asistido) -------------------------------------
def test_mock_column_mapping_says_why_a_doubtful_column_is_doubtful() -> None:
    result = MockProvider().suggest_column_mapping(
        headers=["DENOMINACIÓN", "Procedencia lugar"], sample_rows=[], target_fields=_TARGET_FIELDS
    )
    by_column = {m.column: m for m in result.mappings}
    assert by_column["DENOMINACIÓN"].reason is None
    doubtful = by_column["Procedencia lugar"]
    assert doubtful.field == "provenance"
    assert doubtful.confidence < 0.8
    assert doubtful.reason == "«Procedencia lugar» solo se parece a «Procedencia»: confírmelo."


def test_llm_column_mapping_keeps_the_reason_only_with_a_field(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = (
        '{"mappings": ['
        '{"column": "Fecha", "field": "epoch_original_text", "confidence": 0.6, '
        '"reason": "  Puede ser la época o la fecha de registro.  "}, '
        '{"column": "FOTO", "field": null, "confidence": 0, "reason": "No es un campo."}'
        "]}"
    )
    targets = {**_TARGET_FIELDS, "epoch_original_text": "Época"}
    provider = _llm_provider(monkeypatch, content)
    result = provider.suggest_column_mapping(
        headers=["Fecha", "FOTO"], sample_rows=[], target_fields=targets
    )
    by_column = {m.column: m for m in result.mappings}
    assert by_column["Fecha"].reason == "Puede ser la época o la fecha de registro."
    assert by_column["FOTO"].reason is None


# --- Lectura del libro de registros (change digitalizacion-libro-registros) --------------------
_LEDGER_IMAGE = LedgerPageImage(media_type="image/jpeg", data_base64="Zm90bw==")


def test_mock_extract_ledger_page_returns_a_fixed_row() -> None:
    result = MockProvider().extract_ledger_page(_LEDGER_IMAGE)
    assert len(result.rows) == 1
    row = result.rows[0]
    assert row.inventory_code
    assert row.denomination
    assert row.provenance == "Loreto"
    assert 0 <= row.confidence <= 1


def test_llm_extract_ledger_page_parses_several_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"rows": ['
        '{"inventory_code": "I-2161", "denomination": "Canasta", '
        '"description": "Cesteria. Canasta circular.", '
        '"provenance": "Loreto", "conservation_state": "Bueno", "entry_date": "21-2-91", '
        '"additional_code": null, "confidence": 0.9}, '
        '{"inventory_code": "I-2166", "denomination": "Vasija", '
        '"description": "Ceramica escultorica.", '
        '"provenance": "Puno", "conservation_state": "Bueno", "entry_date": "21-2-91", '
        '"additional_code": "M.I.F.O.", "confidence": 0.8}'
        "]}"
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.extract_ledger_page(_LEDGER_IMAGE)
    assert [row.inventory_code for row in result.rows] == ["I-2161", "I-2166"]
    assert [row.denomination for row in result.rows] == ["Canasta", "Vasija"]
    assert result.rows[0].additional_code is None
    assert result.rows[1].additional_code == "M.I.F.O."


def test_llm_extract_ledger_page_empty_cell_is_none(monkeypatch: pytest.MonkeyPatch) -> None:
    content = (
        '{"rows": [{"inventory_code": null, "denomination": null, '
        '"description": "Objeto sin mas datos.", '
        '"provenance": null, "conservation_state": null, "entry_date": null, '
        '"additional_code": null, "confidence": 0.4}]}'
    )
    provider = _llm_provider(monkeypatch, content)
    result = provider.extract_ledger_page(_LEDGER_IMAGE)
    row = result.rows[0]
    assert row.inventory_code is None
    assert row.denomination is None
    assert row.provenance is None
    assert row.description == "Objeto sin mas datos."


def test_llm_extract_ledger_page_invalid_json_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _llm_provider(monkeypatch, "esto no es JSON")
    with pytest.raises(ProviderUnavailable):
        provider.extract_ledger_page(_LEDGER_IMAGE)
