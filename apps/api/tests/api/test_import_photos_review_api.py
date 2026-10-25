"""Tray of the photos of a batch over HTTP (importacion-masiva-fotografias, task 4.1).

Spec importacion-datos, «Previsualización del lote con miniaturas y conteos de fotos» and
«Bandeja de revisión de fotografías del lote»; design D4. Each test builds its own batch with the
real stages (see ``test_import_photos_apply_api``) and two loose photos without a code. Synthetic
data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import select

from app.modules.imports.models import ImportRow
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import _drain, _file, _items, _jpeg, _send, _verifiable
from tests.api.test_import_photos_apply_api import Lot, lot_with_photos
from tests.api.test_import_pipeline_api import BASE


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def with_loose_photos(pipeline: Pipeline, storage: Any) -> Lot:
    """The batch of ``lot_with_photos`` plus two photos no row matches."""
    lot = lot_with_photos(pipeline, storage)
    for number in (1, 2):
        name = f"sueltas/IMG_000{number}.jpg"
        lot.photos[name] = _send(
            pipeline, lot.batch_id, f"{lot.tag}/{name}", _jpeg(20 + number, 20)
        )
    _drain(pipeline, storage)
    return lot


def row_ids(pipeline: Pipeline, batch_id: str) -> dict[int, uuid.UUID]:
    with pipeline.session() as session:
        return {
            row.source_row_number: row.id
            for row in session.scalars(
                select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch_id))
            )
        }


def tray(pipeline: Pipeline, batch_id: str, **params: Any) -> dict[str, Any]:
    response = pipeline.client.get(f"{BASE}/{batch_id}/photos", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_tray_filters_the_photos_and_signs_their_thumbnails(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    rows = row_ids(pipeline, lot.batch_id)

    loose = tray(pipeline, lot.batch_id, match_status="UNMATCHED")
    assert loose["total"] == 2
    for item in loose["items"]:
        assert item["row_id"] is None and item["status"] == "VERIFIED"
        assert f"media/{item['id']}/thumb.webp" in item["thumbnail_url"]

    toro = tray(pipeline, lot.batch_id, row_id=str(rows[2]))
    assert [item["sort_key"] for item in toro["items"]] == [1, 2, 3]
    assert {item["match_status"] for item in toro["items"]} == {"MATCHED"}

    page = tray(pipeline, lot.batch_id, limit=4, page=2)
    assert (page["total"], page["page"], page["page_size"], len(page["items"])) == (6, 2, 4, 2)
    assert tray(pipeline, lot.batch_id, status="VERIFIED")["total"] == 6


def test_the_summary_counts_the_photos_by_status_and_proposal(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    (pending,) = _items(pipeline.client, lot.batch_id, _file(f"{lot.tag}/sin_subir.jpg"))

    response = pipeline.client.get(f"{BASE}/{lot.batch_id}/photos/summary")

    assert response.status_code == 200, response.text
    counts = response.json()
    assert counts["total"] == 7
    assert counts["by_status"]["VERIFIED"] == 6
    assert counts["by_status"]["PENDING_UPLOAD"] == 1
    assert counts["by_match_status"] == {
        "MATCHED": 4,
        "AMBIGUOUS": 0,
        "UNMATCHED": 2,
        "MANUAL": 0,
        "NONE": 1,
    }
    assert counts["duplicates"] == 0
    still_uploading = tray(pipeline, lot.batch_id, status="PENDING_UPLOAD")["items"]
    assert [item["id"] for item in still_uploading] == [pending["photo_id"]]
    assert still_uploading[0]["thumbnail_url"] is None  # no thumbnail before verification


def test_an_internal_viewer_does_not_see_the_tray(pipeline: Pipeline, storage: Any) -> None:
    lot = lot_with_photos(pipeline, storage)
    viewer = pipeline.login("INTERNAL_VIEWER")

    assert viewer.get(f"{BASE}/{lot.batch_id}/photos").status_code == 403
    assert viewer.get(f"{BASE}/{lot.batch_id}/photos/summary").status_code == 403
