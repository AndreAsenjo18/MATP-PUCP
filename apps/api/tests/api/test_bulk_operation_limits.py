"""Configurable limits of the bulk operations (descargas-masivas-y-enriquecimiento-lote, task 1.2).

Spec multimedia, «Descarga masiva de fotografías por paquete», and spec ia-asistiva,
«Descripciones preliminares por lote como sugerencias pendientes», scenarios «Lote demasiado
grande». Both routes are still stubs (501): the size is checked before, so a valid request reaches
the stub and an invalid one never does. Limits [SUPUESTO AA1]. Synthetic data only (RNF-014).
"""

import uuid

import pytest

from tests.api.conftest import SeededApi

ROUTES = {
    "/api/v1/media/bulk-download": ("media_bulk_download_max_pieces", 200),
    "/api/v1/ai/batch-enrich": ("ai_batch_enrich_max_pieces", 50),
}


def _ids(count: int) -> list[str]:
    return [str(uuid.uuid4()) for _ in range(count)]


@pytest.mark.parametrize("path", ROUTES)
def test_an_empty_list_is_422(seeded_api: SeededApi, path: str) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")

    assert client.post(path, json={"piece_ids": []}).status_code == 422


@pytest.mark.parametrize("path", ROUTES)
def test_the_default_limit_is_the_assumption_aa1(seeded_api: SeededApi, path: str) -> None:
    setting, default = ROUTES[path]
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    assert getattr(seeded_api.app.state.settings, setting) == default

    too_many = client.post(path, json={"piece_ids": _ids(default + 1)})
    at_the_limit = client.post(path, json={"piece_ids": _ids(default)})

    assert too_many.status_code == 422, too_many.text
    error = too_many.json()
    assert error["code"] == "batch_too_large"
    assert error["details"] == {"limit": default, "received": default + 1}
    assert str(default) in error["message"]
    assert at_the_limit.status_code == 501  # the stub: implemented in sections 2 and 3


@pytest.mark.parametrize("path", ROUTES)
def test_the_limit_comes_from_the_settings(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    setting, _default = ROUTES[path]
    monkeypatch.setattr(seeded_api.app.state.settings, setting, 3)
    client = seeded_api.login_as("COLLECTIONS_MANAGER")

    over = client.post(path, json={"piece_ids": _ids(4)})
    within = client.post(path, json={"piece_ids": _ids(3)})

    assert (over.status_code, over.json()["details"]["limit"]) == (422, 3)
    assert within.status_code == 501


def test_the_limits_are_documented_in_the_env_example() -> None:
    from pathlib import Path

    example = (Path(__file__).resolve().parents[4] / ".env.example").read_text(encoding="utf-8")

    assert "MEDIA_BULK_DOWNLOAD_MAX_PIECES=200" in example
    assert "AI_BATCH_ENRICH_MAX_PIECES=50" in example
