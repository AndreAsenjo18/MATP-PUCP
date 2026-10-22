"""Spec usuarios-roles — Registro de accesos a datos sensibles (task 3.3; RNF-014, RF-041).

The TestClient runs background tasks before returning, so the row exists when the call ends.
"""

import uuid

from sqlalchemy import func, select

from app.models import Piece
from app.modules.catalog.enums import TenureRegime
from app.modules.users.models import SensitiveAccessLog
from tests.api.conftest import SeededApi

LOG = "/api/v1/audit/sensitive-access"


def _loan_piece(seeded_api: SeededApi) -> str:
    with seeded_api.session() as db:
        piece = db.scalar(
            select(Piece)
            .where(Piece.tenure_regime == TenureRegime.LOAN_FOR_USE, Piece.lender_name.is_not(None))
            .limit(1)
        )
        assert piece is not None, "El seed debe tener comodatos con comodante"
        return str(piece.id)


def _rows_for(seeded_api: SeededApi, user_email: str, piece_id: str) -> list[SensitiveAccessLog]:
    with seeded_api.session() as db:
        me = seeded_api.login_as(user_email).get("/api/v1/auth/me").json()["id"]
        rows = db.scalars(
            select(SensitiveAccessLog).where(SensitiveAccessLog.user_id == uuid.UUID(me))
        )
        return [row for row in rows if piece_id in row.entity_ids]


def test_opening_a_loan_piece_logs_the_fields_but_not_their_values(seeded_api: SeededApi) -> None:
    piece_id = _loan_piece(seeded_api)
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")

    sheet = manager.get(f"/api/v1/pieces/{piece_id}")

    assert sheet.status_code == 200 and sheet.json()["lender_name"]
    rows = _rows_for(seeded_api, "curadora@matp.local", piece_id)
    assert len(rows) == 1
    row = rows[0]
    assert row.entity_type == "piece" and row.route == f"/api/v1/pieces/{piece_id}"
    assert "lender_name" in row.fields
    dump = " ".join(str(getattr(row, c.key)) for c in SensitiveAccessLog.__table__.columns)
    assert sheet.json()["lender_name"] not in dump  # field names only, never the values


def test_a_masked_response_logs_nothing(seeded_api: SeededApi) -> None:
    piece_id = _loan_piece(seeded_api)
    viewer = seeded_api.login_as("INTERNAL_VIEWER")
    with seeded_api.session() as db:
        before = db.scalar(select(func.count()).select_from(SensitiveAccessLog))

    sheet = viewer.get(f"/api/v1/pieces/{piece_id}")

    assert sheet.status_code == 200 and sheet.json()["lender_name"] is None
    with seeded_api.session() as db:
        assert db.scalar(select(func.count()).select_from(SensitiveAccessLog)) == before


def test_administrators_can_read_the_log_and_others_cannot(seeded_api: SeededApi) -> None:
    piece_id = _loan_piece(seeded_api)
    seeded_api.login_as("COLLECTIONS_MANAGER").get(f"/api/v1/pieces/{piece_id}")

    listed = seeded_api.login_as("ADMIN").get(LOG, params={"entity_type": "piece"})

    assert listed.status_code == 200
    items = listed.json()["items"]
    assert items and {"route", "entity_ids", "fields", "user_id", "occurred_at"} <= set(items[0])
    assert seeded_api.login_as("CATALOGUER").get(LOG).status_code == 403
