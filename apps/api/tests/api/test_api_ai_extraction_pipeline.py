"""RIA-01 de punta a punta: pedir sugerencia, aprobar y ver el catálogo cambiar (RN-009).

Corre contra el proveedor mock real (AI_PROVIDER no está definido en el entorno de pruebas, así
que el servicio de IA montado en /ai usa MockProvider), sin red ni clave: ejercita exactamente el
mismo camino que usaría AI_PROVIDER=llm, solo que con una respuesta determinista.
"""

import uuid

from sqlalchemy import select

from app.modules.ai_suggestions.novelty import NO_CHANGE_MESSAGE
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
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


def _set_dimensions_and_conservation(
    seeded: SeededApi, piece_id: str, *, dimensions: list[dict], conservation_code: str
) -> None:
    with seeded.system_session() as db:
        piece = db.get(Piece, uuid.UUID(piece_id))
        assert piece is not None
        term = db.scalars(
            select(Term)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(Vocabulary.code == VocabularyCode.CONSERVATION_STATUS, Term.code == conservation_code)
        ).one()
        piece.dimensions = dimensions
        piece.conservation_state_id = term.id
        db.commit()


def test_suggest_approve_and_reject_end_to_end(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    # Un punto de partida distinto al que propondrá la IA: si ya coincidiera (p. ej. BUENO por el
    # seed), el filtro de "sin cambios" (2026-11-05) lo descartaría de `fields` a propósito.
    _set_dimensions_and_conservation(seeded_api, piece_id, dimensions=[], conservation_code="MALO")
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


def test_approve_applies_an_edited_value_not_the_original_proposal(seeded_api: SeededApi) -> None:
    """The reviewer can correct a proposed value before approving (design: "con edición")."""
    piece_id = _any_piece_id(seeded_api)
    _set_dimensions_and_conservation(seeded_api, piece_id, dimensions=[], conservation_code="MALO")
    _set_notes(seeded_api, piece_id, "Alto 35 cm, ancho 20 cm. Buen estado.")
    requester = seeded_api.login_as("CATALOGUER")
    reviewer = seeded_api.login_as("COLLECTIONS_MANAGER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    fields = created.json()["output_data"]["fields"]
    for field in fields:
        if field["field"] == "dimensions" and field["value"]["dimension"] == "alto":
            field["value"]["value"] = 40  # la IA propuso 35; la persona revisora lo corrige a 40

    approved = reviewer.post(
        f"/api/v1/ai/suggestions/{created.json()['id']}/approve",
        json={"approved_data": {"fields": fields}},
    )
    assert approved.status_code == 200, approved.text

    piece_after = reviewer.get(f"/api/v1/pieces/{piece_id}").json()
    assert {"dimension": "alto", "value": 40, "unit": "cm"} in piece_after["dimensions"]
    assert {"dimension": "alto", "value": 35, "unit": "cm"} not in piece_after["dimensions"]


def test_approve_can_also_replace_the_manual_dimensions_text(seeded_api: SeededApi) -> None:
    """Opt-in only: approving never touches `dimensions_text` unless the reviewer sends it."""
    piece_id = _any_piece_id(seeded_api)
    _set_dimensions_and_conservation(seeded_api, piece_id, dimensions=[], conservation_code="MALO")
    _set_notes(seeded_api, piece_id, "Alto 35 cm, ancho 20 cm. Buen estado.")
    requester = seeded_api.login_as("CATALOGUER")
    reviewer = seeded_api.login_as("COLLECTIONS_MANAGER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    fields = created.json()["output_data"]["fields"]

    blank_text = reviewer.post(
        f"/api/v1/ai/suggestions/{created.json()['id']}/approve",
        json={"approved_data": {"fields": fields, "dimensions_text": "   "}},
    )
    assert blank_text.status_code == 422
    assert blank_text.json()["code"] == "invalid_dimensions_text"

    approved = reviewer.post(
        f"/api/v1/ai/suggestions/{created.json()['id']}/approve",
        json={"approved_data": {"fields": fields, "dimensions_text": "35cmx20cm"}},
    )
    assert approved.status_code == 200, approved.text

    piece_after = reviewer.get(f"/api/v1/pieces/{piece_id}").json()
    assert piece_after["dimensions_text"] == "35cmx20cm"


def test_suggest_cataloging_says_so_when_nothing_actually_changed(seeded_api: SeededApi) -> None:
    """Rule-based (no AI judgment): a proposal that matches the piece as cataloged is explained,
    not shown as something to approve (decisión del equipo, 2026-11-05)."""
    piece_id = _any_piece_id(seeded_api)
    _set_dimensions_and_conservation(
        seeded_api,
        piece_id,
        dimensions=[{"dimension": "alto", "value": 58, "unit": "cm"}],
        conservation_code="BUENO",
    )
    _set_notes(seeded_api, piece_id, "Alto 58 cm. Buen estado.")
    requester = seeded_api.login_as("CATALOGUER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    assert created.status_code == 201, created.text
    output = created.json()["output_data"]
    assert output["fields"] == []
    assert output["message"] == NO_CHANGE_MESSAGE
    assert len(output["unchanged_fields"]) == 2


def test_suggest_cataloging_keeps_only_the_dimension_that_actually_changed(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    _set_dimensions_and_conservation(
        seeded_api,
        piece_id,
        dimensions=[{"dimension": "alto", "value": 58, "unit": "cm"}],
        conservation_code="BUENO",
    )
    _set_notes(seeded_api, piece_id, "Alto 58 cm, ancho 40 cm. Buen estado.")
    requester = seeded_api.login_as("CATALOGUER")

    created = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "notes"}
    )
    output = created.json()["output_data"]
    assert output["message"] is None
    assert [f["value"] for f in output["fields"]] == [{"dimension": "ancho", "value": 40, "unit": "cm"}]
    assert len(output["unchanged_fields"]) == 2  # alto (igual) y el estado de conservación


def test_suggest_cataloging_rejects_a_sensitive_source_field(seeded_api: SeededApi) -> None:
    piece_id = _any_piece_id(seeded_api)
    requester = seeded_api.login_as("CATALOGUER")
    response = requester.post(
        "/api/v1/ai/suggest-cataloging", json={"piece_id": piece_id, "field": "lender_name"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "source_field_not_allowed"
