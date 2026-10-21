"""Change alinear-api-endpoints-v1, tarea 4.4 — forma y firma de la importación del contrato.

Solo se verifica el OpenAPI generado (design D8). `upload` declara 202 con
`ImportBatchSummary` y solo `file` en el formulario. `upload`, `diffs` y `confirm` ya los
implementa `importacion-pipeline-reconciliacion` (tareas 2.1, 3.4 y 4.2; su comportamiento se
prueba en `test_import_pipeline_api.py` y `test_import_decisions_api.py`); `rollback` sigue en
501 hasta su tarea 5.2 (Req: Conformidad con el contrato de interfaces del equipo; Valores de
enumerado del contrato en la API; RF-021, RF-026, RF-027).
"""

from pathlib import Path
from typing import Any

import pytest
import yaml

from app.api.stubs import STATUS_IMPLEMENTED, STATUS_STUB, X_CHANGE, X_STATUS
from app.openapi_export import build_spec

CONTRACT = Path(__file__).resolve().parents[4] / "docs" / "fuentes" / "endpoints-api-v1.yaml"
UPLOAD = "/api/v1/imports/upload"
IMPLEMENTED = [
    ("post", UPLOAD),
    ("get", "/api/v1/imports/{batch_id}/diffs"),
    ("post", "/api/v1/imports/{batch_id}/confirm"),
]
STUBS = [("post", "/api/v1/imports/{batch_id}/rollback")]


@pytest.fixture(scope="module")
def spec() -> dict[str, Any]:
    return build_spec()


@pytest.fixture(scope="module")
def contract() -> dict[str, Any]:
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


def _schema(spec: dict[str, Any], ref: str) -> dict[str, Any]:
    return spec["components"]["schemas"][ref.rsplit("/", 1)[-1]]


@pytest.mark.parametrize(("method", "path"), STUBS)
def test_import_routes_remain_stubs(spec: dict[str, Any], method: str, path: str) -> None:
    operation = spec["paths"][path][method]
    assert operation[X_STATUS] == STATUS_STUB
    assert operation[X_CHANGE] == "importacion-pipeline-reconciliacion"
    assert "501" in operation["responses"]


@pytest.mark.parametrize(("method", "path"), IMPLEMENTED)
def test_ingestion_and_preview_routes_are_implemented(
    spec: dict[str, Any], method: str, path: str
) -> None:
    operation = spec["paths"][path][method]
    assert operation[X_STATUS] == STATUS_IMPLEMENTED
    assert "501" not in operation["responses"]


def test_upload_declares_202_with_import_batch_summary(spec: dict[str, Any]) -> None:
    responses = spec["paths"][UPLOAD]["post"]["responses"]
    assert "202" in responses and "201" not in responses
    ref = responses["202"]["content"]["application/json"]["schema"]["$ref"]
    assert ref.endswith("/ImportBatchSummary")


def test_upload_form_has_only_file(spec: dict[str, Any]) -> None:
    body = spec["paths"][UPLOAD]["post"]["requestBody"]
    assert body["required"] is True
    assert list(body["content"]) == ["multipart/form-data"]
    form = _schema(spec, body["content"]["multipart/form-data"]["schema"]["$ref"])
    assert set(form["properties"]) == {"file"}
    assert form["required"] == ["file"]


def test_import_batch_summary_matches_the_contract(
    spec: dict[str, Any], contract: dict[str, Any]
) -> None:
    expected = contract["components"]["schemas"]["ImportBatchSummary"]["properties"]
    actual = spec["components"]["schemas"]["ImportBatchSummary"]["properties"]
    assert set(actual) == set(expected)
    counters = _schema(spec, actual["summary"]["$ref"])
    assert set(counters["properties"]) == set(expected["summary"]["properties"])
