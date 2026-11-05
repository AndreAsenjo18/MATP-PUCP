"""Applying an import batch with its photos (change importacion-masiva-fotografias, 5.2 and 5.3).

Spec importacion-datos, «Aplicación y reversión conjunta de piezas y fotografías»; design D5.
The batch goes through the real stages over HTTP: upload, mapping, validation, photos uploaded,
completed and verified, approval and application. The storage is the in-memory double of the
pipeline fixture. Every test builds its own batch with codes of its own. Synthetic data only
(RNF-014).
"""

import hashlib
import uuid
from dataclasses import dataclass
from typing import Any

import pytest
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.imports.apply import _delete_uploads_after_commit
from app.modules.imports.models import ImportBatch, ImportPhoto, ImportRow
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.media import derivatives
from app.modules.media.models import MediaAsset
from app.modules.media.service import UNSPECIFIED_VIEW_TYPE
from tests.api.conftest import Pipeline
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _jpeg, _send, _verifiable
from tests.api.test_import_pipeline_api import BASE, get_batch, put_mapping, upload, validate

MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "RÉGIMEN", "target_field": "tenure_regime"},
    ]
}


@dataclass
class Lot:
    batch_id: str
    tag: str
    photos: dict[str, str]  # file name -> photo id


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def lot_with_photos(pipeline: Pipeline, storage: Any) -> Lot:
    """Row 2 (owned, three photos named by its code I) and row 3 (loan for use, one photo)."""
    tag = uuid.uuid4().hex[:8]
    code = int(tag, 16) % 90000 + 10000
    content = (
        "DENOMINACIÓN;CÓDIGOS;RÉGIMEN\n"
        f"Toro con fotos {tag};I-{code};Propiedad\n"
        f"Manta en comodato {tag};AJB {code};Comodato\n"
    ).encode()
    batch_id = upload(pipeline.client, f"fotos-{tag}.csv", content)["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    names = [f"I {code}.jpg", f"I {code} (2).jpg", f"I {code} (3).jpg", f"AJB {code}.jpg"]
    photos = {
        name: _send(pipeline, batch_id, f"{tag}/{name}", _jpeg(40 + i, 30))
        for i, name in enumerate(names)
    }
    _drain(pipeline, storage)  # verified photos are matched to their rows right away (3.3)
    return Lot(batch_id, tag, photos)


def approve(pipeline: Pipeline, batch_id: str) -> dict[str, Any]:
    response = confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    assert response.status_code == 200, response.text
    return get_batch(pipeline.client, batch_id)


def pieces_of(pipeline: Pipeline, batch_id: str) -> dict[int, Piece | None]:
    with pipeline.session() as session:
        rows = session.scalars(
            select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch_id))
        ).all()
        return {
            row.source_row_number: session.scalar(
                select(Piece)
                .where(Piece.id == row.target_piece_id)
                .execution_options(**{INCLUDE_DELETED: True})
            )
            for row in rows
        }


def assets_of(pipeline: Pipeline, piece_id: uuid.UUID) -> list[MediaAsset]:
    with pipeline.session() as session:
        return list(
            session.scalars(
                select(MediaAsset)
                .where(MediaAsset.piece_id == piece_id)
                .order_by(MediaAsset.sort_order)
                .execution_options(**{INCLUDE_DELETED: True})
            )
        )


def photo_rows(pipeline: Pipeline, lot: Lot) -> dict[str, ImportPhoto]:
    with pipeline.session() as session:
        return {
            name: session.get(ImportPhoto, uuid.UUID(photo_id))  # type: ignore[misc]
            for name, photo_id in lot.photos.items()
        }


def unspecified_terms(pipeline: Pipeline) -> list[Term]:
    with pipeline.session() as session:
        return list(
            session.scalars(
                select(Term)
                .join(Vocabulary)
                .where(
                    Vocabulary.code == VocabularyCode.PHOTO_VIEW_TYPE,
                    Term.code == UNSPECIFIED_VIEW_TYPE,
                )
                .execution_options(**{INCLUDE_DELETED: True})
            )
        )


def test_applying_a_batch_registers_its_photos_on_the_pieces(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = lot_with_photos(pipeline, storage)
    (seeded,) = unspecified_terms(pipeline)

    assert approve(pipeline, lot.batch_id)["status"] == "APPLIED"

    pieces = pieces_of(pipeline, lot.batch_id)
    toro, manta = pieces[2], pieces[3]
    assert toro is not None and manta is not None
    photos = photo_rows(pipeline, lot)
    code = next(iter(lot.photos)).removesuffix(".jpg")
    owned = assets_of(pipeline, toro.id)
    assert [asset.original_filename for asset in owned] == [
        f"{code}.jpg",
        f"{code} (2).jpg",
        f"{code} (3).jpg",
    ]
    assert [asset.is_primary for asset in owned] == [True, False, False]  # lowest sort_key
    first = photos[f"{code}.jpg"]
    assert owned[0].storage_key == f"media/{first.id}/upload.jpeg"
    assert {asset.view_type_term_id for asset in owned} == {seeded.id}
    assert all(asset.usage_restriction_term_id is None for asset in owned)
    (loaned,) = assets_of(pipeline, manta.id)
    assert loaned.restriction_note is not None  # «No publicar» inherited (RN-008)
    assert {photo.status for photo in photos.values()} == {P.APPLIED}
    assert {photo.media_asset_id for photo in photos.values()} == {
        asset.id for asset in [*owned, loaned]
    }
    assert len(unspecified_terms(pipeline)) == 1  # the seeded term is used, none is created


def test_a_missing_photo_fails_the_batch_before_anything_is_written(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = lot_with_photos(pipeline, storage)
    missing = next(name for name in lot.photos if "(2)" in name)
    del pipeline.stored[f"media/{lot.photos[missing]}/upload.jpeg"]

    batch = approve(pipeline, lot.batch_id)

    assert batch["status"] == "FAILED_APPLY"
    assert batch["status_reason"].startswith("Fila 2: la foto")
    assert f"{lot.tag}/{missing}" in batch["status_reason"]
    with pipeline.session() as session:
        created = session.scalars(
            select(Piece)
            .where(Piece.denomination.contains(lot.tag))
            .execution_options(**{INCLUDE_DELETED: True})
        ).all()
    assert created == []  # no piece of the batch, not even the rows before the photo
    assert {photo.status for photo in photo_rows(pipeline, lot).values()} == {P.VERIFIED}
    assert all(photo.media_asset_id is None for photo in photo_rows(pipeline, lot).values())


def test_rolling_back_a_batch_with_photos(pipeline: Pipeline, storage: Any) -> None:
    """Applied and then reverted with the batch rollback (importacion-pipeline-reconciliacion 5.2).

    Task 5.3: the photos are registered in the change set of the batch, so the rollback retires
    them logically with the pieces and keeps every file (RN-005).
    """
    lot = lot_with_photos(pipeline, storage)
    approve(pipeline, lot.batch_id)
    toro = pieces_of(pipeline, lot.batch_id)[2]
    assert toro is not None
    stored_before = set(pipeline.stored)

    response = pipeline.login("ADMIN").post(
        f"{BASE}/{lot.batch_id}/rollback", json={"reason": f"Prueba de reversión {lot.tag}"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "REVERTED"
    assert pieces_of(pipeline, lot.batch_id)[2].deleted_at is not None  # type: ignore[union-attr]
    assets = assets_of(pipeline, toro.id)
    assert len(assets) == 3
    assert all(asset.deleted_at is not None for asset in assets)  # retired logically (RN-005)
    assert set(pipeline.stored) >= stored_before  # no file is deleted
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(lot.batch_id))
        assert batch is not None and batch.change_set_id is not None
        created_in = set(
            session.scalars(
                select(AuditLog.change_set_id).where(
                    AuditLog.entity_type == MediaAsset.__tablename__,
                    AuditLog.entity_id.in_([asset.id for asset in assets]),
                    AuditLog.action == AuditAction.CREATE,
                )
            )
        )
    assert created_in == {batch.change_set_id}  # the photos travel in the batch change set
    # The batch photos go back to where they were before applying, ready to apply again.
    photos = photo_rows(pipeline, lot).values()
    assert {(photo.status, photo.media_asset_id) for photo in photos} == {(P.VERIFIED, None)}


# ------------------------------------------------- MEDIA_KEEP_ORIGINALS (task 5.4; design D6)
@pytest.fixture
def without_originals(pipeline: Pipeline, storage: Any, monkeypatch: pytest.MonkeyPatch) -> Any:
    """`MEDIA_KEEP_ORIGINALS=false` and a storage double that can delete objects."""
    monkeypatch.setattr(pipeline.client.app.state.settings, "media_keep_originals", False)  # type: ignore[attr-defined]
    monkeypatch.setattr(storage, "delete_pending", lambda key: pipeline.stored.pop(key, None))
    return storage


def test_with_originals_each_photo_keeps_its_original_and_both_derivatives(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = lot_with_photos(pipeline, storage)

    assert approve(pipeline, lot.batch_id)["status"] == "APPLIED"

    for photo in photo_rows(pipeline, lot).values():
        prefix = photo.storage_prefix
        assert {f"{prefix}upload.jpeg", f"{prefix}thumb.webp", f"{prefix}display.webp"} <= set(
            pipeline.stored
        )
    toro = pieces_of(pipeline, lot.batch_id)[2]
    assert toro is not None
    assert all(
        "original" not in (asset.extra_metadata or {}) for asset in assets_of(pipeline, toro.id)
    )


def test_without_originals_the_display_copy_is_the_file_and_the_upload_goes(
    pipeline: Pipeline, without_originals: Any
) -> None:
    lot = lot_with_photos(pipeline, without_originals)

    assert approve(pipeline, lot.batch_id)["status"] == "APPLIED"

    photos = {photo.media_asset_id: photo for photo in photo_rows(pipeline, lot).values()}
    pieces = [piece for piece in pieces_of(pipeline, lot.batch_id).values() if piece is not None]
    assets = [asset for piece in pieces for asset in assets_of(pipeline, piece.id)]
    assert len(assets) == len(lot.photos)
    for asset in assets:
        photo = photos[asset.id]
        display = pipeline.stored[f"{photo.storage_prefix}display.webp"]
        assert asset.storage_key == f"{photo.storage_prefix}display.webp"
        assert (asset.content_type, asset.size_bytes) == ("image/webp", len(display))
        assert asset.content_sha256 == hashlib.sha256(display).hexdigest()
        assert asset.extra_metadata["original"] == {
            "content_type": "image/jpeg",
            "size_bytes": photo.size_bytes,
            "content_sha256": photo.content_sha256,
        }
        assert f"{photo.storage_prefix}upload.jpeg" not in pipeline.stored  # after the commit
        assert f"{photo.storage_prefix}thumb.webp" in pipeline.stored


def test_without_originals_a_missing_display_copy_fails_the_batch_and_keeps_the_upload(
    pipeline: Pipeline, without_originals: Any
) -> None:
    lot = lot_with_photos(pipeline, without_originals)
    name = next(name for name in lot.photos if "(3)" in name)
    del pipeline.stored[f"media/{lot.photos[name]}/display.webp"]

    batch = approve(pipeline, lot.batch_id)

    assert batch["status"] == "FAILED_APPLY"
    assert batch["status_reason"].startswith("Fila 2: la versión de visualización de la foto")
    assert {f"media/{photo_id}/upload.jpeg" for photo_id in lot.photos.values()} <= set(
        pipeline.stored
    )
    assert {photo.status for photo in photo_rows(pipeline, lot).values()} == {P.VERIFIED}


def test_a_photo_whose_derivatives_cannot_be_made_is_rejected(
    pipeline: Pipeline, storage: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Scenario «Derivado imposible de generar»: never available without its display copy."""
    lot = lot_with_photos(pipeline, storage)
    batch_id = lot.batch_id

    def broken(_data: bytes, _max_dim: int) -> bytes:
        raise OSError("imagen truncada (sintética)")

    monkeypatch.setattr(derivatives, "_resize_image", broken)
    photo_id = _send(pipeline, batch_id, f"{lot.tag}/rota.jpg", _jpeg(70, 50))
    _drain(pipeline, storage)

    with pipeline.session() as session:
        photo = session.get(ImportPhoto, uuid.UUID(photo_id))
    assert photo is not None and photo.status is P.REJECTED
    assert (photo.rejection_reason or "").startswith("No se pudo procesar la imagen")


def test_the_uploads_are_kept_when_the_transaction_rolls_back(pipeline: Pipeline) -> None:
    deleted: list[str] = []

    class Recorder:
        def delete_pending(self, key: str) -> None:
            deleted.append(key)

    with pipeline.session() as session:
        session.scalar(select(ImportPhoto.id).limit(1))  # the stage always has its transaction
        _delete_uploads_after_commit(session, Recorder(), ["media/x/upload.jpeg"])  # type: ignore[arg-type]
        session.rollback()
        session.commit()  # a later commit of the same session, as when the failure is recorded
    assert deleted == []

    with pipeline.session() as session:
        _delete_uploads_after_commit(session, Recorder(), ["media/y/upload.jpeg"])  # type: ignore[arg-type]
        session.commit()
    assert deleted == ["media/y/upload.jpeg"]
