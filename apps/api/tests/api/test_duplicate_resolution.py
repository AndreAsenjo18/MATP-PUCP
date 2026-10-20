"""Spec calidad-datos — resolving a candidate as DISTINCT or POSTPONED (task 3.2, design D2/D5).

Resolutions change candidates and pieces, so this module seeds its own database.
"""

import uuid
from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import make_session_factory
from app.core.models_base import utcnow
from app.main import create_app
from app.models import AppUser, Base, DuplicateCandidate, Piece, PieceIdentifier
from app.modules.audit.context import audit_context
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.identification.service import add_identifier
from app.modules.quality.duplicates import load_profiles
from app.modules.quality.incremental import process_pending_items
from app.modules.quality.models import DuplicateStatus
from app.modules.quality.scoring import comparison_fingerprint
from app.seed.synthetic import SeedOptions, run_seed
from tests.api.conftest import MANAGER, VIEWER, api_settings, as_user
from tests.conftest import SYSTEM_CONTEXT


@pytest.fixture(scope="module")
def factory() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    session_factory = make_session_factory(engine)
    with session_factory() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    process_pending_items(session_factory, limit=10_000)  # the seed queued every piece
    yield session_factory
    engine.dispose()


@pytest.fixture(scope="module")
def client(factory: sessionmaker[Session]) -> Iterator[TestClient]:
    app = create_app(api_settings(), health_checks={}, engine=factory.kw["bind"])
    with TestClient(app) as test_client:
        yield test_client


def _resolve(client: TestClient, candidate_id: uuid.UUID, user: str = MANAGER, **body: object):  # type: ignore[no-untyped-def]
    return client.post(
        f"/api/v1/quality/duplicates/{candidate_id}/resolve", json=body, headers=as_user(user)
    )


def _catalog_pairs(session: Session) -> list[DuplicateCandidate]:
    return list(
        session.scalars(
            select(DuplicateCandidate)
            .where(
                DuplicateCandidate.piece_b_id.is_not(None),
                DuplicateCandidate.status == DuplicateStatus.PENDING,
            )
            .order_by(DuplicateCandidate.score.desc())
        ).all()
    )


def _scan(client: TestClient) -> dict:
    job_id = client.post("/api/v1/quality/duplicates/scan", headers=as_user(MANAGER)).json()["id"]
    return client.get(f"/api/v1/quality/jobs/{job_id}", headers=as_user(MANAGER)).json()


def test_distinct_pair_keeps_the_current_fingerprint_and_does_not_return(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """Spec: «Par distinto sin cambios»."""
    with factory() as session:
        candidate = _catalog_pairs(session)[0]
    response = _resolve(client, candidate.id, resolution="DISTINCT", note="Piezas distintas")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "DISTINCT"
    assert body["resolution_note"] == "Piezas distintas"
    assert body["reviewed_at"] is not None

    with factory() as session:
        stored = session.get(DuplicateCandidate, candidate.id)
        profiles = {p.piece_id: p for p in load_profiles(session)}
        expected = comparison_fingerprint(profiles[stored.piece_a_id], profiles[stored.piece_b_id])
        assert stored.compared_fingerprint == expected
        manager = session.scalar(select(AppUser).where(AppUser.email == MANAGER))
        assert stored.reviewed_by_id == manager.id

    assert _scan(client)["status"] == "SUCCEEDED"
    with factory() as session:
        assert session.get(DuplicateCandidate, candidate.id).status == DuplicateStatus.DISTINCT


def test_distinct_pair_returns_when_a_compared_value_changes(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """Spec: «Par distinto con datos modificados» — a new shared code reopens the pair."""
    with factory() as session:
        candidate = _catalog_pairs(session)[0]
    assert _resolve(client, candidate.id, resolution="DISTINCT").status_code == 200

    with factory() as session, audit_context(session, SYSTEM_CONTEXT):
        piece_b = session.get(Piece, candidate.piece_b_id)
        add_identifier(session, piece_b, TYPE_COLLECTION, "ZZZ 9999", source="Ficha nueva")
        piece_a = session.get(Piece, candidate.piece_a_id)
        add_identifier(session, piece_a, TYPE_COLLECTION, "Z.Z.Z. 9999", source="Libro")
        session.commit()
    process_pending_items(factory)

    with factory() as session:
        reopened = session.get(DuplicateCandidate, candidate.id)
        assert reopened.status == DuplicateStatus.PENDING
        assert reopened.reviewed_by_id is None
        identifiers = [s for s in reopened.matched_fields if s["signal"] == "identifier"]
        assert identifiers and identifiers[0]["field"] == f"identifier:{TYPE_COLLECTION}"
        assert session.scalars(
            select(PieceIdentifier).where(PieceIdentifier.normalized_value == "ZZZ 9999")
        ).all()


def test_postpone_until_a_date(client: TestClient, factory: sessionmaker[Session]) -> None:
    with factory() as session:
        candidate = _catalog_pairs(session)[0]
    until = (utcnow() + timedelta(days=30)).isoformat()
    response = _resolve(client, candidate.id, resolution="POSTPONED", postponed_until=until)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "POSTPONED"
    assert response.json()["postponed_until"] is not None


@pytest.mark.parametrize(
    ("days", "code"),
    [
        (181, "postpone_too_long"),
        (-1, "postponed_until_in_past"),
        (None, "postponed_until_required"),
    ],
)
def test_invalid_postponement_is_rejected(
    client: TestClient, factory: sessionmaker[Session], days: int | None, code: str
) -> None:
    """Spec: «Posponer con fecha excesiva» — more than 180 days is a 422 with the maximum."""
    with factory() as session:
        candidate = _catalog_pairs(session)[0]
    body: dict[str, object] = {"resolution": "POSTPONED"}
    if days is not None:
        body["postponed_until"] = (utcnow() + timedelta(days=days)).isoformat()
    response = _resolve(client, candidate.id, **body)
    assert response.status_code == 422
    assert response.json()["code"] == code
    if code == "postpone_too_long":
        assert response.json()["details"]["max_days"] == 180
    with factory() as session:
        assert session.get(DuplicateCandidate, candidate.id).status == DuplicateStatus.PENDING


def test_internal_viewer_cannot_resolve(client: TestClient, factory: sessionmaker[Session]) -> None:
    """Spec task 3.2: Consulta interna gets 403."""
    with factory() as session:
        candidate = _catalog_pairs(session)[0]
    response = _resolve(client, candidate.id, user=VIEWER, resolution="DISTINCT")
    assert response.status_code == 403


def test_a_pair_with_a_merged_piece_is_superseded(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """Spec: «Candidato obsoleto» — 409, the pair is superseded and no piece changes."""
    with factory() as session, audit_context(session, SYSTEM_CONTEXT):
        candidate = _catalog_pairs(session)[-1]
        piece_b = session.get(Piece, candidate.piece_b_id)
        other = session.scalars(
            select(Piece).where(Piece.id.not_in([candidate.piece_a_id, candidate.piece_b_id]))
        ).first()
        piece_b.merged_into_id = other.id  # as if B had been merged into another piece
        session.commit()
    response = _resolve(client, candidate.id, resolution="DISTINCT")
    assert response.status_code == 409
    assert response.json()["code"] == "stale_candidate"
    with factory() as session:
        assert session.get(DuplicateCandidate, candidate.id).status == DuplicateStatus.SUPERSEDED
    again = _resolve(client, candidate.id, resolution="DISTINCT")
    assert again.status_code == 409
    assert again.json()["code"] == "candidate_closed"


def test_unknown_candidate_is_404(client: TestClient) -> None:
    assert _resolve(client, uuid.uuid4(), resolution="DISTINCT").status_code == 404


def test_merge_over_http(client: TestClient, factory: sessionmaker[Session]) -> None:
    """MERGED through the API: the pair is merged and the absorbed piece points to the other."""
    with factory() as session:
        codes = {
            row.piece_id
            for row in session.scalars(
                select(PieceIdentifier).where(
                    PieceIdentifier.identifier_type_code == "I", PieceIdentifier.is_current
                )
            )
        }
        candidate = next(  # a pair where at most one piece holds a code I
            c for c in _catalog_pairs(session) if not {c.piece_a_id, c.piece_b_id} <= codes
        )
    surviving = candidate.piece_b_id if candidate.piece_b_id in codes else candidate.piece_a_id
    absorbed = candidate.piece_a_id if surviving == candidate.piece_b_id else candidate.piece_b_id
    response = _resolve(
        client,
        candidate.id,
        resolution="MERGED",
        surviving_piece_id=str(surviving),
        field_choices={"provenance": "ABSORBED"},
        note="Misma pieza en el libro y en la sábana",
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MERGED"
    with factory() as session:
        gone = session.get(Piece, absorbed, execution_options={"include_deleted": True})
        assert gone.merged_into_id == surviving
        assert session.get(DuplicateCandidate, candidate.id).change_set_id is not None
