"""Spec calidad-datos — `GET /pieces/{piece_id}/alerts` (design D1, tarea 2.1)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, writer
from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, SeededApi


def _as_admin(session: Session) -> None:
    admin_user = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
    assert admin_user is not None
    writer(
        session,
        CurrentUser(
            id=admin_user.id, email=ADMIN, full_name=admin_user.full_name, roles=("ADMIN",)
        ),
    )


def test_alert_includes_suggested_action_and_field(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        piece = create_piece(
            session, denomination="Pieza sin ubicación (2.1)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()
        piece_id = piece.id

    client = seeded_api.login_as("CATALOGUER")
    response = client.get(f"/api/v1/pieces/{piece_id}/alerts")
    assert response.status_code == 200
    alerts = {alert["type"]: alert for alert in response.json()}
    assert "MISSING_LOCATION" in alerts
    assert alerts["MISSING_LOCATION"]["suggested_action"] == "Registrar sede y espacio"
    assert alerts["MISSING_LOCATION"]["applies"] is True


def test_alert_disappears_right_after_being_resolved(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        piece = create_piece(
            session, denomination="Pieza a ubicar (2.1)", tenure_regime=TenureRegime.OWNED
        )
        site = create_location(
            session, level=LocationLevel.SITE, code=f"S-{new_uuid().hex[:6]}", name="Sede 2.1"
        )
        space = create_location(
            session,
            level=LocationLevel.SPACE,
            code=f"D-{new_uuid().hex[:6]}",
            name="Depósito 2.1",
            parent=site,
        )
        session.commit()
        piece_id, space_id = piece.id, space.id

    client = seeded_api.login_as("CATALOGUER")
    before = {a["type"] for a in client.get(f"/api/v1/pieces/{piece_id}/alerts").json()}
    assert "MISSING_LOCATION" in before

    with seeded_api.session() as session:
        _as_admin(session)
        piece = session.get(Piece, piece_id)
        space = session.get(Location, space_id)
        assert piece is not None and space is not None
        move_piece(session, piece, space, "Resolviendo alerta en prueba 2.1")
        session.commit()

    after = {a["type"] for a in client.get(f"/api/v1/pieces/{piece_id}/alerts").json()}
    assert "MISSING_LOCATION" not in after


def test_merged_piece_has_no_alerts(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        absorbed = create_piece(
            session, denomination="Pieza absorbida (2.1)", tenure_regime=TenureRegime.OWNED
        )
        surviving = create_piece(
            session, denomination="Pieza sobreviviente (2.1)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()
        absorbed.merged_into_id = surviving.id
        session.commit()
        absorbed_id = absorbed.id

    client = seeded_api.login_as("CATALOGUER")
    response = client.get(f"/api/v1/pieces/{absorbed_id}/alerts")
    assert response.status_code == 200
    assert response.json() == []


def test_unknown_piece_is_404(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    response = client.get(f"/api/v1/pieces/{uuid.uuid4()}/alerts")
    assert response.status_code == 404
