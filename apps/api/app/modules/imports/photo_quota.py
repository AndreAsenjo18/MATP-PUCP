"""Photo quota warning before approving a batch (importacion-masiva-fotografias 5.5; D6).

With ``MEDIA_QUOTA_BYTES`` configured, the approval summary warns when the photos the batch would
add, on top of the current volume, go beyond the quota. It is an upper bound: it counts every
verified photo with a row, even if the row ends up skipped, and it never blocks the approval.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.imports.models import ImportPhoto
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.media.volume import DISPLAY_BYTES, THUMB_BYTES, current_volume

GB = 10**9


def batch_photo_bytes(session: Session, batch_id: uuid.UUID, *, keep_originals: bool) -> int:
    photos, originals = session.execute(
        select(
            func.count(ImportPhoto.id), func.coalesce(func.sum(ImportPhoto.size_bytes), 0)
        ).where(
            ImportPhoto.batch_id == batch_id,
            ImportPhoto.status == P.VERIFIED,
            ImportPhoto.row_id.is_not(None),
        )
    ).one()
    return (int(originals) if keep_originals else 0) + int(photos) * (DISPLAY_BYTES + THUMB_BYTES)


def photo_quota_warning(
    session: Session, batch_id: uuid.UUID, *, quota_bytes: int | None, keep_originals: bool
) -> str | None:
    if not quota_bytes:
        return None
    added = batch_photo_bytes(session, batch_id, keep_originals=keep_originals)
    if not added:
        return None
    total = current_volume(session).volume.total_bytes + added
    if total <= quota_bytes:
        return None
    return (
        f"Al aplicar este lote, las fotos ocuparían hasta unos {total / GB:.1f} GB y superarían "
        f"la cuota de {quota_bytes / GB:.1f} GB (MEDIA_QUOTA_BYTES). Revise la estimación del "
        "volumen fotográfico antes de aprobar."
    )
