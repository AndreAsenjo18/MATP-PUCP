"""Full duplicate scan as a background job, and the candidate synchronization (spec calidad-datos).

Change deteccion-duplicados-y-cola-revision, task 2.3 (design D1 to D3). ``sync_candidates``
applies the flow of design D1 to the detected pairs and is idempotent, so a scan can run again
after an interruption (ADR-010) and the incremental detection (task 2.4) reuses it:

- a new pair enters the queue as ``PENDING`` with its signals and fingerprint;
- a ``PENDING`` or ``POSTPONED`` pair refreshes its score and signals;
- a ``DISTINCT`` pair returns to ``PENDING`` only when its fingerprint changed (design D2);
- ``MERGED`` and ``SUPERSEDED`` pairs are never touched.
"""

import logging
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.core.jobs import Heartbeat, SessionFactory, is_stale, register_recovery
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.quality.duplicates import CandidatePair, find_candidates
from app.modules.quality.models import (
    DuplicateCandidate,
    DuplicateStatus,
    QualityJob,
    QualityJobStatus,
    QualityJobType,
)
from app.modules.quality.schemas import QualityJobOut

logger = logging.getLogger(__name__)

#: Actor shown in the audit log for candidates written by the detection.
DETECTION_ACTOR = "Detección de duplicados"
DETECTED_BY = "rules"
_UNTOUCHED = {DuplicateStatus.MERGED, DuplicateStatus.SUPERSEDED}


class ScanInProgress(ConflictError):
    code = "scan_in_progress"


@dataclass
class SyncStats:
    created: int = 0
    reopened: int = 0
    refreshed: int = 0


def _key(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    first, second = sorted((a, b), key=str)
    return first, second


def _existing_by_pair(
    session: Session, piece_ids: set[uuid.UUID]
) -> dict[tuple[uuid.UUID, uuid.UUID], DuplicateCandidate]:
    """Latest candidate of every catalogue pair that involves one of ``piece_ids``."""
    rows = session.scalars(
        select(DuplicateCandidate)
        .where(
            DuplicateCandidate.piece_b_id.is_not(None),
            DuplicateCandidate.piece_a_id.in_(piece_ids)
            | DuplicateCandidate.piece_b_id.in_(piece_ids),
        )
        .order_by(DuplicateCandidate.created_at)
    ).all()
    return {_key(row.piece_a_id, row.piece_b_id): row for row in rows if row.piece_b_id}


def _apply(candidate: DuplicateCandidate, pair: CandidatePair) -> None:
    score = Decimal(str(pair.result.score))
    if candidate.score != score:
        candidate.score = score
    matched = pair.result.matched_fields()
    if candidate.matched_fields != matched:
        candidate.matched_fields = matched
    if candidate.compared_fingerprint != pair.result.fingerprint:
        candidate.compared_fingerprint = pair.result.fingerprint
    if candidate.blocking_conflict != pair.result.blocking_conflict:
        candidate.blocking_conflict = pair.result.blocking_conflict


def sync_candidates(session: Session, pairs: Iterable[CandidatePair]) -> SyncStats:
    """Store detected pairs in the review queue following design D1 (requires audit context)."""
    pairs = list(pairs)
    stats = SyncStats()
    if not pairs:
        return stats
    involved = {pid for pair in pairs for pid in (pair.piece_a_id, pair.piece_b_id)}
    existing = _existing_by_pair(session, involved)
    for pair in pairs:
        candidate = existing.get((pair.piece_a_id, pair.piece_b_id))
        if candidate is None:
            candidate = DuplicateCandidate(
                id=new_uuid(),
                piece_a_id=pair.piece_a_id,
                piece_b_id=pair.piece_b_id,
                status=DuplicateStatus.PENDING,
                detected_by=DETECTED_BY,
                score=Decimal("0"),
                matched_fields=[],
            )
            _apply(candidate, pair)
            session.add(candidate)
            stats.created += 1
        elif candidate.status in _UNTOUCHED:
            continue
        elif candidate.status == DuplicateStatus.DISTINCT:
            if candidate.compared_fingerprint == pair.result.fingerprint:
                continue  # the compared data did not change (RF-030)
            _apply(candidate, pair)
            candidate.status = DuplicateStatus.PENDING
            candidate.reviewed_by_id = None
            candidate.reviewed_at = None
            stats.reopened += 1
        else:  # PENDING or POSTPONED: keep the status, refresh the evidence
            _apply(candidate, pair)
            stats.refreshed += 1
    session.flush()
    return stats


def job_summary(job: QualityJob) -> dict[str, object]:
    return QualityJobOut.model_validate(job).model_dump(mode="json")


def _running_scan(session: Session) -> QualityJob | None:
    return session.scalars(
        select(QualityJob)
        .where(
            QualityJob.job_type == QualityJobType.FULL_SCAN,
            QualityJob.status == QualityJobStatus.RUNNING,
        )
        .order_by(QualityJob.created_at.desc())
    ).first()


def _fail(job: QualityJob, message: str) -> None:
    job.status = QualityJobStatus.FAILED
    job.finished_at = utcnow()
    job.error_message = message[:1000]


def start_scan(session: Session, user_id: uuid.UUID | None) -> QualityJob:
    """Register a new full scan, or raise 409 with the progress of the one in course."""
    current = _running_scan(session)
    if current is not None:
        if not is_stale(current.heartbeat_at):
            raise ScanInProgress(
                "Ya hay una detección completa en curso; espere a que termine.",
                details={"job": job_summary(current)},
            )
        _fail(current, "Detección interrumpida: dejó de informar su avance.")
    now = utcnow()
    job = QualityJob(
        id=new_uuid(),
        job_type=QualityJobType.FULL_SCAN,
        status=QualityJobStatus.RUNNING,
        requested_by_id=user_id,
        started_at=now,
        heartbeat_at=now,
        total_pieces=0,
        processed_pieces=0,
        pairs_evaluated=0,
        candidates_created=0,
        candidates_reopened=0,
    )
    session.add(job)
    session.flush()
    return job


def run_full_scan(factory: SessionFactory, job_id: uuid.UUID) -> None:
    """Background body of a full scan: detect, synchronize the queue and record the result."""
    session = factory()
    started = time.monotonic()
    try:
        job = session.get(QualityJob, job_id)
        if job is None or job.status != QualityJobStatus.RUNNING:
            return
        context = AuditContext(
            origin=AuditOrigin.SYSTEM, user_id=job.requested_by_id, actor_label=DETECTION_ACTOR
        )
        with audit_context(session, context):

            def beat() -> None:  # progress fields are already set by `progress`
                job.heartbeat_at = utcnow()
                session.commit()

            heartbeat = Heartbeat(beat)

            def progress(processed: int, total: int) -> None:
                job.processed_pieces = processed
                job.total_pieces = total
                heartbeat.tick()

            detection = find_candidates(session, on_progress=progress)
            stats = sync_candidates(session, detection.candidates)
            job.status = QualityJobStatus.SUCCEEDED
            job.total_pieces = detection.pieces
            job.processed_pieces = detection.pieces
            job.pairs_evaluated = detection.pairs_evaluated
            job.candidates_created = stats.created
            job.candidates_reopened = stats.reopened
            job.heartbeat_at = job.finished_at = utcnow()
            job.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
    except Exception as exc:
        logger.exception("Falló la detección completa de duplicados %s", job_id)
        session.rollback()
        failed = session.get(QualityJob, job_id)
        if failed is not None:
            _fail(failed, f"{type(exc).__name__}: {exc}")
            failed.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
    finally:
        session.close()


def recover_interrupted_scans(factory: SessionFactory) -> int:
    """Startup recovery (ADR-010): a scan still RUNNING without heartbeat was interrupted."""
    session = factory()
    try:
        jobs = session.scalars(
            select(QualityJob).where(QualityJob.status == QualityJobStatus.RUNNING)
        ).all()
        stale = [job for job in jobs if is_stale(job.heartbeat_at)]
        for job in stale:
            _fail(job, "Detección interrumpida por un reinicio del servicio; vuelva a lanzarla.")
        session.commit()
        return len(stale)
    finally:
        session.close()


def register_scan_jobs() -> None:
    register_recovery("quality-scan", recover_interrupted_scans)
