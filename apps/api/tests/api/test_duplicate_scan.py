"""Spec calidad-datos — full duplicate scan in the background and its progress (task 2.3).

Change deteccion-duplicados-y-cola-revision, design D1 to D3. The scan writes candidates and
jobs, so this module seeds its own database instead of the shared ``seeded_api`` one.
"""

from collections.abc import Iterator
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import make_session_factory
from app.core.models_base import new_uuid, utcnow
from app.main import create_app
from app.models import AppUser, Base, DuplicateCandidate
from app.modules.audit.context import audit_context
from app.modules.quality.models import (
    DuplicateStatus,
    QualityJob,
    QualityJobStatus,
    QualityJobType,
)
from app.modules.quality.scan import recover_interrupted_scans
from app.seed.synthetic import SeedOptions, run_seed
from tests.api.conftest import MANAGER, VIEWER, api_settings, as_user
from tests.conftest import SYSTEM_CONTEXT

SCAN = "/api/v1/quality/duplicates/scan"


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
    engine = factory.kw["bind"]
    app = create_app(api_settings(), health_checks={}, engine=engine)
    with TestClient(app) as test_client:
        yield test_client


def _candidates(session: Session) -> list[DuplicateCandidate]:
    return list(session.scalars(select(DuplicateCandidate)).all())


def _add_job(session: Session, *, heartbeat_age: timedelta) -> QualityJob:
    beat = utcnow() - heartbeat_age
    job = QualityJob(
        id=new_uuid(),
        job_type=QualityJobType.FULL_SCAN,
        status=QualityJobStatus.RUNNING,
        started_at=beat,
        heartbeat_at=beat,
        total_pieces=298,
        processed_pieces=100,
        pairs_evaluated=0,
        candidates_created=0,
        candidates_reopened=0,
    )
    session.add(job)
    session.commit()
    return job


def test_scan_runs_in_the_background_and_records_its_result(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    response = client.post(SCAN, headers=as_user(MANAGER))
    assert response.status_code == 202
    accepted = response.json()
    assert accepted["status"] == "RUNNING"
    assert accepted["job_type"] == "FULL_SCAN"

    # The TestClient runs background tasks before returning: the job has already finished.
    job = client.get(f"/api/v1/quality/jobs/{accepted['id']}", headers=as_user(VIEWER)).json()
    assert job["status"] == "SUCCEEDED"
    assert job["total_pieces"] == job["processed_pieces"] == 298
    assert 0 < job["pairs_evaluated"] < 298 * 297 // 2  # «sin comparar todos los pares»
    assert job["duration_ms"] is not None
    assert job["error_message"] is None
    with factory() as session:
        candidates = _candidates(session)
        manager = session.scalar(select(AppUser).where(AppUser.email == MANAGER))
    assert job["requested_by_id"] == str(manager.id)
    # The 10 seeded pairs are refreshed with explained signals and a fingerprint.
    assert len(candidates) >= 10
    assert all(c.compared_fingerprint and len(c.compared_fingerprint) == 64 for c in candidates)
    assert all(isinstance(c.matched_fields[0], dict) for c in candidates)
    assert job["candidates_created"] == len(candidates) - 10


def test_a_second_scan_does_not_duplicate_candidates(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    with factory() as session:
        before = session.scalar(select(func.count()).select_from(DuplicateCandidate))
    job_id = client.post(SCAN, headers=as_user(MANAGER)).json()["id"]
    job = client.get(f"/api/v1/quality/jobs/{job_id}", headers=as_user(MANAGER)).json()
    assert job["status"] == "SUCCEEDED"
    assert job["candidates_created"] == 0
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(DuplicateCandidate)) == before


def test_distinct_pairs_return_only_when_their_fingerprint_changes(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    with factory() as session, audit_context(session, SYSTEM_CONTEXT):
        reviewer = session.scalar(select(AppUser).where(AppUser.email == MANAGER))
        same, changed = _candidates(session)[:2]
        for candidate in (same, changed):
            candidate.status = DuplicateStatus.DISTINCT
            candidate.reviewed_by_id = reviewer.id
            candidate.reviewed_at = utcnow()
        changed.compared_fingerprint = "0" * 64  # as if the compared data had changed since
        session.commit()
        same_id, changed_id = same.id, changed.id

    job_id = client.post(SCAN, headers=as_user(MANAGER)).json()["id"]
    job = client.get(f"/api/v1/quality/jobs/{job_id}", headers=as_user(MANAGER)).json()
    assert job["candidates_reopened"] == 1
    with factory() as session:
        assert session.get(DuplicateCandidate, same_id).status == DuplicateStatus.DISTINCT
        reopened = session.get(DuplicateCandidate, changed_id)
        assert reopened.status == DuplicateStatus.PENDING
        assert reopened.reviewed_by_id is None


def test_scan_in_progress_answers_409_with_its_progress(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    """Spec: «Detección completa en curso»."""
    with factory() as session:
        running = _add_job(session, heartbeat_age=timedelta(seconds=10))
    try:
        response = client.post(SCAN, headers=as_user(MANAGER))
        assert response.status_code == 409
        body = response.json()
        assert body["code"] == "scan_in_progress"
        assert body["details"]["job"]["id"] == str(running.id)
        assert body["details"]["job"]["processed_pieces"] == 100
        assert body["details"]["job"]["total_pieces"] == 298
    finally:
        with factory() as session:
            session.get(QualityJob, running.id).status = QualityJobStatus.FAILED
            session.commit()


def test_a_scan_without_heartbeat_does_not_block_a_new_one(
    client: TestClient, factory: sessionmaker[Session]
) -> None:
    with factory() as session:
        stale = _add_job(session, heartbeat_age=timedelta(minutes=10))
    response = client.post(SCAN, headers=as_user(MANAGER))
    assert response.status_code == 202
    with factory() as session:
        old = session.get(QualityJob, stale.id)
        assert old.status == QualityJobStatus.FAILED
        assert "interrumpida" in old.error_message


def test_startup_recovery_marks_interrupted_scans_as_failed(
    factory: sessionmaker[Session],
) -> None:
    with factory() as session:
        stale = _add_job(session, heartbeat_age=timedelta(minutes=10))
        fresh = _add_job(session, heartbeat_age=timedelta(seconds=5))
    try:
        assert recover_interrupted_scans(factory) == 1
        with factory() as session:
            assert session.get(QualityJob, stale.id).status == QualityJobStatus.FAILED
            assert session.get(QualityJob, fresh.id).status == QualityJobStatus.RUNNING
    finally:
        with factory() as session:
            session.get(QualityJob, fresh.id).status = QualityJobStatus.FAILED
            session.commit()


def test_only_authorized_roles_can_launch_a_scan(client: TestClient) -> None:
    response = client.post(SCAN, headers=as_user(VIEWER))
    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"


def test_unknown_job_is_404(client: TestClient) -> None:
    response = client.get(f"/api/v1/quality/jobs/{new_uuid()}", headers=as_user(VIEWER))
    assert response.status_code == 404


def test_scores_are_stored_with_four_decimals(factory: sessionmaker[Session]) -> None:
    with factory() as session:
        for candidate in _candidates(session):
            assert Decimal(0) <= candidate.score <= Decimal(1)
            assert candidate.score == round(candidate.score, 4)
