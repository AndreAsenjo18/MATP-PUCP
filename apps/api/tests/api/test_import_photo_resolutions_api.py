"""The same photo in another resolution in a photo-only batch, over HTTP.

Change importacion-fotos-a-catalogo, task 5.2 (design D6); spec importacion-datos, «Detección de
la misma foto en distinta resolución»: the thumbnail and the large copy of a camera photo, restoring
the discarded one, two views of one piece, the manual assignment that passes to the kept photo and
a photo verified without a hash. The photos go through the real upload and verification; the
storage is the in-memory double of the pipeline fixture. Synthetic images only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import update

from app.core.db import make_session_factory
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.imports.models import ImportBatch, ImportPhoto
from app.modules.imports.photo_resolutions import discard_lower_resolutions
from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import (
    by_path,
    collection,
    decide,
    pattern_jpeg,
    photo_batch,
    piece,
)
from tests.api.test_import_photos_api import _drain, _send, _verifiable


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def test_the_thumbnail_is_discarded_in_favour_of_the_large_copy_and_can_be_restored(
    pipeline: Pipeline, storage: Any
) -> None:
    batch_id = photo_batch(pipeline, "Resoluciones")
    _send(pipeline, batch_id, "FOTOS/82LF4169.jpg", pattern_jpeg(4169, 400, 300))
    _send(pipeline, batch_id, "FOTOS/ALTAS/82LF4169 copy.jpg", pattern_jpeg(4169, 2400, 1800))
    _drain(pipeline, storage)

    tray = by_path(pipeline, batch_id)
    small, large = tray["FOTOS/82LF4169.jpg"], tray["FOTOS/ALTAS/82LF4169 copy.jpg"]
    assert large["status"] == "VERIFIED"
    assert (large["width_px"], large["height_px"]) == (2400, 1800)
    assert small["status"] == "DISCARDED"
    assert small["same_as_photo_id"] == large["id"]
    with pipeline.session() as session:
        stored = session.get(ImportPhoto, uuid.UUID(small["id"]))
        assert stored is not None
        assert stored.rejection_reason == (
            "Versión de menor resolución de FOTOS/ALTAS/82LF4169 copy.jpg"
        )

    assert decide(pipeline, batch_id, "restore", [small["id"]]).status_code == 200
    _send(pipeline, batch_id, "FOTOS/otra.jpg", pattern_jpeg(77))  # a new group verifies
    _drain(pipeline, storage)

    restored = by_path(pipeline, batch_id)["FOTOS/82LF4169.jpg"]
    assert restored["status"] == "VERIFIED" and restored["piece_id"] is None
    assert restored["same_as_photo_id"] is None  # a person decided: not grouped again


def test_two_views_of_one_piece_are_not_the_same_photo(pipeline: Pipeline, storage: Any) -> None:
    cid = collection(pipeline, "Colección vistas", "VST")
    target = piece(pipeline, cid, ("I", "I-73966"), ("COLECCION", "VST 407"))
    batch_id = photo_batch(pipeline, "Vistas")
    _send(pipeline, batch_id, "I-73966 VST-407(1).jpg", pattern_jpeg(1))
    _send(pipeline, batch_id, "I-73966 VST-407(2).jpg", pattern_jpeg(2))
    _drain(pipeline, storage)

    tray = by_path(pipeline, batch_id)
    assert {item["status"] for item in tray.values()} == {"VERIFIED"}
    assert {item["piece_id"] for item in tray.values()} == {str(target)}
    assert sorted(item["sort_key"] for item in tray.values()) == [1, 2]


def test_a_manual_assignment_passes_to_the_kept_photo(pipeline: Pipeline, storage: Any) -> None:
    target = piece(pipeline, collection(pipeline, "Colección traspaso", "TRS"))
    batch_id = photo_batch(pipeline, "Traspaso")
    small = _send(pipeline, batch_id, "82LF5000.jpg", pattern_jpeg(5000, 300, 200))
    _drain(pipeline, storage)
    decide(pipeline, batch_id, "assign", [small], piece_id=target)

    _send(pipeline, batch_id, "ALTAS/82LF5000 copy.jpg", pattern_jpeg(5000, 1500, 1000))
    _drain(pipeline, storage)

    tray = by_path(pipeline, batch_id)
    assert tray["82LF5000.jpg"]["status"] == "DISCARDED"
    assert tray["ALTAS/82LF5000 copy.jpg"]["piece_id"] == str(target)
    assert tray["ALTAS/82LF5000 copy.jpg"]["match_status"] == "MANUAL"


def test_a_photo_without_hash_gets_it_from_its_thumbnail(pipeline: Pipeline, storage: Any) -> None:
    batch_id = photo_batch(pipeline, "Sin huella")
    small = _send(pipeline, batch_id, "82LF6000.jpg", pattern_jpeg(6000, 360, 240))
    large = _send(pipeline, batch_id, "ALTAS/82LF6000 copy.jpg", pattern_jpeg(6000, 1800, 1200))
    # Verified before migration 0019 (no hash) and not grouped then.
    with pipeline.session() as session:
        session.execute(
            update(ImportPhoto)
            .where(ImportPhoto.id.in_([uuid.UUID(small), uuid.UUID(large)]))
            .values(status="UPLOADED")
        )
        session.commit()
    _drain(pipeline, storage)
    with pipeline.session() as session:
        session.execute(
            update(ImportPhoto)
            .where(ImportPhoto.batch_id == uuid.UUID(batch_id))
            .values(status="VERIFIED", perceptual_hash=None, same_as_photo_id=None)
        )
        session.commit()

    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="prueba", origin_ref=batch_id)
    with make_session_factory(pipeline.engine)() as session, audit_context(session, context):
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        discarded = discard_lower_resolutions(session, storage, batch, 4)
        session.commit()

    assert discarded == 1
    assert by_path(pipeline, batch_id)["82LF6000.jpg"]["status"] == "DISCARDED"
