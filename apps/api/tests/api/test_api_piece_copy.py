"""Registering from a similar piece (crud-manual-completo 4.2; RF-001, RF-043, RN-001).

Spec catalogo-piezas, «Registrar a partir de una pieza similar». The copy lives in the browser, so
for the API it is one more creation: the new piece must get its own internal id and nothing that
identifies the original. Synthetic data only (RNF-014).
"""

import uuid

from tests.api.conftest import SeededApi


def test_a_piece_registered_from_another_gets_its_own_identity(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    code_i = f"I-{uuid.uuid4().int % 900000 + 100000}"
    created = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Mate burilado (sintético)",
            "tenure_regime": "Propiedad",
            "code_i": code_i,
            "author": "Persona sintética",
            "provenance": "Huancayo",
            "dimensions_text": "12 cm de diámetro",
        },
    )
    assert created.status_code == 201, created.text
    source_id = created.json()["id"]
    source = client.get(f"/api/v1/pieces/{source_id}").json()

    copied = client.post(
        "/api/v1/pieces",
        json={
            field: source[field]
            for field in (
                "denomination",
                "tenure_regime",
                "author",
                "provenance",
                "dimensions_text",
            )
        },
    )

    assert copied.status_code == 201, copied.text
    copy_id = copied.json()["id"]
    assert copy_id != source_id
    new = client.get(f"/api/v1/pieces/{copy_id}").json()
    assert new["denomination"] == source["denomination"]
    assert new["code_i"] is None
    assert new["identifiers"] == []
    assert new["location"]["path"] == []
    assert client.get(f"/api/v1/pieces/{source_id}").json()["code_i"] == source["code_i"]

    # The shared database counts active pieces in other tests.
    admin = seeded_api.login_as("ADMIN")
    for piece_id in (source_id, copy_id):
        removed = admin.delete(f"/api/v1/pieces/{piece_id}", params={"reason": "Prueba terminada"})
        assert removed.status_code == 204, removed.text
