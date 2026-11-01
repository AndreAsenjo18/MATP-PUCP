"""Tray of the photos of a batch (change importacion-masiva-fotografias, tasks 4.1 and 4.2; change
importacion-fotos-a-catalogo, tasks 4.1 to 4.3; design D4 and D8).

The tray lists the photos of a batch with their proposed row (a batch with Excel) or piece (a
``PHOTOS`` batch), filtered by status, proposal, row, piece or folder, and counts them for the
preview. A person decides on them; every decision leaves them ``MANUAL`` (the matching never
changes them again) and is audited with its author and the batch as ``origin_ref``, which the
batch log reads:

- ``assign``: to a row of the batch or to a piece of the catalogue, numbered after its last photo;
- ``unassign``: without row or piece;
- ``discard`` / ``restore``: out of the batch and back, as unassigned;
- ``confirm_duplicate``: a photo already on its piece (same SHA-256) is applied anyway;
- ``reorder``: the order of the photos of a row or a piece.

Nothing reaches the catalogue until the batch is applied.
"""

import uuid
from collections.abc import Iterable, Sequence
from typing import Any, Literal

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.catalog.models import Piece
from app.modules.imports.catalog_photos import mark_duplicates
from app.modules.imports.models import ImportBatch, ImportBatchKind, ImportPhoto, ImportRow
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.models import PhotoMatchSource as Source
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.photos import MATCHING_STATES_BY_KIND
from app.modules.imports.state import STATUS_LABELS, batch_kind, lock_batch

#: Photos whose thumbnail exists: it is written when the photo is verified (task 2.2).
WITH_THUMBNAIL = frozenset({P.VERIFIED, P.APPLIED})
#: Key of the photos without a proposal yet (still uploading or not validated).
NO_PROPOSAL = "NONE"
#: Reason of a photo a person discarded in the tray.
DISCARDED_IN_TRAY = "Descartada en la bandeja."

PhotoOperation = Literal["assign", "unassign", "discard", "restore", "confirm_duplicate", "reorder"]
OPERATION_LABELS: dict[str, str] = {
    "assign": "asignar",
    "unassign": "quitar la asignación",
    "discard": "descartar",
    "restore": "restaurar",
    "confirm_duplicate": "confirmar repetida",
    "reorder": "reordenar",
}


def photos_query(
    batch_id: uuid.UUID,
    *,
    status: P | None = None,
    match_status: M | None = None,
    row_id: uuid.UUID | None = None,
    piece_id: uuid.UUID | None = None,
    folder: str | None = None,
) -> Select[Any]:
    """Photos of the batch in the order of the tray: by target and position, then by path."""
    query = select(ImportPhoto).where(ImportPhoto.batch_id == batch_id)
    if status is not None:
        query = query.where(ImportPhoto.status == status)
    if match_status is not None:
        query = query.where(ImportPhoto.match_status == match_status)
    if row_id is not None:
        query = query.where(ImportPhoto.row_id == row_id)
    if piece_id is not None:
        query = query.where(ImportPhoto.piece_id == piece_id)
    if folder:
        prefix = folder.strip("/")
        query = query.where(ImportPhoto.relative_path.startswith(f"{prefix}/", autoescape=True))
    return query.order_by(
        ImportPhoto.row_id.is_(None),
        ImportPhoto.row_id,
        ImportPhoto.piece_id.is_(None),
        ImportPhoto.piece_id,
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


# --- decisiones (D4, D8) --------------------------------------------------------------------------


def _reviewable(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    """The locked batch, if its photos can still change (the photo verification locks it too)."""
    batch = lock_batch(session, batch_id)
    if batch.status not in MATCHING_STATES_BY_KIND[batch_kind(batch)]:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: sus fotos ya no se pueden asignar.",
            code="batch_not_reviewable",
            details={"current_status": batch.status.value},
        )
    return batch


def _photos(
    session: Session, batch: ImportBatch, photo_ids: Sequence[uuid.UUID], allowed: Iterable[P]
) -> list[ImportPhoto]:
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
    allowed = frozenset(allowed)
    wrong = [str(photo_id) for photo_id in wanted if found[photo_id].status not in allowed]
    if wrong:
        if allowed == {P.VERIFIED}:
            message = "Solo se deciden fotos verificadas: espere a que termine su verificación."
            code = "photo_not_verified"
        else:
            message = "Solo se restauran fotos descartadas."
            code = "photo_not_discarded"
        raise ValidationFailed(message, code=code, details={"photo_ids": wrong})
    return [found[photo_id] for photo_id in wanted]


def _target_row(session: Session, batch: ImportBatch, row_id: uuid.UUID) -> ImportRow:
    if batch_kind(batch) is ImportBatchKind.PHOTOS:
        raise ValidationFailed(
            "Un lote de solo fotografías no tiene filas: asigne las fotos a una pieza.",
            code="row_not_in_batch",
            details={"row_id": str(row_id)},
        )
    row = session.get(ImportRow, row_id)
    if row is None or row.batch_id != batch.id:
        raise ValidationFailed(
            "La fila indicada no es de este lote.",
            code="row_not_in_batch",
            details={"row_id": str(row_id)},
        )
    return row


def _target_piece(session: Session, batch: ImportBatch, piece_id: uuid.UUID) -> Piece:
    if batch_kind(batch) is not ImportBatchKind.PHOTOS:
        raise ValidationFailed(
            "Las fotos de un lote con Excel se asignan a una de sus filas.",
            code="piece_not_allowed",
            details={"piece_id": str(piece_id)},
        )
    piece = session.get(Piece, piece_id)
    if piece is None or piece.deleted_at is not None or piece.merged_into_id is not None:
        raise ValidationFailed(
            "La pieza no existe o fue retirada: elija otra.",
            code="piece_not_available",
            details={"piece_id": str(piece_id)},
        )
    return piece


def _target(
    session: Session,
    batch: ImportBatch,
    row_id: uuid.UUID | None,
    piece_id: uuid.UUID | None,
) -> tuple[str, uuid.UUID]:
    if (row_id is None) == (piece_id is None):
        raise ValidationFailed(
            "Indique la fila (`row_id`) o la pieza (`piece_id`), solo una.",
            code="photo_target_required",
        )
    if row_id is not None:
        return "row_id", _target_row(session, batch, row_id).id
    assert piece_id is not None
    return "piece_id", _target_piece(session, batch, piece_id).id


def _clear(photo: ImportPhoto) -> None:
    photo.row_id = None
    photo.piece_id = None
    photo.candidate_row_ids = None
    photo.candidate_piece_ids = None
    photo.match_reason = None
    photo.sort_key = None
    photo.duplicate_of_existing = False
    photo.duplicate_confirmed = False


def _manual(photo: ImportPhoto) -> None:
    photo.match_status = M.MANUAL
    photo.match_source = Source.MANUAL


def _assign(session: Session, photos: list[ImportPhoto], column: str, target: uuid.UUID) -> None:
    ids = [photo.id for photo in photos]
    last = session.scalar(
        select(func.max(ImportPhoto.sort_key)).where(
            getattr(ImportPhoto, column) == target, ImportPhoto.id.not_in(ids)
        )
    )
    for position, photo in enumerate(photos, start=(last or 0) + 1):
        keep_confirmed = photo.piece_id == target and photo.duplicate_confirmed
        _clear(photo)
        _manual(photo)
        setattr(photo, column, target)
        photo.sort_key = position
        photo.duplicate_confirmed = keep_confirmed
    mark_duplicates(session, photos)


def _reorder(
    session: Session, batch: ImportBatch, photos: list[ImportPhoto], column: str, target: uuid.UUID
) -> None:
    outside = [str(photo.id) for photo in photos if getattr(photo, column) != target]
    if outside:
        raise ValidationFailed(
            "Solo se reordenan fotos ya asignadas a esa fila o pieza.",
            code="photo_not_on_target",
            details={"photo_ids": outside},
        )
    ids = {photo.id for photo in photos}
    rest = session.scalars(
        select(ImportPhoto)
        .where(
            ImportPhoto.batch_id == batch.id,
            getattr(ImportPhoto, column) == target,
            ImportPhoto.id.not_in(ids),
        )
        .order_by(ImportPhoto.sort_key, ImportPhoto.relative_path)
    ).all()
    for position, photo in enumerate([*photos, *rest], start=1):
        photo.sort_key = position
    for photo in photos:
        _manual(photo)


def decide_photos(
    session: Session,
    batch_id: uuid.UUID,
    op: PhotoOperation,
    photo_ids: Sequence[uuid.UUID],
    *,
    row_id: uuid.UUID | None = None,
    piece_id: uuid.UUID | None = None,
) -> list[ImportPhoto]:
    """Apply a decision of a person on photos of the batch, in the order given (D4, D8).

    The batch row is locked first, as the photo verification does, so the matching of new
    photos never works on the same batch at the same time. The caller commits.
    """
    batch = _reviewable(session, batch_id)
    if op == "restore":
        photos = _photos(session, batch, photo_ids, {P.DISCARDED})
        for photo in photos:
            photo.status = P.VERIFIED
            photo.rejection_reason = None
            photo.same_as_photo_id = None
            _clear(photo)
            _manual(photo)
    else:
        photos = _photos(session, batch, photo_ids, {P.VERIFIED})
        if op in ("assign", "reorder"):
            column, target = _target(session, batch, row_id, piece_id)
            if op == "assign":
                _assign(session, photos, column, target)
            else:
                _reorder(session, batch, photos, column, target)
        elif op == "unassign":
            for photo in photos:
                _clear(photo)
                _manual(photo)
        elif op == "discard":
            for photo in photos:
                _clear(photo)
                _manual(photo)
                photo.status = P.DISCARDED
                photo.rejection_reason = DISCARDED_IN_TRAY
        elif op == "confirm_duplicate":
            for photo in photos:
                if photo.duplicate_of_existing:
                    photo.duplicate_confirmed = True
    session.flush()
    return photos


def assign_photos(
    session: Session, batch_id: uuid.UUID, photo_ids: Sequence[uuid.UUID], row_id: uuid.UUID
) -> list[ImportPhoto]:
    """Assign verified photos of the batch to one of its rows (``decide_photos`` ``assign``)."""
    return decide_photos(session, batch_id, "assign", photo_ids, row_id=row_id)
