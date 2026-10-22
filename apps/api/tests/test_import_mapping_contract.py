"""Spec importacion-datos — Formato de mapeo versionado con transformaciones trazables
(RF-022, RF-008; design D1). Shared contract test of ``MappingSpec`` v1.

Change plantillas-mapeo-y-normalizacion, task 1.1. Synthetic data only (RNF-014).
"""

from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.imports import _mapping_spec
from app.core.db import make_session_factory
from app.models import Base, ImportMappingTemplate
from app.modules.imports.mapping import (
    ColumnSpec,
    ColumnSpecV1,
    FieldTarget,
    IdentifiersTarget,
    IdentifierTarget,
    MappingConversionError,
    MappingSpec,
    MappingSpecV1,
    SourcePayloadTarget,
    TermsTarget,
    from_column_mappings,
    read_mapping,
)
from app.modules.imports.schemas import ColumnMapping, MappingRequest
from app.seed.synthetic import SeedOptions, run_seed

# Example of design D1 (illustrative column names, [SUPUESTO A1]).
D1_EXAMPLE: dict[str, Any] = {
    "version": 1,
    "columns": [
        {
            "source": "DENOMINACIÓN",
            "target": {"kind": "field", "name": "denomination"},
            "transforms": ["trim"],
        },
        {
            "source": "CÓDIGOS",
            "target": {"kind": "identifiers", "default_type": "COLECCION"},
            "transforms": ["trim", "split_concatenated"],
        },
        {
            "source": "N° INV",
            "target": {"kind": "identifier", "type": "I"},
            "transforms": ["absence_markers"],
        },
        {
            "source": "ÉPOCA",
            "target": {"kind": "field", "name": "epoch_original_text"},
            "transforms": ["propose_period"],
        },
        {
            "source": "MATERIAL",
            "target": {"kind": "terms", "vocabulary": "MATERIAL"},
            "transforms": ["split:,", "value_map"],
            "value_map": {"madera policromada": "MADERA"},
        },
        {"source": "OBS. CONSULTORÍA", "target": {"kind": "source_payload"}},
    ],
    "defaults": {"tenure_regime": "OWNED"},
}


# --- version 1 -----------------------------------------------------------------------------


def test_d1_example_is_a_valid_v1_spec() -> None:
    spec = read_mapping(D1_EXAMPLE)
    assert spec.version == 1
    assert [type(column.target) for column in spec.columns] == [
        FieldTarget,
        IdentifiersTarget,
        IdentifierTarget,
        FieldTarget,
        TermsTarget,
        SourcePayloadTarget,
    ]
    assert spec.columns[4].value_map == {"madera policromada": "MADERA"}
    assert spec.defaults == {"tenure_regime": "OWNED"}


def test_serialization_round_trip() -> None:
    spec = MappingSpecV1.model_validate(D1_EXAMPLE)
    data = spec.as_json()
    assert data["version"] == 1
    assert data["columns"][5] == {
        "source": "OBS. CONSULTORÍA",
        "target": {"kind": "source_payload"},
        "transforms": [],
    }
    assert "value_map" not in data["columns"][0]
    assert MappingSpecV1.model_validate(data) == spec
    assert read_mapping(data) == spec


def test_sheet_and_header_row_are_not_part_of_the_spec() -> None:
    for key, value in (("sheet", "Inventario"), ("header_row", 3)):
        with pytest.raises(MappingConversionError) as error:
            read_mapping({**D1_EXAMPLE, key: value})
        assert error.value.code == "invalid_mapping"


def test_unknown_transformation_is_rejected() -> None:
    data = {
        "version": 1,
        "columns": [
            {"source": "A", "target": {"kind": "field", "name": "notes"}, "transforms": ["lower"]}
        ],
    }
    with pytest.raises(MappingConversionError) as error:
        read_mapping(data)
    assert "Transformaciones disponibles" in error.value.message


def test_value_map_transformation_requires_its_table() -> None:
    with pytest.raises(ValueError, match="value_map"):
        ColumnSpecV1(
            source="MATERIAL",
            target=TermsTarget(vocabulary="MATERIAL"),
            transforms=["value_map"],
        )


def test_unknown_target_kind_is_rejected() -> None:
    data = {"version": 1, "columns": [{"source": "A", "target": {"kind": "formula"}}]}
    with pytest.raises(MappingConversionError):
        read_mapping(data)


# --- versions ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "data",
    [
        {"version": 2, "columns": []},
        {"version": "1", "columns": []},
        {"columns": [{"source": "A", "target": "denomination"}]},  # no version
        {},
        {"DENOMINACIÓN": "denomination"},  # not the seed form
    ],
)
def test_unknown_version_or_form_is_an_error(data: dict[str, Any]) -> None:
    with pytest.raises(MappingConversionError) as error:
        read_mapping(data)
    assert error.value.code == "unknown_mapping_version"
    assert "no se adivina" in error.value.message


# --- v0 stored by the pipeline -------------------------------------------------------------


def test_saved_v0_batch_mapping_is_converted() -> None:
    stored = MappingSpec(
        columns=[
            ColumnSpec("DENOMINACIÓN", "denomination"),
            ColumnSpec("N° INV", "identifier", "I"),
            ColumnSpec("CÓDIGOS", "identifier", "COLECCION", split_compound=True),
            ColumnSpec("OTROS CÓDIGOS", "identifier", None, split_compound=True),
            ColumnSpec("OBS. CONSULTORÍA", "payload"),
        ],
        defaults={"tenure_regime": "Propiedad", "collection": "MMZ"},
    ).as_json()  # what ``set_mapping`` stores in ``import_batch.mapping``
    assert stored["version"] == 0

    spec = read_mapping(stored)

    assert spec.version == 1
    assert [column.source for column in spec.columns] == [
        "DENOMINACIÓN",
        "N° INV",
        "CÓDIGOS",
        "OTROS CÓDIGOS",
        "OBS. CONSULTORÍA",
    ]
    assert [column.target for column in spec.columns] == [
        FieldTarget(name="denomination"),
        IdentifierTarget(type="I"),
        IdentifiersTarget(default_type="COLECCION"),
        IdentifiersTarget(default_type=None),
        SourcePayloadTarget(),
    ]
    assert all(column.transforms == [] for column in spec.columns)
    assert spec.defaults == {"tenure_regime": "OWNED", "collection": "MMZ"}


def test_v0_defaults_with_internal_code_are_kept() -> None:
    stored = MappingSpec(columns=[], defaults={"tenure_regime": "LOAN_FOR_USE"}).as_json()
    assert read_mapping(stored).defaults == {"tenure_regime": "LOAN_FOR_USE"}


def test_v0_identifier_without_type_nor_split_is_an_error() -> None:
    stored = MappingSpec(columns=[ColumnSpec("CÓDIGO", "identifier")]).as_json()
    with pytest.raises(MappingConversionError) as error:
        read_mapping(stored)
    assert error.value.code == "identifier_type_required"
    assert error.value.column == "CÓDIGO"


def test_v0_with_an_unknown_tenure_default_is_an_error() -> None:
    stored = MappingSpec(columns=[], defaults={"tenure_regime": "Custodia"}).as_json()
    with pytest.raises(MappingConversionError) as error:
        read_mapping(stored)
    assert error.value.code == "invalid_default"


def test_malformed_v0_is_an_error() -> None:
    with pytest.raises(MappingConversionError) as error:
        read_mapping({"version": 0, "columns": [{"source": "A", "kind": "field"}]})
    assert error.value.code == "invalid_mapping"


# --- public ColumnMapping ------------------------------------------------------------------


def test_column_mappings_are_translated_like_put_mapping() -> None:
    body = MappingRequest(
        columns=[
            ColumnMapping(source_column="DENOMINACIÓN", target_field="denomination"),
            ColumnMapping(
                source_column="N° INV", target_field="identifier", identifier_type_code="I"
            ),
            ColumnMapping(source_column="INC", target_field="identifier:INC_RN"),
            ColumnMapping(
                source_column="CÓDIGOS",
                target_field="identifier",
                identifier_type_code="COLECCION",
                split_compound=True,
            ),
            ColumnMapping(source_column="OBS.", target_field=None),
            # A type on a field column is ignored, as ``PUT /mapping`` does.
            ColumnMapping(source_column="AUTOR", target_field="author", identifier_type_code="I"),
        ],
        defaults={"tenure_regime": "Comodato"},
    )

    spec = from_column_mappings(body.columns, body.defaults)

    assert [column.target for column in spec.columns] == [
        FieldTarget(name="denomination"),
        IdentifierTarget(type="I"),
        IdentifierTarget(type="INC_RN"),
        IdentifiersTarget(default_type="COLECCION"),
        SourcePayloadTarget(),
        FieldTarget(name="author"),
    ]
    assert spec.defaults == {"tenure_regime": "LOAN_FOR_USE"}
    # Same result as converting what ``PUT /imports/{batch_id}/mapping`` stores today.
    assert read_mapping(_mapping_spec(body).as_json()) == spec


def test_column_mappings_without_defaults() -> None:
    columns = [ColumnMapping(source_column="DENOMINACIÓN", target_field="denomination")]
    assert from_column_mappings(columns).defaults == {}


def test_identifier_column_without_type_is_an_error() -> None:
    columns = [ColumnMapping(source_column="CÓDIGO", target_field="identifier:")]
    with pytest.raises(MappingConversionError) as error:
        from_column_mappings(columns)
    assert error.value.code == "identifier_type_required"


# --- seed template -------------------------------------------------------------------------


@pytest.fixture(scope="module")
def seeded_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    session = make_session_factory(engine)()
    run_seed(session, SeedOptions(upload_media=False, admin_password="demo-password-1"))
    session.commit()
    yield session
    session.close()
    engine.dispose()


def test_seed_template_is_converted(seeded_session: Session) -> None:
    template = seeded_session.scalars(select(ImportMappingTemplate)).one()
    assert "version" not in template.mapping  # the seed form

    spec = read_mapping(template.mapping)

    targets = {column.source: column.target for column in spec.columns}
    assert targets == {
        "DENOMINACIÓN": FieldTarget(name="denomination"),
        "CÓDIGOS": IdentifiersTarget(default_type=None),
        "ÉPOCA": FieldTarget(name="epoch_original_text"),
        "PROCEDENCIA": FieldTarget(name="provenance"),
        "OBS. CONSULTORÍA": SourcePayloadTarget(),
    }
    assert spec.defaults == {}
    assert read_mapping(spec.as_json()) == spec
