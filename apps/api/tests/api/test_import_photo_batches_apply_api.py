"""Approving, applying and reverting a photo-only batch over HTTP.

Change importacion-fotos-a-catalogo, tasks 6.1 and 6.2 (design D9); spec importacion-datos, «Lote
de solo fotografías para piezas existentes», scenarios «Carga del archivo fotográfico…»,
«Aplicación y reversión del lote de fotos» and «Foto sin pieza al aprobar». The photos go through
the real upload, verification and matching; the storage is the in-memory double of the pipeline
fixture. Every test builds its own collection and batch. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.media.models import MediaAsset
from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import collection, media, pattern_jpeg, photo_batch, piece
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _jpeg, _send, _verifiable
from tests.api.test_import_pipeline_api import BASE, get_batch


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


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


def lot(pipeline: Pipeline, storage: Any, acronym: str) -> dict[str, Any]:
    """Two pieces of a new collection, the first with a photo already; photos for both and one
    with a camera name, that finds no piece."""
    cid = collection(pipeline, f"Colección {acronym}", acronym)
    pucp = str(60000 + sum(ord(c) for c in acronym))
    first = piece(pipeline, cid, ("COLECCION", f"{acronym} 1"), ("PUCP", pucp))
    second = piece(pipeline, cid, ("COLECCION", f"{acronym} 2"))
    old = media(pipeline, first, "0" * 64)
    batch_id = photo_batch(pipeline, f"Archivo fotográfico {acronym}")
    folder = f"Fotos {acronym}"
    sent = {
        name: _send(pipeline, batch_id, f"{folder}/{name}", pattern_jpeg(int(pucp) * 10 + i))
        for i, name in enumerate(
            [
                f"{acronym} 001 - PUCP {pucp} (1).JPG",
                f"{acronym} 001 - PUCP {pucp} (2).JPG",
                "2.JPG",
                "IMG_0001.jpg",
            ]
        )
    }
    _drain(pipeline, storage)
    return {
        "batch_id": batch_id,
        "first": first,
        "second": second,
        "old": old,
        "sent": sent,
        "pucp": pucp,
    }


def test_the_warning_before_approving_counts_what_stays_out(
    pipeline: Pipeline, storage: Any
) -> None:
    data = lot(pipeline, storage, "AVS")

    batch = get_batch(pipeline.client, data["batch_id"])

    assert batch["status"] == "IN_PREVIEW"
    photos = batch["approval_summary"]["photos"]
    assert photos["to_apply"] == 3 and photos["pieces"] == 2
    assert photos["unassigned"] == 1  # the camera name: never a piece, never created
    assert photos["collections_pending"] == 1  # «Fotos AVS» proposed, nobody confirmed it
    assert photos["duplicates_pending"] == 0 and photos["uploading"] == 0


def test_applying_puts_each_photo_after_the_ones_the_piece_had_and_reverting_keeps_them(
    pipeline: Pipeline, storage: Any
) -> None:
    data = lot(pipeline, storage, "APL")
    token = summary(pipeline, data["batch_id"])["summary_token"]

    response = confirm(pipeline, data["batch_id"], token)

    assert response.status_code == 200, response.text
    batch = get_batch(pipeline.client, data["batch_id"])
    assert batch["status"] == "APPLIED", batch["status_reason"]
    first = assets_of(pipeline, data["first"])
    assert [asset.id == data["old"] for asset in first] == [True, False, False]
    assert [asset.original_filename for asset in first[1:]] == [
        f"APL 001 - PUCP {data['pucp']} (1).JPG",
        f"APL 001 - PUCP {data['pucp']} (2).JPG",
    ]
    assert [asset.original_filename for asset in assets_of(pipeline, data["second"])] == ["2.JPG"]
    with pipeline.session() as session:
        camera = session.get(ImportPhoto, uuid.UUID(data["sent"]["IMG_0001.jpg"]))
        assert camera is not None and camera.status is P.VERIFIED  # not applied, still there
        stored = session.get(ImportBatch, uuid.UUID(data["batch_id"]))
        assert stored is not None and stored.counts["APPLIED_PHOTOS"] == 3  # type: ignore[index]

    reverted = pipeline.login("ADMIN").post(
        f"{BASE}/{data['batch_id']}/rollback", json={"reason": "Prueba de reversión de fotos"}
    )

    assert reverted.status_code == 200, reverted.text
    first = assets_of(pipeline, data["first"])
    assert first[0].deleted_at is None  # the photo the piece had stays
    assert all(asset.deleted_at is not None for asset in first[1:])
    with pipeline.session() as session:
        created = set(
            session.scalars(
                select(AuditLog.change_set_id).where(
                    AuditLog.entity_type == MediaAsset.__tablename__,
                    AuditLog.entity_id.in_([asset.id for asset in first[1:]]),
                    AuditLog.action == AuditAction.CREATE,
                )
            )
        )
        assert created == {stored.change_set_id}


def test_a_missing_object_fails_the_batch_before_anything_is_written(
    pipeline: Pipeline, storage: Any
) -> None:
    data = lot(pipeline, storage, "FLT")
    missing = data["sent"]["2.JPG"]
    del pipeline.stored[f"media/{missing}/upload.jpeg"]

    confirm(pipeline, data["batch_id"], summary(pipeline, data["batch_id"])["summary_token"])

    batch = get_batch(pipeline.client, data["batch_id"])
    assert batch["status"] == "FAILED_APPLY"
    assert "2.JPG" in batch["status_reason"]
    assert [asset.id for asset in assets_of(pipeline, data["first"])] == [data["old"]]
    assert assets_of(pipeline, data["second"]) == []


def test_a_batch_without_assigned_photos_cannot_be_approved(
    pipeline: Pipeline, storage: Any
) -> None:
    batch_id = photo_batch(pipeline, "Solo nombres de cámara")
    _send(pipeline, batch_id, "ALTAS/IMG_0002.jpg", _jpeg(33, 44))
    _drain(pipeline, storage)

    token = summary(pipeline, batch_id)["summary_token"]
    response = confirm(pipeline, batch_id, token)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "nothing_to_apply"
