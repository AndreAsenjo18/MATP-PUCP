"""API tests for location administration and movement rules added by
ubicacion-jerarquica-y-movimientos: RF-016, RF-017, RF-020, RN-005 (tasks 2.1, 2.2, 3.1, 3.3, 3.4).
"""

import random
import uuid

import pytest
from sqlalchemy import select

from app.api.deps import CurrentUser, writer
from app.modules.catalog.models import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.locations.models import Location, LocationLevel, PieceMovement
from app.modules.locations.service import create_location
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, CATALOGUER, STORAGE, SeededApi, as_user


def _as_admin_session(seeded_api: SeededApi):
    session = seeded_api.session()
    admin_user = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
    assert admin_user is not None
    writer(
        session,
        CurrentUser(
            id=admin_user.id, email=ADMIN, full_name=admin_user.full_name, roles=("ADMIN",)
        ),
    )
    return session


@pytest.fixture(scope="module")
def admin_hierarchy(seeded_api: SeededApi) -> dict[str, str]:
    session = _as_admin_session(seeded_api)
    site = create_location(session, level=LocationLevel.SITE, code="SITE-ADM", name="Sede ADM")
    deposit = create_location(
        session, level=LocationLevel.SPACE, code="DEP-ADM", name="Depósito ADM", parent=site
    )
    deposit2 = create_location(
        session, level=LocationLevel.SPACE, code="DEP-ADM-2", name="Depósito ADM 2", parent=site
    )
    rack = create_location(
        session, level=LocationLevel.FURNITURE, code="RACK-ADM", name="Rack ADM", parent=deposit
    )
    box = create_location(
        session, level=LocationLevel.CONTAINER, code="BOX-ADM", name="Caja ADM", parent=rack
    )
    piece_in_box = create_piece(
        session, denomination="Pieza en caja ADM", tenure_regime=TenureRegime.OWNED
    )
    from app.modules.locations.service import move_piece

    move_piece(session, piece_in_box, box, "Ingreso para pruebas de administración")
    session.commit()
    data = {
        "site_id": str(site.id),
        "deposit_id": str(deposit.id),
        "deposit2_id": str(deposit2.id),
        "rack_id": str(rack.id),
        "box_id": str(box.id),
        "piece_in_box_id": str(piece_in_box.id),
    }
    session.close()
    return data


# --------------------------------------------------------------------------- POST /locations
def test_create_location_rack_in_deposit(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.post(
        "/api/v1/locations",
        json={
            "parent_id": admin_hierarchy["deposit_id"],
            "level": "Mueble",
            "code": "RACK-B-ADM",
            "name": "Rack B",
        },
        headers=as_user(ADMIN),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["code"] == "RACK-B-ADM"
    assert [node["code"] for node in body["path"]] == ["SITE-ADM", "DEP-ADM", "RACK-B-ADM"]


def test_create_location_invalid_parent_level(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.post(
        "/api/v1/locations",
        json={
            "parent_id": admin_hierarchy["site_id"],
            "level": "Nivel",
            "code": "NIVEL-DIRECTO",
            "name": "Nivel directo en sede",
        },
        headers=as_user(ADMIN),
    )
    assert res.status_code == 422
    assert res.json()["code"] == "invalid_location_parent"


def test_create_location_duplicate_code(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.post(
        "/api/v1/locations",
        json={
            "parent_id": admin_hierarchy["site_id"],
            "level": "Depósito",
            "code": "dep-adm",
            "name": "Duplicado",
        },
        headers=as_user(ADMIN),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "duplicate_location_code"


def test_create_location_forbidden_for_storage_staff(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.post(
        "/api/v1/locations",
        json={
            "parent_id": admin_hierarchy["site_id"],
            "level": "Depósito",
            "code": "DEP-FORBIDDEN",
            "name": "No autorizado",
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------- PUT /locations
def test_deactivate_container_with_pieces_is_rejected(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.put(
        f"/api/v1/locations/{admin_hierarchy['box_id']}",
        json={"is_active": False},
        headers=as_user(ADMIN),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "location_not_empty"
    assert res.json()["details"]["affected_pieces"] == 1


def test_deactivate_empty_location_succeeds(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.post(
        "/api/v1/locations",
        json={
            "parent_id": admin_hierarchy["site_id"],
            "level": "Depósito",
            "code": "DEP-VACIO",
            "name": "Depósito vacío",
        },
        headers=as_user(ADMIN),
    )
    location_id = res.json()["id"]
    res_update = seeded_api.client.put(
        f"/api/v1/locations/{location_id}",
        json={"is_active": False},
        headers=as_user(ADMIN),
    )
    assert res_update.status_code == 200
    assert res_update.json()["is_active"] is False


def test_relocate_node_cycle_rejected(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.put(
        f"/api/v1/locations/{admin_hierarchy['deposit_id']}",
        json={"parent_id": admin_hierarchy["rack_id"]},
        headers=as_user(ADMIN),
    )
    assert res.status_code == 422
    assert res.json()["code"] == "location_cycle"


def test_relocate_node_requires_confirm_affected_count(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.put(
        f"/api/v1/locations/{admin_hierarchy['rack_id']}",
        json={"parent_id": admin_hierarchy["deposit2_id"]},
        headers=as_user(ADMIN),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "confirm_affected_count_mismatch"
    assert res.json()["details"]["affected_pieces"] == 1


def test_relocate_node_with_confirmed_count_moves_subtree_and_logs_movements(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    res = seeded_api.client.put(
        f"/api/v1/locations/{admin_hierarchy['rack_id']}",
        json={"parent_id": admin_hierarchy["deposit2_id"], "confirm_affected_count": 1},
        headers=as_user(ADMIN),
    )
    assert res.status_code == 200
    assert [node["code"] for node in res.json()["path"]] == ["SITE-ADM", "DEP-ADM-2", "RACK-ADM"]

    with seeded_api.session() as session:
        movements = session.scalars(
            select(PieceMovement).where(
                PieceMovement.piece_id == uuid.UUID(admin_hierarchy["piece_in_box_id"])
            )
        ).all()
        relocation_movements = [
            m for m in movements if m.origin_ref and m.origin_ref.startswith("relocation:")
        ]
        assert len(relocation_movements) == 1
        assert "Reubicación" in relocation_movements[0].reason


# ------------------------------------------------------------------------ POST /pieces/{id}/move
@pytest.fixture(scope="module")
def move_piece_data(seeded_api: SeededApi, admin_hierarchy: dict[str, str]) -> dict[str, str]:
    session = _as_admin_session(seeded_api)
    site = session.get(Location, uuid.UUID(admin_hierarchy["site_id"]))
    space_a = create_location(
        session, level=LocationLevel.SPACE, code="MV-A", name="Depósito mov A", parent=site
    )
    space_b = create_location(
        session, level=LocationLevel.SPACE, code="MV-B", name="Depósito mov B", parent=site
    )
    piece = create_piece(
        session, denomination="Pieza para concurrencia", tenure_regime=TenureRegime.OWNED
    )
    from app.modules.locations.service import move_piece

    move_piece(session, piece, space_a, "Ingreso inicial")
    session.commit()
    data = {"space_a_id": str(space_a.id), "space_b_id": str(space_b.id), "piece_id": str(piece.id)}
    session.close()
    return data


def test_move_with_stale_expected_from_is_rejected(
    seeded_api: SeededApi, move_piece_data: dict[str, str]
) -> None:
    client = seeded_api.client
    piece_id = move_piece_data["piece_id"]
    wrong_origin = str(uuid.uuid4())
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={
            "movement_type": "MOVE",
            "to_location_id": move_piece_data["space_b_id"],
            "expected_from_location_id": wrong_origin,
            "reason": "Traslado",
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "location_changed"


def test_move_with_matching_expected_from_succeeds(
    seeded_api: SeededApi, move_piece_data: dict[str, str]
) -> None:
    client = seeded_api.client
    piece_id = move_piece_data["piece_id"]
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={
            "movement_type": "MOVE",
            "to_location_id": move_piece_data["space_b_id"],
            "expected_from_location_id": move_piece_data["space_a_id"],
            "reason": "Traslado confirmado",
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 201
    assert res.json()["to_location"]["id"] == move_piece_data["space_b_id"]


def test_verification_with_mismatched_location_suggests_a_move(
    seeded_api: SeededApi, move_piece_data: dict[str, str]
) -> None:
    client = seeded_api.client
    piece_id = move_piece_data["piece_id"]
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "VERIFICATION", "to_location_id": move_piece_data["space_a_id"]},
        headers=as_user(STORAGE),
    )
    assert res.status_code == 422
    assert res.json()["code"] == "verification_location_mismatch"


def test_correction_requires_locations_manage_permission(
    seeded_api: SeededApi, move_piece_data: dict[str, str]
) -> None:
    client = seeded_api.client
    piece_id = move_piece_data["piece_id"]
    history = client.get(
        f"/api/v1/pieces/{piece_id}/location-history", headers=as_user(STORAGE)
    ).json()
    last_movement_id = history[0]["id"]
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={
            "movement_type": "CORRECTION",
            "to_location_id": move_piece_data["space_a_id"],
            "corrects_movement_id": last_movement_id,
            "reason": "Registro erróneo",
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 403


def test_correction_links_to_the_previous_movement_without_editing_it(
    seeded_api: SeededApi, move_piece_data: dict[str, str]
) -> None:
    client = seeded_api.client
    piece_id = move_piece_data["piece_id"]
    history_before = client.get(
        f"/api/v1/pieces/{piece_id}/location-history", headers=as_user(ADMIN)
    ).json()
    last_movement_id = history_before[0]["id"]
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={
            "movement_type": "CORRECTION",
            "to_location_id": move_piece_data["space_a_id"],
            "corrects_movement_id": last_movement_id,
            "reason": "Se registró el traslado incorrecto",
        },
        headers=as_user(ADMIN),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["movement_type"] == "CORRECTION"
    assert body["corrects_movement_id"] == last_movement_id

    history_after = client.get(
        f"/api/v1/pieces/{piece_id}/location-history", headers=as_user(ADMIN)
    ).json()
    previous = next(m for m in history_after if m["id"] == last_movement_id)
    assert previous["movement_type"] in ("MOVE", "VERIFICATION", "CORRECTION")  # unchanged


# ----------------------------------------------------------------------- POST /movements/batch
@pytest.fixture(scope="module")
def batch_data(seeded_api: SeededApi, admin_hierarchy: dict[str, str]) -> dict[str, object]:
    session = _as_admin_session(seeded_api)
    site = session.get(Location, uuid.UUID(admin_hierarchy["site_id"]))
    destination = create_location(
        session, level=LocationLevel.SPACE, code="BATCH-DEST", name="Depósito de lote", parent=site
    )
    origin = create_location(
        session, level=LocationLevel.SPACE, code="BATCH-ORIGIN", name="Depósito origen", parent=site
    )
    pieces = [
        create_piece(session, denomination=f"Pieza lote {i}", tenure_regime=TenureRegime.OWNED)
        for i in range(3)
    ]
    from app.modules.locations.service import move_piece

    for piece in pieces:
        move_piece(session, piece, origin, "Ingreso para lote")
    session.commit()
    data = {
        "destination_id": str(destination.id),
        "origin_id": str(origin.id),
        "piece_ids": [str(piece.id) for piece in pieces],
    }
    session.close()
    return data


def test_batch_move_succeeds_for_every_piece(
    seeded_api: SeededApi, batch_data: dict[str, object]
) -> None:
    client = seeded_api.client
    res = client.post(
        "/api/v1/movements/batch",
        json={
            "movement_type": "MOVE",
            "to_location_id": batch_data["destination_id"],
            "reason": "Traslado masivo",
            "items": [{"piece_id": pid} for pid in batch_data["piece_ids"]],
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 201
    body = res.json()
    assert len(body["registered"]) == 3
    assert body["failures"] == []


def test_batch_move_is_all_or_nothing_when_one_piece_already_moved(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    session = _as_admin_session(seeded_api)
    site = session.get(Location, uuid.UUID(admin_hierarchy["site_id"]))
    destination = create_location(
        session, level=LocationLevel.SPACE, code="BATCH-DEST-2", name="Depósito 2", parent=site
    )
    origin = create_location(
        session,
        level=LocationLevel.SPACE,
        code="BATCH-ORIGIN-2",
        name="Depósito origen 2",
        parent=site,
    )
    from app.modules.locations.service import move_piece

    piece_ok = create_piece(session, denomination="Pieza ok", tenure_regime=TenureRegime.OWNED)
    piece_already = create_piece(
        session, denomination="Pieza ya movida", tenure_regime=TenureRegime.OWNED
    )
    move_piece(session, piece_ok, origin, "Ingreso")
    move_piece(session, piece_already, destination, "Ya está en destino")
    session.commit()
    piece_ok_id, piece_already_id = str(piece_ok.id), str(piece_already.id)
    destination_id = str(destination.id)
    session.close()

    client = seeded_api.client
    res = client.post(
        "/api/v1/movements/batch",
        json={
            "movement_type": "MOVE",
            "to_location_id": destination_id,
            "reason": "Traslado masivo",
            "items": [{"piece_id": piece_ok_id}, {"piece_id": piece_already_id}],
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code in (409, 422)
    body = res.json()
    assert len(body["failures"]) == 1
    assert body["failures"][0]["piece_id"] == piece_already_id
    assert body["registered"] == []

    with seeded_api.session() as check_session:
        refreshed = check_session.get(type(piece_ok), uuid.UUID(piece_ok_id))
        assert refreshed.current_location_id != uuid.UUID(destination_id)


def test_batch_move_retried_with_same_idempotency_key_does_not_duplicate(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    session = _as_admin_session(seeded_api)
    site = session.get(Location, uuid.UUID(admin_hierarchy["site_id"]))
    destination = create_location(
        session, level=LocationLevel.SPACE, code="BATCH-DEST-3", name="Depósito 3", parent=site
    )
    origin = create_location(
        session,
        level=LocationLevel.SPACE,
        code="BATCH-ORIGIN-3",
        name="Depósito origen 3",
        parent=site,
    )
    from app.modules.locations.service import move_piece

    piece = create_piece(
        session, denomination="Pieza idempotente", tenure_regime=TenureRegime.OWNED
    )
    move_piece(session, piece, origin, "Ingreso")
    session.commit()
    piece_id, destination_id = str(piece.id), str(destination.id)
    session.close()

    client = seeded_api.client
    payload = {
        "movement_type": "MOVE",
        "to_location_id": destination_id,
        "reason": "Traslado con reintento",
        "items": [{"piece_id": piece_id}],
    }
    headers = {**as_user(STORAGE), "Idempotency-Key": "retry-key-1"}
    res1 = client.post("/api/v1/movements/batch", json=payload, headers=headers)
    assert res1.status_code == 201
    movement_id = res1.json()["registered"][0]["id"]

    res2 = client.post("/api/v1/movements/batch", json=payload, headers=headers)
    assert res2.status_code == 201
    assert res2.json()["registered"][0]["id"] == movement_id

    with seeded_api.session() as check_session:
        all_movements = list(
            check_session.scalars(
                select(PieceMovement).where(PieceMovement.piece_id == uuid.UUID(piece_id))
            )
        )
        assert len(all_movements) == 2  # ingreso inicial + un solo traslado (no duplicado)


def test_batch_move_over_limit_is_rejected(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    client = seeded_api.client
    items = [{"piece_id": str(uuid.uuid4())} for _ in range(201)]
    res = client.post(
        "/api/v1/movements/batch",
        json={
            "movement_type": "MOVE",
            "to_location_id": admin_hierarchy["box_id"],
            "items": items,
        },
        headers=as_user(STORAGE),
    )
    assert res.status_code == 422


# ----------------------------------------------------------------- disponibilidad y tipo de espacio
def test_move_to_exhibition_room_proposes_availability(seeded_api: SeededApi) -> None:
    session = _as_admin_session(seeded_api)
    site = create_location(session, level=LocationLevel.SITE, code="SITE-AV", name="Sede AV")
    room = create_location(
        session,
        level=LocationLevel.SPACE,
        code="SALA-AV",
        name="Sala AV",
        parent=site,
        space_kind="EXHIBITION_ROOM",
    )
    piece = create_piece(
        session, denomination="Pieza disponibilidad", tenure_regime=TenureRegime.OWNED
    )
    session.commit()
    piece_id, room_id = str(piece.id), str(room.id)
    session.close()

    client = seeded_api.client
    res = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": room_id, "reason": "A sala"},
        headers=as_user(STORAGE),
    )
    assert res.status_code == 201

    with seeded_api.session() as check_session:
        refreshed_piece = check_session.get(type(piece), uuid.UUID(piece_id))
        availability_term = check_session.get(Term, refreshed_piece.availability_term_id)
        assert availability_term.code == "EN_SALA"


def test_manual_availability_incoherent_with_current_location_is_rejected(
    seeded_api: SeededApi,
) -> None:
    session = _as_admin_session(seeded_api)
    site = create_location(session, level=LocationLevel.SITE, code="SITE-INC", name="Sede INC")
    deposit = create_location(
        session,
        level=LocationLevel.SPACE,
        code="DEP-INC",
        name="Depósito INC",
        parent=site,
        space_kind="DEPOSIT",
    )
    piece = create_piece(
        session, denomination="Pieza incoherente", tenure_regime=TenureRegime.OWNED
    )
    from app.modules.locations.service import move_piece

    move_piece(session, piece, deposit, "Ingreso")
    session.commit()
    piece_id = str(piece.id)
    version = piece.version
    en_sala_id = str(
        session.scalar(
            select(Term.id)
            .join(Vocabulary)
            .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == "EN_SALA")
        )
    )
    session.close()

    client = seeded_api.client
    res = client.put(
        f"/api/v1/pieces/{piece_id}",
        json={"availability_term_id": en_sala_id},
        headers={**as_user(CATALOGUER), "If-Match": str(version)},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "availability_incoherent"


# -------------------------------------------------------------- propiedad: ubicación derivada
def test_current_location_matches_the_last_move_or_correction(
    seeded_api: SeededApi, admin_hierarchy: dict[str, str]
) -> None:
    """Tras una secuencia aleatoria de movimientos, verificaciones y correcciones,
    `piece.current_location_id` siempre coincide con el destino del último MOVE/CORRECTION
    (Req: Registro de movimientos con ubicación actual derivada; tarea 3.2)."""
    session = _as_admin_session(seeded_api)
    site = session.get(Location, uuid.UUID(admin_hierarchy["site_id"]))
    spaces = [
        create_location(
            session,
            level=LocationLevel.SPACE,
            code=f"PROP-{i}",
            name=f"Depósito prop {i}",
            parent=site,
        )
        for i in range(4)
    ]
    from app.modules.locations.service import correct_movement, move_piece, verify_location

    piece = create_piece(session, denomination="Pieza propiedad", tenure_regime=TenureRegime.OWNED)
    session.commit()

    rng = random.Random(42)
    expected_location = None
    history_ids: list[uuid.UUID] = []
    for _ in range(60):
        action = rng.choice(["move", "verify", "correct"])
        if action == "move" or expected_location is None:
            destination = rng.choice(spaces)
            if destination.id == piece.current_location_id:
                continue
            movement = move_piece(session, piece, destination, "Movimiento aleatorio de prueba")
            expected_location = destination.id
            history_ids.append(movement.id)
        elif action == "verify":
            verify_location(session, piece)
        else:  # correct
            if not history_ids:
                continue
            target_movement_id = rng.choice(history_ids)
            destination = rng.choice(spaces)
            movement = correct_movement(
                session,
                piece,
                destination,
                corrects_movement_id=target_movement_id,
                reason="Corrección aleatoria de prueba",
            )
            expected_location = destination.id
            history_ids.append(movement.id)
        session.commit()
        assert piece.current_location_id == expected_location

    session.close()
