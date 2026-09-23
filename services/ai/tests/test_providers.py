"""Spec ia-asistiva — Contrato del proveedor de IA (RIA-01, RIA-03, RIA-04, RN-009)."""

import pytest

from matp_ai.config import load_settings
from matp_ai.providers import LLMProvider, MockProvider, ProviderUnavailable, get_provider
from matp_ai.schemas import PieceContext

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


def test_llm_stub_is_unavailable() -> None:
    settings = load_settings(ai_provider="llm", llm_api_key="clave-ficticia", llm_model="modelo-x")
    provider = LLMProvider(settings)
    with pytest.raises(ProviderUnavailable):
        provider.extract_structured(TEXT)
    with pytest.raises(ProviderUnavailable):
        provider.describe(PieceContext(title="x"))


def test_piece_context_rejects_sensitive_fields() -> None:
    with pytest.raises(ValueError, match="lender_name"):
        PieceContext.model_validate({"title": "x", "lender_name": "Comodante"})
