"""Lower resolution versions of a photo of a ``PHOTOS`` batch (change importacion-fotos-a-catalogo,
task 5.2; design D6).

After each group of verified photos, the photos of the batch whose perceptual hashes are within
``IMPORT_PHOTO_SIMILARITY_BITS`` are proposed as the same photo: the one with most pixels is kept
and the others become ``DISCARDED`` with the reason and ``same_as_photo_id``. It is a proposal: a
person restores a discarded photo with ``PATCH … restore`` and nothing is deleted (RN-005). A
discarded photo that a person had assigned passes its piece to the kept one if that one has none.

Photos a person removed from their piece or restored (``MANUAL`` without a piece) are not grouped
again. A photo verified before migration 0019 has no hash: it is computed once from its
thumbnail. Only ``PHOTOS`` batches: in a batch with Excel every photo belongs to its row.
"""

import logging
from collections.abc import Sequence

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.storage import ObjectStorage
from app.modules.imports.models import ImportBatch, ImportBatchKind, ImportPhoto
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.perceptual import HashedPhoto, dhash_bytes, similar_groups
from app.modules.imports.state import batch_kind

logger = logging.getLogger("matp.imports")

LOWER_RESOLUTION = "Versión de menor resolución de {path}"
STORAGE_ERRORS = (BotoCoreError, ClientError, ConnectionError)


def _hash_from_thumbnail(storage: ObjectStorage, photo: ImportPhoto) -> bool:
    """Compute the missing hash from the thumbnail; ``False`` if it cannot be read."""
    try:
        data = storage.get_bytes(f"{photo.storage_prefix}thumb.webp")
        photo.perceptual_hash, _, _ = dhash_bytes(data)
    except (*STORAGE_ERRORS, FileNotFoundError, KeyError, OSError, ValueError):
        # A missing or broken thumbnail only leaves the photo out of the grouping.
        logger.warning("No se pudo calcular la huella perceptual de la foto %s", photo.id)
        return False
    return True


def _candidates(session: Session, batch: ImportBatch) -> list[ImportPhoto]:
    return [
        photo
        for photo in session.scalars(
            select(ImportPhoto)
            .where(ImportPhoto.batch_id == batch.id, ImportPhoto.status == P.VERIFIED)
            .order_by(ImportPhoto.relative_path, ImportPhoto.id)
        )
        if not (photo.match_status is M.MANUAL and photo.piece_id is None)
    ]


def _pass_assignment(session: Session, kept: ImportPhoto, discarded: Sequence[ImportPhoto]) -> None:
    if kept.piece_id is not None:
        return
    manual = next(
        (photo for photo in discarded if photo.match_status is M.MANUAL and photo.piece_id), None
    )
    if manual is None:
        return
    last = session.scalar(
        select(func.max(ImportPhoto.sort_key)).where(ImportPhoto.piece_id == manual.piece_id)
    )
    kept.piece_id = manual.piece_id
    kept.match_status = M.MANUAL
    kept.match_source = manual.match_source
    kept.sort_key = (last or 0) + 1
    kept.match_reason = None


def discard_lower_resolutions(
    session: Session, storage: ObjectStorage | None, batch: ImportBatch, bits: int
) -> int:
    """Group the verified photos of the batch and discard every lower resolution version (D6).
    Returns how many photos were discarded. The caller flushes and commits."""
    if batch_kind(batch) is not ImportBatchKind.PHOTOS:
        return 0
    photos = _candidates(session, batch)
    hashed = []
    for photo in photos:
        if photo.perceptual_hash is None and (
            storage is None or not _hash_from_thumbnail(storage, photo)
        ):
            continue
        hashed.append(photo)
    by_id = {photo.id: photo for photo in hashed}
    groups = similar_groups(
        [
            HashedPhoto(
                photo.id,
                photo.perceptual_hash or "",
                (photo.width_px or 0) * (photo.height_px or 0),
                photo.size_bytes,
                photo.relative_path,
            )
            for photo in hashed
        ],
        bits,
    )
    discarded = 0
    for group in groups:
        kept = by_id[group[0].photo_id]
        others = [by_id[item.photo_id] for item in group[1:]]
        _pass_assignment(session, kept, others)
        for photo in others:
            photo.status = P.DISCARDED
            photo.rejection_reason = LOWER_RESOLUTION.format(path=kept.relative_path)
            photo.same_as_photo_id = kept.id
            photo.piece_id = None
            photo.candidate_piece_ids = None
            photo.sort_key = None
            photo.match_reason = None
            photo.duplicate_of_existing = False
            discarded += 1
    session.flush()
    return discarded
