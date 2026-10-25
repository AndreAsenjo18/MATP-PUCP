"""Resumable upload of the photos of a batch (change importacion-masiva-fotografias, task 2.1;
design D2).

``request_upload_urls`` (``POST /imports/{batch_id}/photos/upload-urls``) registers each declared
file as an ``import_photo`` in ``PENDING_UPLOAD`` and returns a presigned ``PUT`` straight to the
storage, at the final key of the photo (``media/<photo_id>/upload.<ext>``): applying the batch
copies no object. A file whose fingerprint is already in the batch comes back as
``already_registered`` and is not uploaded again, so dropping the same folder again resumes an
interrupted upload (unique ``(batch_id, content_sha256)``). A photo still waiting for its file,
or one that was rejected, gets a new URL instead.

A file of a type or size the batch does not admit comes back as ``rejected`` with its reason and
is not registered: one bad file does not stop the rest of its group. Nothing reaches the
catalogue until the batch is applied (task 5.1).
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ConflictError, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.state import STATUS_LABELS, lock_batch

#: Files per call (design D2: groups of up to 100).
MAX_FILES_PER_CALL = 100
#: A batch admits photos while it is prepared, until it is approved (design D2).
PHOTO_STATES = frozenset({S.UPLOADED, S.MAPPED, S.VALIDATED, S.IN_PREVIEW})
#: Photos that do not count towards ``IMPORT_MAX_PHOTOS``: a rejected one can be uploaded again.
UNCOUNTED = frozenset({P.REJECTED, P.DISCARDED})

UploadResult = Literal["upload", "already_registered", "rejected"]


@dataclass(frozen=True)
class DeclaredPhoto:
    """A file as the browser lists it, with the SHA-256 it computed."""

    relative_path: str
    size_bytes: int
    content_type: str
    content_sha256: str


@dataclass(frozen=True)
class PhotoLimits:
    allowed_types: frozenset[str]
    max_bytes: int
    max_photos: int
    url_ttl_seconds: int

    @classmethod
    def from_settings(cls, settings: Settings) -> "PhotoLimits":
        return cls(
            allowed_types=frozenset(settings.media_allowed_types_set),
            max_bytes=settings.media_max_bytes,
            max_photos=settings.import_max_photos,
            url_ttl_seconds=settings.media_upload_url_ttl_seconds,
        )


@dataclass(frozen=True)
class UploadItem:
    """What the browser does with one declared file."""

    relative_path: str
    content_sha256: str
    result: UploadResult
    photo: ImportPhoto | None = None
    upload: dict[str, Any] | None = None  # presigned PUT: url, method and headers
    expires_at: datetime | None = None
    reason: str | None = None


def upload_key(photo: ImportPhoto) -> str:
    """Object of the photo as it was uploaded: ``media/<photo_id>/upload.<ext>`` (design D2)."""
    return f"{photo.storage_prefix}upload.{photo.content_type.split('/')[-1]}"


def admitting_batch(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    """The locked batch, if it still admits photos; ``409`` otherwise."""
    batch = lock_batch(session, batch_id)
    if batch.status not in PHOTO_STATES:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}» y no admite fotos: se agregan "
            "mientras el lote se prepara, antes de aprobarlo.",
            code="batch_not_accepting_photos",
            details={"current_status": batch.status.value},
        )
    return batch


def _problem(file: DeclaredPhoto, limits: PhotoLimits) -> str | None:
    if file.content_type not in limits.allowed_types:
        allowed = ", ".join(sorted(limits.allowed_types))
        return f"Tipo «{file.content_type}» no admitido. Admitidos: {allowed}."
    if file.size_bytes > limits.max_bytes:
        return f"El archivo supera el tamaño máximo de {limits.max_bytes // (1024 * 1024)} MB."
    return None


def _register(session: Session, batch_id: uuid.UUID, file: DeclaredPhoto) -> ImportPhoto:
    photo_id = new_uuid()
    photo = ImportPhoto(
        id=photo_id,
        batch_id=batch_id,
        relative_path=file.relative_path,
        original_filename=file.relative_path.rsplit("/", 1)[-1],
        content_sha256=file.content_sha256,
        size_bytes=file.size_bytes,
        content_type=file.content_type,
        storage_prefix=f"media/{photo_id}/",
        status=P.PENDING_UPLOAD,
    )
    session.add(photo)
    return photo


def _retry(photo: ImportPhoto, file: DeclaredPhoto) -> None:
    """A rejected photo is uploaded again, with what the browser declares now."""
    photo.status = P.PENDING_UPLOAD
    photo.rejection_reason = None
    photo.size_bytes = file.size_bytes
    photo.content_type = file.content_type


def request_upload_urls(
    session: Session,
    storage: ObjectStorage,
    batch_id: uuid.UUID,
    files: Sequence[DeclaredPhoto],
    limits: PhotoLimits,
    *,
    now: datetime | None = None,
) -> list[UploadItem]:
    """One item per declared file, in the same order; the caller commits."""
    batch = admitting_batch(session, batch_id)
    known = {
        photo.content_sha256: photo
        for photo in session.scalars(
            select(ImportPhoto).where(
                ImportPhoto.batch_id == batch.id,
                ImportPhoto.content_sha256.in_({file.content_sha256 for file in files}),
            )
        )
    }
    # Fingerprints this call registers or uploads again, checked against the limit first.
    adds = {
        file.content_sha256
        for file in files
        if _problem(file, limits) is None
        and (file.content_sha256 not in known or known[file.content_sha256].status is P.REJECTED)
    }
    counted = session.scalar(
        select(func.count())
        .select_from(ImportPhoto)
        .where(ImportPhoto.batch_id == batch.id, ImportPhoto.status.not_in(UNCOUNTED))
    )
    if counted + len(adds) > limits.max_photos:
        raise ValidationFailed(
            f"El lote admite hasta {limits.max_photos} fotos y ya tiene {counted}; esta tanda "
            f"agrega {len(adds)}. Reparta las fotos en otro lote.",
            code="photo_limit_exceeded",
            details={"max_photos": limits.max_photos, "registered": counted, "added": len(adds)},
        )

    expires_at = (now or utcnow()) + timedelta(seconds=limits.url_ttl_seconds)
    seen: set[str] = set()
    items: list[UploadItem] = []
    for file in files:
        item = UploadItem(file.relative_path, file.content_sha256, "already_registered")
        photo = known.get(file.content_sha256)
        if file.content_sha256 in seen or (
            photo is not None and photo.status not in {P.PENDING_UPLOAD, P.REJECTED}
        ):
            items.append(replace(item, photo=photo))
            continue
        problem = _problem(file, limits)
        if problem is not None:
            items.append(replace(item, result="rejected", reason=problem))
            continue
        if photo is None:
            photo = known[file.content_sha256] = _register(session, batch.id, file)
        elif photo.status is P.REJECTED:
            _retry(photo, file)
        seen.add(file.content_sha256)
        upload = storage.presign_put(upload_key(photo), photo.content_type, limits.url_ttl_seconds)
        items.append(
            replace(item, result="upload", photo=photo, upload=upload, expires_at=expires_at)
        )
    session.flush()
    return items
