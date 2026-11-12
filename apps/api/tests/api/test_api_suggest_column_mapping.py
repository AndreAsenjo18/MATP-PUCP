"""``POST /ai/suggest-column-mapping`` (change carga-masiva-con-ia, tarea 1.1).

Corre contra el proveedor mock real, igual que ``test_api_ai_extraction_pipeline.py``: no
persiste nada (a diferencia de ``/ai/suggest-cataloging``), así que no hay un paso de aprobación.
"""

from typing import Any

import pytest
from matp_ai.providers.base import ProviderUnavailable
from starlette.routing import Mount

from tests.api.conftest import SeededApi


def _ai_subapp(seeded_api: SeededApi) -> Any:
    for route in seeded_api.app.routes:
        if isinstance(route, Mount) and route.name == "ai":
            return route.app
    raise RuntimeError("El servicio de IA no está montado.")


def test_suggest_column_mapping_proposes_known_fields(seeded_api: SeededApi) -> None:
    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/suggest-column-mapping",
        json={
            "headers": ["DENOMINACIÓN", "PROCEDENCIA", "OBSERVACIONES", "FOTO"],
            "sample_rows": [
                {
                    "DENOMINACIÓN": "Arpa andina",
                    "PROCEDENCIA": "Puno",
                    "OBSERVACIONES": "Mide 95 cm de alto.",
                    "FOTO": "I-9201.jpg",
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    by_column = {m["column"]: m["field"] for m in body["mappings"]}
    assert by_column["DENOMINACIÓN"] == "denomination"
    assert by_column["PROCEDENCIA"] == "provenance"
    assert by_column["OBSERVACIONES"] == "notes"
    # "FOTO" no está en el vocabulario expuesto por esta operación (fuera de alcance, D2).
    assert by_column["FOTO"] is None


def test_suggest_column_mapping_never_sends_sensitive_headers(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}
    subapp = _ai_subapp(seeded_api)
    real_provider = subapp.state.provider
    original = real_provider.suggest_column_mapping

    def _spy(
        headers: list[str], sample_rows: list[dict[str, Any]], target_fields: dict[str, str]
    ) -> Any:
        captured["headers"] = headers
        captured["sample_rows"] = sample_rows
        captured["target_fields"] = target_fields
        return original(headers, sample_rows, target_fields)

    monkeypatch.setattr(real_provider, "suggest_column_mapping", _spy)

    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/suggest-column-mapping",
        json={
            "headers": ["DENOMINACIÓN", "COMODANTE"],
            "sample_rows": [{"DENOMINACIÓN": "Virgen del Rosario", "COMODANTE": "Familia X"}],
        },
    )
    assert response.status_code == 200, response.text
    # Las columnas siguen viajando (hay que decirle a la IA que "COMODANTE" existe para que
    # proponga null), pero su valor de muestra nunca sale del backend.
    assert captured["sample_rows"] == [{"DENOMINACIÓN": "Virgen del Rosario"}]
    assert "lender_name" not in captured["target_fields"]
    assert "loan_agreement_ref" not in captured["target_fields"]


def test_suggest_column_mapping_degrades_when_ai_unavailable(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The route closes over the provider instance at app-creation time (``main.py``), not over
    # ``app.state.provider`` read per request — so the broken method is patched onto that same
    # instance in place, rather than swapping ``state.provider`` for a different object.
    subapp = _ai_subapp(seeded_api)

    def _broken(*_args: object, **_kwargs: object) -> None:
        raise ProviderUnavailable("fuera de servicio (prueba)")

    monkeypatch.setattr(subapp.state.provider, "suggest_column_mapping", _broken)

    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/suggest-column-mapping",
        json={"headers": ["DENOMINACIÓN"], "sample_rows": []},
    )
    assert response.status_code == 503
    assert response.json()["code"] == "ai_unavailable"


def test_suggest_column_mapping_requires_imports_prepare_permission(seeded_api: SeededApi) -> None:
    # STORAGE_STAFF no tiene `imports.prepare` (seed/reference.py).
    storage_staff = seeded_api.login_as("STORAGE_STAFF")
    response = storage_staff.post(
        "/api/v1/ai/suggest-column-mapping",
        json={"headers": ["DENOMINACIÓN"], "sample_rows": []},
    )
    assert response.status_code == 403
