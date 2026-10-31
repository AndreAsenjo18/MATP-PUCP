"""Proposed rows of the photos of an import batch (change importacion-masiva-fotografias, 3.3; D3).

``match_batch_photos`` runs the pure ``photo_matching.match_photos`` over the rows and photos of a
batch and stores the proposals in ``import_photo``. It runs at the end of the validation stage,
inside its transaction, and (task 2.2) when photos of the batch are verified. It is idempotent:
every run recomputes all the automatic proposals of the batch from its validated rows, and a run
that finds nothing new writes nothing.

A person's decision is never changed by a run (spec «Bandeja de revisión de fotografías del
lote»; design D4):

- a photo assigned by hand is ``MANUAL`` with its row: it keeps its row and its ``sort_key``, and
  the automatic photos of that row are numbered after the highest manual one;
- a photo a person removed from its row (``unassign``) is ``MANUAL`` without a row, and a
  discarded photo has ``status = DISCARDED``: neither is matched again;
- a photo never matched has no ``match_status``, or an automatic one (``MATCHED``, ``AMBIGUOUS``,
  ``UNMATCHED``).

Only ``VERIFIED`` photos are matched: the others are still uploading, were rejected or discarded,
or were already applied. Nothing reaches the catalogue until the batch is approved.
"""

import logging
import uuid
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.modules.identification.models import NormalizationRule
from app.modules.identification.params import session_params
from app.modules.imports.catalog_photos import match_catalog_batch
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportPhoto,
    ImportPhotoStatus,
    ImportRow,
)
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.photo_matching import (
    BatchPhoto,
    BatchRow,
    compile_camera_patterns,
    match_photos,
)
from app.modules.imports.state import batch_kind

logger = logging.getLogger(__name__)

#: States in which proposals can change: while validating (the stage runs from MAPPED) and during
#: the preview. An approved or applied batch keeps the proposals it was approved with. A ``PHOTOS``
#: batch has no validation: its photos are matched from the upload (importacion-fotos-a-catalogo).
MATCHING_STATES = frozenset({S.MAPPED, S.VALIDATED, S.IN_PREVIEW})
MATCHING_STATES_BY_KIND = {
    ImportBatchKind.SPREADSHEET: MATCHING_STATES,
    ImportBatchKind.PHOTOS: frozenset({S.UPLOADED, S.IN_PREVIEW}),
}
AUTOMATIC = frozenset({M.MATCHED, M.AMBIGUOUS, M.UNMATCHED})

PHOTO_MATCHING_FAILED = (
    "No se pudo proponer la fila de las fotos del lote ({error}). La validación no se guardó: "
    "vuelva a validar el lote y, si se repite, avise al equipo."
)


class PhotoMatchingFailed(DomainError):
    """The matching broke: the validation that runs it fails as a whole, with this message."""

    code = "photo_matching_failed"


def batch_rows(session: Session, batch_id: uuid.UUID) -> list[BatchRow]:
    """Validated rows of the batch for the matching; empty while the batch is not validated.

    The photo file column is read once ``MappingSpec`` has it (task 3.4); until then that path
    finds nothing.
    """
    rows = []
    for row_id, mapped in session.execute(
        select(ImportRow.id, ImportRow.mapped_data).where(
            ImportRow.batch_id == batch_id, ImportRow.mapped_data.is_not(None)
        )
    ):
        identifiers = tuple(
            (item["type"], item.get("normalized_value")) for item in mapped.get("identifiers") or []
        )
        rows.append(BatchRow(row_id, identifiers))
    return rows


def _candidate_ids(row_ids: Sequence[uuid.UUID]) -> list[str] | None:
    return [str(row_id) for row_id in row_ids] or None


def match_batch_photos(
    session: Session, batch: ImportBatch, rules: Mapping[str, NormalizationRule]
) -> int:
    """Store the proposed row of every verified, not manual photo of ``batch``.

    Returns how many photos were matched (0 when the batch is not validated yet or no longer
    admits changes). Any failure is raised as ``PhotoMatchingFailed`` with a clear message. The
    photos of a ``PHOTOS`` batch are matched with the pieces of the catalogue instead
    (``catalog_photos.match_catalog_batch``).
    """
    kind = batch_kind(batch)
    if batch.status not in MATCHING_STATES_BY_KIND[kind]:
        return 0
    if kind is ImportBatchKind.PHOTOS:
        try:
            return match_catalog_batch(session, batch, rules)
        except DomainError:
            raise
        except Exception as exc:
            logger.exception("Falló el emparejamiento de fotos del lote %s", batch.id)
            raise PhotoMatchingFailed(
                PHOTO_MATCHING_FAILED.format(error=type(exc).__name__)
            ) from exc
    try:
        rows = batch_rows(session, batch.id)
        if not rows:
            return 0
        photos = list(
            session.scalars(
                select(ImportPhoto)
                .where(
                    ImportPhoto.batch_id == batch.id,
                    ImportPhoto.status == ImportPhotoStatus.VERIFIED,
                )
                .order_by(ImportPhoto.relative_path, ImportPhoto.id)
            )
        )
        automatic = [photo for photo in photos if photo.match_status is not M.MANUAL]
        after_manual: dict[uuid.UUID, int] = {}
        for photo in photos:
            if photo.match_status is M.MANUAL and photo.row_id and photo.sort_key:
                after_manual[photo.row_id] = max(after_manual.get(photo.row_id, 0), photo.sort_key)
        proposals = match_photos(
            [BatchPhoto(photo.id, photo.relative_path) for photo in automatic],
            rows,
            rules,
            compile_camera_patterns(session_params(session).photo_camera_patterns),
        )
        for photo, proposal in zip(automatic, proposals, strict=True):
            values: dict[str, Any] = {
                "match_status": proposal.status,
                "match_source": proposal.source,
                "row_id": proposal.row_id,
                "candidate_row_ids": _candidate_ids(proposal.candidate_row_ids),
                "sort_key": (
                    proposal.sort_key + after_manual.get(proposal.row_id, 0)
                    if proposal.sort_key and proposal.row_id
                    else None
                ),
            }
            for name, value in values.items():
                if getattr(photo, name) != value:  # an unchanged photo is not written again
                    setattr(photo, name, value)
        session.flush()
    except DomainError:
        raise
    except Exception as exc:
        logger.exception("Falló el emparejamiento de fotos del lote %s", batch.id)
        raise PhotoMatchingFailed(PHOTO_MATCHING_FAILED.format(error=type(exc).__name__)) from exc
    return len(automatic)


_CLEARED = {
    "match_status": None,
    "match_source": None,
    "row_id": None,
    "candidate_row_ids": None,
    "sort_key": None,
    "piece_id": None,
    "candidate_piece_ids": None,
    "match_reason": None,
}


def reset_automatic_proposals(session: Session, batch_id: uuid.UUID) -> None:
    """Re-mapping invalidates the automatic proposals; manual ones stay (rows keep their id)."""
    session.execute(
        update(ImportPhoto)
        .where(ImportPhoto.batch_id == batch_id, ImportPhoto.match_status.in_(AUTOMATIC))
        .values(**_CLEARED)
    )


def detach_photos_from_rows(session: Session, batch_id: uuid.UUID) -> None:
    """Re-ingestion replaces the rows: no photo may keep pointing to them.

    Automatic proposals and manual assignments to a row are cleared (that row no longer exists),
    so the next validation proposes them again. A photo a person removed from its row stays
    ``MANUAL`` without a row, and a discarded photo stays discarded.
    """
    session.execute(
        update(ImportPhoto)
        .where(
            ImportPhoto.batch_id == batch_id,
            # Candidates only exist on automatic (AMBIGUOUS) photos, so they are covered too.
            or_(ImportPhoto.match_status.in_(AUTOMATIC), ImportPhoto.row_id.is_not(None)),
        )
        .values(**_CLEARED)
    )
