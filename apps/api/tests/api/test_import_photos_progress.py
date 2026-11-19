"""Progress of a batch of photos in «Revisar y aprobar» and the link to see its pieces in the
search (change importacion-fotos-progreso; RF-025, RF-031).

The photos are verified, matched and applied in the background: the summary says how many the
server is still working on, and once applied the search filters the pieces that received them.
Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest

from app.modules.search.filters import PieceFilter
from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import collection, pattern_jpeg, photo_batch, piece
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_photos_api import _drain, _send, _verifiable
from tests.api.test_import_pipeline_api import BASE, get_batch


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def test_the_summary_counts_the_photos_still_being_processed(
    pipeline: Pipeline, storage: Any
) -> None:
    cid = collection(pipeline, "Colección PRG", "PRG")
    piece(pipeline, cid, ("COLECCION", "PRG 1"))
    batch_id = photo_batch(pipeline, "Archivo fotográfico PRG")
    for index in range(2):
        name = f"Fotos PRG/PRG 001 ({index + 1}).JPG"
        _send(pipeline, batch_id, name, pattern_jpeg(7100 + index))

    before = pipeline.client.get(f"{BASE}/{batch_id}/photos/summary").json()
    _drain(pipeline, storage)
    after = pipeline.client.get(f"{BASE}/{batch_id}/photos/summary").json()

    assert (before["total"], before["processing"]) == (2, 2)
    assert after["processing"] == 0


def test_the_search_lists_the_pieces_that_received_the_photos_of_the_batch(
    pipeline: Pipeline, storage: Any
) -> None:
    cid = collection(pipeline, "Colección BSQ", "BSQ")
    first = piece(pipeline, cid, ("COLECCION", "BSQ 1"))
    second = piece(pipeline, cid, ("COLECCION", "BSQ 2"))
    piece(pipeline, cid, ("COLECCION", "BSQ 3"))  # no photo in the batch
    batch_id = photo_batch(pipeline, "Archivo fotográfico BSQ")
    _send(pipeline, batch_id, "Fotos BSQ/BSQ 001.JPG", pattern_jpeg(7201))
    _send(pipeline, batch_id, "Fotos BSQ/BSQ 002.JPG", pattern_jpeg(7202))
    _drain(pipeline, storage)

    before = pipeline.client.get("/api/v1/search", params={"import_batch_id": batch_id})
    assert before.status_code == 200, before.text
    assert before.json()["total"] == 0  # nothing applied yet

    response = confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    assert response.status_code == 200, response.text
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"

    found = pipeline.client.get("/api/v1/search", params={"import_batch_id": batch_id}).json()
    assert {item["piece"]["id"] for item in found["items"]} == {str(first), str(second)}
    with pipeline.session() as session:  # how the export names the filter
        described = PieceFilter(import_batch_id=uuid.UUID(batch_id)).describe(session)
    assert [(item.label, item.value_display) for item in described] == [
        ("Fotos importadas", "Lote «Archivo fotográfico BSQ»")
    ]
