"""Spec importacion-datos — Formato de mapeo versionado: un lote con mapeo v1 (RF-022;
design D1, phase 2).

Change plantillas-mapeo-y-normalizacion, task 3.5. ``MappingSpec.from_json`` reads v1 and keeps
a v0 projection, so the pipeline code that reads ``MappingSpec`` (``field_diff``,
``validate_stage``, ``decisions``) works unchanged. Synthetic data only (RNF-014).
"""

from typing import Any

from app.modules.imports.mapping import (
    ColumnSpec,
    MappingSpec,
    MappingSpecV1,
    _plan,
    read_mapping,
)

V1: dict[str, Any] = {
    "version": 1,
    "columns": [
        {
            "source": "DENOMINACIÓN",
            "target": {"kind": "field", "name": "denomination"},
            "transforms": ["trim"],
        },
        {"source": "N° INV", "target": {"kind": "identifier", "type": "I"}},
        {
            "source": "CÓDIGOS",
            "target": {"kind": "identifiers", "default_type": "COLECCION"},
            "transforms": ["split_concatenated"],
        },
        {
            "source": "MATERIAL",
            "target": {"kind": "terms", "vocabulary": "MATERIAL"},
            "transforms": ["value_map"],
            "value_map": {"madera policromada": "MADERA"},
        },
        {"source": "OBS.", "target": {"kind": "source_payload"}},
    ],
    "defaults": {"tenure_regime": "OWNED"},
}
V0: dict[str, Any] = {
    "version": 0,
    "columns": [
        {
            "source": "DENOMINACIÓN",
            "target": "denomination",
            "identifier_type": None,
            "split_compound": False,
        }
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def test_from_json_reads_v1_with_a_v0_projection() -> None:
    spec = MappingSpec.from_json(V1)

    assert spec.version == 1
    assert spec.v1 == MappingSpecV1.model_validate(V1)
    assert spec.columns == [
        ColumnSpec("DENOMINACIÓN", "denomination"),
        ColumnSpec("N° INV", "identifier", "I"),
        ColumnSpec("CÓDIGOS", "identifier", "COLECCION", True),
        ColumnSpec("MATERIAL", "terms:MATERIAL"),
        ColumnSpec("OBS.", "payload"),
    ]
    assert spec.defaults == {"tenure_regime": "OWNED"}
    # What ``field_diff`` reads: record field names as text, the rest never a record field.
    assert {column.target for column in spec.columns} | set(spec.defaults) >= {
        "denomination",
        "tenure_regime",
    }


def test_as_json_stores_the_v1_form() -> None:
    spec = MappingSpec.from_json(V1)

    assert spec.as_json() == MappingSpecV1.model_validate(V1).as_json()
    assert MappingSpec.from_json(spec.as_json()) == spec
    assert read_mapping(spec.as_json()) == spec.v1


def test_the_plan_of_a_projected_spec_follows_v1_rules() -> None:
    plan = _plan(MappingSpec.from_json(V1))

    assert plan.is_v1
    assert plan.defaults == {"tenure_regime": "OWNED"}
    assert [source for source, _column in plan.columns] == [c["source"] for c in V1["columns"]]


def test_a_v0_mapping_is_read_and_stored_as_before() -> None:
    spec = MappingSpec.from_json(V0)

    assert spec.v1 is None and spec.version == 0
    assert spec.as_json() == V0
    assert not _plan(spec).is_v1
