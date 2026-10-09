"""Colecciones, categorías y estados de conservación con la forma `CollectionItem` (tarea 4.2).

Change alinear-api-endpoints-v1: las respuestas contienen `id`, `code` y `name` del documento de
interfaces además de sus campos propios; `POST /collections` acepta `code`. RF-010..RF-012.
"""

import pytest
import yaml

from tests.api.conftest import MANAGER, SeededApi, as_user
from tests.api.test_contract_conformance import CONTRACT

H = as_user(MANAGER)


@pytest.fixture(scope="module")
def collection_item_fields() -> set[str]:
    document = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return set(document["components"]["schemas"]["CollectionItem"]["properties"])


@pytest.mark.parametrize("path", ["/collections", "/categories", "/conservation-states"])
def test_listings_have_the_collection_item_fields(
    seeded_api: SeededApi, collection_item_fields: set[str], path: str
) -> None:
    items = seeded_api.client.get(f"/api/v1{path}", headers=H).json()
    assert items
    for item in items:
        assert collection_item_fields <= set(item), f"{path}: {item}"
        assert item["name"]


def test_collection_code_is_the_normalized_acronym(seeded_api: SeededApi) -> None:
    collections = seeded_api.client.get("/api/v1/collections", headers=H).json()
    assert all(item["code"] == item["acronym_normalized"] for item in collections)
    assert any(item["code"] for item in collections)


def test_term_name_is_its_label(seeded_api: SeededApi) -> None:
    states = seeded_api.client.get("/api/v1/conservation-states", headers=H).json()
    assert {state["name"] for state in states} >= {"Bueno", "Regular", "Malo"}
    assert all(state["name"] == state["label"] for state in states)


def test_create_collection_with_the_contract_body(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    created = client.post(
        "/api/v1/collections",
        json={"code": "F.L.T.", "name": "Colección FLT (ficticia)"},
        headers=H,
    )
    assert created.status_code == 201
    body = created.json()
    assert (body["code"], body["acronym"], body["name"]) == (
        "FLT",
        "F.L.T.",
        "Colección FLT (ficticia)",
    )
    listed = {item["id"]: item for item in client.get("/api/v1/collections", headers=H).json()}
    assert listed[body["id"]]["code"] == "FLT"

    duplicate = client.post(
        "/api/v1/collections", json={"code": "FLT", "name": "Otra FLT"}, headers=H
    )
    assert duplicate.status_code == 422
    assert duplicate.json()["code"] == "duplicate_acronym"


def test_code_and_acronym_must_agree(seeded_api: SeededApi) -> None:
    response = seeded_api.client.post(
        "/api/v1/collections",
        json={"code": "AAA", "acronym": "BBB", "name": "Colección contradictoria"},
        headers=H,
    )
    assert response.status_code == 422
