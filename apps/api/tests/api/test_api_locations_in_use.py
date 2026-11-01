"""Allowed child types in the tree and places in use (crud-manual-completo 1.3; RF-016, RN-005).

Spec ubicacion-movimientos, «Alta y edición de lugares desde el árbol de ubicaciones»: a place with
pieces, or with active places inside, is not deactivated; the type of a new place is proposed from
the level where it goes. Design D3. Synthetic data only (RNF-014).
"""

import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import select

from app.api.deps import CurrentUser, writer
from app.modules.catalog.models import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, SeededApi, as_user


@pytest.fixture(scope="module")
def depot(seeded_api: SeededApi) -> Iterator[dict[str, str]]:
    """Depósito › Estante B (with a piece in its Nivel 1) and Estante D (an empty Nivel 1)."""
    session = seeded_api.session()
    admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
    assert admin is not None
    writer(
        session,
        CurrentUser(id=admin.id, email=ADMIN, full_name=admin.full_name, roles=("ADMIN",)),
    )
    site = session.scalar(select(Location).where(Location.level == LocationLevel.SITE))
    assert site is not None

    def place(level: LocationLevel, code: str, name: str, parent: Location) -> Location:
        return create_location(session, level=level, code=code, name=name, parent=parent)

    space = place(LocationLevel.SPACE, "CMC-DEP", "Depósito de prueba (sintético)", site)
    shelf_b = place(LocationLevel.FURNITURE, "CMC-EST-B", "Estante B (sintético)", space)
    level_b = place(LocationLevel.SHELF_LEVEL, "CMC-EST-B-N1", "Nivel 1 (sintético)", shelf_b)
    box = place(LocationLevel.CONTAINER, "CMC-EST-B-N1-C1", "Caja 1 (sintética)", level_b)
    shelf_d = place(LocationLevel.FURNITURE, "CMC-EST-D", "Estante D (sintético)", space)
    level_d = place(LocationLevel.SHELF_LEVEL, "CMC-EST-D-N1", "Nivel 1 (sintético)", shelf_d)
    piece = create_piece(
        session, denomination="Manta del estante B (sintética)", tenure_regime=TenureRegime.OWNED
    )
    move_piece(session, piece, level_b, "Ingreso de prueba")
    session.commit()
    ids = {
        "site": site.id,
        "space": space.id,
        "shelf_b": shelf_b.id,
        "level_b": level_b.id,
        "box": box.id,
        "shelf_d": shelf_d.id,
        "level_d": level_d.id,
    }
    piece_id = str(piece.id)
    session.close()
    yield {key: str(value) for key, value in ids.items()}
    # The seeded database is shared: the active total must not move.
    deleted = seeded_api.client.delete(
        f"/api/v1/pieces/{piece_id}",
        params={"reason": "Limpieza de prueba"},
        headers=as_user(ADMIN),
    )
    assert deleted.status_code == 204, deleted.text


def _nodes(tree: list[dict]) -> dict[str, dict]:
    found: dict[str, dict] = {}
    stack = list(tree)
    while stack:
        node = stack.pop()
        found[node["id"]] = node
        stack.extend(node["children"])
    return found


def test_each_node_says_which_types_it_admits_inside(
    seeded_api: SeededApi, depot: dict[str, str]
) -> None:
    """Escenario «Lugar que la jerarquía no admite»: a level never offers a sede."""
    tree = seeded_api.client.get("/api/v1/locations/tree", headers=as_user(ADMIN)).json()
    nodes = _nodes(tree)

    assert nodes[depot["site"]]["allowed_child_types"] == ["Depósito"]
    assert nodes[depot["space"]]["allowed_child_types"] == ["Mueble"]
    assert nodes[depot["shelf_b"]]["allowed_child_types"] == ["Nivel", "Contenedor"]
    assert nodes[depot["level_b"]]["allowed_child_types"] == ["Contenedor"]
    assert nodes[depot["box"]]["allowed_child_types"] == []


def _deactivate(seeded_api: SeededApi, location_id: str):  # type: ignore[no-untyped-def]
    return seeded_api.client.put(
        f"/api/v1/locations/{location_id}", json={"is_active": False}, headers=as_user(ADMIN)
    )


def test_a_shelf_with_pieces_is_not_deactivated(
    seeded_api: SeededApi, depot: dict[str, str]
) -> None:
    """Escenario «Desactivar un lugar con piezas»: it says how many pieces to move first."""
    response = _deactivate(seeded_api, depot["shelf_b"])

    assert response.status_code == 409, response.text
    body = response.json()
    assert body["code"] == "location_in_use"
    assert body["details"] == {"affected_pieces": 1, "active_places": 2}
    assert "reubicar 1 pieza y desactivar 2 lugares" in body["message"]


def test_a_place_with_active_places_inside_is_not_deactivated(
    seeded_api: SeededApi, depot: dict[str, str]
) -> None:
    response = _deactivate(seeded_api, depot["shelf_d"])

    assert response.status_code == 409, response.text
    assert response.json()["details"] == {"affected_pieces": 0, "active_places": 1}
    assert "desactivar 1 lugar que contiene" in response.json()["message"]


def test_an_empty_place_is_deactivated_and_then_its_parent_too(
    seeded_api: SeededApi, depot: dict[str, str]
) -> None:
    level = _deactivate(seeded_api, depot["level_d"])
    shelf = _deactivate(seeded_api, depot["shelf_d"])

    assert (level.status_code, shelf.status_code) == (200, 200), (level.text, shelf.text)
    with seeded_api.session() as session:
        assert session.get(Location, uuid.UUID(depot["shelf_d"])).is_active is False  # type: ignore[union-attr]
