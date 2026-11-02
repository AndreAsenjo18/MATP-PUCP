"""End to end: the synthetic demo batch with its 80 photos (importacion-masiva-fotografias 7.1).

The spreadsheet and the photo folder are written by the generator of ``data/fixtures/lote_demo``
and go through the real stages over HTTP on SQLite: upload, mapping (with the photo file column,
task 3.4), validation, photos uploaded and verified, the proposals of the three matching paths,
approval and application. Every photo of an applied row becomes a photo of its piece; the rest
stay in the batch. Synthetic data only (RNF-014).
"""

import hashlib
from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from app.seed.demo_batch import PHOTO_FOLDER, PHOTOS, SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_demo_batch import DEMO_MAPPING
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _items, _verifiable
from tests.api.test_import_pipeline_api import BASE, diffs, get_batch, put_mapping, upload, validate

MAPPING = {
    "columns": [
        *DEMO_MAPPING["columns"],
        {"source_column": "FOTO", "target_field": "photo_filename"},
    ]
}


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def test_the_demo_batch_with_its_photos_from_upload_to_the_catalogue(
    pipeline: Pipeline, storage: Any, tmp_path: Path
) -> None:
    write_demo_batch(tmp_path)
    folder = tmp_path / PHOTO_FOLDER
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200, batch_id
    assert validate(pipeline.client, batch_id).status_code == 202
    rows = {
        row["source_row_number"]: row
        for row in diffs(pipeline.client, batch_id, page_size=50).json()["items"]
    }

    sent: dict[str, str] = {}  # relative path -> photo id
    for photo in PHOTOS:
        data = (folder / photo.path).read_bytes()
        content_type = "image/png" if photo.path.endswith(".png") else "image/jpeg"
        (item,) = _items(
            pipeline.client,
            batch_id,
            {
                "relative_path": photo.path,
                "size_bytes": len(data),
                "content_type": content_type,
                "content_sha256": hashlib.sha256(data).hexdigest(),
            },
        )
        if photo.same_as:  # the same bytes as a photo already sent: not uploaded again
            assert item["result"] == "already_registered", item
            continue
        # What the browser does: upload the file to its URL and say it finished.
        pipeline.stored[f"media/{item['photo_id']}/upload.{content_type.split('/')[-1]}"] = data
        completed = pipeline.client.post(
            f"{BASE}/{batch_id}/photos/complete", json={"photo_ids": [item["photo_id"]]}
        )
        assert completed.status_code == 202, completed.text
        sent[photo.path] = item["photo_id"]
    _drain(pipeline, storage)

    tray = {
        item["id"]: item
        for item in pipeline.client.get(f"{BASE}/{batch_id}/photos", params={"limit": 100}).json()[
            "items"
        ]
    }
    assert len(tray) == 78 and {item["status"] for item in tray.values()} == {"VERIFIED"}
    by_expected: Counter[tuple[str, str | None]] = Counter()
    for photo in PHOTOS:
        if photo.same_as:
            continue
        item = tray[sent[photo.path]]
        by_expected[(photo.expected, item["match_status"])] += 1
        if photo.row is not None:
            assert item["row_id"] == rows[photo.row]["id"], photo.path
    assert by_expected == {
        ("nombre", "MATCHED"): 32,
        ("carpeta", "MATCHED"): 32,
        ("ambigua", "AMBIGUOUS"): 3,
        ("sin código", "UNMATCHED"): 11,
    }

    confirmed = confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    assert confirmed.status_code == 200, confirmed.text
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"

    applied_rows = {
        row["source_row_number"]
        for row in diffs(pipeline.client, batch_id, page_size=50).json()["items"]
        if row["action"] != "SKIP"
    }
    after = {
        item["id"]: item["status"]
        for item in pipeline.client.get(f"{BASE}/{batch_id}/photos", params={"limit": 100}).json()[
            "items"
        ]
    }
    for photo in PHOTOS:
        if photo.same_as:
            continue
        expected = "APPLIED" if photo.row in applied_rows else "VERIFIED"
        assert after[sent[photo.path]] == expected, photo.path
    assert Counter(after.values())["APPLIED"] > 0
