"""The spreadsheet row of a duplicate pair in the queue (change revisar-duplicados-comparacion).

A pair between a catalogue piece and an import row must bring the row's catalogue fields (never its
personal data) so the person can compare in the queue; and once the batch decides what the row is,
its pairs leave the queue. Runs the synthetic demo batch on the module-scoped ``pipeline`` database
(RNF-014: synthetic data only).
"""

from pathlib import Path

from app.seed.demo_batch import SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_demo_batch import DEMO_MAPPING
from tests.api.test_import_pipeline_api import put_mapping, upload, validate

PERSONAL_KEYS = {"lender_name", "recorded_by", "notes", "source_payload", "raw_data"}


def _validated_demo_batch(pipeline: Pipeline, tmp_path: Path) -> str:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, DEMO_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return batch_id


def _import_pairs(pipeline: Pipeline, **params: object) -> list[dict]:
    response = pipeline.client.get(
        "/api/v1/quality/duplicates", params={"origin": "IMPORT", "page_size": 100, **params}
    )
    assert response.status_code == 200, response.text
    return response.json()["items"]


def test_an_import_pair_brings_the_row_to_compare_without_personal_data(
    pipeline: Pipeline, tmp_path: Path
) -> None:
    batch_id = _validated_demo_batch(pipeline, tmp_path)

    pairs = [pair for pair in _import_pairs(pipeline) if pair["import_row"]["batch_id"] == batch_id]

    assert pairs, "el lote de demostración trae posibles duplicados"
    row = pairs[0]["import_row"]
    assert row["batch_name"] and row["source_row_number"] >= 1
    assert row["denomination"]
    assert row["editable"] is True and row["resolution"] is None
    assert not PERSONAL_KEYS & set(row)
    catalog = pipeline.client.get(
        "/api/v1/quality/duplicates", params={"origin": "CATALOG"}
    ).json()["items"]
    assert all(pair["import_row"] is None for pair in catalog)


def test_deciding_the_row_in_its_batch_closes_its_pairs(pipeline: Pipeline, tmp_path: Path) -> None:
    batch_id = _validated_demo_batch(pipeline, tmp_path)
    # The first pair whose row can go to its piece. A row whose code I differs from the piece's is
    # refused (RN-002, ``inventory_code_mismatch``), and the synthetic codes are random, so which
    # pairs those are changes from run to run.
    candidates = [
        pair
        for pair in _import_pairs(pipeline, status="PENDING")
        if pair["import_row"]["batch_id"] == batch_id
    ]
    pair = None
    for candidate in candidates:
        response = pipeline.client.patch(
            f"/api/v1/imports/{batch_id}/rows/{candidate['import_row_id']}",
            json={"target_piece_id": candidate["piece_a_id"]},
        )
        if response.status_code == 200:
            pair = candidate
            break
        assert response.json()["code"] == "inventory_code_mismatch", response.text
    assert pair is not None, "ningún par del lote de demostración se pudo resolver hacia su pieza"

    pending = {item["id"] for item in _import_pairs(pipeline, status="PENDING")}
    assert pair["id"] not in pending
    closed = next(
        item for item in _import_pairs(pipeline, status="SUPERSEDED") if item["id"] == pair["id"]
    )
    assert closed["resolution_note"].startswith("Resuelto en su lote: la fila corresponde a «")
    assert closed["import_row"]["resolution"] == "piece"
