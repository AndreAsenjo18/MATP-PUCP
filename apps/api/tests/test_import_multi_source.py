"""Spec importacion-datos — Varias columnas en un mismo campo; Fecha de ingreso y forma de
adquisición desde la importación (RF-021, RF-006, RF-008, RN-003).

Change formatos-reales-importacion, tasks 5.1 to 5.3 (design D3, D4): a field from several
columns, separate measure columns into structured dimensions and their text, the entry date and
the acquisition method that deduces the regime. Synthetic values only (RNF-014).
"""

from datetime import datetime
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.modules.imports.mapping import (
    ColumnSpecV1,
    FieldTarget,
    MappingContext,
    MappingSpecV1,
    MeasuresTarget,
    SourcePayloadTarget,
    TermsTarget,
    apply_mapping,
    validate_mapping,
)

MEASURES = ["Alto (cm)", "Ancho (cm)", "Espesor (cm)", "Diámetro (cm)", "Peso (gr)"]
SPEC = MappingSpecV1(
    columns=[
        ColumnSpecV1(source="Título", target=FieldTarget(name="denomination")),
        ColumnSpecV1(
            source="Procedencia",
            target=FieldTarget(name="provenance"),
            sources=["Procedencia", "Procedencia (2)", "Procedencia (3)"],
            join=", ",
        ),
        ColumnSpecV1(
            source="Alto (cm)",
            target=MeasuresTarget(magnitudes=["alto", "ancho", "espesor", "diámetro", "peso"]),
            sources=MEASURES,
        ),
        ColumnSpecV1(source="Fecha de ingreso", target=FieldTarget(name="entry_date")),
        ColumnSpecV1(source="Forma", target=TermsTarget(vocabulary="ACQUISITION_METHOD")),
    ]
)
HEADERS = [
    "Título",
    "Procedencia",
    "Procedencia (2)",
    "Procedencia (3)",
    *MEASURES,
    "Fecha de ingreso",
    "Forma",
]


@pytest.fixture
def ctx(session: Session, reference: Any) -> MappingContext:
    return MappingContext(session)


def row(**values: Any) -> dict[str, Any]:
    base: dict[str, Any] = dict.fromkeys(HEADERS)
    base["Título"] = "Mate sintético"
    base.update(values)
    return base


def test_the_mapping_with_several_sources_is_valid(ctx: MappingContext) -> None:
    assert validate_mapping(SPEC, HEADERS, ctx) == []
    missing = validate_mapping(SPEC, [h for h in HEADERS if h != "Procedencia (3)"], ctx)
    assert [error.code for error in missing] == ["unknown_column"]


def test_provenance_in_three_columns(ctx: MappingContext) -> None:
    mapped = apply_mapping(
        row(**{"Procedencia": "Perú", "Procedencia (2)": None, "Procedencia (3)": "Cusco"}),
        SPEC,
        ctx,
    )

    assert mapped.fields["provenance"] == "Perú, Cusco"
    # The original of each column stays in the source data (RF-008).
    assert mapped.source_payload["Procedencia"] == "Perú"
    assert mapped.source_payload["Procedencia (3)"] == "Cusco"


def test_separate_measure_columns(ctx: MappingContext) -> None:
    mapped = apply_mapping(
        row(**{"Alto (cm)": 23, "Ancho (cm)": "15.5", "Peso (gr)": "120"}), SPEC, ctx
    )

    assert mapped.fields["dimensions_text"] == "Alto 23 cm; Ancho 15,5 cm; Peso 120 g"
    assert mapped.dimensions == [
        {"dimension": "alto", "value": 23.0, "unit": "cm"},
        {"dimension": "ancho", "value": 15.5, "unit": "cm"},
        {"dimension": "peso", "value": 120.0, "unit": "g"},
    ]
    assert mapped.warnings == []
    assert mapped.as_json()["dimensions"] == mapped.dimensions


def test_a_measure_that_is_not_a_number(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(**{"Alto (cm)": "aprox. 20", "Ancho (cm)": "8,3"}), SPEC, ctx)

    assert mapped.fields["dimensions_text"] == "Alto aprox. 20; Ancho 8,3 cm"
    assert mapped.dimensions == [{"dimension": "ancho", "value": 8.3, "unit": "cm"}]
    assert [warning.code for warning in mapped.warnings] == ["measure_not_number"]
    assert "Alto no es un número" in mapped.warnings[0].message
    assert mapped.errors == []


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (datetime(1998, 3, 15), "1998-03-15"),
        ("15/03/1998", "1998-03-15"),
        ("1998-03-15", "1998-03-15"),
    ],
)
def test_entry_date(ctx: MappingContext, value: Any, expected: str) -> None:
    mapped = apply_mapping(row(**{"Fecha de ingreso": value}), SPEC, ctx)

    assert mapped.fields["entry_date"] == expected
    assert mapped.warnings == []


def test_entry_date_with_only_a_year(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(**{"Fecha de ingreso": 1985}), SPEC, ctx)

    assert "entry_date" not in mapped.fields
    assert mapped.source_payload["Fecha de ingreso"] == 1985
    assert [warning.code for warning in mapped.warnings] == ["entry_date_year_only"]
    assert "solo año: 1985" in mapped.warnings[0].message


def test_an_unreadable_entry_date(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(**{"Fecha de ingreso": "antes de la mudanza"}), SPEC, ctx)

    assert "entry_date" not in mapped.fields
    assert mapped.source_payload["Fecha de ingreso"] == "antes de la mudanza"
    assert [warning.code for warning in mapped.warnings] == ["entry_date_unreadable"]


@pytest.mark.parametrize(
    ("method", "regime"), [("Donación", "OWNED"), ("Cesión de uso", "LOAN_FOR_USE")]
)
def test_the_acquisition_method_deduces_the_regime(
    ctx: MappingContext, method: str, regime: str
) -> None:
    mapped = apply_mapping(row(Forma=method), SPEC, ctx)

    assert mapped.tenure_regime is not None and mapped.tenure_regime.value == regime
    assert mapped.acquisition_method is not None


OWNER_SPEC = MappingSpecV1(
    columns=[
        *SPEC.columns,
        ColumnSpecV1(
            source="Propietario",
            target=SourcePayloadTarget(sensitive=True, lender_for_loans=True),
        ),
    ]
)


def test_a_loan_for_use_takes_the_owner_as_lender(ctx: MappingContext) -> None:
    """Spec «Datos personales del propietario…», scenario «Comodato con propietario»."""
    loan_row = row(Forma="Cesión de uso", Propietario="Comodante sintético")
    loan = apply_mapping(loan_row, OWNER_SPEC, ctx)
    owned = apply_mapping(row(Forma="Donación", Propietario="Donante sintético"), OWNER_SPEC, ctx)

    assert loan.fields["lender_name"] == "Comodante sintético"
    assert loan.sensitive_keys == ["Propietario"]
    assert "lender_name" not in owned.fields
    assert owned.sensitive_keys == ["Propietario"]
    assert owned.as_json()["sensitive_keys"] == ["Propietario"]
