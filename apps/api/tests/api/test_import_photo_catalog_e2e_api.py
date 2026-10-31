"""End to end: the synthetic photo archive loaded into the seeded catalogue (change
importacion-fotos-a-catalogo, task 8.1; RF-046, RNF-014).

The photos of ``app.seed.catalog_photos`` (also written to ``data/fixtures/fotos_catalogo``) go
through the real upload, verification and matching of a photo-only batch on SQLite with the
synthetic seed; then the reading of one folder is set to the template ``{n}-{*}``, the
correspondences list is uploaded, the warning before approval is checked and the batch is applied.
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import select

from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import PieceIdentifier
from app.modules.media.models import MediaAsset
from app.seed.catalog_photos import PHOTOS, correspondences_csv, picture
from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import by_path, photo_batch
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _send, _verifiable
from tests.api.test_import_pipeline_api import BASE, get_batch


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def pieces_by_code(pipeline: Pipeline) -> dict[str, str]:
    with pipeline.session() as session:
        rows = session.execute(
            select(PieceIdentifier.normalized_value, PieceIdentifier.piece_id).where(
                PieceIdentifier.identifier_type_code == "COLECCION",
                PieceIdentifier.is_current.is_(True),
            )
        ).all()
    return {value: str(piece_id) for value, piece_id in rows if value}


def collection_id(pipeline: Pipeline, acronym: str) -> str:
    with pipeline.session() as session:
        query = select(Collection.id).where(Collection.acronym_normalized == acronym)
        found = session.scalar(query)
    assert found is not None
    return str(found)


def test_the_synthetic_archive_reaches_its_pieces(pipeline: Pipeline, storage: Any) -> None:
    codes = pieces_by_code(pipeline)
    batch_id = photo_batch(pipeline, "Archivo fotográfico sintético")
    for photo in PHOTOS:
        _send(pipeline, batch_id, photo.path, picture(photo.seed, photo.size))
    _drain(pipeline, storage)
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"

    # Automatic reading: F1, F2, F3, the range folder and F4 with the folder's collection.
    tray = by_path(pipeline, batch_id)
    for photo in PHOTOS:
        if photo.how in ("automática", "colección de la carpeta"):
            assert tray[photo.path]["piece_id"] == codes[photo.expected], photo.path  # type: ignore[index]
    assert tray["Fotos MBB/MBB 001 - 100/IMG_0001.jpg"]["piece_id"] is None  # never MBB 1
    assert tray["FOTOS 001-100/004-3269.jpg"]["match_reason"] == "camera_name"
    assert tray["82LF4169.jpg"]["status"] == "DISCARDED"
    assert tray["82LF4169.jpg"]["same_as_photo_id"] == tray["ALTAS/82LF4169 copy.jpg"]["id"]

    # F5: the template with the collection MMZ.
    mmz = collection_id(pipeline, "MMZ")
    rule = {"mode": "template", "template": "{n}-{*}", "collection_id": mmz}
    saved = pipeline.client.put(
        f"{BASE}/{batch_id}/photos/reading", json={"folder": "FOTOS 001-100", "rule": rule}
    )
    assert saved.status_code == 200, saved.text
    # F6: the correspondences list.
    listed = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/correspondences",
        files={"file": ("correspondencias.csv", correspondences_csv(), "text/csv")},
    )
    assert listed.status_code == 200, listed.text
    assert (listed.json()["applied"], listed.json()["no_photo"]) == (1, 1)

    tray = by_path(pipeline, batch_id)
    for photo in PHOTOS:
        if photo.expected is not None:
            assert tray[photo.path]["piece_id"] == codes[photo.expected], photo.path

    approval = summary(pipeline, batch_id)["photos"]
    expected = [photo for photo in PHOTOS if photo.expected is not None]
    assert approval["to_apply"] == len(expected)
    assert approval["unassigned"] == 2  # IMG_0001 and DSC_0001: never a piece, never created

    token = summary(pipeline, batch_id)["summary_token"]
    assert confirm(pipeline, batch_id, token).status_code == 200
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"
    with pipeline.session() as session:
        applied = session.scalars(
            select(MediaAsset.extra_metadata).join(Piece, Piece.id == MediaAsset.piece_id)
        ).all()
    from_batch = [meta for meta in applied if meta and meta.get("import_batch_id") == batch_id]
    assert len(from_batch) == len(expected)
    altas = next(meta for meta in from_batch if meta["relative_path"] == "ALTAS/82LF4169 copy.jpg")
    assert altas["replaced_lower_resolution"] == ["82LF4169.jpg"]
    assert uuid.UUID(batch_id)
