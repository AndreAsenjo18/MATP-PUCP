"""Spec importacion-datos — Patrón de cámara añadido por el Administrador, por API (RN-010).

Change importacion-fotos-a-catalogo, task 3.1 (design D3): ``PUT
/normalization-settings/photo_camera_patterns`` saves the extra camera name patterns, rejects an
invalid expression and needs no impact preview: it changes no stored identifier. Synthetic data
only (RNF-014).
"""

from tests.api.conftest import Pipeline

URL = "/api/v1/normalization-settings/photo_camera_patterns"


def test_without_stored_patterns_the_list_is_empty(pipeline: Pipeline) -> None:
    response = pipeline.login("COLLECTIONS_MANAGER").get(URL)

    assert response.status_code == 200, response.text
    assert response.json()["value"] == []


def test_an_invalid_expression_is_rejected(pipeline: Pipeline) -> None:
    response = pipeline.login("COLLECTIONS_MANAGER").put(URL, json={"value": [r"FOTO(\d{5}"]})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_setting_value"
    assert "FOTO(" in response.json()["message"]


def test_a_new_pattern_is_saved(pipeline: Pipeline) -> None:
    client = pipeline.login("COLLECTIONS_MANAGER")

    saved = client.put(URL, json={"value": [r"FOTO\d{5}"]})

    assert saved.status_code == 200, saved.text
    assert client.get(URL).json()["value"] == [r"FOTO\d{5}"]
