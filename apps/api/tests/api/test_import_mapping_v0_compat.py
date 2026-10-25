"""Spec importacion-datos — Formato de mapeo versionado (RF-022; design D1, D2).

Change plantillas-mapeo-y-normalizacion, task 1.3: a v0 mapping, the one ``PUT /mapping``
builds from ``ColumnMapping``, accepts and rejects exactly what it did before the change. The
rules added for v1 (inactive identifier type, ``denomination`` default, ``multiple_values``,
vocabularies) do not apply to it. Synthetic data only (RNF-014).

Own module: it deactivates an identifier type in the module-scoped seeded database.
"""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.modules.identification.models import IdentifierType
from app.modules.imports.mapping import MappingContext, MappingSpecV1, validate_mapping
from tests.api.conftest import Pipeline

FIXTURES = Path(__file__).resolve().parents[4] / "data" / "fixtures"
SABANA = (FIXTURES / "sabana_sintetica_v1.xlsx").read_bytes()
BASE = "/api/v1/imports"
DENOMINATION = {"source_column": "DENOMINACIÓN", "target_field": "denomination"}


def upload(client: TestClient) -> str:
    response = client.post(f"{BASE}/upload", files={"file": ("sabana.xlsx", SABANA)})
    assert response.status_code == 202, response.text
    return str(response.json()["batch_id"])


def put_mapping(client: TestClient, batch_id: str, body: dict[str, Any]) -> Any:
    return client.put(f"{BASE}/{batch_id}/mapping", json=body)


def error_codes(response: Any) -> list[str]:
    return [error["code"] for error in response.json()["details"]["errors"]]


@pytest.fixture
def inactive_pucp(pipeline: Pipeline) -> Iterator[None]:
    def set_active(active: bool) -> None:
        with pipeline.session() as session:
            session.execute(
                update(IdentifierType).where(IdentifierType.code == "PUCP").values(is_active=active)
            )
            session.commit()

    set_active(False)
    yield
    set_active(True)


def test_v0_accepts_an_inactive_identifier_type(pipeline: Pipeline, inactive_pucp: None) -> None:
    batch_id = upload(pipeline.client)
    body = {
        "columns": [
            DENOMINATION,
            {"source_column": "CÓDIGOS", "target_field": "identifier:PUCP"},
        ]
    }

    response = put_mapping(pipeline.client, batch_id, body)

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MAPPED"


def test_v1_rejects_the_same_inactive_identifier_type(
    pipeline: Pipeline, inactive_pucp: None
) -> None:
    spec = MappingSpecV1.model_validate(
        {
            "version": 1,
            "columns": [
                {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}},
                {"source": "CÓDIGOS", "target": {"kind": "identifier", "type": "PUCP"}},
            ],
        }
    )
    with pipeline.session() as session:
        errors = validate_mapping(spec, ["DENOMINACIÓN", "CÓDIGOS"], MappingContext(session))
    assert [error.code for error in errors] == ["inactive_identifier_type"]


def test_v0_rejects_a_denomination_default(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client)
    body = {"columns": [DENOMINATION], "defaults": {"denomination": "Pieza sin nombre"}}

    response = put_mapping(pipeline.client, batch_id, body)

    assert response.status_code == 422
    assert error_codes(response) == ["unknown_default"]


def test_v0_denomination_default_does_not_replace_the_column(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client)
    body = {
        "columns": [{"source_column": "PROCEDENCIA", "target_field": "provenance"}],
        "defaults": {"denomination": "Pieza sin nombre"},
    }

    response = put_mapping(pipeline.client, batch_id, body)

    assert response.status_code == 422
    assert error_codes(response) == ["unknown_default", "denomination_required"]
