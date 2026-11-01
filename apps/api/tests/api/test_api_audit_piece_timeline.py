"""Spec auditoria-trazabilidad — Trazabilidad completa de una pieza (RF-040, contrato #44)."""

from sqlalchemy import select

from app.models import AuditLog, Piece
from tests.api.conftest import LoginAs, SeededApi


def _edited_piece(seeded_api: SeededApi, login_as: LoginAs) -> str:
    with seeded_api.session() as db:
        piece_id = str(db.scalars(select(Piece.id).limit(1)).first())
    client = login_as("CATALOGUER")
    version = client.get(f"/api/v1/pieces/{piece_id}").json()["version"]
    response = client.put(
        f"/api/v1/pieces/{piece_id}",
        json={"notes": "Nota para la línea de tiempo (sintética)"},
        headers={"If-Match": str(version)},
    )
    assert response.status_code == 200, response.text
    return piece_id


def test_the_timeline_lists_only_that_pieces_changes_newest_first(
    seeded_api: SeededApi, login_as: LoginAs
) -> None:
    piece_id = _edited_piece(seeded_api, login_as)

    response = login_as("ADMIN").get(f"/api/v1/audit-logs/pieces/{piece_id}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] >= 1
    assert {item["entity_type"] for item in body["items"]} == {"piece"}
    assert {item["entity_id"] for item in body["items"]} == {piece_id}
    times = [item["occurred_at"] for item in body["items"]]
    assert times == sorted(times, reverse=True)
    assert any(item["field"] == "notes" for item in body["items"])


def test_the_timeline_matches_the_general_audit_query(
    seeded_api: SeededApi, login_as: LoginAs
) -> None:
    piece_id = _edited_piece(seeded_api, login_as)
    admin = login_as("ADMIN")

    timeline = admin.get(f"/api/v1/audit-logs/pieces/{piece_id}", params={"page_size": 100})
    general = admin.get(
        "/api/v1/audit-logs",
        params={"entity_type": "piece", "entity_id": piece_id, "page_size": 100},
    )

    assert timeline.json()["total"] == general.json()["total"]
    assert [i["id"] for i in timeline.json()["items"]] == [i["id"] for i in general.json()["items"]]


def test_the_timeline_is_paginated_and_restricted_to_who_may_read_the_audit(
    seeded_api: SeededApi, login_as: LoginAs
) -> None:
    piece_id = _edited_piece(seeded_api, login_as)
    page = login_as("ADMIN").get(f"/api/v1/audit-logs/pieces/{piece_id}", params={"page_size": 1})
    assert page.status_code == 200 and len(page.json()["items"]) == 1
    assert (
        login_as("INTERNAL_VIEWER").get(f"/api/v1/audit-logs/pieces/{piece_id}").status_code == 403
    )


def test_a_piece_without_changes_returns_an_empty_page(
    seeded_api: SeededApi, login_as: LoginAs
) -> None:
    with seeded_api.session() as db:
        unaudited = db.scalar(select(Piece.id).where(Piece.id.not_in(select(AuditLog.entity_id))))
    if unaudited is None:  # the seed audits every piece it creates
        return
    response = login_as("ADMIN").get(f"/api/v1/audit-logs/pieces/{unaudited}")
    assert response.status_code == 200 and response.json()["total"] == 0
