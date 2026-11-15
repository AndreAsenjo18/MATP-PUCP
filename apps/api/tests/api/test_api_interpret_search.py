"""``POST /ai/interpret-search`` (change busqueda-lenguaje-natural, RIA-06).

Corre contra el proveedor mock real, igual que `test_api_suggest_column_mapping.py`: no persiste
nada (no hay `AiSuggestion`, no hay paso de aprobación porque no hay nada que guardar, RN-009 no
aplica).
"""

from typing import Any

import pytest
from matp_ai.providers.base import ProviderUnavailable
from starlette.routing import Mount

from tests.api.conftest import SeededApi

_MATERIAL_ID = "01900000-0000-7000-8000-00000000a001"
_CATEGORY_ID = "01900000-0000-7000-8000-00000000a002"
_LOCATION_ID = "01900000-0000-7000-8000-00000000a003"


def _ai_subapp(seeded_api: SeededApi) -> Any:
    for route in seeded_api.app.routes:
        if isinstance(route, Mount) and route.name == "ai":
            return route.app
    raise RuntimeError("El servicio de IA no está montado.")


def test_interpret_search_resolves_known_values_to_real_ids(seeded_api: SeededApi) -> None:
    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/interpret-search",
        json={
            "text": "ceramica sin foto en deposito 1",
            "materials": [{"id": _MATERIAL_ID, "label": "Cerámica"}],
            "categories": [{"id": _CATEGORY_ID, "label": "Figura zoomorfa"}],
            "locations": [{"id": _LOCATION_ID, "label": "Depósito 1"}],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["material_id"] == _MATERIAL_ID
    assert body["location_id"] == _LOCATION_ID
    assert body["alert_code"] == "MISSING_PHOTO"
    # "Figura zoomorfa" no aparece literalmente en el texto: el mock no la calza (esperado).
    assert body["category_id"] is None


def test_interpret_search_never_invents_a_value_outside_the_lists(
    seeded_api: SeededApi,
) -> None:
    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/interpret-search",
        json={
            "text": "oro macizo de otro planeta",
            "materials": [{"id": _MATERIAL_ID, "label": "Cerámica"}],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["material_id"] is None
    assert body["q"] == "oro macizo de otro planeta"


def test_interpret_search_never_sends_sensitive_fields(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}
    subapp = _ai_subapp(seeded_api)
    real_provider = subapp.state.provider
    original = real_provider.interpret_search

    def _spy(text: str, valid_values: Any) -> Any:
        captured["valid_values"] = valid_values.model_dump()
        return original(text, valid_values)

    monkeypatch.setattr(real_provider, "interpret_search", _spy)

    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/interpret-search", json={"text": "piezas valoradas en más de mil soles"}
    )
    assert response.status_code == 200, response.text
    sent = str(captured["valid_values"])
    assert "valuation" not in sent
    assert "lender_name" not in sent
    assert "loan_agreement_ref" not in sent


def test_interpret_search_degrades_when_ai_unavailable(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    subapp = _ai_subapp(seeded_api)

    def _broken(*_args: object, **_kwargs: object) -> None:
        raise ProviderUnavailable("fuera de servicio (prueba)")

    monkeypatch.setattr(subapp.state.provider, "interpret_search", _broken)

    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post("/api/v1/ai/interpret-search", json={"text": "cualquier cosa"})
    assert response.status_code == 503
    assert response.json()["code"] == "ai_unavailable"


def test_interpret_search_requires_login(seeded_api: SeededApi) -> None:
    response = seeded_api.client.post("/api/v1/ai/interpret-search", json={"text": "algo"})
    assert response.status_code == 401
