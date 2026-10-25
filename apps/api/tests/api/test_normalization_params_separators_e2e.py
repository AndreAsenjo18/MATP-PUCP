"""Spec identificacion-piezas — Separadores vigentes y costo de leer los parámetros, de punta a
punta (RN-010, RF-023, RNF-004).

Change plantillas-mapeo-y-normalizacion, task 2.2 step E (design D5):
- once the comma is removed from the separators, a cell ``I-9001, I-9002`` is no longer split
  when a batch is validated;
- validating a batch reads the parameters a fixed number of times, whatever its size: never
  once per row.
Own module: the ``pipeline`` fixture gives it its own seeded database. Synthetic data only
(RNF-014); the codes 9001-9002 and the denominations are not used by the seed.
"""

from typing import Any

from sqlalchemy import event

from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import set_params, sheet
from tests.api.test_import_pipeline_api import diffs, put_mapping, upload, validate

HEADERS = ["DENOMINACIÓN", "CÓDIGOS"]
MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}
PARAMETER_TABLES = ("normalization_setting", "collection_acronym_alias")


def _validated_rows(pipeline: Pipeline, rows: list[list[Any]]) -> list[dict[str, Any]]:
    batch_id = upload(pipeline.client, "codigos.xlsx", sheet(HEADERS, rows))["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return diffs(pipeline.client, batch_id, page_size=100).json()["items"]


def _parameter_reads(pipeline: Pipeline, rows: int) -> int:
    """Statements that read the parameters while one batch is uploaded, mapped and validated."""
    statements: list[str] = []
    listener = lambda *args: statements.append(args[2])  # noqa: E731
    event.listen(pipeline.engine, "before_cursor_execute", listener)
    try:
        _validated_rows(
            pipeline, [[f"Cántaro {n} (sintético)", f"I-{5000 + n}"] for n in range(rows)]
        )
    finally:
        event.remove(pipeline.engine, "before_cursor_execute", listener)
    return sum(1 for s in statements if any(table in s for table in PARAMETER_TABLES))


def test_without_the_comma_a_cell_is_no_longer_split(pipeline: Pipeline) -> None:
    [before] = _validated_rows(pipeline, [["Quena (sintética)", "I-9001, I-9002"]])
    assert [i["original_value"] for i in before["mapped_data"]["identifiers"]] == [
        "I-9001",
        "I-9002",
    ]

    set_params(pipeline, separators=["/", ";", "|", "\n", "\r"])

    [after] = _validated_rows(pipeline, [["Quena (sintética)", "I-9001, I-9002"]])
    assert [i["original_value"] for i in after["mapped_data"]["identifiers"]] == ["I-9001, I-9002"]
    [split] = _validated_rows(pipeline, [["Quena (sintética)", "I-9001; I-9002"]])
    assert len(split["mapped_data"]["identifiers"]) == 2


def test_the_parameters_are_read_a_fixed_number_of_times_per_batch(pipeline: Pipeline) -> None:
    # The two queries of ``load_params``, once for the batch, with 5 rows or with 60.
    assert _parameter_reads(pipeline, 5) == _parameter_reads(pipeline, 60) == 2
