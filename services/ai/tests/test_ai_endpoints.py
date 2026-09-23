"""Spec ia-asistiva — endpoints del servicio IA y contrato exportado (RN-009, RNF-009)."""

import pytest
from fastapi.testclient import TestClient

from matp_ai.config import load_settings
from matp_ai.main import create_app
from matp_ai.openapi_export import DEFAULT_OUTPUT, build_spec, render

TEXT = "Alto 35 cm, ancho 20 cm. Exhibida en la muestra de retablos 1998"


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(load_settings(ai_provider="mock")))


def test_extract_returns_pending_review_proposal(client: TestClient) -> None:
    first = client.post("/v1/extract-structured", json={"text": TEXT})
    second = client.post("/v1/extract-structured", json={"text": TEXT})
    assert first.status_code == 200
    body = first.json()
    assert body == second.json()
    assert body["function_code"] == "RIA_01"
    assert body["provider"] == "mock"
    assert body["status"] == "PENDING_REVIEW"
    assert body["requires_human_approval"] is True
    assert len(body["result"]["fields"]) == 3


def test_empty_text_is_rejected(client: TestClient) -> None:
    response = client.post("/v1/extract-structured", json={"text": "   "})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "request_validation_failed"
    assert "obligatorio" in body["message"]


def test_suggest_terms_and_describe_endpoints(client: TestClient) -> None:
    piece = {"title": "Mate burilado de Cochas (sintético)", "materials": ["calabaza"]}
    terms = client.post("/v1/suggest-terms", json=piece).json()
    assert terms["function_code"] == "RIA_03"
    assert {s["term_code"] for s in terms["result"]["suggestions"]} >= {"MATE_BURILADO", "CALABAZA"}
    description = client.post("/v1/describe", json=piece).json()
    assert description["function_code"] == "RIA_04"
    assert "calabaza" in description["result"]["text"]


def test_sensitive_fields_are_not_accepted(client: TestClient) -> None:
    response = client.post("/v1/describe", json={"title": "x", "lender_name": "Comodante"})
    assert response.status_code == 422


def test_llm_provider_unavailable_returns_503() -> None:
    settings = load_settings(ai_provider="llm", llm_api_key="clave-ficticia", llm_model="modelo-x")
    with TestClient(create_app(settings)) as client:
        response = client.post("/v1/extract-structured", json={"text": TEXT})
        health = client.get("/health")
    assert response.status_code == 503
    assert response.json()["code"] == "ai_provider_unavailable"
    assert health.status_code == 200
    assert health.json()["provider"] == "llm"


def test_committed_ai_openapi_is_up_to_date() -> None:
    assert DEFAULT_OUTPUT.exists(), "Falta docs/api/ai-openapi.json. Ejecute: npm run openapi"
    assert DEFAULT_OUTPUT.read_text(encoding="utf-8") == render(build_spec()), (
        "docs/api/ai-openapi.json desactualizado. Ejecute: npm run openapi"
    )
