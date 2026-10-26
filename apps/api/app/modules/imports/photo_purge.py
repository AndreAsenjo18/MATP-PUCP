"""Purge of the files of batch photos that will never be applied (D7 of the photo import).

The photos of an **abandoned** batch, and the photos **discarded** in a batch that is already
closed, are kept ``IMPORT_PHOTO_RETENTION_DAYS`` days. After that, their objects
(``upload.<ext>``, ``thumb.webp`` and ``display.webp``) are deleted and the ``import_photo`` row
stays, with the purge in its ``rejection_reason`` and in the audit. This does not break RN-005:
those files were never catalogue information.

A photo is never purged while its batch is still in progress, when it was applied, or when a
``media_asset`` (even a retired one) still points to its upload, as after a batch rollback.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.models_base import utcnow
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.photo_upload import upload_key
from app.modules.media.models import MediaAsset

ACTOR = "purge_photos"
PURGE_MARK = "Archivos eliminados tras el plazo de retención"
# Batches that will never apply their photos again: the discarded ones can go (a reverted batch
# is not applied again; an applied one already registered the photos it wanted).
CLOSED = frozenset({S.APPLIED, S.REVERTED, S.ABANDONED, S.FAILED_INGESTION})


@dataclass
class PurgeResult:
    photos: list[ImportPhoto] = field(default_factory=list)
    deleted_keys: list[str] = field(default_factory=list)


def object_keys(photo: ImportPhoto) -> list[str]:
    """Every object a batch photo may have left in the storage (D2)."""
    prefix = photo.storage_prefix
    return [upload_key(photo), f"{prefix}thumb.webp", f"{prefix}display.webp"]


def purgeable_photos(session: Session, *, retention_days: int, now: datetime) -> list[ImportPhoto]:
    cutoff = now - timedelta(days=retention_days)
    candidates = session.scalars(
        select(ImportPhoto)
        .join(ImportBatch, ImportBatch.id == ImportPhoto.batch_id)
        .where(
            ImportPhoto.status != P.APPLIED,
            ImportPhoto.media_asset_id.is_(None),
            ImportPhoto.updated_at < cutoff,
            ImportBatch.updated_at < cutoff,
            or_(
                ImportBatch.status == S.ABANDONED,
                (ImportPhoto.status == P.DISCARDED) & ImportBatch.status.in_(CLOSED),
            ),
            or_(
                ImportPhoto.rejection_reason.is_(None),
                ImportPhoto.rejection_reason.not_like(f"%{PURGE_MARK}%"),
            ),
        )
        .order_by(ImportPhoto.batch_id, ImportPhoto.id)
    ).all()
    uploads = {upload_key(photo): photo for photo in candidates}
    referenced = set(
        session.scalars(
            select(MediaAsset.storage_key)
            .where(MediaAsset.storage_key.in_(uploads))
            .execution_options(**{INCLUDE_DELETED: True})
        )
    )
    return [photo for key, photo in uploads.items() if key not in referenced]


def purge_photos(
    session: Session,
    storage: ObjectStorage,
    *,
    retention_days: int,
    now: datetime | None = None,
    dry_run: bool = False,
) -> PurgeResult:
    """Delete the objects of the photos past the retention period; the rows stay (D7).

    Running it again finds nothing new: a purged photo carries ``PURGE_MARK``. Deleting an object
    that is already gone is a no-op, so a run interrupted halfway can simply be repeated.
    """
    moment = now or utcnow()
    result = PurgeResult(purgeable_photos(session, retention_days=retention_days, now=moment))
    if dry_run:
        return result
    note = f"{PURGE_MARK} ({retention_days} días, {moment.date().isoformat()})."
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR, reason=note)
    with audit_context(session, context):
        for photo in result.photos:
            for key in object_keys(photo):
                storage.delete_pending(key)
                result.deleted_keys.append(key)
            previous = (photo.rejection_reason or "").strip()
            photo.rejection_reason = f"{previous} · {note}" if previous else note
        session.flush()
    return result
