"""Tray of the photos of a batch (change importacion-masiva-fotografias, task 4.1 and the
``assign`` of 4.2; design D4).

The tray lists the photos of a batch with their proposed row, filtered by status, proposal or
row, and counts them for the preview. A person assigns the ambiguous or unmatched ones to a row:
``assign`` leaves them ``MANUAL`` with that row, numbered after its last photo, and the matching
never changes them again (task 3.3). Nothing reaches the catalogue until the batch is applied
(task 5.2). ``unassign``, ``discard``, ``confirm_duplicate`` and ``reorder`` are still to come.
"""

import uuid
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.storage import ObjectStorage
from app.modules.imports.models import ImportPhoto
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.models import PhotoMatchStatus as M

#: Photos whose thumbnail exists: it is written when the photo is verified (task 2.2).
WITH_THUMBNAIL = frozenset({P.VERIFIED, P.APPLIED})
#: Key of the photos without a proposal yet (still uploading or not validated).
NO_PROPOSAL = "NONE"


def photos_query(
    batch_id: uuid.UUID,
    *,
    status: P | None = None,
    match_status: M | None = None,
    row_id: uuid.UUID | None = None,
) -> Select[Any]:
    """Photos of the batch in the order of the tray: by row and position, then by path."""
    query = select(ImportPhoto).where(ImportPhoto.batch_id == batch_id)
    if status is not None:
        query = query.where(ImportPhoto.status == status)
    if match_status is not None:
        query = query.where(ImportPhoto.match_status == match_status)
    if row_id is not None:
        query = query.where(ImportPhoto.row_id == row_id)
    return query.order_by(
        ImportPhoto.row_id.is_(None),
        ImportPhoto.row_id,
        ImportPhoto.sort_key,
        ImportPhoto.relative_path,
        ImportPhoto.id,
    )


def thumbnail_url(storage: ObjectStorage, photo: ImportPhoto, ttl_seconds: int) -> str | None:
    """Signed thumbnail of a verified photo; ``None`` before verification or if signing fails."""
    if photo.status not in WITH_THUMBNAIL:
        return None
    try:
        return storage.presign_get(f"{photo.storage_prefix}thumb.webp", ttl_seconds)
    except (BotoCoreError, ClientError):  # a convenience: the photo stays listed without it
        return None


def summary(session: Session, batch_id: uuid.UUID) -> dict[str, Any]:
    """Counts of the batch photos by status, by proposal and repeated on their target piece."""
    by_status = dict.fromkeys((status.value for status in P), 0)
    by_match = dict.fromkeys([*(match.value for match in M), NO_PROPOSAL], 0)
    duplicates = 0
    rows = session.execute(
        select(
            ImportPhoto.status,
            ImportPhoto.match_status,
            ImportPhoto.duplicate_of_existing & ~ImportPhoto.duplicate_confirmed,
            func.count(),
        )
        .where(ImportPhoto.batch_id == batch_id)
        .group_by(
            ImportPhoto.status,
            ImportPhoto.match_status,
            ImportPhoto.duplicate_of_existing & ~ImportPhoto.duplicate_confirmed,
        )
    )
    total = 0
    for status, match_status, duplicate, count in rows:
        total += count
        by_status[P(status).value] += count
        by_match[M(match_status).value if match_status else NO_PROPOSAL] += count
        duplicates += count if duplicate else 0
    return {
        "total": total,
        "by_status": by_status,
        "by_match_status": by_match,
        "duplicates": duplicates,
    }
