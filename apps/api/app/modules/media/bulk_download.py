"""Photo packages of several pieces (descargas-masivas-y-enriquecimiento-lote, section 2).

Design D1: asking for a package creates a job and answers its state; the ZIP is built in the
background over ``app/core/jobs.py`` (ADR-010), one package in preparation per person, and is
served later through a short-lived link until the package expires [SUPUESTO AA2]. Only the
person who asked for a package can see it.
"""

import logging
import os
import re
import tempfile
import uuid
import zipfile
from collections.abc import Iterable
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, PermissionDenied
from app.core.jobs import Heartbeat, SessionFactory, is_stale, register_recovery
from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term
from app.modules.media.models import BulkDownloadStatus as S
from app.modules.media.models import MediaAsset, MediaBulkDownload
from app.modules.media.service import effective_restriction

logger = logging.getLogger(__name__)

ACTOR = "bulk_download"
IN_PREPARATION = (S.PENDING, S.RUNNING)
EXPORT_PREFIX = "exports/bulk-download/"
# A restriction term whose ``extra`` carries this flag forbids downloading the photo (RN-008).
BLOCKS_DOWNLOAD = "blocks_external_download"


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


# ---------------------------------------------------------------- task 2.2: the worker
def _temporary_zip() -> Path:
    """An empty temporary file for the ZIP; the worker always deletes it."""
    handle, name = tempfile.mkstemp(prefix="matp-fotos-", suffix=".zip")
    os.close(handle)
    return Path(name)


def _safe(text: str) -> str:
    """A name that every unzip tool accepts: no path separators or control characters."""
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", text).strip(" .")
    return re.sub(r"\s+", " ", cleaned)[:120] or "sin nombre"


def _entry_name(piece: Piece, asset: MediaAsset, used: set[str]) -> str:
    """``Denominación (id corto)/01 nombre.ext``, unique inside the ZIP."""
    folder = f"{_safe(piece.denomination)} ({str(piece.id)[:8]})"
    stem = Path(asset.original_filename or str(asset.id)).stem
    extension = Path(asset.storage_key).suffix  # the file actually stored (display.webp, …)
    name = f"{folder}/{asset.sort_order + 1:02d} {_safe(stem)}{extension}"
    candidate, copy = name, 2
    while candidate in used:
        candidate = f"{Path(name).with_suffix('')} ({copy}){extension}"
        copy += 1
    used.add(candidate)
    return candidate


def _blocking_restriction(session: Session, asset: MediaAsset, piece: Piece) -> str | None:
    """The code of the effective restriction when it forbids downloading the photo (D3)."""
    restriction = effective_restriction(session, asset, piece)
    if restriction.term_id is None:
        return None
    term = session.get(Term, restriction.term_id)
    if term is None or not (term.extra or {}).get(BLOCKS_DOWNLOAD):
        return None
    return term.code


def _photos_in_order(session: Session, job: MediaBulkDownload) -> tuple[dict, list[MediaAsset]]:
    """The active pieces of the package and their active photos, in the order asked for."""
    order = {uuid.UUID(value): index for index, value in enumerate(job.piece_ids)}
    pieces = {
        piece.id: piece
        for piece in session.scalars(
            select(Piece).where(Piece.id.in_(order), Piece.deleted_at.is_(None))
        )
    }
    photos = session.scalars(
        select(MediaAsset).where(MediaAsset.piece_id.in_(pieces), MediaAsset.deleted_at.is_(None))
    ).all()
    return pieces, sorted(
        photos, key=lambda asset: (order[asset.piece_id], asset.sort_order, asset.created_at)
    )


def _build(
    session: Session, job: MediaBulkDownload, storage: ObjectStorage, ttl_hours: int
) -> None:
    def beat() -> None:
        job.heartbeat_at = utcnow()
        session.commit()

    heartbeat = Heartbeat(beat)
    pieces, photos = _photos_in_order(session, job)
    omitted: list[dict[str, str]] = []
    included = 0
    path = _temporary_zip()
    try:
        # Photos are already compressed: storing them saves time without growing the package.
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
            used: set[str] = set()
            for asset in photos:
                heartbeat.tick()
                piece = pieces[asset.piece_id]
                restriction = _blocking_restriction(session, asset, piece)
                if restriction is not None:
                    omitted.append(
                        {
                            "media_id": str(asset.id),
                            "piece_id": str(asset.piece_id),
                            "restriction": restriction,
                        }
                    )
                    continue
                archive.writestr(
                    _entry_name(piece, asset, used), storage.get_bytes(asset.storage_key)
                )
                included += 1
        key = f"{EXPORT_PREFIX}{job.id}.zip" if included else None
        if key is not None:
            storage.put_bytes(key, path.read_bytes(), "application/zip")
    finally:
        path.unlink(missing_ok=True)
    job.included_photos = included
    job.omitted = omitted
    job.storage_key = key
    job.expires_at = utcnow() + timedelta(hours=ttl_hours) if key else None
    job.status = S.READY
    job.heartbeat_at = None
    session.commit()


def build_bulk_download(
    factory: SessionFactory, job_id: uuid.UUID, storage: ObjectStorage, *, ttl_hours: int
) -> None:
    """The background work of a package (D2, D3); it never raises: a failure leaves it FAILED.

    Each photo is checked against its effective restriction right before it goes into the ZIP,
    so the restriction in force when the package is built wins. A package whose photos are all
    restricted ends READY without a file, and ``omitted`` says why.
    """
    with factory() as session:
        context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR)
        with audit_context(session, context):
            job = session.get(MediaBulkDownload, job_id)
            if job is None or job.status is not S.PENDING:
                return
            job.status = S.RUNNING
            job.heartbeat_at = utcnow()
            session.commit()
            try:
                _build(session, job, storage, ttl_hours)
            except Exception:
                logger.exception("No se pudo generar el paquete de fotos %s", job_id)
                session.rollback()
                failed = session.get(MediaBulkDownload, job_id)
                if failed is not None:
                    failed.status = S.FAILED
                    failed.heartbeat_at = None
                    failed.error = "No se pudo generar el paquete; vuelva a pedirlo."
                    session.commit()


register_recovery("media_bulk_download", fail_interrupted)
