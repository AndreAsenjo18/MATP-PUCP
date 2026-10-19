"""Spec importacion-datos — Estados del lote con etapas reanudables (RF-021, RNF-007).

Change importacion-pipeline-reconciliacion, task 1.2: background stages with heartbeat,
idempotent repetition and recovery of interrupted batches at startup.
"""

import asyncio
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core import jobs
from app.core.db import make_session_factory
from app.core.errors import ConflictError, ValidationFailed
from app.core.models_base import new_uuid
from app.main import create_app
from app.models import AppUser
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.service import ingest_stage
from app.modules.imports.state import transition
from app.modules.imports.worker import (
    HEARTBEAT_EVERY_ROWS,
    INTERRUPTED_REASON,
    Progress,
    Stage,
    launch_stage,
    recover_import_batches,
    recover_interrupted_batches,
    register_import_jobs,
    run_stage,
    start_stage,
)
from tests.api.conftest import api_settings
from tests.conftest import ActAs

NewBatch = Callable[..., ImportBatch]

FIXTURES = Path(__file__).resolve().parents[3] / "data" / "fixtures"
SABANA = (FIXTURES / "sabana_sintetica_v1.xlsx").read_bytes()
NOW = datetime(2026, 10, 19, 10, 0, tzinfo=UTC)


@pytest.fixture
def context(users: dict[str, AppUser]) -> uuid.UUID:
    """The user who launches the stage."""
    return users["CATALOGUER"].id


@pytest.fixture
def new_batch(session: Session, act_as: ActAs) -> NewBatch:
    def factory(status: S = S.UPLOADED, **marks: object) -> ImportBatch:
        with act_as("CATALOGUER"):
            batch = ImportBatch(
                id=new_uuid(),
                source_name="Sábana sintética",
                file_name="sabana_sintetica_v1.xlsx",
                status=status,
                **marks,
            )
            session.add(batch)
            session.commit()
        return batch

    return factory


def _rows(session: Session, batch_id: uuid.UUID) -> list[int]:
    return list(
        session.scalars(
            select(ImportRow.source_row_number)
            .where(ImportRow.batch_id == batch_id)
            .order_by(ImportRow.source_row_number)
        )
    )


def _run(
    session: Session, engine: Engine, batch: ImportBatch, stage: Stage, work, context
) -> ImportBatch:
    start_stage(session, batch.id, stage)
    session.commit()
    run_stage(session, make_session_factory(engine), batch.id, stage, work, context)
    session.expire_all()
    stored = session.get(ImportBatch, batch.id)
    assert stored is not None
    return stored


# --- Etapa de ingesta e idempotencia --------------------------------------------------------------
def test_ingestion_stage_stores_rows_and_clears_marks(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    batch = _run(session, engine, new_batch(), Stage.INGEST, ingest_stage(SABANA), context)

    assert batch.status == S.UPLOADED
    assert batch.processing_started_at is None and batch.heartbeat_at is None
    assert batch.sheet_name == "SABANA" and batch.header_row == 1
    assert batch.counts is not None
    assert batch.counts["rows"] == 40 and "progress" not in batch.counts
    assert _rows(session, batch.id) == list(range(2, 42))


def test_repeating_a_stage_does_not_duplicate_rows(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    batch = new_batch()
    _run(session, engine, batch, Stage.INGEST, ingest_stage(SABANA), context)
    first = session.scalars(select(ImportRow.raw_data).where(ImportRow.batch_id == batch.id)).all()

    _run(session, engine, batch, Stage.INGEST, ingest_stage(SABANA), context)

    second = session.scalars(select(ImportRow.raw_data).where(ImportRow.batch_id == batch.id)).all()
    assert len(second) == 40
    assert sorted(map(str, first)) == sorted(map(str, second))


# --- Fallos de etapa ------------------------------------------------------------------------------
def test_ingestion_failure_leaves_batch_failed_with_reason(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    batch = _run(
        session, engine, new_batch(), Stage.INGEST, ingest_stage(SABANA, max_rows=10), context
    )

    assert batch.status == S.FAILED_INGESTION
    assert batch.status_reason is not None and "10 filas" in batch.status_reason
    assert batch.processing_started_at is None
    assert _rows(session, batch.id) == []


def test_validation_failure_rolls_back_and_keeps_stable_state(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    def work(work_session: Session, batch: ImportBatch, progress: Progress) -> None:
        work_session.add(
            ImportRow(id=new_uuid(), batch_id=batch.id, source_row_number=2, raw_data={})
        )
        work_session.flush()
        raise ValidationFailed("El mapeo no tiene columna de denominación.")

    batch = _run(session, engine, new_batch(S.MAPPED), Stage.VALIDATE, work, context)

    assert batch.status == S.MAPPED
    assert batch.status_reason == "El mapeo no tiene columna de denominación."
    assert _rows(session, batch.id) == []


def test_unexpected_error_gives_a_generic_reason(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    def work(_session: Session, _batch: ImportBatch, _progress: Progress) -> None:
        raise RuntimeError("fallo interno con detalles técnicos")

    batch = _run(session, engine, new_batch(S.APPROVED), Stage.APPLY, work, context)

    assert batch.status == S.FAILED_APPLY
    assert batch.status_reason is not None
    assert "aplicación" in batch.status_reason and "técnicos" not in batch.status_reason


def test_work_moves_the_batch_to_its_next_state(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    def work(work_session: Session, batch: ImportBatch, progress: Progress) -> None:
        progress.advance(3, total=3, force=True)
        transition(work_session, batch.id, S.VALIDATED)
        transition(work_session, batch.id, S.IN_PREVIEW)

    batch = _run(session, engine, new_batch(S.MAPPED), Stage.VALIDATE, work, context)

    assert batch.status == S.IN_PREVIEW and batch.status_reason is None


# --- Scenario: Consulta del progreso --------------------------------------------------------------
def test_progress_is_recorded_while_the_stage_runs(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    seen: list[dict] = []

    def work(work_session: Session, batch: ImportBatch, progress: Progress) -> None:
        for done in (0, HEARTBEAT_EVERY_ROWS - 1, HEARTBEAT_EVERY_ROWS, 1200):
            progress.advance(done, total=1200)
            counts = work_session.scalar(
                select(ImportBatch.counts).where(ImportBatch.id == batch.id)
            )
            seen.append((counts or {}).get("progress"))

    _run(session, engine, new_batch(S.MAPPED), Stage.VALIDATE, work, context)

    started = {"stage": "VALIDATE", "done": 0, "total": None}
    assert seen == [
        started,
        started,
        {"stage": "VALIDATE", "done": 500, "total": 1200},
        {"stage": "VALIDATE", "done": 1200, "total": 1200},
    ]


# --- Arranque de etapas ---------------------------------------------------------------------------
def test_stage_requires_its_stable_state(session: Session, new_batch: NewBatch) -> None:
    batch = new_batch(S.IN_PREVIEW)

    with pytest.raises(ConflictError) as error:
        start_stage(session, batch.id, Stage.VALIDATE)

    assert error.value.code == "invalid_batch_transition"
    assert error.value.details["required_status"] == "MAPPED"


def test_a_running_stage_cannot_start_twice(session: Session, new_batch: NewBatch) -> None:
    batch = new_batch(S.MAPPED, processing_started_at=NOW, heartbeat_at=NOW)

    with pytest.raises(ConflictError) as error:
        start_stage(session, batch.id, Stage.VALIDATE, now=NOW + timedelta(minutes=1))
    assert error.value.code == "batch_processing"

    session.rollback()
    restarted = start_stage(session, batch.id, Stage.VALIDATE, now=NOW + timedelta(minutes=6))
    assert restarted.processing_started_at is not None


def test_launch_runs_the_stage_after_the_response(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    batch = new_batch()
    tasks = BackgroundTasks()

    launched = launch_stage(
        session,
        tasks,
        make_session_factory(engine),
        batch.id,
        Stage.INGEST,
        ingest_stage(SABANA),
        context,
    )
    assert launched.processing_started_at is not None
    assert _rows(session, batch.id) == []

    asyncio.run(tasks())

    assert len(_rows(session, batch.id)) == 40


# --- Scenario: Interrupción por reinicio ----------------------------------------------------------
def test_interrupted_batches_are_recovered(
    session: Session, engine: Engine, new_batch: NewBatch
) -> None:
    stale = new_batch(S.MAPPED, processing_started_at=NOW, heartbeat_at=NOW)
    alive = new_batch(S.MAPPED, processing_started_at=NOW, heartbeat_at=NOW + timedelta(minutes=9))
    idle = new_batch(S.MAPPED)

    with make_session_factory(engine)() as recovery:
        recovered = recover_interrupted_batches(recovery, NOW + timedelta(minutes=10))
        recovery.commit()

    assert recovered == 1
    session.expire_all()
    stale_now = session.get(ImportBatch, stale.id)
    assert stale_now is not None
    assert stale_now.status == S.MAPPED
    assert stale_now.status_reason == INTERRUPTED_REASON
    assert stale_now.processing_started_at is None and stale_now.heartbeat_at is None
    assert session.get(ImportBatch, alive.id).processing_started_at is not None  # type: ignore[union-attr]
    assert session.get(ImportBatch, idle.id).status_reason is None  # type: ignore[union-attr]


def test_recovery_runs_when_the_api_starts(
    engine: Engine, session: Session, new_batch: NewBatch
) -> None:
    ten_minutes_ago = datetime.now(UTC) - timedelta(minutes=10)
    batch = new_batch(S.MAPPED, processing_started_at=ten_minutes_ago, heartbeat_at=ten_minutes_ago)

    with TestClient(create_app(api_settings(), health_checks={}, engine=engine)):
        pass

    session.expire_all()
    stored = session.get(ImportBatch, batch.id)
    assert stored is not None and stored.status_reason == INTERRUPTED_REASON


def test_import_recovery_is_registered_with_the_shared_jobs(engine: Engine) -> None:
    register_import_jobs()

    assert jobs._recoveries["imports"] is recover_import_batches
    assert jobs.recover_interrupted(make_session_factory(engine))["imports"] == 0


def test_staging_rows_do_not_flood_the_audit_log(
    session: Session, engine: Engine, new_batch: NewBatch, context: uuid.UUID
) -> None:
    from app.modules.audit.models import AuditLog

    batch = new_batch()
    before = session.scalar(select(func.count()).select_from(AuditLog))

    _run(session, engine, batch, Stage.INGEST, ingest_stage(SABANA), context)

    after = session.scalar(select(func.count()).select_from(AuditLog))
    assert after is not None and before is not None
    assert after - before <= 5  # batch fields only, not one entry per staging cell
