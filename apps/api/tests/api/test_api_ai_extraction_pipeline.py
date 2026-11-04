"""RIA-01 de punta a punta: pedir sugerencia, aprobar y ver el catálogo cambiar (RN-009).

Corre contra el proveedor mock real (AI_PROVIDER no está definido en el entorno de pruebas, así
que el servicio de IA montado en /ai usa MockProvider), sin red ni clave: ejercita exactamente el
mismo camino que usaría AI_PROVIDER=llm, solo que con una respuesta determinista.
"""

import uuid

from sqlalchemy import select

from app.modules.catalog.models import Piece
from tests.api.conftest import SeededApi


def _any_piece_id(seeded: SeededApi) -> str:
    with seeded.system_session() as db:
        piece = db.scalars(select(Piece).where(Piece.deleted_at.is_(None)).limit(1)).one()
        return str(piece.id)


def _set_notes(seeded: SeededApi, piece_id: str, notes: str) -> None:
    with seeded.system_session() as db:
        piece = db.get(Piece, uuid.UUID(piece_id))
        assert piece is not None
        piece.notes = notes
        db.commit()


def test_suggest_approve_and_reject_end_to_end(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    _set_notes(seeded_api, piece_id, "Alto 35 cm, ancho 20 cm. Buen estado.")

    requester = seeded_api.login_as("CATALOGUER")
    reviewer = seeded_api.login_as("COLLECTIONS_MANAGER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    assert created.status_code == 201, created.text
    suggestion = created.json()
    assert suggestion["status"] == "PENDING"
    assert suggestion["provider"] == "mock"
    fields = suggestion["output_data"]["fields"]
    assert any(f["field"] == "dimensions" for f in fields)
    assert any(f["field"] == "conservation_status" for f in fields)

    # A catalogador cannot review their own suggestion's permission-gated endpoint.
    assert (
        requester.post(
            f"/api/v1/ai/suggestions/{suggestion['id']}/approve",
            json={"approved_data": {"fields": fields}},
        ).status_code
        == 403
    )

    approved = reviewer.post(
        f"/api/v1/ai/suggestions/{suggestion['id']}/approve",
        json={"approved_data": {"fields": fields}},
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["status"] == "APPROVED"
    assert body["reviewed_by_id"] is not None

    # Applied for real: no simulation, no "the mock store" — the piece itself changed.
    piece_after = reviewer.get(f"/api/v1/pieces/{piece_id}").json()
    assert {"dimension": "alto", "value": 35, "unit": "cm"} in piece_after["dimensions"]
    assert piece_after["conservation_status"]["code"] == "BUENO"

    # Reviewing it again is a conflict (D3): a decision is final once made.
    again = reviewer.post(
        f"/api/v1/ai/suggestions/{suggestion['id']}/reject", json={"reason": "demasiado tarde"}
    )
    assert again.status_code == 409


def test_reject_requires_a_reason_and_applies_nothing(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    _set_notes(seeded_api, piece_id, "Alto 12 cm. En restauración.")
    requester = seeded_api.login_as("CATALOGUER")
    reviewer = seeded_api.login_as("COLLECTIONS_MANAGER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    suggestion = created.json()

    missing_reason = reviewer.post(
        f"/api/v1/ai/suggestions/{suggestion['id']}/reject", json={"reason": ""}
    )
    assert missing_reason.status_code == 422

    rejected = reviewer.post(
        f"/api/v1/ai/suggestions/{suggestion['id']}/reject",
        json={"reason": "No corresponde a esta pieza"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"

    piece_after = reviewer.get(f"/api/v1/pieces/{piece_id}").json()
    assert piece_after["notes"] == "Alto 12 cm. En restauración."


def test_suggest_cataloging_rejects_a_sensitive_source_field(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "lender_name"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "source_field_not_allowed"
