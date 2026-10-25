"""Spec importacion-datos — Gestión de plantillas de mapeo (RF-022, RN-005; design D1, D3).

Change plantillas-mapeo-y-normalizacion, tasks 3.1 and 3.5: templates are stored as
``MappingSpec`` v1 and spoken as ``ColumnMapping``. ``PUT /imports/{batch_id}/mapping`` builds
v0 as before without the new fields, and v1 with a template, transformations, ``value_map`` or
``terms:`` targets (phase 2 of design D1).
Synthetic data only (RNF-014); template names and headers are illustrative [SUPUESTO A1].

Own module: the ``pipeline`` fixture gives it its own seeded database.
"""

import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.api.v1.imports import _mapping_spec
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.imports.mapping import MappingSpecV1, read_mapping
from app.modules.imports.models import ImportBatch, ImportMappingTemplate
from app.modules.imports.schemas import MappingRequest
from app.modules.imports.templates import header_signature
from tests.api.conftest import Pipeline

FIXTURES = Path(__file__).resolve().parents[4] / "data" / "fixtures"
SABANA = (FIXTURES / "sabana_sintetica_v1.xlsx").read_bytes()
TEMPLATES = "/api/v1/import-templates"
IMPORTS = "/api/v1/imports"
HEADERS = ["DENOMINACIÓN", "CÓDIGOS", "N° INV", "ÉPOCA", "MATERIAL", "OBS. CONSULTORÍA"]
COLUMNS: list[dict[str, Any]] = [
    {"source_column": "DENOMINACIÓN", "target_field": "denomination", "transforms": ["trim"]},
    {
        "source_column": "CÓDIGOS",
        "target_field": "identifier",
        "identifier_type_code": "COLECCION",
        "split_compound": True,
        "transforms": ["trim", "split_concatenated"],
    },
    {"source_column": "N° INV", "target_field": "identifier:I", "transforms": ["absence_markers"]},
    {
        "source_column": "ÉPOCA",
        "target_field": "epoch_original_text",
        "transforms": ["propose_period"],
    },
    {
        "source_column": "MATERIAL",
        "target_field": "terms:MATERIAL",
        "transforms": ["split:,", "value_map"],
        "value_map": {"madera policromada": "MADERA"},
    },
    {"source_column": "OBS. CONSULTORÍA", "target_field": None},
]
# What the API returns for COLUMNS: ``identifier:I`` comes back as ``identifier`` + type.
COLUMNS_OUT: list[dict[str, Any]] = [
    {
        "source_column": "DENOMINACIÓN",
        "target_field": "denomination",
        "identifier_type_code": None,
        "split_compound": False,
        "transforms": ["trim"],
        "value_map": None,
    },
    {
        "source_column": "CÓDIGOS",
        "target_field": "identifier",
        "identifier_type_code": "COLECCION",
        "split_compound": True,
        "transforms": ["trim", "split_concatenated"],
        "value_map": None,
    },
    {
        "source_column": "N° INV",
        "target_field": "identifier",
        "identifier_type_code": "I",
        "split_compound": False,
        "transforms": ["absence_markers"],
        "value_map": None,
    },
    {
        "source_column": "ÉPOCA",
        "target_field": "epoch_original_text",
        "identifier_type_code": None,
        "split_compound": False,
        "transforms": ["propose_period"],
        "value_map": None,
    },
    {
        "source_column": "MATERIAL",
        "target_field": "terms:MATERIAL",
        "identifier_type_code": None,
        "split_compound": False,
        "transforms": ["split:,", "value_map"],
        "value_map": {"madera policromada": "MADERA"},
    },
    {
        "source_column": "OBS. CONSULTORÍA",
        "target_field": None,
        "identifier_type_code": None,
        "split_compound": False,
        "transforms": [],
        "value_map": None,
    },
]
DENOMINATION = {"source_column": "DENOMINACIÓN", "target_field": "denomination"}


def unique(name: str) -> str:
    return f"{name} {uuid.uuid4().hex[:8]} (sintética)"


def template_body(name: str, **overrides: Any) -> dict[str, Any]:
    return {
        "name": name,
        "source_name": "Consultoría 2024/25 (sintética)",
        "headers": HEADERS,
        "columns": COLUMNS,
        "description": "[SUPUESTO] Columnas ilustrativas.",
        **overrides,
    }


def create(client: TestClient, name: str, **overrides: Any) -> dict[str, Any]:
    response = client.post(TEMPLATES, json=template_body(name, **overrides))
    assert response.status_code == 201, response.text
    return dict(response.json())


def error_codes(response: Any) -> list[str]:
    return [error["code"] for error in response.json()["details"]["errors"]]


def upload(client: TestClient) -> str:
    response = client.post(f"{IMPORTS}/upload", files={"file": ("sabana.xlsx", SABANA)})
    assert response.status_code == 202, response.text
    return str(response.json()["batch_id"])


def stored_mapping(pipeline: Pipeline, batch_id: str) -> Any:
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        return batch.mapping


# --- alta, consulta y edición ---------------------------------------------------------------


def test_create_stores_v1_and_answers_with_column_mappings(pipeline: Pipeline) -> None:
    name = unique("Sábana consultoría")
    created = create(pipeline.client, name)

    assert created["name"] == name
    assert created["columns"] == COLUMNS_OUT
    assert created["header_signature"] == header_signature(HEADERS)
    with pipeline.session() as session:
        template = session.get(ImportMappingTemplate, uuid.UUID(created["id"]))
        assert template is not None
        assert template.mapping["version"] == 1
        assert isinstance(read_mapping(template.mapping), MappingSpecV1)

    detail = pipeline.client.get(f"{TEMPLATES}/{created['id']}")
    assert detail.status_code == 200
    # SQLite drops the time zone of ``created_at`` on reload; the rest must match.
    assert {**detail.json(), "created_at": None} == {**created, "created_at": None}
    listed = pipeline.client.get(TEMPLATES, params={"source_name": created["source_name"]})
    assert created["id"] in {item["id"] for item in listed.json()}


def test_signature_ignores_order_and_accents() -> None:
    reordered = ["obs. consultoria", "material", "epoca", "N° INV", "codigos", " denominacion "]
    assert header_signature(reordered) == header_signature(HEADERS)
    assert header_signature([*HEADERS, "COLUMNA NUEVA"]) != header_signature(HEADERS)


def test_the_seed_template_is_listed_through_read_mapping(pipeline: Pipeline) -> None:
    listed = pipeline.client.get(TEMPLATES).json()
    seed = next(item for item in listed if item["name"] == "Plantilla sábana sintética v1")
    codes = next(column for column in seed["columns"] if column["source_column"] == "CÓDIGOS")
    assert codes["target_field"] == "identifier"
    assert codes["split_compound"] is True
    payload = next(c for c in seed["columns"] if c["source_column"] == "OBS. CONSULTORÍA")
    assert payload["target_field"] is None


def test_duplicate_name_among_active_templates_is_rejected(pipeline: Pipeline) -> None:
    """[SUPUESTO T9] unique ignoring case and accents."""
    name = unique("Plantilla Ánfora")
    create(pipeline.client, name)

    response = pipeline.client.post(TEMPLATES, json=template_body(name.upper().replace("Á", "A")))

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "template_name_taken"


def test_patch_renames_and_revalidates_the_mapping(pipeline: Pipeline) -> None:
    created = create(pipeline.client, unique("Para editar"))
    new_name = unique("Editada")
    headers = ["DENOMINACIÓN", "PROCEDENCIA"]
    columns = [DENOMINATION, {"source_column": "PROCEDENCIA", "target_field": "provenance"}]

    response = pipeline.client.patch(
        f"{TEMPLATES}/{created['id']}",
        json={"name": new_name, "headers": headers, "columns": columns, "description": None},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == new_name
    assert [column["source_column"] for column in body["columns"]] == headers
    assert body["header_signature"] == header_signature(headers)
    assert body["description"] is None

    only_headers = pipeline.client.patch(f"{TEMPLATES}/{created['id']}", json={"headers": headers})
    assert only_headers.status_code == 422
    assert only_headers.json()["code"] == "headers_and_columns_required"


# --- validación del spec --------------------------------------------------------------------


def test_unknown_transformation_lists_the_available_ones(pipeline: Pipeline) -> None:
    columns = [{**DENOMINATION, "transforms": ["capitalizar"]}]
    response = pipeline.client.post(
        TEMPLATES, json=template_body(unique("Mala"), headers=["DENOMINACIÓN"], columns=columns)
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_mapping"
    [error] = response.json()["details"]["errors"]
    assert error["code"] == "invalid_transform"
    assert "Transformaciones disponibles" in error["message"]


@pytest.mark.parametrize(
    ("columns", "expected"),
    [
        ([DENOMINATION, {"source_column": "NO ESTÁ", "target_field": "notes"}], "unknown_column"),
        (
            [DENOMINATION, {"source_column": "MATERIAL", "target_field": "terms:NOEXISTE"}],
            "unknown_vocabulary",
        ),
        (
            [
                DENOMINATION,
                {
                    "source_column": "MATERIAL",
                    "target_field": "terms:MATERIAL",
                    "transforms": ["value_map"],
                    "value_map": {"maguey": "MAGUEY_INEXISTENTE"},
                },
            ],
            "unknown_term",
        ),
        ([{"source_column": "MATERIAL", "target_field": "notes"}], "denomination_required"),
        ([{**DENOMINATION, "transforms": ["split:,"]}], "multiple_values"),
    ],
)
def test_invalid_spec_is_rejected(
    pipeline: Pipeline, columns: list[dict[str, Any]], expected: str
) -> None:
    response = pipeline.client.post(TEMPLATES, json=template_body(unique("Mala"), columns=columns))

    assert response.status_code == 422, response.text
    assert expected in error_codes(response)


# --- eliminación lógica (RN-005) ------------------------------------------------------------


def test_cataloguer_cannot_delete_and_viewer_cannot_list(pipeline: Pipeline) -> None:
    """[SUPUESTO T8] deleting needs ``imports.approve``; listing needs ``imports.prepare``."""
    created = create(pipeline.client, unique("Protegida"))

    deleted = pipeline.client.delete(f"{TEMPLATES}/{created['id']}", params={"reason": "Prueba"})
    assert deleted.status_code == 403
    assert pipeline.login("INTERNAL_VIEWER").get(TEMPLATES).status_code == 403


def test_logical_delete_keeps_batch_references_and_goes_to_the_trash(
    pipeline: Pipeline,
) -> None:
    """Scenario «Eliminar una plantilla usada»."""
    name = unique("Usada por un lote")
    created = create(pipeline.client, name)
    template_id = uuid.UUID(created["id"])
    batch_id = upload(pipeline.client)
    mapped = pipeline.client.put(f"{IMPORTS}/{batch_id}/mapping", json={"columns": [DENOMINATION]})
    assert mapped.status_code == 200, mapped.text
    with pipeline.session() as session:  # no API links a batch to a template yet (task 3.5)
        session.execute(
            update(ImportBatch)
            .where(ImportBatch.id == uuid.UUID(batch_id))
            .values(template_id=template_id)
        )
        session.commit()
    mapping_before = stored_mapping(pipeline, batch_id)
    manager = pipeline.login("COLLECTIONS_MANAGER")

    without_reason = manager.delete(f"{TEMPLATES}/{template_id}")
    assert without_reason.status_code == 422
    deleted = manager.delete(f"{TEMPLATES}/{template_id}", params={"reason": "Fuente retirada"})
    assert deleted.status_code == 204, deleted.text

    assert pipeline.client.get(f"{TEMPLATES}/{template_id}").status_code == 404
    assert str(template_id) not in {item["id"] for item in pipeline.client.get(TEMPLATES).json()}
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        assert batch.template_id == template_id
        assert batch.mapping == mapping_before
        row = session.scalar(
            select(ImportMappingTemplate)
            .where(ImportMappingTemplate.id == template_id)
            .execution_options(**{INCLUDE_DELETED: True})
        )
        assert row is not None and row.deleted_at is not None
        assert row.deletion_reason == "Fuente retirada"

    trash = pipeline.login("ADMIN").get(
        "/api/v1/trash", params={"entity_type": "import_mapping_template"}
    )
    assert trash.status_code == 200, trash.text
    entry = next(item for item in trash.json()["items"] if item["entity_id"] == str(template_id))
    assert entry["entity_label"] == name
    assert entry["type_label"] == "Plantilla de mapeo"
    assert entry["deletion_reason"] == "Fuente retirada"

    # The name is unique among the active templates only [SUPUESTO T9].
    create(pipeline.client, name)


# --- PUT /imports/{batch_id}/mapping (design D1) -------------------------------------------


def test_put_mapping_without_the_new_fields_is_unchanged(pipeline: Pipeline) -> None:
    body = {
        "columns": [
            DENOMINATION,
            {"source_column": "CÓDIGOS", "target_field": "identifier:PUCP"},
        ],
        "defaults": {"tenure_regime": "Propiedad"},
    }
    explicit = {
        **body,
        "columns": [{**column, "transforms": [], "value_map": None} for column in body["columns"]],
    }
    expected = _mapping_spec(MappingRequest.model_validate(body)).as_json()
    assert expected["version"] == 0

    for request in (body, explicit):
        batch_id = upload(pipeline.client)
        response = pipeline.client.put(f"{IMPORTS}/{batch_id}/mapping", json=request)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "MAPPED"
        assert stored_mapping(pipeline, batch_id) == expected


@pytest.mark.parametrize(
    "column",
    [
        {**DENOMINATION, "transforms": ["trim"]},
        {**DENOMINATION, "value_map": {"retablo": "RETABLO"}},
        {"source_column": "MATERIAL", "target_field": "terms:MATERIAL"},
    ],
    ids=["transforms", "value_map", "terms"],
)
def test_put_mapping_with_v1_fields_stores_v1(pipeline: Pipeline, column: dict[str, Any]) -> None:
    """Phase 2 of design D1: transformations, ``value_map`` or ``terms:`` make the batch v1."""
    batch_id = upload(pipeline.client)
    columns = [column] if column["source_column"] == "DENOMINACIÓN" else [DENOMINATION, column]

    response = pipeline.client.put(f"{IMPORTS}/{batch_id}/mapping", json={"columns": columns})

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MAPPED"
    stored = stored_mapping(pipeline, batch_id)
    assert stored["version"] == 1
    assert [spec.source for spec in read_mapping(stored).columns] == [
        item["source_column"] for item in columns
    ]


def test_put_mapping_with_a_template_stores_its_v1_mapping(pipeline: Pipeline) -> None:
    """Phase 2 of design D1: the template defines the mapping; its defaults travel with it
    (contract labels in the API, internal codes in the JSON; ADR-002)."""
    columns = [
        {**DENOMINATION, "transforms": ["trim"]},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "MATERIAL", "target_field": "terms:MATERIAL", "transforms": ["split:,"]},
    ]
    created = create(
        pipeline.client,
        unique("Aplicable a la sábana"),
        headers=["DENOMINACIÓN", "CÓDIGOS", "MATERIAL"],
        columns=columns,
        defaults={"tenure_regime": "Comodato"},
    )
    assert created["defaults"] == {"tenure_regime": "Comodato"}
    batch_id = upload(pipeline.client)

    with_columns = pipeline.client.put(
        f"{IMPORTS}/{batch_id}/mapping",
        json={"template_id": created["id"], "columns": [DENOMINATION]},
    )
    response = pipeline.client.put(
        f"{IMPORTS}/{batch_id}/mapping", json={"template_id": created["id"]}
    )

    assert with_columns.status_code == 422
    assert with_columns.json()["code"] == "template_with_columns"
    assert response.status_code == 200, response.text
    assert response.json()["template_id"] == created["id"]
    with pipeline.session() as session:
        template = session.get(ImportMappingTemplate, uuid.UUID(created["id"]))
        assert template is not None
        assert template.mapping["defaults"] == {"tenure_regime": "LOAN_FOR_USE"}
        assert stored_mapping(pipeline, batch_id) == template.mapping


def test_put_mapping_with_a_template_the_file_does_not_fit_is_rejected(
    pipeline: Pipeline,
) -> None:
    """The template is validated against the headers of the batch: «N° INV» is missing."""
    created = create(pipeline.client, unique("Otra fuente"))
    batch_id = upload(pipeline.client)

    response = pipeline.client.put(
        f"{IMPORTS}/{batch_id}/mapping", json={"template_id": created["id"]}
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_mapping"
    assert "unknown_column" in error_codes(response)
    assert stored_mapping(pipeline, batch_id) is None


def test_saving_a_batch_mapping_as_a_template_is_still_not_available(
    pipeline: Pipeline,
) -> None:
    batch_id = upload(pipeline.client)

    response = pipeline.client.put(
        f"{IMPORTS}/{batch_id}/mapping",
        json={"columns": [DENOMINATION], "save_as_template_name": unique("No")},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "templates_not_available"


def test_template_defaults_use_contract_labels(pipeline: Pipeline) -> None:
    invalid = pipeline.client.post(
        TEMPLATES,
        json=template_body(unique("Régimen raro"), defaults={"tenure_regime": "Alquiler"}),
    )
    created = create(
        pipeline.client, unique("Con régimen"), defaults={"tenure_regime": "Propiedad"}
    )
    kept = pipeline.client.patch(
        f"{TEMPLATES}/{created['id']}", json={"headers": HEADERS, "columns": COLUMNS}
    )
    alone = pipeline.client.patch(
        f"{TEMPLATES}/{created['id']}", json={"defaults": {"tenure_regime": "Comodato"}}
    )

    assert invalid.status_code == 422 and invalid.json()["code"] == "invalid_mapping"
    assert created["defaults"] == {"tenure_regime": "Propiedad"}
    assert kept.status_code == 200 and kept.json()["defaults"] == {"tenure_regime": "Propiedad"}
    assert alone.status_code == 422 and alone.json()["code"] == "headers_and_columns_required"
