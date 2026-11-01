"""Photo-only batches over HTTP (change importacion-fotos-a-catalogo, task 2.2; design D1).

Spec importacion-datos, «Lote de solo fotografías para piezas existentes» (RF-046): a batch without
Excel, created by name, that admits photos and rejects the operations of a spreadsheet batch with
``409 batch_kind_mismatch``. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.imports.models import ImportBatch, ImportBatchKind, ImportBatchStatus
from app.modules.imports.models import ImportPhotoStatus as P
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import (
    CONTENT,
    _drain,
    _file,
    _items,
    _jpeg,
    _photo,
    _send,
    _verifiable,
)
from tests.api.test_import_pipeline_api import BASE, upload

NAME = "Archivo fotográfico — colección ABC"


def create(client: TestClient, name: str = NAME) -> Any:
    return client.post(f"{BASE}/photo-batches", json={"name": name})


@pytest.fixture
def photo_batch(pipeline: Pipeline) -> dict[str, Any]:
    response = create(pipeline.client)
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


def test_creating_a_photo_batch(pipeline: Pipeline, photo_batch: dict[str, Any]) -> None:
    assert photo_batch["kind"] == "PHOTOS"
    assert photo_batch["file_name"] == NAME
    assert photo_batch["status"] == "UPLOADED"
    assert photo_batch["file_sha256"] is None
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(photo_batch["id"]))
        assert batch is not None
        assert batch.kind == ImportBatchKind.PHOTOS
        assert batch.file_storage_key is None
    listed = pipeline.client.get(BASE, params={"page_size": 100}).json()["items"]
    assert any(item["id"] == photo_batch["id"] and item["kind"] == "PHOTOS" for item in listed)


def test_a_photo_batch_admits_photos(pipeline: Pipeline, photo_batch: dict[str, Any]) -> None:
    items = _items(pipeline.client, photo_batch["id"], _file("ALTAS/82LF4169 copy.jpg"))

    assert [item["result"] for item in items] == ["upload"]


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("put", "/mapping", {"columns": []}),
        ("post", "/validate", None),
        ("get", "/diffs", None),
        ("patch", f"/rows/{uuid.UUID(int=1)}", {"decision": "ACCEPTED"}),
        ("post", f"/images/{uuid.UUID(int=1)}/associate", {}),
    ],
)
def test_spreadsheet_operations_are_rejected_on_a_photo_batch(
    pipeline: Pipeline, photo_batch: dict[str, Any], method: str, path: str, body: Any
) -> None:
    client = pipeline.client
    if path.startswith("/images"):
        client = pipeline.login("COLLECTIONS_MANAGER")
    response = client.request(method, f"{BASE}/{photo_batch['id']}{path}", json=body)

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "batch_kind_mismatch"
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(photo_batch["id"]))
        assert batch is not None and batch.status == ImportBatchStatus.UPLOADED
        assert batch.mapping is None


def test_an_internal_viewer_cannot_create_a_photo_batch(pipeline: Pipeline) -> None:
    response = create(pipeline.login("INTERNAL_VIEWER"), "Consulta")

    assert response.status_code == 403, response.text
    with pipeline.session() as session:
        query = select(ImportBatch).where(ImportBatch.file_name == "Consulta")
        assert session.scalar(query) is None


@pytest.mark.parametrize("name", ["", "x" * 301])
def test_the_name_is_required_and_bounded(pipeline: Pipeline, name: str) -> None:
    assert create(pipeline.client, name).status_code == 422


# --- Paso a la previsualización (tarea 2.3) --------------------------------------------------


def _status(pipeline: Pipeline, batch_id: str) -> ImportBatchStatus:
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        return batch.status


def test_the_batch_reaches_the_preview_once_every_photo_is_verified_and_a_resumed_upload_goes_on(
    pipeline: Pipeline, photo_batch: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = _verifiable(pipeline.client, pipeline, monkeypatch)
    batch_id = photo_batch["id"]
    first = _send(pipeline, batch_id, "ABC 001 - PUCP 1234.jpg", _jpeg(400, 300))
    second = _send(pipeline, batch_id, "ABC 002 - PUCP 1235.jpg", _jpeg(300, 400))
    head = storage.head

    def unreachable_second(key: str) -> dict[str, Any]:
        if second in key:
            raise ConnectionError("almacenamiento sin respuesta")
        return head(key)  # type: ignore[no-any-return]

    monkeypatch.setattr(storage, "head", unreachable_second)
    assert _drain(pipeline, storage) == 1
    assert _photo(pipeline, first).status == P.VERIFIED
    assert _photo(pipeline, second).status == P.UPLOADED
    assert _status(pipeline, batch_id) == ImportBatchStatus.UPLOADED  # one still waits

    monkeypatch.setattr(storage, "head", head)
    assert _drain(pipeline, storage) == 1
    assert _status(pipeline, batch_id) == ImportBatchStatus.IN_PREVIEW

    third = _send(pipeline, batch_id, "ABC 003 - PUCP 1236.jpg", _jpeg(500, 300))
    assert _drain(pipeline, storage) == 1
    assert _photo(pipeline, third).status == P.VERIFIED
    assert _status(pipeline, batch_id) == ImportBatchStatus.IN_PREVIEW


def test_a_spreadsheet_batch_does_not_reach_the_preview_by_verifying_photos(
    pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = _verifiable(pipeline.client, pipeline, monkeypatch)
    batch_id = upload(pipeline.client, "sabana_con_fotos.csv", CONTENT)["batch_id"]
    _send(pipeline, batch_id, "I-01234.jpg", _jpeg())

    _drain(pipeline, storage)

    assert _status(pipeline, batch_id) == ImportBatchStatus.UPLOADED
