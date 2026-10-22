"""Spec calidad-datos — `GET /quality/incomplete` (design D4, tarea 2.3)."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, writer
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.identification.service import set_inventory_code
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


def test_incomplete_report_lists_piece_with_its_active_alerts(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        piece = create_piece(
            session, denomination="Pieza incompleta (2.3, API)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()
        piece_id = piece.id

    client = seeded_api.login_as("ADMIN")
    response = client.get("/api/v1/quality/incomplete", params={"page_size": 100})
    assert response.status_code == 200
    body = response.json()
    row = next(item for item in body["items"] if item["piece_id"] == str(piece_id))
    assert "MISSING_PHOTO" in row["alerts"]
    assert "MISSING_LOCATION" in row["alerts"]


def test_alert_filter_excludes_pieces_that_already_have_a_code(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        _as_admin(session)
        with_code = create_piece(
            session, denomination="Con código (2.3, API)", tenure_regime=TenureRegime.OWNED
        )
        set_inventory_code(session, with_code, "I-40001")
        session.commit()
        with_code_id = with_code.id

    client = seeded_api.login_as("ADMIN")
    response = client.get(
        "/api/v1/quality/incomplete",
        params={"alert": "MISSING_INVENTORY_CODE", "page_size": 100},
    )
    assert response.status_code == 200
    ids = {item["piece_id"] for item in response.json()["items"]}
    assert str(with_code_id) not in ids


def test_csv_export_is_downloadable_and_unpaginated(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("ADMIN")
    response = client.get("/api/v1/quality/incomplete", params={"format": "csv", "page_size": 1})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "piezas-incompletas.csv" in response.headers["content-disposition"]
    assert "Reporte de piezas incompletas" in response.text


def test_xlsx_export_has_the_right_content_type(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("ADMIN")
    response = client.get("/api/v1/quality/incomplete", params={"format": "xlsx"})
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert "piezas-incompletas.xlsx" in response.headers["content-disposition"]


def test_incomplete_report_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/quality/incomplete")
    assert response.status_code == 401
