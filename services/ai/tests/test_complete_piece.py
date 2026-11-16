"""Spec ia-asistiva — «Completar ficha» con su prueba (change ia-completar-ficha; RIA-01, RIA-03,
RN-009, RN-010, RNF-014). Datos sintéticos."""

import json
import os
from typing import Any

import pytest
from fastapi.testclient import TestClient

from matp_ai.config import load_settings
from matp_ai.main import create_app
from matp_ai.providers import LLMProvider, MockProvider
from matp_ai.schemas import (
    CompletePieceRequest,
    CompletionEvidence,
    CompletionProposal,
    finish_completion,
)

DESCRIPTION = (
    "Caja de resonancia de madera de cedro, elaborada en Ayacucho. Mide 1,20 m de alto. "
    "Buen estado."
)
VOCABULARIES = {
    "category": [{"code": "INSTRUMENTO_MUSICAL", "label": "Instrumento musical"}],
    "materials": [{"code": "MADERA", "label": "Madera"}, {"code": "CUERO", "label": "Cuero"}],
    "conservation_status": [{"code": "BUENO", "label": "Bueno"}, {"code": "MALO", "label": "Malo"}],
}
ALL_FIELDS = [
    "category",
    "materials",
    "provenance",
    "epoch",
    "dimensions_text",
    "conservation_status",
]


def _request(**overrides: Any) -> CompletePieceRequest:
    body: dict[str, Any] = {
        "texts": {
            "denomination": "Charango (sintético)",
            "description": DESCRIPTION,
            "notes": None,
        },
        "fields": ALL_FIELDS,
        "vocabularies": VOCABULARIES,
        "image": None,
    }
    body.update(overrides)
    return CompletePieceRequest.model_validate(body)


def _by_field(result: Any) -> dict[str, Any]:
    return {p.field: p for p in result.proposals}


def test_mock_proposes_from_the_piece_text_with_a_literal_quote() -> None:
    request = _request()
    result = finish_completion(MockProvider().complete_piece(request).proposals, request)
    proposals = _by_field(result)
    # Escenario «Propuesta con cita»: el término de la lista y la cita a la vista.
    assert proposals["materials"].value == "MADERA"
    assert proposals["materials"].label == "Madera"
    assert proposals["materials"].evidence.quote == "madera de cedro"
    assert proposals["materials"].evidence.text_field == "description"
    assert proposals["provenance"].value == "Ayacucho"
    assert proposals["conservation_status"].value == "BUENO"
    assert proposals["dimensions_text"].evidence.quote == "1,20 m de alto"
    for proposal in result.proposals:
        assert proposal.evidence.quote and proposal.evidence.quote in DESCRIPTION + "Charango"
    # Escenario «Sin dato en la ficha»: no dice la época, no se propone época.
    assert "epoch" not in proposals
    assert result.not_found == ["epoch"]


def test_mock_is_deterministic() -> None:
    request = _request()
    first = MockProvider().complete_piece(request)
    second = MockProvider().complete_piece(request)
    assert first.model_dump() == second.model_dump()


def test_mock_only_proposes_terms_of_the_museum_lists() -> None:
    request = _request(vocabularies={"materials": [{"code": "CUERO", "label": "Cuero"}]})
    result = finish_completion(MockProvider().complete_piece(request).proposals, request)
    assert "materials" not in _by_field(result)
    assert "category" not in _by_field(result)  # sin categorías en la lista, no hay categoría


def test_mock_only_answers_the_requested_fields() -> None:
    request = _request(fields=["epoch"])
    result = finish_completion(MockProvider().complete_piece(request).proposals, request)
    assert result.proposals == []
    assert result.not_found == ["epoch"]


def _proposal(field: str, value: Any, evidence: dict[str, Any], confidence: float = 0.9) -> Any:
    return CompletionProposal(
        field=field,  # type: ignore[arg-type]
        value=value,
        label="",
        confidence=confidence,
        evidence=CompletionEvidence.model_validate(evidence),
    )


def test_verification_drops_proposals_without_evidence() -> None:
    request = _request(fields=["provenance", "materials", "category"])
    result = finish_completion(
        [
            # Cita que no está en la ficha: conocimiento general del modelo.
            _proposal("provenance", "Huamanga", {"source": "text", "quote": "hecho en Huamanga"}),
            # Sin cita.
            _proposal("materials", "MADERA", {"source": "text", "quote": None}),
            # Término inventado, fuera de la lista del museo.
            _proposal("category", "CORDOFONO", {"source": "text", "quote": "Charango"}),
            # Campo no pedido.
            _proposal("epoch", "siglo XX", {"source": "text", "quote": "Buen estado"}),
        ],
        request,
    )
    assert result.proposals == []
    assert result.not_found == ["provenance", "materials", "category"]


def test_verification_accepts_a_label_and_returns_the_term_code() -> None:
    request = _request(fields=["materials"])
    result = finish_completion(
        [_proposal("materials", "madera", {"source": "text", "quote": "madera de cedro"})], request
    )
    assert [(p.value, p.label) for p in result.proposals] == [("MADERA", "Madera")]


def test_photo_evidence_only_with_a_photo_for_visible_fields_and_high_confidence() -> None:
    image = {"media_type": "image/webp", "data_base64": "UklGRg=="}
    seen = _proposal("materials", "CUERO", {"source": "image"}, confidence=0.85)
    without_photo = finish_completion([seen], _request(fields=["materials"]))
    assert without_photo.proposals == []

    with_photo = _request(fields=["materials", "provenance"], image=image)
    result = finish_completion(
        [
            seen,
            _proposal("provenance", "Cusco", {"source": "image"}, confidence=0.95),
            _proposal("materials", "MADERA", {"source": "image"}, confidence=0.5),
        ],
        with_photo,
    )
    assert [(p.field, p.value, p.evidence.source) for p in result.proposals] == [
        ("materials", "CUERO", "image")
    ]
    assert result.not_found == ["provenance"]


def test_several_materials_are_separate_proposals() -> None:
    request = _request(
        texts={"denomination": "Tambor (sintético)", "description": "Madera y cuero de cabra."},
        fields=["materials"],
    )
    result = finish_completion(MockProvider().complete_piece(request).proposals, request)
    assert sorted(p.value for p in result.proposals) == ["CUERO", "MADERA"]


def test_request_accepts_only_catalog_fields() -> None:
    """RNF-014: comodante, registrador ni registro de origen caben en el cuerpo."""
    for extra in (
        {"lender_name": "Comodante sintético"},
        {"recorded_by": "Registrador sintético"},
        {"source_payload": {"OBSERVACIONES": "x"}},
    ):
        with pytest.raises(ValueError):
            _request(texts={"denomination": "x", **extra})
        with pytest.raises(ValueError):
            CompletePieceRequest.model_validate(
                {"texts": {"denomination": "x"}, "fields": ["epoch"], **extra}
            )


def test_endpoint_returns_a_pending_proposal() -> None:
    client = TestClient(create_app(load_settings(ai_provider="mock"), MockProvider()))
    response = client.post("/v1/complete-piece", json=_request().model_dump())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "PENDING_REVIEW"
    assert body["requires_human_approval"] is True
    assert body["result"]["prompt_version"] == "completar-ficha-v1"
    assert any(p["field"] == "materials" for p in body["result"]["proposals"])


# ----------------------------------------------------------------------------- proveedor LLM
class _FakeResponse:
    def __init__(self, body: Any) -> None:
        self.status_code = 200
        self._body = body
        self.text = str(body)

    def json(self) -> Any:
        return self._body


def _llm(monkeypatch: pytest.MonkeyPatch, content: str, sent: list[dict[str, Any]]) -> LLMProvider:
    settings = load_settings(
        ai_provider="llm",
        llm_base_url="https://example-llm.test/v1",
        llm_api_key="clave-ficticia",
        llm_model="modelo-x",
    )

    def fake_post(self: Any, url: str, *, headers: dict[str, str], json: dict[str, Any]) -> Any:
        sent.append(json)
        return _FakeResponse({"choices": [{"message": {"content": content}}]})

    import httpx2

    monkeypatch.setattr(httpx2.Client, "post", fake_post)
    return LLMProvider(settings)


def test_llm_payload_carries_only_the_piece_text_lists_and_photo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[dict[str, Any]] = []
    provider = _llm(monkeypatch, '{"proposals": [], "not_found": ["epoch"]}', sent)
    image = {"media_type": "image/webp", "data_base64": "UklGRg=="}
    provider.complete_piece(_request(image=image))
    payload = sent[0]
    system, user = payload["messages"]
    assert payload["temperature"] == 0
    assert "No uses conocimiento general" in system["content"]
    assert "not_found" in system["content"]
    assert '"MADERA": "Madera"' in system["content"]  # la lista del museo, no otra
    text_part, image_part = user["content"]
    assert text_part["text"] == (
        "Ficha de la pieza:\nDenominación: Charango (sintético)\nDescripción: " + DESCRIPTION
    )
    assert image_part["image_url"]["url"] == "data:image/webp;base64,UklGRg=="
    # Nada más sale hacia el proveedor: solo modelo, mensajes y opciones de respuesta.
    assert set(payload) == {"model", "messages", "temperature", "response_format"}

    sent.clear()
    provider.complete_piece(_request())
    assert isinstance(sent[0]["messages"][1]["content"], str)  # sin foto, solo texto
    assert "foto" not in sent[0]["messages"][0]["content"]


def test_llm_answer_is_verified_before_leaving_the_service(monkeypatch: pytest.MonkeyPatch) -> None:
    content = json.dumps(
        {
            "proposals": [
                {
                    "field": "materials",
                    "value": "MADERA",
                    "confidence": 0.9,
                    "evidence": {"source": "text", "quote": "madera de cedro"},
                },
                {
                    "field": "epoch",
                    "value": "siglo XIX",
                    "confidence": 0.7,
                    "evidence": {"source": "text", "quote": "típico del siglo XIX"},
                },
                "esto no es una propuesta",
            ],
            "not_found": [],
        }
    )
    settings = load_settings(
        ai_provider="llm",
        llm_base_url="https://example-llm.test/v1",
        llm_api_key="clave-ficticia",
        llm_model="modelo-x",
    )
    provider = LLMProvider(settings)
    # Se reemplaza la llamada al modelo, no httpx: el cliente de pruebas también usa httpx.
    monkeypatch.setattr(LLMProvider, "_chat_completion", lambda self, payload: content)
    client = TestClient(create_app(settings, provider))
    body = client.post("/v1/complete-piece", json=_request().model_dump()).json()
    proposals = body["result"]["proposals"]
    assert [(p["field"], p["value"]) for p in proposals] == [("materials", "MADERA")]
    assert "epoch" in body["result"]["not_found"]


@pytest.mark.skipif(
    not os.environ.get("MATP_LLM_LIVE_TEST_API_KEY"),
    reason="Prueba en vivo: requiere MATP_LLM_LIVE_TEST_API_KEY, MATP_LLM_LIVE_TEST_BASE_URL y "
    "MATP_LLM_LIVE_TEST_MODEL (nunca corre en CI, consume cuota real del proveedor).",
)
def test_llm_complete_piece_live() -> None:
    settings = load_settings(
        ai_provider="llm",
        llm_base_url=os.environ["MATP_LLM_LIVE_TEST_BASE_URL"],
        llm_api_key=os.environ["MATP_LLM_LIVE_TEST_API_KEY"],
        llm_model=os.environ["MATP_LLM_LIVE_TEST_MODEL"],
    )
    request = _request()
    result = finish_completion(LLMProvider(settings).complete_piece(request).proposals, request)
    proposals = _by_field(result)
    assert proposals["materials"].value == "MADERA"
    assert "epoch" not in proposals
