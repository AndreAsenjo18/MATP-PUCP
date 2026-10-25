"""Verification of the uploaded photos of a batch (change importacion-masiva-fotografias, task
2.2; design D2).

``POST /imports/{batch_id}/photos/complete`` moves the photos whose file was uploaded to
``UPLOADED``: that status is the queue of the ``import-photos`` worker (``app.core.jobs``), woken
up after the commit. For each queued photo the worker reads the object from the storage and
checks its size, its SHA-256 and its real type (``media.service.verify_image``), then writes
``thumb.webp`` and ``display.webp`` next to it with the derivatives of ``media``. The photo
becomes ``VERIFIED`` or ``REJECTED`` with its reason and, in the same transaction, the batch is
matched again (``photos.match_batch_photos``, task 3.3: «al llegar fotos nuevas»).

The worker never writes a batch while one of its stages runs: the validation rewrites the
proposals of the batch and its heartbeat writes the batch row. Those photos wait for the next
drain, and the batch row is locked before any photo is written (as ``worker.start_stage`` does),
so a stage cannot start in between. A stage whose heartbeat is stale was interrupted and does not
hold its photos back. A photo whose verification was cut by a restart is still ``UPLOADED``: the
worker drains it again when the app starts (``jobs.start_workers`` wakes every queue at once),
so no per-photo heartbeat is needed.
"""

import hashlib
import logging
import uuid
from collections.abc import Sequence

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import jobs
from app.core.config import Settings
from app.core.errors import NotFound, ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.imports.mapping import MappingContext
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.photo_upload import PHOTO_STATES, upload_key
from app.modules.imports.photos import PhotoMatchingFailed, match_batch_photos
from app.modules.imports.state import lock_batch
from app.modules.media import derivatives
from app.modules.media.service import verify_image

logger = logging.getLogger("matp.imports")

#: Worker that verifies the uploaded photos (``app.core.jobs``).
QUEUE = "import-photos"
#: Photos read per transaction: each group commits its verification and the new proposals.
CHUNK = 20
#: Batches whose queued photos are verified. An approved batch may still have its last photos in
#: the queue; they are verified but no longer matched (``photos.MATCHING_STATES``).
VERIFIED_STATES = PHOTO_STATES | {S.APPROVED, S.FAILED_APPLY}
VERIFIER = "verificación de fotos del lote"
UNEXPECTED = "No se pudo verificar la foto; vuelva a soltar la carpeta o avise al equipo."
#: The storage did not answer: the photo stays in the queue for the next drain.
STORAGE_ERRORS = (BotoCoreError, ClientError, ConnectionError)


def _stage_running(batch: ImportBatch) -> bool:
    started = batch.processing_started_at
    return started is not None and not jobs.is_stale(batch.heartbeat_at or started)


def rejection(storage: ObjectStorage, photo: ImportPhoto, max_bytes: int) -> str | None:
    """Why ``photo`` is rejected, or None once its derivatives are written.

    A storage that does not answer raises one of ``STORAGE_ERRORS``.
    """
    key = upload_key(photo)
    try:
        size = storage.head(key).get("content_length")
    except FileNotFoundError:
        return "El archivo no llegó al almacenamiento; vuelva a soltar la carpeta para subirlo."
    if size is not None and size > max_bytes:
        return f"El archivo supera el tamaño máximo de {max_bytes // (1024 * 1024)} MB."
    data = b"".join(storage.stream(key))
    if len(data) != photo.size_bytes:
        return f"El archivo subido pesa {len(data)} bytes y se declararon {photo.size_bytes}."
    if hashlib.sha256(data).hexdigest() != photo.content_sha256:
        return "La huella SHA-256 del archivo subido no coincide con la declarada."
    try:
        image = verify_image(data)
    except ValidationFailed as exc:
        return exc.message
    if image.content_type != photo.content_type:
        return f"El archivo es {image.content_type} y se declaró {photo.content_type}."
    derivatives.store_derivatives(storage, photo.storage_prefix, data)
    return None


def _queued(session: Session, held: set[uuid.UUID], limit: int) -> list[ImportPhoto]:
    query = (
        select(ImportPhoto)
        .join(ImportBatch, ImportBatch.id == ImportPhoto.batch_id)
        .where(
            ImportPhoto.status == P.UPLOADED,
            ImportBatch.deleted_at.is_(None),
            ImportBatch.status.in_(VERIFIED_STATES),
        )
        .order_by(ImportPhoto.created_at, ImportPhoto.id)
        .limit(limit)
    )
    if held:
        query = query.where(ImportPhoto.id.not_in(held))
    return list(session.scalars(query))


def _match(session: Session, batch: ImportBatch) -> None:
    try:
        match_batch_photos(session, batch, MappingContext(session).identifier_rules)
    except PhotoMatchingFailed:
        # The verification stands; the next validation of the batch proposes the rows again.
        session.expire_all()


def _verify_group(
    session: Session,
    storage: ObjectStorage,
    batch_id: uuid.UUID,
    photos: Sequence[ImportPhoto],
    max_bytes: int,
    held: set[uuid.UUID],
) -> int:
    batch = session.get(ImportBatch, batch_id)
    if batch is None or _stage_running(batch):
        held.update(photo.id for photo in photos)
        return 0
    outcomes: dict[uuid.UUID, str | None] = {}
    for photo in photos:  # reading the files takes long: nothing is locked meanwhile
        try:
            outcomes[photo.id] = rejection(storage, photo, max_bytes)
        except STORAGE_ERRORS:
            logger.warning("El almacenamiento no respondió al verificar la foto %s", photo.id)
            held.add(photo.id)
        except Exception:
            logger.exception("Falló la verificación de la foto %s", photo.id)
            outcomes[photo.id] = UNEXPECTED
    if not outcomes:
        return 0

    try:
        batch = lock_batch(session, batch_id)
    except NotFound:  # deleted while the files were read
        batch = None
    if batch is not None:
        session.refresh(batch)
    if batch is None or _stage_running(batch):  # or a stage started while the files were read
        session.rollback()
        held.update(outcomes)
        return 0
    context = AuditContext(
        origin=AuditOrigin.SYSTEM, actor_label=VERIFIER, origin_ref=str(batch_id)
    )
    written = 0
    with audit_context(session, context):
        for photo in photos:
            if photo.id not in outcomes:
                continue
            session.refresh(photo)
            if photo.status is not P.UPLOADED:  # a person changed it meanwhile
                continue
            problem = outcomes[photo.id]
            photo.status = P.VERIFIED if problem is None else P.REJECTED
            photo.rejection_reason = problem
            written += 1
        session.flush()
        if any(problem is None for problem in outcomes.values()):
            _match(session, batch)
    session.commit()
    return written


def verify_uploaded_photos(
    factory: jobs.SessionFactory, storage: ObjectStorage, *, max_bytes: int, chunk: int = CHUNK
) -> int:
    """Drain of the ``import-photos`` worker: verify every queued photo; returns how many."""
    done = 0
    held: set[uuid.UUID] = set()  # photos that wait for the next drain
    while True:
        with factory() as session:
            photos = _queued(session, held, chunk)
            if not photos:
                return done
            groups: dict[uuid.UUID, list[ImportPhoto]] = {}
            for photo in photos:
                groups.setdefault(photo.batch_id, []).append(photo)
            for batch_id, group in groups.items():
                done += _verify_group(session, storage, batch_id, group, max_bytes, held)


def register_photo_jobs(storage: ObjectStorage, settings: Settings) -> None:
    """Register the queue of uploaded photos (``app.core.jobs``); called by ``create_app``."""

    def drain(factory: jobs.SessionFactory) -> int:
        return verify_uploaded_photos(factory, storage, max_bytes=settings.media_max_bytes)

    jobs.register_worker(QUEUE, drain, interval=30.0)
