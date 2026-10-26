"""Tray of the photos of a batch (change importacion-masiva-fotografias, task 4.1 and the
``assign`` of 4.2; design D4).

The tray lists the photos of a batch with their proposed row, filtered by status, proposal or
row, and counts them for the preview. A person assigns the ambiguous or unmatched ones to a row:
``assign`` leaves them ``MANUAL`` with that row, numbered after its last photo, and the matching
never changes them again (task 3.3). Nothing reaches the catalogue until the batch is applied
(task 5.2). ``unassign``, ``discard``, ``confirm_duplicate`` and ``reorder`` are still to come.
"""

import uuid
from collections.abc import Sequence
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.imports.models import ImportPhoto, ImportRow
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.models import PhotoMatchSource as Source
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.photos import MATCHING_STATES
from app.modules.imports.state import STATUS_LABELS, lock_batch

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


def assign_photos(
    session: Session, batch_id: uuid.UUID, photo_ids: Sequence[uuid.UUID], row_id: uuid.UUID
) -> list[ImportPhoto]:
    """Assign verified photos of the batch to one of its rows, in the order given (D4).

    The batch row is locked first, as the photo verification does, so the matching of new
    photos never works on the same batch at the same time. The caller commits.
    """
    batch = lock_batch(session, batch_id)
    if batch.status not in MATCHING_STATES:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: sus fotos ya no se pueden asignar.",
            code="batch_not_reviewable",
            details={"current_status": batch.status.value},
        )
    row = session.get(ImportRow, row_id)
    if row is None or row.batch_id != batch.id:
        raise ValidationFailed(
            "La fila indicada no es de este lote.",
            code="row_not_in_batch",
            details={"row_id": str(row_id)},
        )
    wanted = list(dict.fromkeys(photo_ids))
    found = {
        photo.id: photo
        for photo in session.scalars(
            select(ImportPhoto).where(ImportPhoto.batch_id == batch.id, ImportPhoto.id.in_(wanted))
        )
    }
    foreign = [str(photo_id) for photo_id in wanted if photo_id not in found]
    if foreign:
        raise ValidationFailed(
            "Algunas fotos no pertenecen a este lote.",
            code="photo_not_in_batch",
            details={"photo_ids": foreign},
        )
    unverified = [str(photo_id) for photo_id in wanted if found[photo_id].status is not P.VERIFIED]
    if unverified:
        raise ValidationFailed(
            "Solo se asignan fotos verificadas: espere a que termine su verificación.",
            code="photo_not_verified",
            details={"photo_ids": unverified},
        )
    last = session.scalar(
        select(func.max(ImportPhoto.sort_key)).where(
            ImportPhoto.row_id == row.id, ImportPhoto.id.not_in(wanted)
        )
    )
    for position, photo_id in enumerate(wanted, start=(last or 0) + 1):
        photo = found[photo_id]
        photo.match_status = M.MANUAL
        photo.match_source = Source.MANUAL
        photo.row_id = row.id
        photo.candidate_row_ids = None
        photo.sort_key = position
    session.flush()
    return [found[photo_id] for photo_id in wanted]
