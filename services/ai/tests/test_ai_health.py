"""Spec plataforma — proveedor de IA por defecto y proveedor desconocido (RN-009)."""

import pytest
from fastapi.testclient import TestClient

from matp_ai.config import ConfigurationError, load_settings
from matp_ai.main import create_app


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("AI_PROVIDER", "LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL"):
        monkeypatch.delenv(name, raising=False)


def test_default_provider_is_mock() -> None:
    app = create_app(load_settings())
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["provider"] == "mock"
    assert response.json()["service"] == "ai"


def test_unknown_provider_refuses_to_start(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "openai-direct")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "openai-direct" in str(excinfo.value)
    assert "mock, llm" in str(excinfo.value)


def test_llm_provider_requires_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "llm")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "LLM_API_KEY" in str(excinfo.value)
