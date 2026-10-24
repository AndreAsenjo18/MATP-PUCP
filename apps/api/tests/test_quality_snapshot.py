"""Spec calidad-datos — instantáneas diarias de completitud (RF-035, design D5).

Change alertas-y-reporte-incompletas, tarea 2.4. Cubre los tres escenarios de la spec:
evolución mensual, instantánea repetida (idempotencia) y rango de fechas inválido.
"""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.service import create_collection
from app.modules.identification.service import set_inventory_code
from app.modules.quality.completeness import AlertCode
from app.modules.quality.models import CompletenessSnapshot
from app.modules.quality.snapshot import dashboard_history, replace_daily_snapshot
from tests.conftest import ActAs

DAY = date(2026, 10, 1)


def test_replace_daily_snapshot_is_idempotent(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session, denomination="Pieza sin foto (2.4)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()

    replace_daily_snapshot(session, DAY)
    session.commit()
    with act_as("CATALOGUER"):
        set_inventory_code(session, piece, "I-50001")
        session.commit()
    replace_daily_snapshot(session, DAY)
    session.commit()

    rows = session.scalars(
        select(CompletenessSnapshot).where(
            CompletenessSnapshot.taken_on == DAY,
            CompletenessSnapshot.collection_id.is_(None),
            CompletenessSnapshot.alert_code == AlertCode.MISSING_INVENTORY_CODE.value,
        )
    ).all()
    assert len(rows) == 1
    assert rows[0].numerator == 0  # la segunda corrida ya ve el código asignado


def test_dashboard_history_returns_one_point_per_day(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        create_piece(
            session, denomination="Pieza para evolución (2.4)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()

    for offset in range(3):
        replace_daily_snapshot(session, DAY + timedelta(days=offset))
    session.commit()

    points = dashboard_history(session, DAY, DAY + timedelta(days=2))
    photo_days = {p.taken_on for p in points if p.alert == AlertCode.MISSING_PHOTO}
    assert photo_days == {DAY, DAY + timedelta(days=1), DAY + timedelta(days=2)}


def test_dashboard_history_rejects_inverted_date_range(session: Session) -> None:
    with pytest.raises(ValidationFailed) as exc:
        dashboard_history(session, DAY, DAY - timedelta(days=1))
    assert exc.value.code == "invalid_date_range"


def test_dashboard_history_scoped_to_a_collection_excludes_global_rows(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        collection = create_collection(session, name="Colección de evolución (2.4)")
        create_piece(
            session,
            denomination="Pieza de colección (2.4)",
            tenure_regime=TenureRegime.OWNED,
            collection_id=collection.id,
        )
        session.commit()
        collection_id = collection.id

    replace_daily_snapshot(session, DAY)
    session.commit()

    scoped = dashboard_history(session, DAY, DAY, collection_id=collection_id)
    glob = dashboard_history(session, DAY, DAY)
    unknown = dashboard_history(session, DAY, DAY, collection_id=uuid.uuid4())
    assert len(scoped) == 6  # una fila por alerta (design D1)
    assert len(glob) == 6
    assert unknown == []  # sin colección con ese id, no hay fila que pueda coincidir
