"""Photo packages of several pieces (descargas-masivas-y-enriquecimiento-lote, section 2).

Design D1: asking for a package creates a job and answers its state; the ZIP is built in the
background over ``app/core/jobs.py`` (ADR-010), one package in preparation per person, and is
served later through a short-lived link until the package expires [SUPUESTO AA2]. Only the
person who asked for a package can see it.
"""

import logging
import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, PermissionDenied
from app.core.jobs import SessionFactory, is_stale, register_recovery
from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.media.models import BulkDownloadStatus as S
from app.modules.media.models import MediaBulkDownload

logger = logging.getLogger(__name__)

ACTOR = "bulk_download"
IN_PREPARATION = (S.PENDING, S.RUNNING)


def _in_preparation(job: MediaBulkDownload) -> bool:
    """Pending, or running with a recent heartbeat (a stale one was interrupted)."""
    return job.status is S.PENDING or (job.status is S.RUNNING and not is_stale(job.heartbeat_at))


def create_bulk_download(
    session: Session, user_id: uuid.UUID, piece_ids: Iterable[uuid.UUID]
) -> MediaBulkDownload:
    """The job of a new package; 409 while the same person has another one in preparation.

    The caller's audit context records the job; the size was already checked against
    ``MEDIA_BULK_DOWNLOAD_MAX_PIECES`` (task 1.2).
    """
    current = session.scalars(
        select(MediaBulkDownload).where(
            MediaBulkDownload.requested_by_id == user_id,
            MediaBulkDownload.status.in_(IN_PREPARATION),
        )
    ).all()
    busy = [job for job in current if _in_preparation(job)]
    if busy:
        raise ConflictError(
            "Ya tiene un paquete de fotos en preparación; espere a que termine para pedir otro.",
            code="bulk_download_in_progress",
            details={"job_id": str(busy[0].id)},
        )
    job = MediaBulkDownload(
        id=new_uuid(),
        requested_by_id=user_id,
        piece_ids=list(dict.fromkeys(str(piece_id) for piece_id in piece_ids)),
        status=S.PENDING,
        omitted=[],
    )
    session.add(job)
    session.flush()
    return job


def bulk_download_of(session: Session, job_id: uuid.UUID, user_id: uuid.UUID) -> MediaBulkDownload:
    """The package, only for the person who asked for it (404 if missing, 403 otherwise)."""
    job = session.get(MediaBulkDownload, job_id)
    if job is None:
        raise NotFound("No existe ese paquete de fotos.")
    if job.requested_by_id != user_id:
        raise PermissionDenied("Solo quien pidió el paquete de fotos puede consultarlo.")
    return job


def fail_interrupted(factory: SessionFactory) -> int:
    """On startup nothing is being built: every package left in preparation failed."""
    with factory() as session:
        context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR)
        with audit_context(session, context):
            jobs = session.scalars(
                select(MediaBulkDownload).where(MediaBulkDownload.status.in_(IN_PREPARATION))
            ).all()
            for job in jobs:
                job.status = S.FAILED
                job.error = "Se interrumpió al reiniciar el sistema; vuelva a pedir el paquete."
            session.commit()
    return len(jobs)


register_recovery("media_bulk_download", fail_interrupted)
