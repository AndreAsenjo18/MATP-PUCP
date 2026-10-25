"""Spec colecciones-vocabularios — Historial de evaluaciones de conservación por API (RF-012).

Change colecciones-y-vocabularios-admin, task 3.1 (design D3): every assessment is kept
(append-only) and the current state of the piece is the one of the most recent assessment by
date. Runs on the module-scoped seeded database of ``pipeline``; each test creates its piece.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Piece, Term, Vocabulary
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline


def _term(pipeline: Pipeline, code: str) -> str:
    with pipeline.session() as session:
        term_id = session.scalar(
            select(Term.id)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(Vocabulary.code == "CONSERVATION_STATUS", Term.code == code)
        )
    assert term_id is not None
    return str(term_id)


def _piece(pipeline: Pipeline) -> str:
    with pipeline.session() as session:
        admin_id = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)):
            piece = create_piece(
                session,
                denomination=f"Pieza evaluada {uuid.uuid4().hex[:6]} (sintética)",
                tenure_regime=TenureRegime.OWNED,
            )
        session.commit()
        return str(piece.id)


def _url(piece_id: str) -> str:
    return f"/api/v1/pieces/{piece_id}/conservation-assessments"


def _state(pipeline: Pipeline, piece_id: str) -> str | None:
    with pipeline.session() as session:
        piece = session.get(Piece, uuid.UUID(piece_id))
        assert piece is not None
        return str(piece.conservation_state_id) if piece.conservation_state_id else None


def test_a_new_assessment_becomes_the_current_state(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline)
    client = pipeline.login("CONSERVATION")
    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    first = client.post(
        _url(piece_id), json={"status_term_id": _term(pipeline, "BUENO"), "assessed_at": yesterday}
    )
    assert first.status_code == 201, first.text

    response = client.post(
        _url(piece_id),
        json={"status_term_id": _term(pipeline, "REGULAR"), "notes": "Grietas leves."},
    )

    assert response.status_code == 201, response.text
    history = response.json()
    assert [item["status"]["code"] for item in history] == ["REGULAR", "BUENO"]
    assert [item["is_current"] for item in history] == [True, False]
    assert history[0]["notes"] == "Grietas leves." and history[0]["assessed_by_user_id"]
    assert _state(pipeline, piece_id) == _term(pipeline, "REGULAR")
    listed = pipeline.client.get(_url(piece_id)).json()
    assert [item["id"] for item in listed] == [item["id"] for item in history]


def test_an_old_assessment_joins_the_history_without_changing_the_state(
    pipeline: Pipeline,
) -> None:
    piece_id = _piece(pipeline)
    client = pipeline.login("CONSERVATION")
    assert (
        client.post(_url(piece_id), json={"status_term_id": _term(pipeline, "BUENO")}).status_code
        == 201
    )
    two_years_ago = (datetime.now(UTC) - timedelta(days=730)).isoformat()

    response = client.post(
        _url(piece_id),
        json={"status_term_id": _term(pipeline, "MALO"), "assessed_at": two_years_ago},
    )

    assert response.status_code == 201, response.text
    assert [item["status"]["code"] for item in response.json()] == ["BUENO", "MALO"]
    assert _state(pipeline, piece_id) == _term(pipeline, "BUENO")


def test_an_inactive_term_is_422_with_the_active_terms(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline)
    admin = pipeline.login("ADMIN")
    created = admin.post(
        "/api/v1/vocabularies/CONSERVATION_STATUS/terms",
        json={
            "code": f"RETIRADO_{uuid.uuid4().hex[:4].upper()}",
            "label": f"Retirado {uuid.uuid4().hex[:4]}",
        },
    )
    assert created.status_code == 201, created.text
    term_id = created.json()["id"]
    deactivated = admin.patch(
        f"/api/v1/vocabularies/CONSERVATION_STATUS/terms/{term_id}", json={"is_active": False}
    )
    assert deactivated.status_code == 200, deactivated.text

    response = pipeline.login("CONSERVATION").post(_url(piece_id), json={"status_term_id": term_id})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid_conservation_term"
    assert {"Bueno", "Regular", "Malo"} <= {term["label"] for term in body["details"]["available"]}
    assert term_id not in {term["id"] for term in body["details"]["available"]}
    assert pipeline.client.get(_url(piece_id)).json() == []


def test_a_term_of_another_vocabulary_is_rejected(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline)
    with pipeline.session() as session:
        material = session.scalar(
            select(Term.id)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(Vocabulary.code == "MATERIAL")
            .limit(1)
        )

    response = pipeline.login("CONSERVATION").post(
        _url(piece_id), json={"status_term_id": str(material)}
    )

    assert response.status_code == 422 and response.json()["code"] == "invalid_conservation_term"


def test_only_conservation_staff_records_assessments(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline)

    response = pipeline.login("CATALOGUER").post(
        _url(piece_id), json={"status_term_id": _term(pipeline, "BUENO")}
    )

    assert response.status_code == 403
