"""Spec calidad-datos — `GET /reports/dashboard-stats` (design D3, tarea 2.2)."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, writer
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.service import create_collection
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


def test_dashboard_stats_omits_by_collection_unless_requested(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("ADMIN")
    response = client.get("/api/v1/reports/dashboard-stats")
    assert response.status_code == 200
    body = response.json()
    assert body["by_collection"] == []
    alerts = {alert["alert"]: alert for alert in body["alerts"]}
    assert set(alerts) == {
        "MISSING_INVENTORY_CODE",
        "MISSING_PHOTO",
        "MISSING_LOCATION",
        "MISSING_REQUIRED_FIELDS",
        "MISSING_RECOMMENDED_FIELDS",
        "UNNORMALIZABLE_IDENTIFIER",
    }
    assert alerts["MISSING_PHOTO"]["denominator"] == body["total_pieces"]


def test_dashboard_stats_marks_inapplicable_kpi_as_null_for_loan_for_use_collection(
    seeded_api: SeededApi,
) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        collection = create_collection(session, name="Colección en comodato (2.2, API)")
        create_piece(
            session,
            denomination="Pieza en comodato (2.2, API)",
            tenure_regime=TenureRegime.LOAN_FOR_USE,
            lender_name="Familia sintética",
            collection_id=collection.id,
        )
        session.commit()
        collection_id = collection.id

    client = seeded_api.login_as("ADMIN")
    response = client.get("/api/v1/reports/dashboard-stats", params={"by_collection": True})
    assert response.status_code == 200
    group = next(
        g for g in response.json()["by_collection"] if g["collection_id"] == str(collection_id)
    )
    alerts = {a["alert"]: a for a in group["alerts"]}
    assert alerts["MISSING_INVENTORY_CODE"]["denominator"] == 0
    assert alerts["MISSING_INVENTORY_CODE"]["completeness_ratio"] is None


def test_dashboard_stats_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/reports/dashboard-stats")
    assert response.status_code == 401
