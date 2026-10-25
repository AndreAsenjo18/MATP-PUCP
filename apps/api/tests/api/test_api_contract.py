"""Spec plataforma — Contrato OpenAPI versionado, exportable y con cliente tipado (RNF-009)."""

import inspect
import json
import uuid
from collections import Counter
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.api.errors import NotImplementedEndpoint
from app.api.stubs import STATUS_IMPLEMENTED, STATUS_STUB, X_CHANGE, X_STATUS
from app.api.v1 import admin, collections, imports, loans, locations, pieces, quality_reports
from app.openapi_export import DEFAULT_OUTPUT, build_spec, render
from tests.api.conftest import LoginAs, SeededApi

CHANGES_DIR = Path(__file__).resolve().parents[4] / "openspec" / "changes"


def backlog_changes() -> set[str]:
    """Changes still open in OpenSpec: the archived ones are already implemented."""
    return {
        entry.name
        for entry in CHANGES_DIR.iterdir()
        if entry.is_dir() and entry.name != "archive" and (entry / "proposal.md").is_file()
    }


def archived_changes() -> set[str]:
    """Archived folders are named ``YYYY-MM-DD-<change>``."""
    archive = CHANGES_DIR / "archive"
    if not archive.is_dir():
        return set()
    return {entry.name[11:] for entry in archive.iterdir() if entry.is_dir()}


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
    modules = (admin, collections, imports, loans, locations, pieces, quality_reports)
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
                assert "501" in operation["responses"], f"{method} {path}"
            assert operation["summary"], f"{method} {path} sin resumen"


def test_every_stub_cites_an_existing_backlog_change(spec: dict) -> None:
    """Tarea 5.1: el `x-change` de cada stub es un change abierto en `openspec/changes/`."""
    open_changes = backlog_changes()
    archived = archived_changes()
    stubs = {
        f"{method.upper()} {path}": operation.get(X_CHANGE)
        for path, operations in spec["paths"].items()
        for method, operation in operations.items()
        if operation.get(X_STATUS) == STATUS_STUB
    }
    assert stubs
    unknown = {op: change for op, change in stubs.items() if change not in open_changes}
    assert not unknown, (
        "Stubs que citan un change que no existe en openspec/changes/ "
        + (
            "(o que ya se archivó, así que la operación debería estar implementada)"
            if set(unknown.values()) & archived
            else ""
        )
        + f": {unknown}"
    )


def test_operation_ids_are_unique_and_stable(spec: dict) -> None:
    ids = [op["operationId"] for ops in spec["paths"].values() for op in ops.values()]
    duplicated = [name for name, count in Counter(ids).items() if count > 1]
    assert not duplicated
    assert "listPieces" in ids, "operationId en camelCase (contrato del equipo)"


def test_routes_are_versioned_and_health_stays_at_root(spec: dict) -> None:
    for path in spec["paths"]:
        assert path.startswith("/api/v1/") or path.startswith("/health")


def test_business_operations_declare_the_session_cookie_scheme(spec: dict) -> None:
    schemes = spec["components"]["securitySchemes"]
    assert schemes["cookieAuth"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "matp_session",
        "description": schemes["cookieAuth"]["description"],
    }
    assert {"cookieAuth": []} in spec["paths"]["/api/v1/pieces"]["get"]["security"]


def test_the_test_identity_header_is_not_part_of_the_published_contract(spec: dict) -> None:
    """ADR-009 D7: X-MATP-User only exists under APP_ENV=test, so it is not documented."""
    assert "DevUserHeader" not in spec["components"]["securitySchemes"]
    assert "X-MATP-User" not in json.dumps(spec)


def test_each_stub_raises_not_implemented_with_a_valid_example() -> None:
    stubs = [r for r in _api_routes() if r.openapi_extra.get(X_STATUS) == STATUS_STUB]
    # Baja cada vez que un change implementa un stub (p. ej. ubicacion-jerarquica-y-movimientos
    # implementó POST/PUT /locations y autenticacion-y-matriz-permisos los usuarios y la
    # matriz; alertas-y-reporte-incompletas los de calidad; auditoria-y-soft-delete-transversal
    # el historial de la pieza; importacion-pipeline-reconciliacion la reversión del lote y
    # colecciones-y-vocabularios-admin los vocabularios y tipos de identificador;
    # ficha-pieza-crud la validación y la restauración de la ficha); el umbral solo detecta un
    # vaciado accidental de la lista, no fija cuántos quedan.
    assert len(stubs) >= 12
    for route in stubs:
        params = inspect.signature(route.endpoint).parameters
        with pytest.raises(NotImplementedEndpoint) as raised:
            route.endpoint(**dict.fromkeys(params))
        assert raised.value.change == route.openapi_extra[X_CHANGE], route.path
        if route.response_model is not None and route.status_code != 204:
            assert raised.value.example is not None, f"{route.path} sin ejemplo"
            TypeAdapter(route.response_model).validate_python(raised.value.example)


def test_stub_over_http_returns_501_with_change_and_example(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    response = client.post(
        f"/api/v1/ai/suggestions/{uuid.uuid4()}/reject",
        json={"reason": "Sugerencia sintética"},
    )
    assert response.status_code == 501
    body = response.json()
    assert body["code"] == "not_implemented"
    assert body["change"] == "ia-extraccion-texto-libre"
    assert "ia-extraccion-texto-libre" in body["message"]
    assert body["example"]["status"] == "PENDING"


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


def test_request_validation_error_uses_uniform_format(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    response = client.get("/api/v1/pieces?page=0")
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "request_validation_failed"
    assert body["details"]["fields"][0]["location"] == ["query", "page"]


def test_unknown_route_uses_uniform_format(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
