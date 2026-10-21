"""Tests for locations tree with five levels and piece movements with history (RF-016, RF-017).

Task 4.3 of change alinear-api-endpoints-v1.
"""

import uuid

import pytest
from sqlalchemy import select

from app.api.deps import CurrentUser, writer
from app.modules.catalog.models import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import create_location
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, SeededApi


@pytest.fixture(scope="module")
def hierarchy_data(seeded_api: SeededApi) -> dict[str, str]:
    """Create a 5-level location hierarchy and a test piece."""
    with seeded_api.session() as session:
        admin_user = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin_user is not None
        writer(
            session,
            CurrentUser(
                id=admin_user.id,
                email=ADMIN,
                full_name=admin_user.full_name,
                roles=("ADMIN",),
            ),
        )

        site = create_location(
            session,
            level=LocationLevel.SITE,
            code="SITE-5L",
            name="Sede Principal 5L",
        )
        space = create_location(
            session,
            level=LocationLevel.SPACE,
            code="DEP-5L",
            name="Depósito 5L",
            parent=site,
        )
        rack = create_location(
            session,
            level=LocationLevel.FURNITURE,
            code="EST-5L",
            name="Estante 5L",
            parent=space,
        )
        shelf = create_location(
            session,
            level=LocationLevel.SHELF_LEVEL,
            code="NIV-5L",
            name="Nivel 5L",
            parent=rack,
        )
        box = create_location(
            session,
            level=LocationLevel.CONTAINER,
            code="BOX-5L",
            name="Caja 5L",
            parent=shelf,
        )

        piece = create_piece(
            session,
            denomination="Pieza Prueba Movimientos RF-017",
            tenure_regime=TenureRegime.OWNED,
        )
        session.commit()

        return {
            "site_id": str(site.id),
            "space_id": str(space.id),
            "rack_id": str(rack.id),
            "shelf_id": str(shelf.id),
            "box_id": str(box.id),
            "piece_id": str(piece.id),
        }


def test_locations_tree_five_levels(seeded_api: SeededApi, hierarchy_data: dict[str, str]) -> None:
    """RF-016: GET /locations/tree returns the complete 5-level nested hierarchy."""
    client = seeded_api.login_as("STORAGE_STAFF")
    res = client.get("/api/v1/locations/tree")
    assert res.status_code == 200
    roots = res.json()

    # Find the created root site
    site_node = next((n for n in roots if n["id"] == hierarchy_data["site_id"]), None)
    assert site_node is not None, "El nodo raíz de la sede debe figurar en el árbol"
    assert site_node["name"] == "Sede Principal 5L"
    assert site_node["level_type"] == "Sede"

    # Level 2: Depósito (space)
    space_node = next(
        (n for n in site_node["children"] if n["id"] == hierarchy_data["space_id"]),
        None,
    )
    assert space_node is not None, "El depósito debe ser hijo directo de la sede"
    assert space_node["name"] == "Depósito 5L"
    assert space_node["level_type"] == "Depósito"

    # Level 3: Mueble (rack)
    rack_node = next(
        (n for n in space_node["children"] if n["id"] == hierarchy_data["rack_id"]),
        None,
    )
    assert rack_node is not None, "El mueble debe ser hijo directo del depósito"
    assert rack_node["name"] == "Estante 5L"
    assert rack_node["level_type"] == "Mueble"

    # Level 4: Nivel (shelf)
    shelf_node = next(
        (n for n in rack_node["children"] if n["id"] == hierarchy_data["shelf_id"]),
        None,
    )
    assert shelf_node is not None, "El nivel debe ser hijo directo del mueble"
    assert shelf_node["name"] == "Nivel 5L"
    assert shelf_node["level_type"] == "Nivel"

    # Level 5: Contenedor (box)
    box_node = next(
        (n for n in shelf_node["children"] if n["id"] == hierarchy_data["box_id"]),
        None,
    )
    assert box_node is not None, "El contenedor debe ser hijo directo del nivel"
    assert box_node["name"] == "Caja 5L"
    assert box_node["level_type"] == "Contenedor"
    assert box_node["children"] == []


def test_locations_tree_pruned_for_viewer(
    seeded_api: SeededApi, hierarchy_data: dict[str, str]
) -> None:
    """RF-041: Levels deeper than SPACE are pruned for roles without exact_location."""
    client = seeded_api.login_as("INTERNAL_VIEWER")
    res = client.get("/api/v1/locations/tree")
    assert res.status_code == 200
    roots = res.json()

    site_node = next((n for n in roots if n["id"] == hierarchy_data["site_id"]), None)
    assert site_node is not None
    space_node = next(
        (n for n in site_node["children"] if n["id"] == hierarchy_data["space_id"]),
        None,
    )
    assert space_node is not None
    # For VIEWER without sensitive.exact_location, rack/shelf/box are pruned
    assert space_node["children"] == []


def test_piece_movement_and_location_history(
    seeded_api: SeededApi, hierarchy_data: dict[str, str]
) -> None:
    """RF-017: POST /pieces/{id}/move registers movements and GET location-history reflects them."""
    client = seeded_api.login_as("STORAGE_STAFF")
    piece_id = hierarchy_data["piece_id"]
    box_id = hierarchy_data["box_id"]
    space_id = hierarchy_data["space_id"]

    # 1. Initial state: no movements
    res_initial = client.get(f"/api/v1/pieces/{piece_id}/location-history")
    assert res_initial.status_code == 200
    assert res_initial.json() == []

    # 2. Move piece to box using destination_location_id (OpenAPI contract alias)
    move_payload_1 = {
        "movement_type": "MOVE",
        "destination_location_id": box_id,
        "reason": "Ingreso inicial a caja",
    }
    res_move_1 = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json=move_payload_1,
    )
    assert res_move_1.status_code == 201
    move_1 = res_move_1.json()
    assert move_1["piece_id"] == piece_id
    assert move_1["movement_type"] == "MOVE"
    assert move_1["from_location"] is None
    assert move_1["to_location"]["id"] == box_id
    assert move_1["reason"] == "Ingreso inicial a caja"
    assert move_1["occurred_at"] is not None

    # Check location history has 1 record
    res_hist_1 = client.get(f"/api/v1/pieces/{piece_id}/location-history")
    assert res_hist_1.status_code == 200
    hist_1 = res_hist_1.json()
    assert len(hist_1) == 1
    assert hist_1[0]["id"] == move_1["id"]

    # 3. Move piece from box to space using to_location_id
    move_payload_2 = {
        "movement_type": "MOVE",
        "to_location_id": space_id,
        "reason": "Traslado a depósito principal",
    }
    res_move_2 = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json=move_payload_2,
    )
    assert res_move_2.status_code == 201
    move_2 = res_move_2.json()
    assert move_2["from_location"]["id"] == box_id
    assert move_2["to_location"]["id"] == space_id
    assert move_2["reason"] == "Traslado a depósito principal"

    # 4. Verification in place
    verify_payload = {"movement_type": "VERIFICATION"}
    res_verify = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json=verify_payload,
    )
    assert res_verify.status_code == 201
    verify_out = res_verify.json()
    assert verify_out["movement_type"] == "VERIFICATION"
    assert verify_out["from_location"]["id"] == space_id
    assert verify_out["to_location"]["id"] == space_id

    # 5. History should now have 3 records (most recent first)
    res_hist_final = client.get(f"/api/v1/pieces/{piece_id}/location-history")
    assert res_hist_final.status_code == 200
    history = res_hist_final.json()
    assert len(history) == 3
    assert history[0]["movement_type"] == "VERIFICATION"
    assert history[1]["movement_type"] == "MOVE"
    assert history[1]["to_location"]["id"] == space_id
    assert history[2]["movement_type"] == "MOVE"
    assert history[2]["to_location"]["id"] == box_id


def test_piece_move_business_rule_validations(
    seeded_api: SeededApi, hierarchy_data: dict[str, str]
) -> None:
    """Validate business rules on piece movements."""
    client = seeded_api.login_as("STORAGE_STAFF")
    piece_id = hierarchy_data["piece_id"]
    site_id = hierarchy_data["site_id"]
    space_id = hierarchy_data["space_id"]

    # Moving to a SITE without space violates rule -> 422 space_required
    res_site = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": site_id},
    )
    assert res_site.status_code == 422
    assert res_site.json()["code"] == "space_required"

    # Moving to same location violates rule -> 409 same_location
    res_same = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": space_id},
    )
    assert res_same.status_code == 409
    assert res_same.json()["code"] == "same_location"

    # Nonexistent destination -> 404
    res_missing_loc = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": str(uuid.uuid4())},
    )
    assert res_missing_loc.status_code == 404

    # Nonexistent piece -> 404
    res_missing_piece = client.post(
        f"/api/v1/pieces/{uuid.uuid4()}/move",
        json={"movement_type": "MOVE", "to_location_id": space_id},
    )
    assert res_missing_piece.status_code == 404

    # Missing destination on MOVE -> 422
    res_no_dest = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE"},
    )
    assert res_no_dest.status_code == 422

    # Forbidden for role without movements.register
    res_forbidden = seeded_api.login_as("INTERNAL_VIEWER").post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": space_id},
    )
    assert res_forbidden.status_code == 403
