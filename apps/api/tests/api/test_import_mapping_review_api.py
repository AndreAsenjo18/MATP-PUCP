"""«Así quedarían las piezas» (change importacion-mapeo-asistido): el lote trae sus primeras filas
tal como vienen en el archivo, para comprobar el mapeo con datos reales antes de validar, y la
sugerencia de la IA dice por qué duda de una columna. Datos sintéticos (RNF-014).
"""

import io
from typing import Any

from openpyxl import Workbook

from tests.api.conftest import Pipeline, SeededApi
from tests.api.test_import_pipeline_api import get_batch, upload


def _workbook(rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_the_batch_brings_its_first_rows_as_read_from_the_file(pipeline: Pipeline) -> None:
    content = _workbook(
        [
            ["Nombre del objeto", "Código", "Lugar"],
            ["Arpa sintética", "MMZ 1", "Ayacucho"],
            ["Mate sintético", "MMZ 2", "Huancayo"],
            ["Retablo sintético", "MMZ 3", None],
            ["Toro sintético", "MMZ 4", "Puno"],
        ]
    )
    batch_id = upload(pipeline.client, "muestra.xlsx", content)["batch_id"]

    batch = get_batch(pipeline.client, batch_id)

    assert batch["sample_rows"] == [
        {"Nombre del objeto": "Arpa sintética", "Código": "MMZ 1", "Lugar": "Ayacucho"},
        {"Nombre del objeto": "Mate sintético", "Código": "MMZ 2", "Lugar": "Huancayo"},
        {"Nombre del objeto": "Retablo sintético", "Código": "MMZ 3", "Lugar": None},
    ]
    assert all(not key.startswith("__") for row in batch["sample_rows"] for key in row)


def test_a_doubtful_column_comes_with_its_reason(seeded_api: SeededApi) -> None:
    response = seeded_api.login_as("CATALOGUER").post(
        "/api/v1/ai/suggest-column-mapping",
        json={"headers": ["DENOMINACIÓN", "Procedencia lugar"]},
    )
    assert response.status_code == 200, response.text
    by_column = {item["column"]: item for item in response.json()["mappings"]}
    assert by_column["DENOMINACIÓN"]["reason"] is None
    doubtful = by_column["Procedencia lugar"]
    assert doubtful["field"] == "provenance"
    assert doubtful["confidence"] < 0.8
    assert "Procedencia lugar" in doubtful["reason"]
