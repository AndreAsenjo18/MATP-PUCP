"""Spec identificacion-piezas — Escenario «Nuevo marcador de ausencia», de punta a punta (RN-010,
RF-004, RF-023).

Change plantillas-mapeo-y-normalizacion, task 2.2 step E (design D5): once an administrator adds
``NO REGISTRA`` to the absence markers, a code I with that value means "no code I" in the manual
entry (``POST /pieces``; ``POST /pieces/validate`` is still a stub of ``ficha-pieza-crud``) and
in the import (dry-run and validation of
a batch). Before, it is a malformed code I. Own module: the ``pipeline`` fixture gives it its own
seeded database. Synthetic data only (RNF-014); ``NO REGISTRA`` is illustrative [SUPUESTO A5].
"""

from typing import Any

from app.modules.identification.normalization import ABSENCE_MARKERS
from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import set_params, sheet
from tests.api.test_import_pipeline_api import diffs, put_mapping, upload, validate

HEADERS = ["DENOMINACIÓN", "N° INV"]
PIECE = {"denomination": "Soga de maguey (sintética)", "tenure_regime": "Propiedad"}
MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "N° INV", "target_field": "identifier:I"},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def _create(pipeline: Pipeline, code_i: str):  # type: ignore[no-untyped-def]
    return pipeline.client.post("/api/v1/pieces", json={**PIECE, "code_i": code_i})


def _template_id(pipeline: Pipeline) -> str:
    created = pipeline.client.post(
        "/api/v1/import-templates",
        json={
            "name": "Códigos I con marcador (sintética)",
            "source_name": "Prueba",
            "headers": HEADERS,
            "columns": [
                {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
                {
                    "source_column": "N° INV",
                    "target_field": "identifier:I",
                    "transforms": ["trim", "absence_markers"],
                },
            ],
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _dry_run_counts(pipeline: Pipeline, template_id: str) -> dict[str, int]:
    batch_id = upload(pipeline.client, "marcador.xlsx", sheet(HEADERS, [["Soga", "NO REGISTRA"]]))[
        "batch_id"
    ]
    response = pipeline.client.post(
        f"/api/v1/import-templates/{template_id}/dry-run", json={"batch_id": batch_id}
    )
    assert response.status_code == 200, response.text
    [column] = [c for c in response.json()["columns"] if c["mapping"]["source_column"] == "N° INV"]
    return column["counts"]


def _validated_identifiers(pipeline: Pipeline) -> list[dict[str, Any]]:
    batch_id = upload(pipeline.client, "lote.xlsx", sheet(HEADERS, [["Soga", "no registra"]]))[
        "batch_id"
    ]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id, page_size=10).json()["items"]
    return row["mapped_data"]["identifiers"]


def test_no_registra_becomes_no_code_i_in_manual_entry_and_import(pipeline: Pipeline) -> None:
    template_id = _template_id(pipeline)

    # Before: NO REGISTRA is a malformed code I everywhere.
    rejected = _create(pipeline, "NO REGISTRA")
    assert rejected.status_code == 422 and rejected.json()["code"] == "unrecognized_format"
    assert _dry_run_counts(pipeline, template_id)["ABSENT"] == 0
    [before] = _validated_identifiers(pipeline)
    assert before["is_absent"] is False and before["status"] == "UNPARSEABLE"

    set_params(pipeline, absence_markers=[*ABSENCE_MARKERS, "NO REGISTRA"])

    # Manual entry: the piece is created without a code I.
    created = _create(pipeline, "No registra")
    assert created.status_code == 201, created.text
    identifiers = pipeline.client.get(f"/api/v1/pieces/{created.json()['id']}/identifiers")
    assert identifiers.status_code == 200, identifiers.text
    assert [i for i in identifiers.json() if i["identifier_type_code"] == "I"] == []

    # Import: the preview counts it as absent and the validated row keeps it as "no code".
    counts = _dry_run_counts(pipeline, template_id)
    assert counts["ABSENT"] == 1 and counts["UNPARSEABLE"] == 0
    [after] = _validated_identifiers(pipeline)
    assert after["is_absent"] is True and after["original_value"] == "no registra"
