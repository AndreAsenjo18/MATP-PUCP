"""Spec ia-asistiva — Juicio de pares de duplicados por IA (change ia-juicio-duplicados; RIA-02,
RN-009, RNF-014). Datos sintéticos."""

import json
import os
from typing import Any

import pytest
from fastapi.testclient import TestClient

from matp_ai.config import load_settings
from matp_ai.main import create_app
from matp_ai.providers import LLMProvider, MockProvider
from matp_ai.schemas import JudgeDuplicatesRequest, finish_judgments


def _side(**values: Any) -> dict[str, Any]:
    return {"kind": "piece", **values}


def _request(*pairs: tuple[str, dict[str, Any], dict[str, Any]]) -> JudgeDuplicatesRequest:
    return JudgeDuplicatesRequest.model_validate(
        {"pairs": [{"pair_id": pid, "a": a, "b": b} for pid, a, b in pairs]}
    )


SAME = (
    "same",
    _side(denomination="Retablo de San Marcos", collection="Colección RA"),
    _side(denomination="Retablo de San Marcos", collection="Colección RA"),
)
CODES = (
    "codes",
    _side(denomination="Mate burilado", code_i="I-0001"),
    _side(denomination="Mate burilado", code_i="I-0002"),
)
FAR = (
    "far",
    _side(denomination="Máscara de diablo", collection="Colección MMZ"),
    _side(denomination="Tejido de lana", collection="Colección MMZ"),
)
CLOSE = (
    "close",
    _side(denomination="Toro de Pucará grande", collection="Colección RA"),
    _side(denomination="Toro de Pucará", collection="Colección MBB"),
)


def test_mock_judges_each_pair_deterministically() -> None:
    request = _request(SAME, CODES, FAR, CLOSE)
    first = MockProvider().judge_duplicates(request)
    assert first.model_dump() == MockProvider().judge_duplicates(request).model_dump()
    verdicts = {v.pair_id: v for v in first.verdicts}
    assert verdicts["same"].verdict == "same" and verdicts["same"].confidence >= 0.85
    assert verdicts["codes"].verdict == "distinct"
    assert verdicts["far"].verdict == "distinct"
    assert verdicts["close"].verdict == "unsure" and verdicts["close"].confidence < 0.85
    for verdict in first.verdicts:
        assert verdict.reason  # una frase en español
    assert first.prompt_version == "juicio-duplicados-v1"


def test_verification_keeps_only_pairs_sent_valid_verdicts_and_clipped_confidence() -> None:
    request = _request(SAME, CODES)
    result = finish_judgments(
        [
            {"pair_id": "otro", "verdict": "same", "confidence": 0.9, "reason": "no se envió"},
            {"pair_id": "same", "verdict": "probable", "confidence": 0.9, "reason": "inválido"},
            {"pair_id": "same", "verdict": "SAME", "confidence": 7, "reason": "  Igual  todo "},
            {"pair_id": "same", "verdict": "distinct", "confidence": 0.9, "reason": "repetido"},
            {"pair_id": "codes", "verdict": "distinct", "confidence": -2, "reason": ""},
            "esto no es un veredicto",
        ],
        request,
    )
    assert [(v.pair_id, v.verdict, v.confidence, v.reason) for v in result.verdicts] == [
        ("same", "same", 1.0, "Igual todo"),
        ("codes", "distinct", 0.0, "Sin motivo."),
    ]


@pytest.mark.parametrize(
    "extra",
    [
        {"lender_name": "Comodante sintético"},
        {"recorded_by": "Registrador sintético"},
        {"notes": "Observación sintética"},
        {"loan_agreement_ref": "CONV-1"},
        {"legal_owner": "Propietario sintético"},
        {"source_payload": {"OBS": "x"}},
        {"raw_data": {"OBS": "x"}},
    ],
)
def test_request_accepts_only_catalog_fields(extra: dict[str, Any]) -> None:
    """RNF-014: a side cannot carry personal data, and neither can the pair."""
    with pytest.raises(ValueError):
        _request(("p", _side(denomination="x", **extra), _side(denomination="y")))
    with pytest.raises(ValueError):
        JudgeDuplicatesRequest.model_validate(
            {"pairs": [{"pair_id": "p", "a": _side(), "b": _side(), **extra}]}
        )


def test_endpoint_returns_pending_verdicts() -> None:
    client = TestClient(create_app(load_settings(ai_provider="mock"), MockProvider()))
    response = client.post("/v1/judge-duplicates", json=_request(SAME, FAR).model_dump())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["function_code"] == "RIA_02"
    assert body["status"] == "PENDING_REVIEW" and body["requires_human_approval"] is True
    assert [v["pair_id"] for v in body["result"]["verdicts"]] == ["same", "far"]


# ----------------------------------------------------------------------------- proveedor LLM
def _settings() -> Any:
    return load_settings(
        ai_provider="llm",
        llm_base_url="https://example-llm.test/v1",
        llm_api_key="clave-ficticia",
        llm_model="modelo-x",
    )


def test_llm_payload_carries_only_the_pairs_catalog_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[dict[str, Any]] = []

    def fake(self: LLMProvider, payload: dict[str, Any]) -> str:
        sent.append(payload)
        return '{"verdicts": []}'

    monkeypatch.setattr(LLMProvider, "_chat_completion", fake)
    LLMProvider(_settings()).judge_duplicates(_request(SAME, CODES))
    payload = sent[0]
    assert set(payload) == {"model", "messages", "temperature", "response_format"}
    system, user = payload["messages"]
    assert "no uses conocimiento externo" in system["content"]
    body = json.loads(user["content"])
    assert [pair["pair_id"] for pair in body["pairs"]] == ["same", "codes"]
    allowed = {
        "kind",
        "denomination",
        "collection",
        "tenure_regime",
        "code_i",
        "other_codes",
        "author",
        "provenance",
        "period",
        "dimensions",
        "description",
    }
    for pair in body["pairs"]:
        assert set(pair) == {"pair_id", "a", "b"}
        assert set(pair["a"]) <= allowed and set(pair["b"]) <= allowed


def test_llm_answer_is_verified_before_leaving_the_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = json.dumps(
        {
            "verdicts": [
                {"pair_id": "same", "verdict": "same", "confidence": 0.93, "reason": "Igual."},
                {"pair_id": "inventado", "verdict": "same", "confidence": 1, "reason": "x"},
                {"pair_id": "codes", "verdict": "quizás", "confidence": 0.9, "reason": "x"},
            ]
        }
    )
    monkeypatch.setattr(LLMProvider, "_chat_completion", lambda self, payload: content)
    provider = LLMProvider(_settings())
    client = TestClient(create_app(_settings(), provider))
    body = client.post("/v1/judge-duplicates", json=_request(SAME, CODES).model_dump()).json()
    assert [(v["pair_id"], v["verdict"]) for v in body["result"]["verdicts"]] == [("same", "same")]


@pytest.mark.skipif(
    not os.environ.get("MATP_LLM_LIVE_TEST_API_KEY"),
    reason="Prueba en vivo: requiere MATP_LLM_LIVE_TEST_API_KEY, MATP_LLM_LIVE_TEST_BASE_URL y "
    "MATP_LLM_LIVE_TEST_MODEL (nunca corre en CI, consume cuota real del proveedor).",
)
def test_llm_judge_duplicates_live() -> None:
    settings = load_settings(
        ai_provider="llm",
        llm_base_url=os.environ["MATP_LLM_LIVE_TEST_BASE_URL"],
        llm_api_key=os.environ["MATP_LLM_LIVE_TEST_API_KEY"],
        llm_model=os.environ["MATP_LLM_LIVE_TEST_MODEL"],
    )
    request = _request(SAME, CODES)
    raw = LLMProvider(settings).judge_duplicates(request)
    verdicts = {
        v.pair_id: v.verdict for v in finish_judgments(list(raw.verdicts), request).verdicts
    }
    assert verdicts.get("codes") == "distinct"
