"""«Pedir a Gemini que revise estas filas» (change importacion-revision-filas-compacta; RIA-02,
RN-009, RNF-014).

The batch's pairs are judged with the same analysis as the duplicate queue, against the real mock
provider mounted at /ai. A verdict is a suggestion: no row is decided by it. Synthetic demo batch.
"""

from pathlib import Path

from app.seed.demo_batch import SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_demo_batch import DEMO_MAPPING
from tests.api.test_import_pipeline_api import diffs, put_mapping, upload, validate

BASE = "/api/v1/imports"


def _validated_demo_batch(pipeline: Pipeline, tmp_path: Path) -> str:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, DEMO_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return batch_id


def _rows(pipeline: Pipeline, batch_id: str) -> dict[str, dict]:
    response = diffs(pipeline.client, batch_id, page_size=100)
    assert response.status_code == 200, response.text
    return {row["id"]: row for row in response.json()["items"]}


def test_gemini_judges_only_this_batch_and_decides_nothing(
    pipeline: Pipeline, tmp_path: Path
) -> None:
    judged = _validated_demo_batch(pipeline, tmp_path / "a")
    other = _validated_demo_batch(pipeline, tmp_path / "b")
    before = {row_id: row["decision"] for row_id, row in _rows(pipeline, judged).items()}

    started = pipeline.client.post(f"{BASE}/{judged}/ai-judgment")
    assert started.status_code == 202, started.text
    assert started.json()["run"]["id"]

    body = pipeline.client.get(f"{BASE}/{judged}/ai-judgment").json()
    assert 0 < body["min_confidence"] <= 1
    rows = _rows(pipeline, judged)
    # Change duplicados-solo-por-codigo: validation no longer proposes rows by similarity, so a
    # new batch has no pairs to judge (conflicts are decided by their codes).
    assert body["verdicts"] == []
    # RN-009: a verdict never decides a row.
    assert {row_id: row["decision"] for row_id, row in rows.items()} == before
    # Only this batch: the other one has no verdicts yet.
    assert pipeline.client.get(f"{BASE}/{other}/ai-judgment").json()["verdicts"] == []


def test_a_batch_must_be_validated_before_asking_gemini(pipeline: Pipeline, tmp_path: Path) -> None:
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]

    response = pipeline.client.post(f"{BASE}/{batch_id}/ai-judgment")

    assert response.status_code == 409
    assert response.json()["code"] == "batch_not_validated"
    empty = pipeline.client.get(f"{BASE}/{batch_id}/ai-judgment").json()
    assert empty["verdicts"] == []


def test_to_decide_lists_only_rows_that_need_a_piece(pipeline: Pipeline, tmp_path: Path) -> None:
    batch_id = _validated_demo_batch(pipeline, tmp_path)

    response = diffs(pipeline.client, batch_id, to_decide=True, page_size=100)

    assert response.status_code == 200, response.text
    rows = response.json()["items"]
    assert rows, "el lote de demostración trae conflictos o posibles duplicados"
    assert {row["classification"] for row in rows} <= {"CONFLICT", "POSSIBLE_DUPLICATE"}
