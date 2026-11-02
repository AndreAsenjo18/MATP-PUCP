"""What a search hit carries to act from the results (fusion-busqueda-deposito 3.2 and 3.3).

Spec ubicacion-movimientos, «Verificar y mover desde los resultados de la búsqueda»; RF-041. The
exact location only reaches whoever can see it: every role that registers movements can.
Synthetic data only (RNF-014).
"""

import uuid
from datetime import datetime

from sqlalchemy import select

from app.api.deps import CurrentUser, writer
from app.modules.catalog.models import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, STORAGE, VIEWER, LoginAs, SeededApi, as_user


def _located_hits(page: dict) -> list[dict]:
    return [hit for hit in page["items"] if hit["piece"]["has_location"]]


def test_the_hit_carries_the_exact_location_for_whoever_can_see_it(login_as: LoginAs) -> None:
    client = login_as("STORAGE_STAFF")

    hits = _located_hits(client.get("/api/v1/search", params={"limit": 50}).json())

    assert hits
    for hit in hits[:5]:
        detail = client.get(f"/api/v1/pieces/{hit['piece']['id']}").json()
        assert hit["location_id"] == detail["location"]["location_id"]


def test_the_hit_hides_the_location_from_a_role_without_exact_location(login_as: LoginAs) -> None:
    client = login_as("INTERNAL_VIEWER")

    hits = _located_hits(client.get("/api/v1/search", params={"limit": 50}).json())

    assert hits
    assert all("location_id" not in hit for hit in hits)


def test_moving_hits_in_one_batch_with_the_location_they_showed(seeded_api: SeededApi) -> None:
    """Escenario «Mover varias piezas filtradas»: what the search shows is what the batch checks."""
    session = seeded_api.session()
    admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
    assert admin is not None
    writer(
        session,
        CurrentUser(id=admin.id, email=ADMIN, full_name=admin.full_name, roles=("ADMIN",)),
    )
    site = session.scalar(select(Location).where(Location.level == LocationLevel.SITE))
    assert site is not None
    origin = create_location(
        session,
        level=LocationLevel.SPACE,
        code="FBD-ORIGEN",
        name="Origen (sintético)",
        parent=site,
    )
    destination = create_location(
        session,
        level=LocationLevel.SPACE,
        code="FBD-DESTINO",
        name="Destino (sintético)",
        parent=site,
    )
    pieces = [
        create_piece(
            session,
            denomination=f"Textil de lote {i} (sintético)",
            tenure_regime=TenureRegime.OWNED,
        )
        for i in range(3)
    ]
    for piece in pieces:
        move_piece(session, piece, origin, "Ingreso de prueba")
    session.commit()
    origin_id, destination_id = str(origin.id), str(destination.id)
    piece_ids = {str(piece.id) for piece in pieces}
    session.close()
    client, storage = seeded_api.client, as_user(STORAGE)

    found = client.get("/api/v1/search", params={"location_id": origin_id}, headers=storage).json()
    hits = [hit for hit in found["items"] if hit["piece"]["id"] in piece_ids]
    assert {hit["location_id"] for hit in hits} == {origin_id} and len(hits) == 3

    moved = client.post(
        "/api/v1/movements/batch",
        json={
            "movement_type": "MOVE",
            "to_location_id": destination_id,
            "items": [
                {"piece_id": hit["piece"]["id"], "expected_from_location_id": hit["location_id"]}
                for hit in hits
            ],
        },
        headers={**storage, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert moved.status_code == 201, moved.text
    assert len(moved.json()["registered"]) == 3

    after = client.get("/api/v1/search", params={"location_id": destination_id}, headers=storage)
    assert {
        hit["location_id"] for hit in after.json()["items"] if hit["piece"]["id"] in piece_ids
    } == {destination_id}
    stale = client.post(
        "/api/v1/movements/batch",
        json={
            "movement_type": "MOVE",
            "to_location_id": origin_id,
            "items": [{"piece_id": hits[0]["piece"]["id"], "expected_from_location_id": origin_id}],
        },
        headers={**storage, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert stale.status_code in (409, 422) and stale.json()["registered"] == []
    for piece_id in piece_ids:  # the seeded database is shared: the active total must not move
        deleted = client.delete(
            f"/api/v1/pieces/{piece_id}",
            params={"reason": "Limpieza de prueba"},
            headers=as_user(ADMIN),
        )
        assert deleted.status_code == 204, deleted.text


def test_a_verification_from_the_search_makes_the_hit_seen_today(seeded_api: SeededApi) -> None:
    """Escenario «Verificar una pieza desde la búsqueda» (3.2 and 3.3): the last time seen is the
    verification, for whoever sees the location; nothing for whoever does not."""
    client, storage = seeded_api.client, as_user(STORAGE)
    place = next(
        hit["location_id"]
        for hit in client.get("/api/v1/search", params={"limit": 50}, headers=storage).json()[
            "items"
        ]
        if hit.get("location_id")
    )
    piece_id = client.post(
        "/api/v1/pieces",
        json={"denomination": "Faja verificada (sintética)", "tenure_regime": "Propiedad"},
        headers=as_user(ADMIN),
    ).json()["id"]
    params = {"denomination": "Faja verificada (sintética)"}

    def hit_of(headers: dict[str, str]) -> dict:
        page = client.get("/api/v1/search", params=params, headers=headers).json()
        return next(hit for hit in page["items"] if hit["piece"]["id"] == piece_id)

    assert hit_of(storage).get("last_seen_at") is None  # never placed nor verified
    placed = client.post(
        f"/api/v1/pieces/{piece_id}/move",
        json={"movement_type": "MOVE", "to_location_id": place},
        headers=storage,
    )
    assert placed.status_code in (200, 201), placed.text
    verified = client.post(
        f"/api/v1/pieces/{piece_id}/move", json={"movement_type": "VERIFICATION"}, headers=storage
    )
    assert verified.status_code in (200, 201), verified.text

    seen = datetime.fromisoformat(hit_of(storage)["last_seen_at"])
    assert seen == datetime.fromisoformat(verified.json()["occurred_at"])
    assert seen >= datetime.fromisoformat(placed.json()["occurred_at"])
    assert "last_seen_at" not in hit_of(as_user(VIEWER))
    deleted = client.delete(
        f"/api/v1/pieces/{piece_id}",
        params={"reason": "Limpieza de prueba"},
        headers=as_user(ADMIN),
    )
    assert deleted.status_code == 204, deleted.text
