"""«Descartar este lote» (change importacion-descartar-lote; RF-021, RN-005).

A batch that will not be approved moves to ABANDONED without deleting anything. (Closing the
duplicate pairs of its rows went away with the duplicate queue, change retirar-cola-duplicados.)
Synthetic demo batch (RNF-014).
"""

from pathlib import Path

from app.seed.demo_batch import SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_demo_batch import DEMO_MAPPING
from tests.api.test_import_pipeline_api import get_batch, put_mapping, upload, validate

BASE = "/api/v1/imports"


def _validated_demo_batch(pipeline: Pipeline, tmp_path: Path) -> str:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, DEMO_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return batch_id


def test_abandoning_keeps_the_batch_and_its_rows(pipeline: Pipeline, tmp_path: Path) -> None:
    batch_id = _validated_demo_batch(pipeline, tmp_path)

    response = pipeline.client.post(
        f"{BASE}/{batch_id}/abandon", json={"reason": "Subí el archivo equivocado."}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ABANDONED"
    assert body["status_reason"] == "Subí el archivo equivocado."
    # RN-005: nothing is deleted; the batch and its rows are still there.
    assert get_batch(pipeline.client, batch_id)["counts"]["rows"] > 0


def test_a_just_uploaded_batch_can_be_abandoned_without_reason(
    pipeline: Pipeline, tmp_path: Path
) -> None:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]

    response = pipeline.client.post(f"{BASE}/{batch_id}/abandon")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ABANDONED"
    assert response.json()["status_reason"]


def test_an_abandoned_batch_cannot_be_abandoned_again(pipeline: Pipeline, tmp_path: Path) -> None:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert pipeline.client.post(f"{BASE}/{batch_id}/abandon").status_code == 200

    again = pipeline.client.post(f"{BASE}/{batch_id}/abandon")

    assert again.status_code == 409
    assert again.json()["code"] == "invalid_batch_transition"
