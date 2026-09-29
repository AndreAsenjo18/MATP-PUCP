"""Change alinear-api-endpoints-v1, tareas 3.1 y 3.2 — enumerados del contrato en español.

El contrato (`docs/fuentes/endpoints-api-v1.yaml`) exige `Propiedad`, `Comodato`,
`Préstamo Temporal` y `Frontal`, `Perfil`, `Posterior`, `Detalle`, `Abierto`, `Cerrado`;
el dominio conserva los códigos en inglés (ADR-002) y la traducción vive en
`app/api/enums.py`, aplicada en la frontera de la API (Req: Valores de enumerado
del contrato en la API; RNF-009, RF-005, RF-013, RF-016).
"""

import pytest
from fastapi.testclient import TestClient

from app.api.enums import (
    LOCATION_LEVEL_LABELS,
    PHOTO_VIEW_TYPE_LABELS,
    TENURE_REGIME_LABELS,
    code_of,
    label_of,
    serialize_label,
)
from app.core.errors import ValidationFailed
from app.modules.catalog.enums import TenureRegime
from app.modules.locations.models import LocationLevel
from tests.api.conftest import CATALOGUER, MANAGER, SeededApi, as_user

H = as_user(CATALOGUER)
M = as_user(MANAGER)

SPANISH_TENURE = {"Propiedad", "Comodato", "Préstamo Temporal"}
ENGLISH_TENURE = {"OWNED", "LOAN_FOR_USE", "TEMPORARY_LOAN"}
SPANISH_LEVELS = {"Sede", "Depósito", "Mueble", "Nivel", "Contenedor"}
ENGLISH_LEVELS = {"SITE", "SPACE", "FURNITURE", "SHELF_LEVEL", "CONTAINER"}
# `Superior` no está en el contrato y se expone con su código propio (fallback).
SPANISH_VIEWS = {"Frontal", "Perfil", "Posterior", "Detalle", "Abierto", "Cerrado"}
ENGLISH_VIEWS = {"FRONTAL", "PERFIL", "POSTERIOR", "DETALLE", "ABIERTA", "CERRADA"}


def _walk_values(node: object, keys: set[str]) -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in keys and isinstance(value, str):
                found.append(value)
            else:
                found.extend(_walk_values(value, keys))
    elif isinstance(node, list):
        for item in node:
            found.extend(_walk_values(item, keys))
    return found


# ------------------------------------------------------------------ 3.1 ida y vuelta


def test_tenure_roundtrip() -> None:
    for code, label in TENURE_REGIME_LABELS.items():
        assert code_of(TENURE_REGIME_LABELS, label, "tenure_regime") is code
        assert label_of(TENURE_REGIME_LABELS, code) == label
        assert serialize_label(TENURE_REGIME_LABELS, code) == label
        assert serialize_label(TENURE_REGIME_LABELS, label) == label


def test_location_level_roundtrip() -> None:
    for code, label in LOCATION_LEVEL_LABELS.items():
        assert code_of(LOCATION_LEVEL_LABELS, label, "level") is code
        assert label_of(LOCATION_LEVEL_LABELS, code) == label
        assert serialize_label(LOCATION_LEVEL_LABELS, code) == label


def test_view_type_roundtrip() -> None:
    assert set(PHOTO_VIEW_TYPE_LABELS) == {
        "FRONTAL",
        "PERFIL",
        "POSTERIOR",
        "DETALLE",
        "ABIERTA",
        "CERRADA",
    }
    for code, label in PHOTO_VIEW_TYPE_LABELS.items():
        assert code_of(PHOTO_VIEW_TYPE_LABELS, label, "view_type") == code
        assert serialize_label(PHOTO_VIEW_TYPE_LABELS, code) == label


def test_invalid_label_lists_allowed_values() -> None:
    with pytest.raises(ValidationFailed) as exc_info:
        code_of(TENURE_REGIME_LABELS, "Dueño", "tenure_regime")
    assert '"Propiedad"' in str(exc_info.value)
    assert '"Comodato"' in str(exc_info.value)


def test_labels_are_case_insensitive() -> None:
    assert code_of(TENURE_REGIME_LABELS, "comodato", "tenure_regime") is TenureRegime.LOAN_FOR_USE
    assert code_of(LOCATION_LEVEL_LABELS, "depósito", "level") is LocationLevel.SPACE


# ------------------------------------------------- 3.2 ninguna respuesta en inglés


def test_list_pieces_tenure_in_spanish(client: TestClient) -> None:
    body = client.get("/api/v1/pieces?page_size=100", headers=H).json()
    assert body["total"] > 0
    values = _walk_values(body["items"], {"tenure_regime"})
    assert values, "se esperaban piezas listadas"
    assert set(values) <= SPANISH_TENURE
    assert not (set(values) & ENGLISH_TENURE)


def test_piece_detail_tenure_in_spanish(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    first = client.get("/api/v1/pieces?page_size=1", headers=H).json()["items"][0]
    detail = client.get(f"/api/v1/pieces/{first['id']}", headers=H).json()
    assert detail["tenure_regime"] in SPANISH_TENURE


def test_collections_default_tenure_in_spanish(client: TestClient) -> None:
    body = client.get("/api/v1/collections", headers=H).json()
    assert body, "se esperaban colecciones"
    values = _walk_values(body, {"default_tenure_regime"})
    assert values
    assert set(values) <= SPANISH_TENURE
    assert not (set(values) & ENGLISH_TENURE)


def test_locations_level_in_spanish(client: TestClient) -> None:
    body = client.get("/api/v1/locations", headers=H).json()
    values = _walk_values(body, {"level"})
    assert values
    assert set(values) <= SPANISH_LEVELS
    assert not (set(values) & ENGLISH_LEVELS)


def test_locations_tree_level_type_in_spanish(client: TestClient) -> None:
    body = client.get("/api/v1/locations/tree", headers=H).json()
    values = _walk_values(body, {"level_type"})
    assert values
    assert set(values) <= SPANISH_LEVELS
    assert not (set(values) & ENGLISH_LEVELS)


def test_search_hits_tenure_in_spanish(client: TestClient) -> None:
    first = client.get("/api/v1/pieces?page_size=1", headers=H).json()["items"][0]
    fragment = first["title"].split()[0]
    body = client.get("/api/v1/search", params={"q": fragment}, headers=H).json()
    assert body["total"] > 0
    values = _walk_values(body["items"], {"tenure_regime"})
    assert values
    assert set(values) <= SPANISH_TENURE


def test_media_view_type_in_spanish(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    listing = client.get("/api/v1/pieces?page_size=100", headers=H).json()["items"]
    checked = 0
    for item in listing:
        media = client.get(f"/api/v1/pieces/{item['id']}/media", headers=H).json()
        for asset in media:
            view = asset["view_type"]
            assert view is None or view["code"] in SPANISH_VIEWS | {"SUPERIOR"}
            assert not (view and view["code"] in ENGLISH_VIEWS)
            checked += 1
        if checked >= 5:
            break
    assert checked > 0, "se esperaban fotos en el seed"


# ---------------------------------------------------------- 3.2 solo español al entrar


def test_create_collection_accepts_spanish(seeded_api: SeededApi) -> None:
    response = seeded_api.client.post(
        "/api/v1/collections",
        json={"name": "Colección prueba ES (sintética)", "default_tenure_regime": "Comodato"},
        headers=M,
    )
    assert response.status_code == 201
    assert response.json()["default_tenure_regime"] == "Comodato"


def test_create_collection_rejects_english_and_unknown(seeded_api: SeededApi) -> None:
    for value in ("OWNED", "Dueño"):
        response = seeded_api.client.post(
            "/api/v1/collections",
            json={"name": "Colección prueba ES (sintética)", "default_tenure_regime": value},
            headers=M,
        )
        assert response.status_code == 422
        assert "Propiedad" in response.text


def test_piece_filters_accept_only_spanish(client: TestClient) -> None:
    ok = client.get("/api/v1/pieces?tenure_regime=Comodato&page_size=5", headers=H)
    assert ok.status_code == 200
    assert {item["tenure_regime"] for item in ok.json()["items"]} == {"Comodato"}
    for value in ("LOAN_FOR_USE", "Dueño"):
        bad = client.get(f"/api/v1/pieces?tenure_regime={value}", headers=H)
        assert bad.status_code == 422
        assert "Propiedad" in bad.text


def test_location_level_filter_accepts_only_spanish(client: TestClient) -> None:
    ok = client.get("/api/v1/locations?level=Sede", headers=H)
    assert ok.status_code == 200
    assert {item["level"] for item in ok.json()} == {"Sede"}
    bad = client.get("/api/v1/locations?level=SITE", headers=H)
    assert bad.status_code == 422
