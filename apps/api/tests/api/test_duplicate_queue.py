"""Spec calidad-datos — duplicate review queue with filters and postponement expiry (task 3.1).

Change deteccion-duplicados-y-cola-revision, design D5. Reading the queue may reopen postponed
pairs, so this module seeds its own database instead of the shared ``seeded_api`` one.
"""

from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, or_, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import make_session_factory
from app.core.models_base import utcnow
from app.main import create_app
from app.models import AppUser, Base, Collection, DuplicateCandidate, Piece
from app.modules.audit.context import audit_context
from app.modules.quality.models import DuplicateStatus
from app.seed.synthetic import SeedOptions, run_seed
from tests.api.conftest import MANAGER, VIEWER, api_settings, as_user
from tests.conftest import SYSTEM_CONTEXT

QUEUE = "/api/v1/quality/duplicates"


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
    yield session_factory
    engine.dispose()


@pytest.fixture(scope="module")
def client(factory: sessionmaker[Session]) -> Iterator[TestClient]:
    app = create_app(api_settings(), health_checks={}, engine=factory.kw["bind"])
    with TestClient(app) as test_client:
        yield test_client


def _get(client: TestClient, **params: object) -> dict:
    response = client.get(QUEUE, params={"page_size": 100, **params}, headers=as_user(VIEWER))
    assert response.status_code == 200, response.text
    return response.json()


def _all(session: Session) -> list[DuplicateCandidate]:
    return list(session.scalars(select(DuplicateCandidate)).all())


def test_queue_lists_candidates_best_score_first_with_explained_signals(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    body = _get(client)
    with factory() as session:
        assert body["total"] == len(_all(session))
    scores = [item["score"] for item in body["items"]]
    assert scores == sorted(scores, reverse=True)
    first = body["items"][0]
    assert isinstance(first["matched_fields"], list)
    assert {"field", "similarity"} <= set(first["matched_fields"][0])
    assert {"blocking_conflict", "postponed_until"} <= set(first)


def test_filter_by_status_and_minimum_score(client: TestClient) -> None:
    pending = _get(client, status="PENDING")
    assert pending["total"] > 0
    assert {item["status"] for item in pending["items"]} == {"PENDING"}
    scores = sorted({item["score"] for item in _get(client)["items"]})
    threshold = scores[len(scores) // 2]  # a value inside the seeded range
    strong = _get(client, min_score=threshold)
    assert all(item["score"] >= threshold for item in strong["items"])
    assert 0 < strong["total"] < _get(client)["total"]


def test_filter_by_origin(client: TestClient, factory: sessionmaker[Session]) -> None:
    catalog = _get(client, origin="CATALOG")
    imported = _get(client, origin="IMPORT")
    assert all(item["piece_b_id"] and not item["import_row_id"] for item in catalog["items"])
    assert all(item["import_row_id"] and not item["piece_b_id"] for item in imported["items"])
    with factory() as session:
        assert catalog["total"] + imported["total"] == len(_all(session))
    response = client.get(QUEUE, params={"origin": "EXCEL"}, headers=as_user(VIEWER))
    assert response.status_code == 422


def test_filter_by_collection_includes_its_subcollections(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    with factory() as session:
        parent = session.scalars(
            select(Collection).where(
                Collection.id.in_(
                    select(Collection.parent_id).where(Collection.parent_id.is_not(None))
                )
            )
        ).first()
        assert parent is not None
        family = {parent.id} | set(
            session.scalars(select(Collection.id).where(Collection.parent_id == parent.id))
        )
        in_family = select(Piece.id).where(Piece.collection_id.in_(family))
        expected = {
            str(c.id)
            for c in session.scalars(
                select(DuplicateCandidate).where(
                    or_(
                        DuplicateCandidate.piece_a_id.in_(in_family),
                        DuplicateCandidate.piece_b_id.in_(in_family),
                    )
                )
            )
        }
    body = _get(client, collection_id=str(parent.id))
    assert {item["id"] for item in body["items"]} == expected


def test_an_expired_postponement_reopens_on_read(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """Design D5: a postponed pair is pending again after its date, without a cron job."""
    with factory() as session, audit_context(session, SYSTEM_CONTEXT):
        reviewer = session.scalar(select(AppUser).where(AppUser.email == MANAGER))
        expired, future = _all(session)[:2]
        for candidate, until in ((expired, -1), (future, 30)):
            candidate.status = DuplicateStatus.POSTPONED
            candidate.postponed_until = utcnow() + timedelta(days=until)
            candidate.reviewed_by_id = reviewer.id
            candidate.reviewed_at = utcnow()
        session.commit()
        expired_id, future_id = expired.id, future.id

    statuses = {item["id"]: item["status"] for item in _get(client)["items"]}
    assert statuses[str(expired_id)] == "PENDING"
    assert statuses[str(future_id)] == "POSTPONED"
    with factory() as session:
        assert session.get(DuplicateCandidate, expired_id).postponed_until is None


def test_queue_requires_an_identity(client: TestClient) -> None:
    assert client.get(QUEUE).status_code == 401
