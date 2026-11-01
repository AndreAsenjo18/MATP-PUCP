"""A sheet cannot enter a retired collection (crud-manual-completo 4.3; RF-043, RN-005).

Spec catalogo-piezas, «Datos copiados que ya no son válidos»: the form empties a copied collection
that was retired, but it can also be retired with the form open, so the server has the last word.
Synthetic data only (RNF-014).
"""

import uuid

from tests.api.conftest import SeededApi

PIECE = {"denomination": "Pieza de la colección retirada (sintética)", "tenure_regime": "Propiedad"}


def _retired_collection(seeded_api: SeededApi) -> str:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    created = manager.post(
        "/api/v1/collections",
        json={"name": "Colección retirada (sintética)", "acronym": f"RE{uuid.uuid4().hex[:4]}"},
    )
    assert created.status_code == 201, created.text
    collection_id = created.json()["id"]
    retired = manager.delete(
        f"/api/v1/collections/{collection_id}", params={"reason": "Colección duplicada"}
    )
    assert retired.status_code == 204, retired.text
    return collection_id


def _remove(seeded_api: SeededApi, piece_id: str) -> None:
    # The shared database counts active pieces in other tests.
    removed = seeded_api.login_as("ADMIN").delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": "Prueba terminada"}
    )
    assert removed.status_code == 204, removed.text


def test_a_piece_cannot_be_created_in_a_retired_collection(seeded_api: SeededApi) -> None:
    collection_id = _retired_collection(seeded_api)
    client = seeded_api.login_as("CATALOGUER")

    response = client.post("/api/v1/pieces", json={**PIECE, "collection_id": collection_id})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "collection_not_available"


def test_validation_flags_the_retired_collection_on_its_field(seeded_api: SeededApi) -> None:
    collection_id = _retired_collection(seeded_api)
    client = seeded_api.login_as("CATALOGUER")

    result = client.post("/api/v1/pieces/validate", json={**PIECE, "collection_id": collection_id})

    assert result.status_code == 200, result.text
    assert result.json()["is_valid"] is False
    assert [(issue["field"], issue["code"]) for issue in result.json()["issues"]] == [
        ("collection_id", "collection_not_available")
    ]


def test_a_collection_that_does_not_exist_is_rejected_the_same_way(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")

    response = client.post("/api/v1/pieces", json={**PIECE, "collection_id": str(uuid.uuid4())})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "collection_not_available"


def test_a_piece_cannot_move_to_a_retired_collection_when_edited(seeded_api: SeededApi) -> None:
    collection_id = _retired_collection(seeded_api)
    client = seeded_api.login_as("CATALOGUER")
    created = client.post("/api/v1/pieces", json=PIECE)
    assert created.status_code == 201, created.text
    piece_id = created.json()["id"]
    version = client.get(f"/api/v1/pieces/{piece_id}").json()["version"]

    response = client.put(
        f"/api/v1/pieces/{piece_id}",
        json={"collection_id": collection_id},
        headers={"If-Match": str(version)},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "collection_not_available"
    _remove(seeded_api, piece_id)


def test_an_active_collection_is_still_accepted(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    active = manager.post(
        "/api/v1/collections",
        json={"name": "Colección activa (sintética)", "acronym": f"AC{uuid.uuid4().hex[:4]}"},
    )
    client = seeded_api.login_as("CATALOGUER")

    response = client.post("/api/v1/pieces", json={**PIECE, "collection_id": active.json()["id"]})

    assert response.status_code == 201, response.text
    _remove(seeded_api, response.json()["id"])
