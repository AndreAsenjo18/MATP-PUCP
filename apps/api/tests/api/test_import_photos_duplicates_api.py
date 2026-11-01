"""A photo repeated on the piece a row updates (change importacion-masiva-fotografias, task 4.3).

Spec importacion-datos, «Previsualización del lote con miniaturas y conteos de fotos», scenario
«Foto repetida en una pieza existente»: a photo of an update row with the same SHA-256 as a photo
the piece already has is marked as repeated and is not applied unless a person confirms it. The
same photo on a new piece is never repeated. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest

from app.modules.imports.models import ImportPhotoStatus as P
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import _drain, _jpeg, _send, _verifiable
from tests.api.test_import_photos_apply_api import (
    MAPPING,
    approve,
    assets_of,
    lot_with_photos,
    photo_rows,
    pieces_of,
)
from tests.api.test_import_pipeline_api import BASE, put_mapping, upload, validate


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def test_a_photo_already_on_the_updated_piece_is_repeated_until_confirmed(
    pipeline: Pipeline, storage: Any
) -> None:
    first = lot_with_photos(pipeline, storage)
    assert approve(pipeline, first.batch_id)["status"] == "APPLIED"
    toro = pieces_of(pipeline, first.batch_id)[2]
    assert toro is not None
    code = next(iter(first.photos)).removesuffix(".jpg").removeprefix("I ")
    content = f"DENOMINACIÓN;CÓDIGOS;RÉGIMEN\nToro con fotos {first.tag};I-{code};Propiedad\n"
    batch_id = upload(pipeline.client, f"otra-vez-{first.tag}.csv", content.encode())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    again = _send(pipeline, batch_id, f"{first.tag}/I {code}.jpg", _jpeg(40, 30))  # same bytes
    new = _send(pipeline, batch_id, f"{first.tag}/I {code} (4).jpg", _jpeg(50, 30))
    _drain(pipeline, storage)

    tray = pipeline.client.get(f"{BASE}/{batch_id}/photos").json()["items"]
    repeated = {item["id"]: item["duplicate_of_existing"] for item in tray}
    assert repeated == {again: True, new: False}

    assert approve(pipeline, batch_id)["status"] == "APPLIED"
    names = [asset.original_filename for asset in assets_of(pipeline, toro.id)]
    assert names.count(f"I {code}.jpg") == 1  # the repeated photo was not registered again
    assert f"I {code} (4).jpg" in names
    lot = type(first)(batch_id, first.tag, {"again": again, "new": new})
    photos = photo_rows(pipeline, lot)
    assert photos["new"].status is P.APPLIED
    assert photos["again"].status is P.VERIFIED and photos["again"].media_asset_id is None


def test_the_same_photo_on_a_new_piece_is_not_repeated(pipeline: Pipeline, storage: Any) -> None:
    lot = lot_with_photos(pipeline, storage)

    photos = photo_rows(pipeline, lot)

    assert not any(photo.duplicate_of_existing for photo in photos.values())
    assert all(isinstance(photo.row_id, uuid.UUID) for photo in photos.values())
