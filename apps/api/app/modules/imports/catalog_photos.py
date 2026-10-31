"""Proposed pieces of the photos of a ``PHOTOS`` batch (change importacion-fotos-a-catalogo, D3).

``match_catalog_batch`` builds the catalogue index once per run, reads the folders of the batch
(range, proposed collection and reading rule) and stores the proposal of every verified photo
that a person has not decided. Like the matching with rows (``photos.match_batch_photos``) it is
idempotent and never changes a manual assignment, a photo a person removed from its piece nor a
discarded photo (spec «Asignación manual de fotos a piezas existentes»). Nothing reaches the
catalogue until the batch is approved and applied.
"""

import uuid
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    CollectionAcronymAlias,
    IdentifierType,
    NormalizationRule,
    PieceIdentifier,
)
from app.modules.identification.params import session_params
from app.modules.imports.catalog_photo_matching import (
    CatalogIndex,
    CatalogPhoto,
    CatalogPiece,
    CatalogProposal,
    CollectionRef,
    FolderInfo,
    PhotoReading,
    analyze_folders,
    match_catalog_photos,
)
from app.modules.imports.models import ImportBatch, ImportPhoto, ImportPhotoStatus
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.photo_matching import compile_camera_patterns


def catalog_index(session: Session) -> CatalogIndex:
    """Current identifiers of the pieces that are neither retired nor merged (D3): one query."""
    rows = session.execute(
        select(
            Piece.id,
            Piece.collection_id,
            PieceIdentifier.identifier_type_code,
            PieceIdentifier.normalized_value,
        )
        .join(PieceIdentifier, PieceIdentifier.piece_id == Piece.id)
        .where(
            Piece.deleted_at.is_(None),
            Piece.merged_into_id.is_(None),
            PieceIdentifier.deleted_at.is_(None),
            PieceIdentifier.is_current.is_(True),
            PieceIdentifier.normalized_value.is_not(None),
        )
    ).all()
    collections: dict[uuid.UUID, uuid.UUID | None] = {}
    identifiers: dict[uuid.UUID, list[tuple[str, str]]] = defaultdict(list)
    for piece_id, collection_id, type_code, value in rows:
        collections[piece_id] = collection_id
        identifiers[piece_id].append((type_code, value))
    return CatalogIndex(
        CatalogPiece(piece_id, collections[piece_id], tuple(values))
        for piece_id, values in identifiers.items()
    )


def collection_refs(session: Session) -> list[CollectionRef]:
    """Active collections with their current and historical acronyms (D5)."""
    aliases: dict[uuid.UUID, list[str]] = defaultdict(list)
    for collection_id, alias in session.execute(
        select(CollectionAcronymAlias.collection_id, CollectionAcronymAlias.alias_normalized).where(
            CollectionAcronymAlias.deleted_at.is_(None)
        )
    ):
        aliases[collection_id].append(alias)
    return [
        CollectionRef(
            collection_id,
            name,
            tuple(item for item in (acronym, *aliases[collection_id]) if item),
        )
        for collection_id, name, acronym in session.execute(
            select(Collection.id, Collection.name, Collection.acronym_normalized)
            .where(Collection.deleted_at.is_(None), Collection.is_active.is_(True))
            .order_by(Collection.name)
        )
    ]


def active_types(session: Session) -> frozenset[str]:
    """Identifier types a template may name (D4)."""
    return frozenset(
        session.scalars(
            select(IdentifierType.code).where(
                IdentifierType.deleted_at.is_(None), IdentifierType.is_active.is_(True)
            )
        )
    )


def batch_folders(session: Session, batch: ImportBatch) -> dict[str, FolderInfo]:
    """Every folder of the batch with its range, proposed collection and rule (D4, D5, D11)."""
    paths = session.scalars(
        select(ImportPhoto.relative_path).where(ImportPhoto.batch_id == batch.id)
    )
    return analyze_folders(
        paths, collection_refs(session), PhotoReading.from_json(batch.photo_reading)
    )


def _candidates(piece_ids: Sequence[uuid.UUID]) -> list[str] | None:
    return [str(piece_id) for piece_id in piece_ids] or None


def match_catalog_batch(
    session: Session,
    batch: ImportBatch,
    rules: Mapping[str, NormalizationRule],
    *,
    folder: str | None = None,
    preset: Mapping[uuid.UUID, CatalogProposal] | None = None,
) -> int:
    """Store the proposed piece of every verified photo of ``batch`` a person did not decide;
    with ``folder``, only those inside it (a new reading rule, D4). Returns how many."""
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
    if folder:
        automatic = [photo for photo in automatic if photo.relative_path.startswith(f"{folder}/")]
    if not automatic:
        return 0
    after_manual: dict[uuid.UUID, int] = {}
    for photo in photos:
        if photo.match_status is M.MANUAL and photo.piece_id and photo.sort_key:
            after_manual[photo.piece_id] = max(after_manual.get(photo.piece_id, 0), photo.sort_key)
    if folder:  # the photos of the piece outside the folder keep their place
        for photo in photos:
            if photo.piece_id and photo.sort_key and photo not in automatic:
                after_manual[photo.piece_id] = max(
                    after_manual.get(photo.piece_id, 0), photo.sort_key
                )
    reading = PhotoReading.from_json(batch.photo_reading)
    proposals = match_catalog_photos(
        [CatalogPhoto(photo.id, photo.relative_path) for photo in automatic],
        catalog_index(session),
        batch_folders(session, batch),
        rules=rules,
        valid_types=active_types(session),
        camera_patterns=compile_camera_patterns(session_params(session).photo_camera_patterns),
        preset=preset,
        default_rule=reading.default,
    )
    for photo, proposal in zip(automatic, proposals, strict=True):
        values: dict[str, Any] = {
            "match_status": proposal.status,
            "match_source": proposal.source,
            "piece_id": proposal.piece_id,
            "candidate_piece_ids": _candidates(proposal.candidate_piece_ids),
            "match_reason": proposal.reason,
            "sort_key": (
                proposal.sort_key + after_manual.get(proposal.piece_id, 0)
                if proposal.sort_key and proposal.piece_id
                else None
            ),
        }
        for name, value in values.items():
            if getattr(photo, name) != value:  # an unchanged photo is not written again
                setattr(photo, name, value)
    session.flush()
    return len(automatic)
