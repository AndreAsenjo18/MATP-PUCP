"""Spec calidad-datos — `GET /reports/dashboard-stats/history` (design D5, tarea 2.4)."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, writer
from app.modules.quality.snapshot import replace_daily_snapshot
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, SeededApi

DAY = "2026-10-01"


def _as_admin(session: Session) -> None:
    admin_user = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
    assert admin_user is not None
    writer(
        session,
        CurrentUser(
            id=admin_user.id, email=ADMIN, full_name=admin_user.full_name, roles=("ADMIN",)
        ),
    )


def test_history_returns_points_for_the_requested_range(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        replace_daily_snapshot(session, date.fromisoformat(DAY))
        session.commit()

    client = seeded_api.login_as("ADMIN")
    response = client.get(
        "/api/v1/reports/dashboard-stats/history", params={"from": DAY, "to": DAY}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["collection_id"] is None
    alerts = {point["alert"] for point in body["points"]}
    assert "MISSING_PHOTO" in alerts
    assert all(point["taken_on"] == DAY for point in body["points"])


def test_history_rejects_inverted_date_range(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("ADMIN")
    response = client.get(
        "/api/v1/reports/dashboard-stats/history", params={"from": "2026-10-10", "to": DAY}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_date_range"


def test_history_requires_authentication(client: TestClient) -> None:
    response = client.get(
        "/api/v1/reports/dashboard-stats/history", params={"from": DAY, "to": DAY}
    )
    assert response.status_code == 401
