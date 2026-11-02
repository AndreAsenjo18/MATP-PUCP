"""The materials of the sheet are saved (RF-006, RN-005).

`POST /pieces` and `PUT /pieces/{id}` accepted `material_term_ids` and ignored them. Now they save
the active MATERIAL terms, replace them on edit (the removed ones are soft-deleted with a reason)
and move the version of the sheet only on a real change. Synthetic data only (RNF-014).
"""

import uuid

import pytest
from sqlalchemy import select

from app.models import PieceMaterial
from app.modules.audit.tracking import INCLUDE_DELETED
from tests.api.conftest import ADMIN, SeededApi, as_user

MATERIALS = "/api/v1/vocabularies/MATERIAL/terms"


def _new_material(client, label: str) -> str:  # type: ignore[no-untyped-def]
    created = client.post(
        MATERIALS, json={"code": f"M{uuid.uuid4().hex[:8].upper()}", "label": label}
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


@pytest.fixture
def materials(seeded_api: SeededApi) -> dict[str, str]:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    tag = uuid.uuid4().hex[:6]
    return {
        "arcilla": _new_material(client, f"Arcilla {tag} (sintética)"),
        "engobe": _new_material(client, f"Engobe {tag} (sintético)"),
        "pigmento": _new_material(client, f"Pigmento {tag} (sintético)"),
    }


def _labels(detail: dict) -> set[str]:
    return {material["label"].split(" ")[0] for material in detail["materials"]}


def _cleanup(seeded_api: SeededApi, piece_id: str) -> None:
    """The seeded database is shared: the active total must not move."""
    deleted = seeded_api.client.delete(
        f"/api/v1/pieces/{piece_id}",
        params={"reason": "Limpieza de prueba"},
        headers=as_user(ADMIN),
    )
    assert deleted.status_code == 204, deleted.text


def test_the_materials_are_saved_with_the_new_piece(
    seeded_api: SeededApi, materials: dict[str, str]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Cuenco con materiales (sintético)",
            "tenure_regime": "Propiedad",
            "material_term_ids": [materials["arcilla"], materials["engobe"], materials["arcilla"]],
        },
    )

    assert created.status_code == 201, created.text
    detail = client.get(f"/api/v1/pieces/{created.json()['id']}").json()
    assert _labels(detail) == {"Arcilla", "Engobe"}
    _cleanup(seeded_api, created.json()["id"])


def test_editing_replaces_them_and_keeps_the_removed_one_retired(
    seeded_api: SeededApi, materials: dict[str, str]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Plato con materiales (sintético)",
            "tenure_regime": "Propiedad",
            "material_term_ids": [materials["arcilla"], materials["engobe"]],
        },
    ).json()
    detail = client.get(f"/api/v1/pieces/{piece['id']}").json()

    edited = client.put(
        f"/api/v1/pieces/{piece['id']}",
        json={"material_term_ids": [materials["arcilla"], materials["pigmento"]]},
        headers={"If-Match": str(detail["version"])},
    )

    assert edited.status_code == 200, edited.text
    assert _labels(edited.json()) == {"Arcilla", "Pigmento"}
    assert edited.json()["version"] == detail["version"] + 1
    with seeded_api.session() as session:
        removed = session.scalar(
            select(PieceMaterial)
            .where(
                PieceMaterial.piece_id == uuid.UUID(piece["id"]),
                PieceMaterial.term_id == uuid.UUID(materials["engobe"]),
            )
            .execution_options(**{INCLUDE_DELETED: True})
        )
    assert removed is not None and removed.deleted_at is not None
    assert removed.deletion_reason == "Material quitado de la ficha"
    _cleanup(seeded_api, piece["id"])


def test_an_empty_list_clears_them_and_leaving_them_out_keeps_them(
    seeded_api: SeededApi, materials: dict[str, str]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Jarra con materiales (sintética)",
            "tenure_regime": "Propiedad",
            "material_term_ids": [materials["arcilla"]],
        },
    ).json()
    version = client.get(f"/api/v1/pieces/{piece['id']}").json()["version"]

    notes_only = client.put(
        f"/api/v1/pieces/{piece['id']}",
        json={"notes": "Sin tocar los materiales (sintético)"},
        headers={"If-Match": str(version)},
    )
    cleared = client.put(
        f"/api/v1/pieces/{piece['id']}",
        json={"material_term_ids": []},
        headers={"If-Match": str(notes_only.json()["version"])},
    )

    assert _labels(notes_only.json()) == {"Arcilla"}
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["materials"] == []
    _cleanup(seeded_api, piece["id"])


def test_saving_the_same_materials_does_not_move_the_version(
    seeded_api: SeededApi, materials: dict[str, str]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Vaso con materiales (sintético)",
            "tenure_regime": "Propiedad",
            "material_term_ids": [materials["engobe"]],
        },
    ).json()
    version = client.get(f"/api/v1/pieces/{piece['id']}").json()["version"]

    same = client.put(
        f"/api/v1/pieces/{piece['id']}",
        json={"material_term_ids": [materials["engobe"]]},
        headers={"If-Match": str(version)},
    )

    assert same.status_code == 200, same.text
    assert same.json()["version"] == version
    _cleanup(seeded_api, piece["id"])


def test_a_term_of_another_list_or_inactive_is_rejected(
    seeded_api: SeededApi, materials: dict[str, str]
) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    manager.patch(f"{MATERIALS}/{materials['pigmento']}", json={"is_active": False})
    state = manager.get("/api/v1/vocabularies/CONSERVATION_STATUS/terms").json()[0]["id"]
    client = seeded_api.login_as("CATALOGUER")

    for wrong in (materials["pigmento"], state):
        response = client.post(
            "/api/v1/pieces",
            json={
                "denomination": "Pieza con material inválido (sintética)",
                "tenure_regime": "Propiedad",
                "material_term_ids": [materials["arcilla"], wrong],
            },
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_material"
        assert response.json()["details"]["term_ids"] == [wrong]
    listed = client.get(
        "/api/v1/pieces", params={"denomination": "Pieza con material inválido"}
    ).json()
    assert all(
        item["denomination"] != "Pieza con material inválido (sintética)"
        for item in listed["items"]
    )
