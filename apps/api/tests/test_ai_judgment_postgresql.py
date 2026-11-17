"""Juicio de duplicados con IA on a real PostgreSQL (change ia-juicio-duplicados, task 2.6).

Migration 0025: `duplicate_ai_verdict` is append-only through its trigger, `quality_job` accepts
the new job type and its counters, and the queries of the groups, the sample and the approval of
a group (audited with origin AI) behave the same as on SQLite. Synthetic data only (RNF-014).
"""

import io
from collections.abc import Iterator
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.core.errors import ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.quality import ai_judgment
from app.modules.quality.models import (
    DuplicateAiVerdict,
    DuplicateAiVerdictSource,
    DuplicateAiVerdictValue,
    DuplicateCandidate,
    DuplicateStatus,
    QualityJob,
    QualityJobStatus,
    QualityJobType,
)
from app.modules.users.models import AppUser

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def factory(postgres_url: str) -> Iterator[sessionmaker[Session]]:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.set_section_option("alembic", "sqlalchemy.url", postgres_url)
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("DATABASE_URL", postgres_url)  # read by alembic/env.py
        command.upgrade(config, "head")
    engine = create_engine(postgres_url, poolclass=NullPool)
    yield make_session_factory(engine)
    engine.dispose()


def _system() -> AuditContext:
    return AuditContext(origin=AuditOrigin.SYSTEM, actor_label="prueba sintética de IA")


def _world(factory: sessionmaker[Session]) -> dict[str, object]:
    """Two pending pairs, an AI run and its verdicts (one «distinct», one «same»)."""
    with factory() as session, audit_context(session, _system()):
        # The random tail: the head of a UUID v7 is its timestamp, the same within an instant.
        tag = new_uuid().hex[-12:]
        pieces = [
            create_piece(
                session, denomination=f"Pieza sintética {tag} {n}", tenure_regime=TenureRegime.OWNED
            )
            for n in range(4)
        ]
        session.flush()
        distinct = DuplicateCandidate(
            id=new_uuid(),
            piece_a_id=pieces[0].id,
            piece_b_id=pieces[1].id,
            score=Decimal("0.8"),
            matched_fields=[],
        )
        same = DuplicateCandidate(
            id=new_uuid(),
            piece_a_id=pieces[2].id,
            piece_b_id=pieces[3].id,
            score=Decimal("0.95"),
            matched_fields=[],
        )
        run = QualityJob(
            id=new_uuid(),
            job_type=QualityJobType.AI_DUPLICATE_JUDGMENT,
            status=QualityJobStatus.SUCCEEDED,
            started_at=utcnow(),
            finished_at=utcnow(),
            total_pieces=0,
            processed_pieces=0,
            pairs_evaluated=0,
            candidates_created=0,
            candidates_reopened=0,
            total_pairs=2,
            processed_pairs=2,
            failed_batches=0,
        )
        reviewer = AppUser(
            id=new_uuid(),
            email=f"revisora-{tag}@matp.local",
            full_name="Revisora sintética",
            is_synthetic=True,
        )
        session.add_all([distinct, same, run, reviewer])
        session.flush()
        for candidate, verdict in (
            (distinct, DuplicateAiVerdictValue.DISTINCT),
            (same, DuplicateAiVerdictValue.SAME),
        ):
            session.add(
                DuplicateAiVerdict(
                    id=new_uuid(),
                    run_id=run.id,
                    candidate_id=candidate.id,
                    verdict=verdict,
                    confidence=Decimal("0.9"),
                    reason="Motivo sintético.",
                    source=DuplicateAiVerdictSource.AI,
                    provider="mock",
                    model="mock-deterministic-v1",
                    prompt_version="juicio-duplicados-v1",
                    created_at=utcnow(),
                )
            )
        session.commit()
        return {"run": run.id, "distinct": distinct.id, "same": same.id, "reviewer": reviewer.id}


def test_verdicts_are_append_only_on_postgresql(factory: sessionmaker[Session]) -> None:
    world = _world(factory)
    with factory() as session:
        for statement in (
            "UPDATE duplicate_ai_verdict SET reason = 'reescrito' WHERE run_id = :run",
            "DELETE FROM duplicate_ai_verdict WHERE run_id = :run",
        ):
            with pytest.raises(DBAPIError):
                session.execute(text(statement), {"run": world["run"]})
            session.rollback()


def test_groups_sample_and_approval_on_postgresql(factory: sessionmaker[Session]) -> None:
    world = _world(factory)
    config = ai_judgment.JudgmentConfig()
    with factory() as session:
        groups = ai_judgment.group_members(session, world["run"], config)  # type: ignore[arg-type]
        assert [m.candidate.id for m in groups["distinct"]] == [world["distinct"]]
        assert [m.candidate.id for m in groups["same"]] == [world["same"]]
        assert ai_judgment.sample_ids(session, world["run"], config) == [world["same"]]  # type: ignore[arg-type]

        run = session.get(QualityJob, world["run"])
        assert run is not None
        with pytest.raises(ValidationFailed) as missing:
            ai_judgment.approve_group(
                session,
                run,
                "same",
                user_id=world["reviewer"],  # type: ignore[arg-type]
                excluded_ids=[],
                confirmed_sample_ids=[],
                can_decide_rows=False,
            )
        assert missing.value.code == "sample_not_confirmed"

        result = ai_judgment.approve_group(
            session,
            run,
            "distinct",
            user_id=world["reviewer"],  # type: ignore[arg-type]
            excluded_ids=[],
            confirmed_sample_ids=[],
            can_decide_rows=False,
        )
        session.commit()
        assert result.resolved == 1

    with factory() as session:
        candidate = session.get(DuplicateCandidate, world["distinct"])
        assert candidate is not None and candidate.status == DuplicateStatus.DISTINCT
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == world["distinct"], AuditLog.field == "status"
            )
        ).all()
        assert entries
        assert all(e.origin == AuditOrigin.AI for e in entries)
        assert all(e.origin_ref == str(world["run"]) for e in entries)
        assert all(e.user_id == world["reviewer"] for e in entries)
