"""Spec multimedia — Procedencia visible de las fotografías importadas (RF-046, RF-013, RN-005).

Change importacion-fotos-a-catalogo, task 6.3 (design D9): a photo applied from a batch keeps its
path, its batch and the lower resolution version discarded in its place; a photo uploaded from
the sheet says so; nobody can change it through the API. Synthetic data only (RNF-014).
"""

from typing import Any

import pytest

from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import collection, media, pattern_jpeg, photo_batch, piece
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _send, _verifiable
from tests.api.test_import_pipeline_api import get_batch


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def gallery(pipeline: Pipeline, piece_id: Any) -> list[dict[str, Any]]:
    response = pipeline.login("INTERNAL_VIEWER").get(f"/api/v1/pieces/{piece_id}/media")
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]


def test_a_photo_of_the_archive_shows_its_path_batch_and_replaced_version(
    pipeline: Pipeline, storage: Any
) -> None:
    target = piece(pipeline, collection(pipeline, "Colección procedencia", "PRC"), ("I", "I-80236"))
    old = media(pipeline, target, "1" * 64)
    batch_id = photo_batch(pipeline, "Lote 12 sintético")
    _send(pipeline, batch_id, "FOTOS/82LF4169.jpg", pattern_jpeg(8236, 400, 300))
    _send(pipeline, batch_id, "FOTOS/ALTAS/82LF4169 copy.jpg", pattern_jpeg(8236, 2400, 1800))
    _drain(pipeline, storage)
    kept = next(
        item
        for item in pipeline.client.get(f"/api/v1/imports/{batch_id}/photos").json()["items"]
        if item["status"] == "VERIFIED"
    )
    pipeline.client.patch(
        f"/api/v1/imports/{batch_id}/photos",
        json={"op": "assign", "photo_ids": [kept["id"]], "piece_id": str(target)},
    )
    confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"

    photos = {item["id"]: item for item in gallery(pipeline, target)}
    imported = next(item for item in photos.values() if item["id"] != str(old))
    assert imported["provenance"] == {
        "source": "import",
        "original_filename": "82LF4169 copy.jpg",
        "relative_path": "FOTOS/ALTAS/82LF4169 copy.jpg",
        "import_batch_id": batch_id,
        "import_batch_name": "Lote 12 sintético",
        "replaced_lower_resolution": ["FOTOS/82LF4169.jpg"],
    }
    assert photos[str(old)]["provenance"]["source"] == "manual"
    assert photos[str(old)]["provenance"]["original_filename"] == "anterior.jpg"

    edited = pipeline.login("COLLECTIONS_MANAGER").patch(
        f"/api/v1/pieces/{target}/media/{imported['id']}",
        json={"provenance": {"relative_path": "otra/ruta.jpg"}, "extra_metadata": {}},
    )
    assert edited.status_code == 200, edited.text  # the field is ignored
    after = next(item for item in gallery(pipeline, target) if item["id"] == imported["id"])
    assert after["provenance"] == imported["provenance"]
