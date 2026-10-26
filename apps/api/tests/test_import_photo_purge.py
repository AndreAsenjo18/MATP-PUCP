"""Purge of batch photos past the retention period (importacion-masiva-fotografias 2.3, D7).

Spec importacion-datos, «Fotografías del lote con subida reanudable»; RN-005: only files that
never became catalogue information are deleted, and every ``import_photo`` row stays. Batches and
photos are inserted directly with their final state. Synthetic data only (RNF-014).
"""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid, utcnow
from app.models import AppUser
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.photo_purge import ACTOR, PURGE_MARK, object_keys, purge_photos
from app.modules.media.models import MediaAsset
from tests.conftest import ActAs

RETENTION = 30
OLD = timedelta(days=RETENTION + 1)


class Storage:
    """In-memory storage with the objects every photo leaves behind."""

    def __init__(self) -> None:
        self.objects: set[str] = set()

    def delete_pending(self, key: str) -> None:
        self.objects.discard(key)


@pytest.fixture
def storage() -> Storage:
    return Storage()


@pytest.fixture
def make_photo(session: Session, act_as: ActAs, users: dict[str, AppUser], storage: Storage):  # type: ignore[no-untyped-def]
    """A photo of a new batch in ``batch_status``, last touched ``age`` ago."""

    def make(batch_status: S, photo_status: P, *, age: timedelta = OLD) -> ImportPhoto:
        batch_id, photo_id = new_uuid(), new_uuid()
        with act_as("CATALOGUER"):
            session.add(
                ImportBatch(
                    id=batch_id,
                    source_name="Sábana sintética de purga",
                    file_name=f"purga-{batch_id.hex[:6]}.csv",
                    status=batch_status,
                    uploaded_by_id=users["CATALOGUER"].id,
                )
            )
            session.flush()
            photo = ImportPhoto(
                id=photo_id,
                batch_id=batch_id,
                relative_path=f"purga/{photo_id.hex}.jpg",
                original_filename=f"{photo_id.hex}.jpg",
                content_sha256=photo_id.hex * 2,
                size_bytes=2048,
                content_type="image/jpeg",
                storage_prefix=f"media/{photo_id}/",
                status=photo_status,
            )
            session.add(photo)
            session.commit()
        stamp = utcnow() - age
        session.execute(
            update(ImportBatch).where(ImportBatch.id == batch_id).values(updated_at=stamp)
        )
        session.execute(
            update(ImportPhoto).where(ImportPhoto.id == photo_id).values(updated_at=stamp)
        )
        session.commit()
        session.expire_all()
        storage.objects.update(object_keys(photo))
        return photo

    return make


def _purge(session: Session, storage: Storage) -> list[uuid.UUID]:
    result = purge_photos(session, storage, retention_days=RETENTION)  # type: ignore[arg-type]
    session.commit()
    return [photo.id for photo in result.photos]


def test_old_photos_of_an_abandoned_batch_lose_their_files_and_keep_their_row(
    session: Session, storage: Storage, make_photo
) -> None:  # type: ignore[no-untyped-def]
    photo = make_photo(S.ABANDONED, P.VERIFIED)

    purged = _purge(session, storage)

    assert purged == [photo.id]
    assert not storage.objects & set(object_keys(photo))
    kept = session.get(ImportPhoto, photo.id)
    assert kept is not None and kept.status is P.VERIFIED
    assert PURGE_MARK in (kept.rejection_reason or "")
    entry = session.scalars(
        select(AuditLog).where(AuditLog.entity_id == photo.id, AuditLog.field == "rejection_reason")
    ).one()
    assert (entry.origin, entry.actor_label) == (AuditOrigin.SYSTEM, ACTOR)


def test_a_discarded_photo_of_a_closed_batch_is_purged(
    session: Session, storage: Storage, make_photo
) -> None:  # type: ignore[no-untyped-def]
    photo = make_photo(S.APPLIED, P.DISCARDED)

    assert _purge(session, storage) == [photo.id]


def test_applied_photos_live_batches_and_recent_ones_are_not_touched(
    session: Session, storage: Storage, make_photo
) -> None:  # type: ignore[no-untyped-def]
    untouched = [
        make_photo(S.APPLIED, P.APPLIED),  # its upload is the file of a media asset
        make_photo(S.IN_PREVIEW, P.DISCARDED),  # the batch is still in progress
        make_photo(S.VALIDATED, P.PENDING_UPLOAD),
        make_photo(S.ABANDONED, P.VERIFIED, age=timedelta(days=RETENTION - 1)),
    ]
    before = set(storage.objects)

    assert _purge(session, storage) == []
    assert storage.objects == before
    assert all(session.get(ImportPhoto, photo.id).rejection_reason is None for photo in untouched)  # type: ignore[union-attr]


def test_a_photo_whose_upload_a_media_asset_points_to_is_kept(
    session: Session, storage: Storage, act_as: ActAs, make_photo
) -> None:  # type: ignore[no-untyped-def]
    """As after a batch rollback: the retired asset still points to the upload (RN-005)."""
    photo = make_photo(S.ABANDONED, P.VERIFIED)
    with act_as("ADMIN"):
        piece = create_piece(
            session, denomination="Pieza sintética", tenure_regime=TenureRegime.OWNED
        )
        session.add(
            MediaAsset(
                id=new_uuid(),
                piece_id=piece.id,
                storage_key=object_keys(photo)[0],
                original_filename=photo.original_filename,
                content_type="image/jpeg",
                size_bytes=2048,
                content_sha256=photo.content_sha256,
            )
        )
        session.commit()

    assert _purge(session, storage) == []
    assert set(object_keys(photo)) <= storage.objects


def test_running_it_again_purges_nothing_new(
    session: Session, storage: Storage, make_photo
) -> None:  # type: ignore[no-untyped-def]
    make_photo(S.ABANDONED, P.DISCARDED)
    assert len(_purge(session, storage)) == 1

    assert _purge(session, storage) == []
