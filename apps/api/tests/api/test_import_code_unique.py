"""Two pieces never share a code, in an import either (change codigo-unico-y-ajustes-pantallas, D2).

Before, only the code I of two rows of a batch was compared: two rows with the same PUCP code both
became pieces, and the duplicate reached the catalogue. And a row whose collection code a piece
already had could still be made «nueva». Runs on the module-scoped ``pipeline`` database; every
value is synthetic (RNF-014).
"""

from typing import Any

import pytest

from app.core.errors import ValidationFailed
from app.modules.imports.decisions import _check_as_new
from app.modules.imports.models import ImportRow
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import (
    _catalog,
    diffs,
    put_mapping,
    upload,
    validate,
)

BASE = "/api/v1/imports"
MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {
            "source_column": "PUCP",
            "target_field": "identifier",
            "identifier_type_code": "PUCP",
        },
        {"source_column": "RÉGIMEN", "target_field": "tenure_regime"},
    ]
}


@pytest.fixture(scope="module")
def batch(pipeline: Pipeline) -> tuple[str, dict[int, dict[str, Any]]]:
    with pipeline.session() as session:
        catalog = _catalog(session)
        session.expunge_all()
    lines = [
        "DENOMINACIÓN;CÓDIGOS;PUCP;RÉGIMEN",
        "Primera con PUCP repetido zz;;PUX-7301;Propiedad",
        "Segunda con PUCP repetido zz;;pux-7301;Propiedad",
        f"Códigos de dos piezas zz;{catalog.third_code} / {catalog.other_collection_code};;"
        "Propiedad",
    ]
    content = ("\n".join(lines) + "\n").encode("utf-8")
    batch_id = upload(pipeline.client, "codigos-unicos.csv", content)["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    rows = diffs(pipeline.client, batch_id).json()["items"]
    return batch_id, {row["source_row_number"]: row for row in rows}


def _new(pipeline: Pipeline, batch_id: str, row: dict[str, Any]) -> Any:
    return pipeline.client.patch(f"{BASE}/{batch_id}/rows/{row['id']}", json={"as_new": True})


def test_two_rows_with_the_same_code_of_any_type_point_to_each_other(
    batch: tuple[str, dict[int, dict[str, Any]]],
) -> None:
    _batch_id, rows = batch

    for number, other in ((2, 3), (3, 2)):
        row = rows[number]
        assert row["classification"] == "CONFLICT"
        [conflict] = [m for m in row["matches"] if m["kind"] == "batch_row"]
        assert (conflict["row_number"], conflict["identifier_type"]) == (other, "PUCP")


def test_only_one_of_them_can_become_a_new_piece(
    pipeline: Pipeline, batch: tuple[str, dict[int, dict[str, Any]]]
) -> None:
    batch_id, rows = batch

    assert _new(pipeline, batch_id, rows[2]).status_code == 200
    response = _new(pipeline, batch_id, rows[3])

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "code_in_use_in_batch"
    assert "fila 2" in response.json()["message"]


def test_a_row_with_codes_of_catalogue_pieces_cannot_become_new(
    pipeline: Pipeline, batch: tuple[str, dict[int, dict[str, Any]]]
) -> None:
    batch_id, rows = batch
    assert rows[4]["classification"] == "CONFLICT"

    response = _new(pipeline, batch_id, rows[4])

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "inventory_code_in_use"


def test_a_code_of_another_type_that_a_piece_has_also_blocks_new() -> None:
    """Before, only the code I did: a row whose collection code a piece had could be made new."""
    row = ImportRow(
        matches=[
            {
                "kind": "piece",
                "piece_id": "p-1",
                "identifiers": [{"identifier_type": "COLECCION", "value": "MMZ 15"}],
            }
        ]
    )

    with pytest.raises(ValidationFailed) as raised:
        _check_as_new(None, row)  # type: ignore[arg-type]  # the session is not reached

    assert raised.value.code == "code_in_use"
