"""Background stages of an import batch (spec importacion-datos: RF-021, RNF-007; design D1).

A heavy stage (ingestion, validation, application) runs in ``BackgroundTasks`` through
``app.core.jobs``:

1. ``start_stage`` (inside the request) checks the batch is in the state the stage starts from
   and that no stage is already running, and marks ``processing_started_at``/``heartbeat_at``.
2. ``run_stage`` (in the background) runs the stage work with a fresh session. The work moves
   the batch to its next state itself; on success the marks are cleared. On failure everything
   the work wrote is rolled back and the batch goes to the failure state of the stage
   (``FAILED_INGESTION``, ``FAILED_APPLY``) or keeps its stable state (validation) with the
   reason in ``status_reason``.
3. ``recover_interrupted_batches`` (at startup) clears the marks of batches whose heartbeat is
   older than ``STALE_AFTER``: the batch is still in its stable state, so it can run the stage
   again. Stages are idempotent, so running one twice never duplicates rows.

Processing marks and progress are technical columns written with Core ``UPDATE`` statements,
outside the audit log: a heartbeat every few hundred rows is not a change of business data.
"""

import enum
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import select, update
from sqlalchemy.orm import Session, sessionmaker

from app.core import jobs
from app.core.errors import ConflictError, DomainError
from app.core.models_base import utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import STATUS_LABELS, lock_batch, transition

logger = logging.getLogger("matp.imports")


class Stage(enum.StrEnum):
    INGEST = "INGEST"
    VALIDATE = "VALIDATE"
    APPLY = "APPLY"


# State a batch is in while a stage runs: the stable state the stage starts from.
STAGE_STATUS: dict[Stage, S] = {
    Stage.INGEST: S.UPLOADED,
    Stage.VALIDATE: S.MAPPED,
    Stage.APPLY: S.APPROVED,
}
FAILURE_STATUS: dict[Stage, S | None] = {
    Stage.INGEST: S.FAILED_INGESTION,
    Stage.VALIDATE: None,
    Stage.APPLY: S.FAILED_APPLY,
}
STAGE_LABELS: dict[Stage, str] = {
    Stage.INGEST: "lectura del archivo",
    Stage.VALIDATE: "validación",
    Stage.APPLY: "aplicación",
}
INTERRUPTED_REASON = "Procesamiento interrumpido por un reinicio del servicio; vuelva a intentarlo."
UNEXPECTED_REASON = "Error inesperado durante la {stage}; vuelva a intentarlo o avise al equipo."
SYSTEM_CONTEXT = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="recuperación de lotes")


@dataclass
class Progress:
    """Heartbeat and progress of a running stage, visible to ``GET /imports/{batch_id}``."""

    beat: Callable[[dict[str, Any]], None]
    stage: Stage
    total: int | None = None
    done: int = 0
    _last_beat: int = field(default=0, repr=False)

    def advance(self, done: int, *, total: int | None = None, force: bool = False) -> None:
        self.done = done
        if total is not None:
            self.total = total
        if force or done - self._last_beat >= jobs.HEARTBEAT_EVERY:
            self._last_beat = done
            self.beat(self.as_json())

    def as_json(self) -> dict[str, Any]:
        return {"stage": self.stage.value, "done": self.done, "total": self.total}


StageWork = Callable[[Session, ImportBatch, Progress], None]


def _mark(session: Session, batch_id: uuid.UUID, **values: Any) -> None:
    session.execute(update(ImportBatch).where(ImportBatch.id == batch_id).values(**values))


def _progress_values(session: Session, batch_id: uuid.UUID, progress: dict[str, Any] | None):  # type: ignore[no-untyped-def]
    counts = session.scalar(select(ImportBatch.counts).where(ImportBatch.id == batch_id)) or {}
    counts = {key: value for key, value in counts.items() if key != "progress"}
    if progress is not None:
        counts["progress"] = progress
    return counts


def _beat_for(
    session: Session, session_factory: sessionmaker[Session], batch_id: uuid.UUID
) -> Callable[[dict[str, Any]], None]:
    """Heartbeats go through their own short transaction so other requests see them.

    SQLite (test suite only) allows a single writer, so there the heartbeat is written in the
    stage's own transaction.
    """

    def write(target: Session, progress: dict[str, Any]) -> None:
        _mark(
            target,
            batch_id,
            heartbeat_at=utcnow(),
            counts=_progress_values(target, batch_id, progress),
        )

    if session.get_bind().dialect.name == "sqlite":
        return lambda progress: write(session, progress)

    def beat(progress: dict[str, Any]) -> None:
        with session_factory() as separate:
            write(separate, progress)
            separate.commit()

    return beat


def import_context(batch_id: uuid.UUID, user_id: uuid.UUID) -> AuditContext:
    """Changes made by a stage are attributed to the user who launched it and to the batch."""
    return AuditContext(origin=AuditOrigin.IMPORT, user_id=user_id, origin_ref=str(batch_id))


def start_stage(
    session: Session, batch_id: uuid.UUID, stage: Stage, now: datetime | None = None
) -> ImportBatch:
    """Check and mark the start of a stage; the caller commits before scheduling it."""
    batch = lock_batch(session, batch_id)
    expected = STAGE_STATUS[stage]
    if batch.status != expected:
        raise ConflictError(
            f"La {STAGE_LABELS[stage]} solo puede ejecutarse con el lote en estado "
            f"«{STATUS_LABELS[expected]}»; está en «{STATUS_LABELS[batch.status]}».",
            code="invalid_batch_transition",
            details={"current_status": batch.status.value, "required_status": expected.value},
        )
    if batch.processing_started_at is not None and not jobs.is_stale(batch.heartbeat_at, now):
        raise ConflictError(
            "El lote ya se está procesando; espere a que termine.",
            code="batch_processing",
            details={"progress": (batch.counts or {}).get("progress")},
        )
    moment = now or utcnow()
    _mark(
        session,
        batch_id,
        processing_started_at=moment,
        heartbeat_at=moment,
        counts=_progress_values(
            session, batch_id, {"stage": stage.value, "done": 0, "total": None}
        ),
    )
    session.refresh(batch)
    return batch


def run_stage(
    session: Session,
    session_factory: sessionmaker[Session],
    batch_id: uuid.UUID,
    stage: Stage,
    work: StageWork,
    user_id: uuid.UUID,
) -> None:
    """Run a started stage; never raises (the outcome is recorded on the batch)."""
    context = import_context(batch_id, user_id)
    progress = Progress(_beat_for(session, session_factory, batch_id), stage)
    try:
        with audit_context(session, context):
            batch = session.get(ImportBatch, batch_id)
            if batch is None:
                return
            work(session, batch, progress)
            _mark(
                session,
                batch_id,
                processing_started_at=None,
                heartbeat_at=None,
                counts=_progress_values(session, batch_id, None),
            )
            session.commit()
    except Exception as exc:
        session.rollback()
        if isinstance(exc, DomainError):
            reason = exc.message
        else:
            logger.exception("Falló la etapa %s del lote %s", stage, batch_id)
            reason = UNEXPECTED_REASON.format(stage=STAGE_LABELS[stage])
        _record_failure(session, batch_id, stage, reason, context)


def _record_failure(
    session: Session, batch_id: uuid.UUID, stage: Stage, reason: str, context: AuditContext
) -> None:
    with audit_context(session, context):
        failure = FAILURE_STATUS[stage]
        if failure is not None:
            transition(session, batch_id, failure, reason=reason)
        else:
            lock_batch(session, batch_id).status_reason = reason
        _mark(
            session,
            batch_id,
            processing_started_at=None,
            heartbeat_at=None,
            counts=_progress_values(session, batch_id, None),
        )
        session.commit()


def launch_stage(
    session: Session,
    background_tasks: BackgroundTasks,
    session_factory: sessionmaker[Session],
    batch_id: uuid.UUID,
    stage: Stage,
    work: StageWork,
    user_id: uuid.UUID,
) -> ImportBatch:
    """For the routes: mark the stage, commit and run it after the response is sent."""
    batch = start_stage(session, batch_id, stage)
    session.commit()
    background_tasks.add_task(
        jobs.run_job,
        f"import:{stage.value}:{batch_id}",
        session_factory,
        run_stage,
        session_factory,
        batch_id,
        stage,
        work,
        user_id,
    )
    return batch


def recover_interrupted_batches(session: Session, now: datetime) -> int:
    """Startup hook: batches with a stale heartbeat go back to their stable state."""
    batches = session.scalars(
        select(ImportBatch).where(
            ImportBatch.processing_started_at.is_not(None), ImportBatch.deleted_at.is_(None)
        )
    ).all()
    recovered = 0
    with audit_context(session, SYSTEM_CONTEXT):
        for batch in batches:
            if not jobs.is_stale(batch.heartbeat_at or batch.processing_started_at, now):
                continue
            batch.status_reason = INTERRUPTED_REASON
            session.flush()
            _mark(
                session,
                batch.id,
                processing_started_at=None,
                heartbeat_at=None,
                counts=_progress_values(session, batch.id, None),
            )
            recovered += 1
    return recovered
