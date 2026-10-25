"""Photos of an import batch over HTTP (change importacion-masiva-fotografias, task 2.1).

Spec importacion-datos, «Fotografías del lote con subida reanudable»; design D2. Every test builds
its own batch; the storage only signs URLs here. Synthetic data only (RNF-014).
"""

import hashlib
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.modules.imports.models import ImportBatch, ImportBatchStatus, ImportPhoto
from app.modules.imports.models import ImportPhotoStatus as P
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import BASE, upload

CONTENT = "DENOMINACIÓN;CÓDIGO I\nToro sintético;I-01234\n".encode()


def _file(name: str, *, content: bytes | None = None, **values: Any) -> dict[str, Any]:
    data = content if content is not None else f"foto sintética {name}".encode()
    return {
        "relative_path": name,
        "size_bytes": len(data),
        "content_type": "image/jpeg",
        "content_sha256": hashlib.sha256(data).hexdigest(),
        **values,
    }


def _upload_urls(client: TestClient, batch_id: str, *files: dict[str, Any]) -> Any:
    return client.post(f"{BASE}/{batch_id}/photos/upload-urls", json={"files": list(files)})


def _items(client: TestClient, batch_id: str, *files: dict[str, Any]) -> list[dict[str, Any]]:
    response = _upload_urls(client, batch_id, *files)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def _photos(pipeline: Pipeline, batch_id: str) -> dict[uuid.UUID, ImportPhoto]:
    with pipeline.session() as session:
        return {
            photo.id: photo
            for photo in session.scalars(
                select(ImportPhoto).where(ImportPhoto.batch_id == uuid.UUID(batch_id))
            )
        }


def _set_status(pipeline: Pipeline, model: Any, row_id: Any, status: Any) -> None:
    with pipeline.session() as session:
        session.execute(update(model).where(model.id == row_id).values(status=status))
        session.commit()


@pytest.fixture
def batch_id(pipeline: Pipeline) -> str:
    return upload(pipeline.client, "sabana_fotos.csv", CONTENT)["batch_id"]


def test_a_new_group_gets_an_upload_url_per_file(pipeline: Pipeline, batch_id: str) -> None:
    files = [_file("MMZ 045/DSC_0001.jpg"), _file("MMZ 045/DSC_0002.jpg"), _file("I-01234.jpg")]

    items = _items(pipeline.client, batch_id, *files)

    assert [item["result"] for item in items] == ["upload"] * 3
    assert [item["relative_path"] for item in items] == [file["relative_path"] for file in files]
    photos = _photos(pipeline, batch_id)
    assert {uuid.UUID(item["photo_id"]) for item in items} == photos.keys()
    for item in items:
        photo = photos[uuid.UUID(item["photo_id"])]
        assert photo.status is P.PENDING_UPLOAD
        assert photo.storage_prefix == f"media/{photo.id}/"
        assert photo.original_filename == item["relative_path"].rsplit("/", 1)[-1]
        assert item["photo_status"] == "PENDING_UPLOAD"
        assert item["method"] == "PUT"
        assert f"media/{photo.id}/upload.jpeg" in item["upload_url"]
        assert item["headers"] == {"Content-Type": "image/jpeg"}
        assert item["expires_at"] is not None


def test_dropping_the_folder_again_resumes_without_registering_twice(
    pipeline: Pipeline, batch_id: str
) -> None:
    uploaded, pending, new = _file("uno.jpg"), _file("dos.jpg"), _file("tres.jpg")
    first = {
        item["relative_path"]: item for item in _items(pipeline.client, batch_id, uploaded, pending)
    }
    _set_status(pipeline, ImportPhoto, uuid.UUID(first["uno.jpg"]["photo_id"]), P.UPLOADED)

    again = _items(pipeline.client, batch_id, uploaded, pending, new, dict(uploaded))

    assert [item["result"] for item in again] == [
        "already_registered",  # its file is already in the storage: not uploaded again
        "upload",  # still waiting for its file: a new URL for the same photo
        "upload",
        "already_registered",  # the same file twice in one group
    ]
    assert again[0]["photo_id"] == first["uno.jpg"]["photo_id"]
    assert again[0]["photo_status"] == "UPLOADED"
    assert again[0]["upload_url"] is None
    assert again[1]["photo_id"] == first["dos.jpg"]["photo_id"]
    assert again[3]["photo_id"] == again[0]["photo_id"]
    assert len(_photos(pipeline, batch_id)) == 3


def test_a_rejected_photo_can_be_uploaded_again(pipeline: Pipeline, batch_id: str) -> None:
    (item,) = _items(pipeline.client, batch_id, _file("rechazada.jpg"))
    _set_status(pipeline, ImportPhoto, uuid.UUID(item["photo_id"]), P.REJECTED)

    (again,) = _items(pipeline.client, batch_id, _file("rechazada.jpg"))

    assert again["result"] == "upload"
    assert again["photo_id"] == item["photo_id"]
    assert _photos(pipeline, batch_id)[uuid.UUID(item["photo_id"])].status is P.PENDING_UPLOAD


def test_an_approved_batch_admits_no_photos(pipeline: Pipeline, batch_id: str) -> None:
    _set_status(pipeline, ImportBatch, uuid.UUID(batch_id), ImportBatchStatus.APPROVED)

    response = _upload_urls(pipeline.client, batch_id, _file("tarde.jpg"))

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "batch_not_accepting_photos"
    assert _photos(pipeline, batch_id) == {}


def test_an_internal_viewer_cannot_add_photos(pipeline: Pipeline, batch_id: str) -> None:
    response = _upload_urls(pipeline.login("INTERNAL_VIEWER"), batch_id, _file("consulta.jpg"))

    assert response.status_code == 403, response.text
    assert _photos(pipeline, batch_id) == {}


def test_a_file_of_another_type_or_too_large_does_not_stop_the_group(
    pipeline: Pipeline, batch_id: str
) -> None:
    items = _items(
        pipeline.client,
        batch_id,
        _file("acta.pdf", content_type="application/pdf"),
        _file("enorme.jpg", size_bytes=60 * 1024 * 1024),
        _file("buena.jpg"),
    )

    assert [item["result"] for item in items] == ["rejected", "rejected", "upload"]
    assert "application/pdf" in items[0]["reason"]
    assert "50 MB" in items[1]["reason"]
    assert items[0]["photo_id"] is None
    assert list(_photos(pipeline, batch_id)) == [uuid.UUID(items[2]["photo_id"])]


def test_a_batch_admits_up_to_the_configured_number_of_photos(pipeline: Pipeline) -> None:
    client = pipeline.app_for(import_max_photos=2)
    batch_id = upload(client, "sabana_fotos.csv", CONTENT)["batch_id"]
    _items(client, batch_id, _file("a.jpg"))

    response = _upload_urls(client, batch_id, _file("a.jpg"), _file("b.jpg"), _file("c.jpg"))

    assert response.status_code == 422, response.text
    body = response.json()
    assert body["code"] == "photo_limit_exceeded"
    assert body["details"] == {"max_photos": 2, "registered": 1, "added": 2}
    assert len(_photos(pipeline, batch_id)) == 1


def test_a_group_has_at_most_100_files(pipeline: Pipeline, batch_id: str) -> None:
    files = [_file(f"foto_{number:03}.jpg") for number in range(101)]

    assert _upload_urls(pipeline.client, batch_id, *files).status_code == 422
    assert _photos(pipeline, batch_id) == {}
