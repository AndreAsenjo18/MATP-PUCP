"""Corregir un valor del archivo en la revisión (change importacion-corregir-celda; RF-025, RN-005).

A code I with a typo is corrected on the stored row and the batch is validated again; the original
value stays recorded and the normalization rules do not change. Synthetic data (RNF-014).
"""

import io
from typing import Any

from openpyxl import Workbook

from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import diffs, get_batch, put_mapping, upload, validate

BASE = "/api/v1/imports"
MAPPING = {
    "columns": [
        {"source_column": "Denominación", "target_field": "denomination"},
        {"source_column": "Código I", "target_field": "identifier", "identifier_type_code": "I"},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def _workbook(rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _batch_with_a_typo(pipeline: Pipeline) -> tuple[str, dict]:
    content = _workbook(
        [
            ["Denominación", "Código I", "Observación"],
            ["Cuchara sintética", "I.-9814", "x"],
            ["Plato sintético", "I-9815", "y"],
        ]
    )
    batch_id = upload(pipeline.client, "erratas.xlsx", content)["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    rows = diffs(pipeline.client, batch_id).json()["items"]
    typo = next(row for row in rows if row["raw_data"]["Código I"] == "I.-9814")
    assert typo["has_validation_errors"], "«I.-9814» no tiene un formato reconocido"
    return batch_id, typo


def test_correcting_the_cell_and_validating_again_clears_the_error(pipeline: Pipeline) -> None:
    batch_id, typo = _batch_with_a_typo(pipeline)

    response = pipeline.client.patch(
        f"{BASE}/{batch_id}/rows/{typo['id']}/cells",
        json={"column": "Código I", "value": "I-9814"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MAPPED"

    assert validate(pipeline.client, batch_id).status_code == 202
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"
    row = next(r for r in diffs(pipeline.client, batch_id).json()["items"] if r["id"] == typo["id"])
    assert not row["has_validation_errors"]
    assert row["raw_data"]["Código I"] == "I-9814"
    # The original value stays recorded, and is not file data for the piece.
    assert row["raw_data"]["__corrections"]["Código I"]["original"] == "I.-9814"
    assert "__corrections" not in (row["mapped_data"] or {}).get("source_payload", {})


def test_a_second_correction_keeps_the_first_original(pipeline: Pipeline) -> None:
    batch_id, typo = _batch_with_a_typo(pipeline)
    url = f"{BASE}/{batch_id}/rows/{typo['id']}/cells"
    assert (
        pipeline.client.patch(url, json={"column": "Código I", "value": "I-1"}).status_code == 200
    )
    assert (
        pipeline.client.patch(url, json={"column": "Código I", "value": "I-9814"}).status_code
        == 200
    )
    assert validate(pipeline.client, batch_id).status_code == 202
    row = next(r for r in diffs(pipeline.client, batch_id).json()["items"] if r["id"] == typo["id"])
    assert row["raw_data"]["__corrections"]["Código I"]["original"] == "I.-9814"


def test_an_unknown_column_is_rejected(pipeline: Pipeline) -> None:
    batch_id, typo = _batch_with_a_typo(pipeline)

    response = pipeline.client.patch(
        f"{BASE}/{batch_id}/rows/{typo['id']}/cells", json={"column": "No existe", "value": "x"}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "unknown_column"
