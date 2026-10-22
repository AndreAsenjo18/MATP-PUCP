"""Spec importacion-datos — Formato de mapeo versionado con transformaciones trazables y
Correspondencia de valores con vocabularios controlados (RF-022, RF-008, RF-011, RN-010;
design D1, D2).

Change plantillas-mapeo-y-normalizacion, task 1.3. Synthetic data only (RNF-014): the rows come
from the synthetic consultancy spreadsheet (``app.seed.fixtures``).
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.collections.service import create_collection
from app.modules.identification.models import IdentifierType
from app.modules.imports.ingest import ingest
from app.modules.imports.mapping import (
    ColumnSpec,
    MappedRow,
    MappingContext,
    MappingSpec,
    MappingSpecV1,
    apply_mapping,
    read_mapping,
    validate_mapping,
)
from app.seed.fixtures import HEADERS, write_synthetic_workbook
from app.seed.reference import ReferenceData
from tests.conftest import ActAs

SABANA_V1: dict[str, Any] = {
    "version": 1,
    "columns": [
        {
            "source": "DENOMINACIÓN",
            "target": {"kind": "field", "name": "denomination"},
            "transforms": ["trim"],
        },
        {
            "source": "CÓDIGOS",
            "target": {"kind": "identifiers", "default_type": None},
            "transforms": ["trim", "absence_markers", "split_concatenated"],
        },
        {
            "source": "ÉPOCA",
            "target": {"kind": "field", "name": "epoch_original_text"},
            "transforms": ["trim", "propose_period"],
        },
        {
            "source": "MATERIAL",
            "target": {"kind": "terms", "vocabulary": "MATERIAL"},
            "transforms": ["split:,", "value_map"],
            "value_map": {"madera policromada": "MADERA"},
        },
        {
            "source": "MEDIDAS",
            "target": {"kind": "field", "name": "dimensions_text"},
            "transforms": ["trim", "propose_dimensions"],
        },
        {"source": "OBS. CONSULTORÍA", "target": {"kind": "source_payload"}},
    ],
    "defaults": {"tenure_regime": "OWNED"},
}

# The same columns as the pipeline maps them today (v0, no transformations).
SABANA_V0 = MappingSpec(
    columns=[
        ColumnSpec("DENOMINACIÓN", "denomination"),
        ColumnSpec("CÓDIGOS", "identifier", None, split_compound=True),
        ColumnSpec("ÉPOCA", "epoch_original_text"),
        ColumnSpec("MEDIDAS", "dimensions_text"),
        ColumnSpec("OBS. CONSULTORÍA", "payload"),
    ],
    defaults={"tenure_regime": "Propiedad"},
)


@pytest.fixture(scope="module")
def sabana_rows(tmp_path_factory: pytest.TempPathFactory) -> list[dict[str, Any]]:
    path: Path = write_synthetic_workbook(tmp_path_factory.mktemp("sabana"))
    result = ingest(path.read_bytes(), path.name)
    return [row.raw_data for row in result.rows]


@pytest.fixture
def ctx(session: Session, reference: ReferenceData) -> MappingContext:
    return MappingContext(session)


def by_denomination(rows: list[dict[str, Any]], denomination: str) -> dict[str, Any]:
    return next(row for row in rows if row["DENOMINACIÓN"] == denomination)


def spec_with(**changes: Any) -> MappingSpecV1:
    return MappingSpecV1.model_validate({**SABANA_V1, **changes})


def one_column(column: dict[str, Any], **defaults: str) -> MappingSpecV1:
    denomination = {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}}
    return MappingSpecV1.model_validate(
        {"version": 1, "columns": [denomination, column], "defaults": defaults}
    )


# --- validation ----------------------------------------------------------------------------


def test_synthetic_v1_mapping_is_valid(ctx: MappingContext) -> None:
    assert validate_mapping(read_mapping(SABANA_V1), HEADERS, ctx) == []


def test_v0_mapping_is_still_valid(ctx: MappingContext) -> None:
    assert validate_mapping(SABANA_V0, HEADERS, ctx) == []


def test_denomination_is_required_unless_it_has_a_default(ctx: MappingContext) -> None:
    columns = [c for c in SABANA_V1["columns"] if c["source"] != "DENOMINACIÓN"]
    errors = validate_mapping(spec_with(columns=columns), HEADERS, ctx)
    assert [error.code for error in errors] == ["denomination_required"]
    with_default = spec_with(columns=columns, defaults={"denomination": "Pieza sin nombre"})
    assert validate_mapping(with_default, HEADERS, ctx) == []
    blank_default = spec_with(columns=columns, defaults={"denomination": "  "})
    assert [e.code for e in validate_mapping(blank_default, HEADERS, ctx)] == [
        "denomination_required"
    ]


def test_duplicate_scalar_target(ctx: MappingContext) -> None:
    spec = one_column({"source": "UBICACIÓN", "target": {"kind": "field", "name": "denomination"}})
    errors = validate_mapping(spec, HEADERS, ctx)
    assert [(error.code, error.column) for error in errors] == [("duplicate_target", "UBICACIÓN")]


def test_unknown_field_target(ctx: MappingContext) -> None:
    spec = one_column({"source": "UBICACIÓN", "target": {"kind": "field", "name": "title"}})
    assert [error.code for error in validate_mapping(spec, HEADERS, ctx)] == ["unknown_target"]


def test_a_scalar_field_cannot_be_split(ctx: MappingContext) -> None:
    spec = one_column(
        {
            "source": "PROCEDENCIA",
            "target": {"kind": "field", "name": "provenance"},
            "transforms": ["split:,"],
        }
    )
    assert [error.code for error in validate_mapping(spec, HEADERS, ctx)] == ["multiple_values"]


def test_unknown_and_inactive_identifier_types(session: Session, ctx: MappingContext) -> None:
    unknown = one_column({"source": "CÓDIGOS", "target": {"kind": "identifier", "type": "XYZ"}})
    assert [e.code for e in validate_mapping(unknown, HEADERS, ctx)] == ["unknown_identifier_type"]

    session.execute(
        update(IdentifierType).where(IdentifierType.code == "PUCP").values(is_active=False)
    )
    inactive_ctx = MappingContext(session)
    for target in (
        {"kind": "identifier", "type": "PUCP"},
        {"kind": "identifiers", "default_type": "PUCP"},
    ):
        spec = one_column({"source": "CÓDIGOS", "target": target})
        errors = validate_mapping(spec, HEADERS, inactive_ctx)
        assert [error.code for error in errors] == ["inactive_identifier_type"]


def test_unknown_vocabulary(ctx: MappingContext) -> None:
    spec = one_column({"source": "MATERIAL", "target": {"kind": "terms", "vocabulary": "COLORES"}})
    assert [error.code for error in validate_mapping(spec, HEADERS, ctx)] == ["unknown_vocabulary"]


def test_deleted_vocabulary_counts_as_unknown(session: Session, ctx: MappingContext) -> None:
    session.execute(
        update(Vocabulary)
        .where(Vocabulary.code == "MATERIAL")
        .values(deleted_at=datetime(2026, 1, 1))
    )
    errors = validate_mapping(read_mapping(SABANA_V1), HEADERS, MappingContext(session))
    assert [error.code for error in errors] == ["unknown_vocabulary"]


def test_value_map_to_an_inactive_or_unknown_term(session: Session, ctx: MappingContext) -> None:
    session.execute(update(Term).where(Term.code == "YESO").values(is_active=False))
    spec = one_column(
        {
            "source": "MATERIAL",
            "target": {"kind": "terms", "vocabulary": "MATERIAL"},
            "transforms": ["value_map"],
            "value_map": {"yeso policromado": "YESO", "maguey": "MAGUEY"},
        }
    )
    errors = validate_mapping(spec, HEADERS, MappingContext(session))
    assert [error.code for error in errors] == ["inactive_term", "unknown_term"]
    assert "Yeso" in errors[0].message
    assert "MAGUEY" in errors[1].message


def test_v1_defaults_use_internal_codes(ctx: MappingContext) -> None:
    errors = validate_mapping(spec_with(defaults={"tenure_regime": "Propiedad"}), HEADERS, ctx)
    assert [error.code for error in errors] == ["invalid_default"]
    assert "OWNED" in errors[0].message
    assert (
        validate_mapping(spec_with(defaults={"tenure_regime": "LOAN_FOR_USE"}), HEADERS, ctx) == []
    )


def test_v0_defaults_keep_accepting_contract_labels(ctx: MappingContext) -> None:
    spec = MappingSpec(columns=SABANA_V0.columns, defaults={"tenure_regime": "Comodato"})
    assert validate_mapping(spec, HEADERS, ctx) == []
    bad = MappingSpec(columns=SABANA_V0.columns, defaults={"tenure_regime": "Custodia"})
    assert [error.code for error in validate_mapping(bad, HEADERS, ctx)] == ["invalid_default"]


def test_unknown_default_and_collection_default(
    session: Session, ctx: MappingContext, act_as: ActAs
) -> None:
    errors = validate_mapping(spec_with(defaults={"author": "Anónimo"}), HEADERS, ctx)
    assert [error.code for error in errors] == ["unknown_default"]
    errors = validate_mapping(spec_with(defaults={"collection": "MMZ"}), HEADERS, ctx)
    assert [error.code for error in errors] == ["invalid_default"]
    with act_as("COLLECTIONS_MANAGER"):
        create_collection(session, name="Colección sintética MMZ", acronym="MMZ")
    assert (
        validate_mapping(
            spec_with(defaults={"collection": "MMZ"}), HEADERS, MappingContext(session)
        )
        == []
    )


def test_v0_identifier_without_type_keeps_its_error(ctx: MappingContext) -> None:
    spec = MappingSpec(
        columns=[ColumnSpec("DENOMINACIÓN", "denomination"), ColumnSpec("CÓDIGOS", "identifier")]
    )
    errors = validate_mapping(spec, HEADERS, ctx)
    assert [(error.code, error.column) for error in errors] == [
        ("identifier_type_required", "CÓDIGOS")
    ]
    assert "marque que la celda puede tener varios códigos" in errors[0].message


def test_unknown_and_duplicate_columns(ctx: MappingContext) -> None:
    denomination = {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}}
    spec = MappingSpecV1.model_validate(
        {
            "version": 1,
            "columns": [
                denomination,
                {"source": "NO EXISTE", "target": {"kind": "source_payload"}},
                {"source": "DENOMINACIÓN", "target": {"kind": "source_payload"}},
            ],
        }
    )
    errors = validate_mapping(spec, HEADERS, ctx)
    assert [error.code for error in errors] == ["unknown_column", "duplicate_column"]


# --- application on the synthetic spreadsheet ----------------------------------------------


def test_v0_and_its_v1_conversion_map_every_row_the_same(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    converted = read_mapping(SABANA_V0.as_json())
    for raw in sabana_rows:
        assert (
            apply_mapping(raw, converted, ctx).as_json()
            == apply_mapping(raw, SABANA_V0, ctx).as_json()
        )


def test_transforms_do_not_change_the_identifiers_proposed(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    for raw in sabana_rows:
        assert (
            apply_mapping(raw, spec, ctx).identifiers
            == apply_mapping(raw, SABANA_V0, ctx).identifiers
        )


def test_concatenated_codes_and_absence_markers(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    toro = apply_mapping(by_denomination(sabana_rows, "Toro de Pucará"), spec, ctx)
    assert [(i.type_code, i.normalized_value) for i in toro.identifiers] == [
        ("I", "I-236"),
        ("COLECCION", "MMZ 15"),
    ]
    trace = toro.transformed["CÓDIGOS"].trace
    assert trace[-1].before == "I-0236 / M.M.Z. 015"
    assert trace[-1].after == ["I-0236", "M.M.Z. 015"]

    cajon = apply_mapping(by_denomination(sabana_rows, "Cajón San Marcos"), spec, ctx)
    assert [(i.original_value, i.is_absent) for i in cajon.identifiers] == [("S/N", True)]


def test_period_and_dimension_proposals_stay_in_memory(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    retablo = apply_mapping(by_denomination(sabana_rows, "Retablo ayacuchano"), spec, ctx)
    assert retablo.fields["epoch_original_text"] == "ca. 1950"
    assert retablo.fields["dimensions_text"] == "alto 40 cm"
    assert retablo.proposals == {
        "ÉPOCA": {"epoch_type": "APPROXIMATE", "epoch_start_year": 1940, "epoch_end_year": 1960},
        "MEDIDAS": {"dimensions": [{"dimension": "alto", "value": 40.0, "unit": "cm"}]},
    }
    stored = retablo.as_json()
    assert "epoch_type" not in stored["fields"]
    assert "dimensions" not in stored["fields"]
    assert set(stored) == {
        "fields",
        "collection_id",
        "tenure_regime",
        "identifiers",
        "source_payload",
    }


def test_unlabeled_dimensions_are_a_valid_preview_proposal(ctx: MappingContext) -> None:
    spec = read_mapping(SABANA_V1)
    row = apply_mapping({"DENOMINACIÓN": "Tabla", "MEDIDAS": "23 x 15 cm"}, spec, ctx)
    assert row.proposals["MEDIDAS"]["dimensions"][0] == {
        "dimension": None,
        "value": 23.0,
        "unit": "cm",
    }
    assert row.errors == []
    json.dumps(row.as_json())


def test_unrecognized_texts_have_no_proposal(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    toro = apply_mapping(by_denomination(sabana_rows, "Toro de Pucará"), spec, ctx)
    assert "MEDIDAS" not in toro.proposals  # "alto 23 cm x diám. 15 cm": "diám." is not a label
    assert toro.proposals["ÉPOCA"]["epoch_type"] == "CENTURY"
    charango = apply_mapping(by_denomination(sabana_rows, "Charango"), spec, ctx)
    assert "ÉPOCA" not in charango.proposals  # "desconocida"
    assert charango.fields["epoch_original_text"] == "desconocida"


def test_term_matches_and_the_text_kept_in_the_payload(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    retablo = apply_mapping(by_denomination(sabana_rows, "Retablo ayacuchano"), spec, ctx)
    matches = retablo.term_matches["MATERIAL"]
    assert matches.matched == [("madera", "MADERA"), ("pasta de papa", "PASTA_PAPA")]
    assert matches.unmatched == []
    assert retablo.source_payload["MATERIAL"] == "madera, pasta de papa"

    nino = apply_mapping(by_denomination(sabana_rows, "Niño Manuelito"), spec, ctx)
    assert nino.term_matches["MATERIAL"].matched == [("MADERA", "MADERA")]  # via value_map
    assert nino.source_payload["MATERIAL"] == "madera policromada"


def test_value_without_term_goes_to_the_payload_and_creates_nothing(
    session: Session, ctx: MappingContext
) -> None:
    before = session.scalar(select(Term.id).where(Term.code == "MAGUEY"))
    row = apply_mapping(
        {"DENOMINACIÓN": "Soga", "MATERIAL": "maguey"}, read_mapping(SABANA_V1), ctx
    )
    assert row.term_matches["MATERIAL"].unmatched == ["maguey"]
    assert row.source_payload["MATERIAL"] == "maguey"
    assert before is None
    assert session.scalar(select(Term.id).where(Term.code == "MAGUEY")) is None


def test_inactive_term_does_not_match(session: Session, reference: ReferenceData) -> None:
    session.execute(update(Term).where(Term.code == "YESO").values(is_active=False))
    row = apply_mapping(
        {"DENOMINACIÓN": "Máscara", "MATERIAL": "yeso"},
        read_mapping(SABANA_V1),
        MappingContext(session),
    )
    assert row.term_matches["MATERIAL"].unmatched == ["yeso"]


def test_unmapped_columns_go_to_the_payload(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    raw = by_denomination(sabana_rows, "Toro de Pucará")
    row = apply_mapping(raw, read_mapping(SABANA_V1), ctx)
    assert {"COLECCIÓN", "PROCEDENCIA", "UBICACIÓN", "MATERIAL"} <= set(row.source_payload)
    assert not {"DENOMINACIÓN", "CÓDIGOS", "ÉPOCA", "MEDIDAS"} & set(row.source_payload)


def test_defaults_with_internal_codes(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    row = apply_mapping(sabana_rows[0], read_mapping(SABANA_V1), ctx)
    assert row.tenure_regime is not None and row.tenure_regime.value == "OWNED"
    assert row.as_json()["tenure_regime"] == "OWNED"


def test_denomination_default_fills_an_empty_value(ctx: MappingContext) -> None:
    columns = [c for c in SABANA_V1["columns"] if c["source"] != "DENOMINACIÓN"]
    spec = spec_with(columns=columns, defaults={"denomination": "Pieza sin nombre"})
    assert apply_mapping({"ÉPOCA": "s. XX"}, spec, ctx).fields["denomination"] == "Pieza sin nombre"


def test_mapped_rows_are_json_and_round_trip(
    sabana_rows: list[dict[str, Any]], ctx: MappingContext
) -> None:
    spec = read_mapping(SABANA_V1)
    for raw in sabana_rows:
        row = apply_mapping(raw, spec, ctx)
        stored = json.loads(json.dumps(row.as_json()))
        assert MappedRow.from_json(stored).as_json() == stored


# --- stored values are text ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "transform", "stored"),
    [
        ("03/04/1998", "date:dd/mm/yyyy", "1998-04-03"),
        ("1998", "date:yyyy", "1998"),
        (1998, "date:yyyy", "1998"),
        (datetime(1998, 4, 3), "date:dd/mm/yyyy", "1998-04-03T00:00:00"),
    ],
)
def test_dates_and_years_are_stored_as_text(
    raw: Any, transform: str, stored: str, ctx: MappingContext
) -> None:
    spec = one_column(
        {"source": "FECHA", "target": {"kind": "field", "name": "notes"}, "transforms": [transform]}
    )
    row = apply_mapping({"DENOMINACIÓN": "Quena", "FECHA": raw}, spec, ctx)
    assert row.fields["notes"] == stored
    assert row.errors == []
    json.dumps(row.as_json())


def test_transformation_error_is_a_row_error_and_keeps_the_original(ctx: MappingContext) -> None:
    spec = one_column(
        {
            "source": "FECHA",
            "target": {"kind": "field", "name": "notes"},
            "transforms": ["date:dd/mm/yyyy"],
        }
    )
    raw = {"DENOMINACIÓN": "Quena", "FECHA": "1998-04-03"}
    row = apply_mapping(raw, spec, ctx)
    assert "notes" not in row.fields
    assert [(error.code, error.field) for error in row.errors] == [
        ("date_format_mismatch", "notes")
    ]
    assert "FECHA" in row.errors[0].message
    assert row.transformed["FECHA"].original == "1998-04-03"
    assert row.row_input(2).errors == row.errors  # classification sees the error


def test_preview_data_does_not_affect_row_equality(ctx: MappingContext) -> None:
    raw = {"DENOMINACIÓN": "Retablo", "ÉPOCA": "ca. 1950"}
    with_preview = apply_mapping(raw, read_mapping(SABANA_V1), ctx)
    assert with_preview.proposals
    assert MappedRow.from_json(with_preview.as_json()) == with_preview


def test_context_builds_the_plan_once_per_spec(ctx: MappingContext) -> None:
    assert ctx.plan(SABANA_V0) is ctx.plan(SABANA_V0)


def test_collection_field_and_default(
    session: Session, act_as: ActAs, reference: ReferenceData
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        mmz: Collection = create_collection(session, name="Colección sintética MMZ", acronym="MMZ")
    spec = one_column(
        {
            "source": "COLECCIÓN",
            "target": {"kind": "field", "name": "collection"},
            "transforms": ["trim", "upper"],
        },
        collection="MMZ",
    )
    ctx = MappingContext(session)
    assert (
        apply_mapping({"DENOMINACIÓN": "Toro", "COLECCIÓN": " m.m.z. "}, spec, ctx).collection_id
        == mmz.id
    )
    assert apply_mapping({"DENOMINACIÓN": "Toro"}, spec, ctx).collection_id == mmz.id
    unknown = apply_mapping({"DENOMINACIÓN": "Toro", "COLECCIÓN": "XYZ"}, spec, ctx)
    assert [error.code for error in unknown.errors] == ["unknown_collection"]
