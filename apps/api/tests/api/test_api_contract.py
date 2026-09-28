"""Spec plataforma — Contrato OpenAPI versionado, exportable y con cliente tipado (RNF-009)."""

import inspect
import uuid
from collections import Counter

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.api.errors import NotImplementedEndpoint
from app.api.stubs import STATUS_IMPLEMENTED, STATUS_STUB, X_CHANGE, X_STATUS
from app.api.v1 import admin, collections, imports, locations, pieces, quality_reports
from app.openapi_export import DEFAULT_OUTPUT, build_spec, render
from tests.api.conftest import ADMIN, SeededApi, as_user

BACKLOG_CHANGES = {
    "ficha-pieza-crud",
    "colecciones-y-vocabularios-admin",
    "fotografias-multiples-por-pieza",
    "ubicacion-jerarquica-y-movimientos",
    "importacion-pipeline-reconciliacion",
    "plantillas-mapeo-y-normalizacion",
    "deteccion-duplicados-y-cola-revision",
    "alertas-y-reporte-incompletas",
    "busqueda-avanzada-y-exportacion",
    "reportes-inventario",
    "autenticacion-y-matriz-permisos",
    "auditoria-y-soft-delete-transversal",
    "ia-extraccion-texto-libre",
    "ia-sugerencia-terminos",
}

REQUIRED_PATHS = [
    ("get", "/api/v1/pieces"),
    ("get", "/api/v1/pieces/{piece_id}/identifiers"),
    ("post", "/api/v1/pieces/{piece_id}/media/upload-url"),
    ("get", "/api/v1/pieces/{piece_id}/location-history"),
    ("get", "/api/v1/collections"),
    ("get", "/api/v1/vocabularies/{vocabulary_code}/terms"),
    ("get", "/api/v1/locations"),
    ("post", "/api/v1/imports/upload"),
    ("put", "/api/v1/imports/{batch_id}/mapping"),
    ("post", "/api/v1/imports/{batch_id}/validate"),
    ("get", "/api/v1/imports/{batch_id}/diffs"),
    ("post", "/api/v1/imports/{batch_id}/confirm"),
    ("get", "/api/v1/imports/{batch_id}/log"),
    ("get", "/api/v1/quality/incomplete"),
    ("get", "/api/v1/quality/duplicates"),
    ("get", "/api/v1/reports/{report_type}"),
    ("get", "/api/v1/exports/full"),
    ("post", "/api/v1/ai/suggest-cataloging"),
    ("get", "/api/v1/ai/suggestions"),
    ("post", "/api/v1/ai/suggestions/{suggestion_id}/approve"),
    ("post", "/api/v1/ai/suggestions/{suggestion_id}/reject"),
    ("post", "/api/v1/auth/login"),
    ("get", "/api/v1/users"),
    ("get", "/api/v1/roles"),
    ("get", "/api/v1/audit-logs"),
]


@pytest.fixture(scope="module")
def spec(seeded_api: SeededApi) -> dict:
    return seeded_api.app.openapi()


def _api_routes() -> list[APIRoute]:
    """Routes of every v1 module (FastAPI includes routers lazily, so read them at the source)."""
    modules = (admin, collections, imports, locations, pieces, quality_reports)
    return [route for module in modules for route in module.router.routes]


def test_all_modules_have_their_key_endpoints(spec: dict) -> None:
    for method, path in REQUIRED_PATHS:
        assert method in spec["paths"].get(path, {}), f"Falta {method.upper()} {path}"


def test_every_business_operation_declares_its_status(spec: dict) -> None:
    for path, operations in spec["paths"].items():
        if not path.startswith("/api/v1"):
            continue
        for method, operation in operations.items():
            status = operation.get(X_STATUS)
            assert status in {STATUS_STUB, STATUS_IMPLEMENTED}, f"{method} {path}"
            if status == STATUS_STUB:
                assert operation.get(X_CHANGE) in BACKLOG_CHANGES, f"{method} {path}"
                assert "501" in operation["responses"]
            assert operation["summary"], f"{method} {path} sin resumen"


def test_operation_ids_are_unique_and_stable(spec: dict) -> None:
    ids = [op["operationId"] for ops in spec["paths"].values() for op in ops.values()]
    duplicated = [name for name, count in Counter(ids).items() if count > 1]
    assert not duplicated
    assert "listPieces" in ids, "operationId en camelCase (contrato del equipo)"


def test_routes_are_versioned_and_health_stays_at_root(spec: dict) -> None:
    for path in spec["paths"]:
        assert path.startswith("/api/v1/") or path.startswith("/health")


def test_business_operations_declare_the_dev_identity_scheme(spec: dict) -> None:
    assert spec["components"]["securitySchemes"]["DevUserHeader"]["name"] == "X-MATP-User"
    listed = spec["paths"]["/api/v1/pieces"]["get"]
    assert {"DevUserHeader": []} in listed["security"]


def test_each_stub_raises_not_implemented_with_a_valid_example() -> None:
    stubs = [r for r in _api_routes() if r.openapi_extra.get(X_STATUS) == STATUS_STUB]
    assert len(stubs) >= 40
    for route in stubs:
        params = inspect.signature(route.endpoint).parameters
        with pytest.raises(NotImplementedEndpoint) as raised:
            route.endpoint(**dict.fromkeys(params))
        assert raised.value.change == route.openapi_extra[X_CHANGE], route.path
        if route.response_model is not None and route.status_code != 204:
            assert raised.value.example is not None, f"{route.path} sin ejemplo"
            TypeAdapter(route.response_model).validate_python(raised.value.example)


def test_stub_over_http_returns_501_with_change_and_example(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/imports/{uuid.uuid4()}/confirm",
        json={"confirm_counts": {"rows": 10}},
        headers=as_user(ADMIN),
    )
    assert response.status_code == 501
    body = response.json()
    assert body["code"] == "not_implemented"
    assert body["change"] == "importacion-pipeline-reconciliacion"
    assert "importacion-pipeline-reconciliacion" in body["message"]
    assert body["example"]["status"] == "IN_PREVIEW"


def test_stub_still_requires_identity(client: TestClient) -> None:
    response = client.get("/api/v1/reports/dashboard-stats")
    assert response.status_code == 401


def test_committed_openapi_is_up_to_date() -> None:
    expected = render(build_spec())
    assert DEFAULT_OUTPUT.exists(), "Falta docs/api/openapi.json. Ejecute: npm run openapi"
    current = DEFAULT_OUTPUT.read_text(encoding="utf-8")
    assert current == expected, "docs/api/openapi.json desactualizado. Ejecute: npm run openapi"


def test_export_is_reproducible() -> None:
    assert render(build_spec()) == render(build_spec())


def test_request_validation_error_uses_uniform_format(client: TestClient) -> None:
    response = client.get("/api/v1/pieces?page=0", headers=as_user(ADMIN))
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "request_validation_failed"
    assert body["details"]["fields"][0]["location"] == ["query", "page"]


def test_unknown_route_uses_uniform_format(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist", headers=as_user(ADMIN))
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
