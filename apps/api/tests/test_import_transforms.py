"""Spec importacion-datos — Formato de mapeo versionado con transformaciones trazables
(RF-022, RF-023, RF-007, RF-006; design D2).

Change plantillas-mapeo-y-normalizacion, task 1.2. Synthetic data only (RNF-014).
"""

from datetime import date, datetime
from typing import Any

import pytest

from app.modules.imports.transforms import (
    AVAILABLE_TRANSFORMS,
    NOTE_EXCEL_DATE,
    NOTE_NOT_RECOGNIZED,
    Transform,
    TransformedValue,
    TransformSpecError,
    parse_transform,
    parse_transforms,
    run_transforms,
)


def run(raw: Any, *specs: str, value_map: dict[str, str] | None = None) -> TransformedValue:
    return run_transforms(raw, parse_transforms(specs, value_map), value_map)


# --- parsing -------------------------------------------------------------------------------


def test_ten_transformations_are_available() -> None:
    assert len(AVAILABLE_TRANSFORMS) == 10


@pytest.mark.parametrize(
    ("spec", "expected"),
    [
        ("trim", Transform("trim")),
        ("split:,", Transform("split", ",")),
        ("split::", Transform("split", ":")),
        ("date", Transform("date")),
        ("date:dd/mm/yyyy", Transform("date", "dd/mm/yyyy")),
        ("date:yyyy", Transform("date", "yyyy")),
        ("default:OWNED", Transform("default", "OWNED")),
        ("default:a:b", Transform("default", "a:b")),
    ],
)
def test_parse_transform(spec: str, expected: Transform) -> None:
    assert parse_transform(spec) == expected
    assert str(expected) == spec


def test_unknown_transformation_lists_the_available_ones() -> None:
    with pytest.raises(TransformSpecError) as error:
        parse_transform("lower")
    assert "lower" in error.value.message
    assert "split_concatenated" in error.value.message
    assert error.value.transform == "lower"


@pytest.mark.parametrize("spec", ["split", "split:", "default", "default:"])
def test_missing_argument_is_rejected(spec: str) -> None:
    with pytest.raises(TransformSpecError, match="requiere un valor"):
        parse_transform(spec)


def test_argument_on_a_transformation_without_one_is_rejected() -> None:
    with pytest.raises(TransformSpecError, match="no admite argumento"):
        parse_transform("trim:x")


def test_undeclared_date_format_is_rejected() -> None:
    with pytest.raises(TransformSpecError, match="yyyy-mm-dd"):
        parse_transform("date:yyyy-mm-dd")


def test_value_map_requires_the_column_table() -> None:
    with pytest.raises(TransformSpecError, match="value_map"):
        parse_transform("value_map")
    assert parse_transform("value_map", {}) == Transform("value_map")


# --- trim / upper --------------------------------------------------------------------------


def test_trim_with_trace() -> None:
    result = run("  Retablo ayacuchano \t", "trim")
    assert result.value == "Retablo ayacuchano"
    assert [step.as_json() for step in result.trace] == [
        {"transform": "trim", "before": "  Retablo ayacuchano \t", "after": "Retablo ayacuchano"}
    ]


def test_trim_to_empty_skips_the_rest_but_default_fills_it() -> None:
    result = run("   ", "trim", "upper", "default:SIN DATO")
    assert result.value == "SIN DATO"
    assert [step.transform for step in result.trace] == ["trim", "default:SIN DATO"]


def test_upper_keeps_accents() -> None:
    assert run("cerámica", "upper").value == "CERÁMICA"


def test_numbers_from_excel_become_text() -> None:
    assert run(236.0, "trim").value == "236"
    assert run(12, "upper").value == "12"
    assert run(23.5, "trim").value == "23.5"


def test_empty_cell_skips_text_transformations_without_trace() -> None:
    result = run(None, "trim", "upper", "absence_markers")
    assert result.value is None
    assert result.trace == []
    assert result.is_absent is False


# --- absence_markers -----------------------------------------------------------------------


@pytest.mark.parametrize("raw", ["S/N", "s/c", " - ", "0", "S.C.", "sin código"])
def test_absence_markers(raw: str) -> None:
    result = run(raw, "absence_markers")
    assert result.value is None
    assert result.is_absent is True
    assert result.trace[0].after is None


def test_a_code_is_not_an_absence_marker() -> None:
    result = run("I-0236", "absence_markers")
    assert result.value == "I-0236"
    assert result.is_absent is False


def test_markers_are_removed_from_a_split_value() -> None:
    result = run("RA 3; S/N", "split:;", "absence_markers")
    assert result.value == ["RA 3"]
    assert result.is_absent is False
    assert run("S/N; -", "split:;", "absence_markers").is_absent is True


# --- split_concatenated --------------------------------------------------------------------


def test_split_concatenated_with_trace() -> None:
    result = run("M.M.Z. 015 / I-0236", "trim", "split_concatenated")
    assert result.value == ["M.M.Z. 015", "I-0236"]
    assert result.split_proposed is True
    assert result.trace[-1].before == "M.M.Z. 015 / I-0236"
    assert result.trace[-1].after == ["M.M.Z. 015", "I-0236"]


def test_split_concatenated_does_not_split_absence_markers() -> None:
    result = run("S/N", "split_concatenated")
    assert result.value is None
    assert result.is_absent is True


def test_split_concatenated_single_code() -> None:
    result = run("I-0236", "split_concatenated")
    assert result.value == ["I-0236"]
    assert result.split_proposed is False


@pytest.mark.parametrize("raw", ["I 12; RA 3", "I 12|RA 3", "I 12, RA 3", "I 12\nRA 3"])
def test_split_concatenated_separators(raw: str) -> None:
    assert run(raw, "split_concatenated").value == ["I 12", "RA 3"]


# --- split:<sep> ---------------------------------------------------------------------------


def test_split_on_separator() -> None:
    result = run("madera, pan de oro ,, yeso", "split:,")
    assert result.value == ["madera", "pan de oro", "yeso"]


def test_split_without_the_separator_gives_one_element() -> None:
    assert run("madera", "split:;").value == ["madera"]


def test_split_of_only_separators_is_empty() -> None:
    result = run(",,", "split:,", "default:sin material")
    assert result.value == "sin material"


def test_split_twice_flattens() -> None:
    assert run("a;b,c", "split:;", "split:,").value == ["a", "b", "c"]


# --- date:<formato> ------------------------------------------------------------------------


def test_date_day_month_year() -> None:
    result = run("03/04/1998", "date:dd/mm/yyyy")
    assert result.value == date(1998, 4, 3)
    assert result.trace[0].as_json()["after"] == "1998-04-03"


def test_date_with_another_format_is_an_error_and_keeps_the_original() -> None:
    result = run("1998-04-03", "date:dd/mm/yyyy", "default:no se aplica")
    assert result.value is None
    assert result.original == "1998-04-03"
    assert result.error is not None
    assert result.error.code == "date_format_mismatch"
    assert result.error.transform == "date:dd/mm/yyyy"
    assert "no se adivina" in result.error.message
    assert [step.transform for step in result.trace] == ["date:dd/mm/yyyy"]


@pytest.mark.parametrize("raw", ["3/4/1998", "03/04/98", "03-04-1998", "ca. 1998"])
def test_date_does_not_guess_close_shapes(raw: str) -> None:
    assert run(raw, "date:dd/mm/yyyy").error is not None


@pytest.mark.parametrize("raw", ["31/02/1998", "00/01/1998", "01/13/1998"])
def test_impossible_calendar_date_is_an_error(raw: str) -> None:
    result = run(raw, "date:dd/mm/yyyy")
    assert result.error is not None
    assert result.error.code == "invalid_date"


def test_leap_day() -> None:
    assert run("29/02/2000", "date:dd/mm/yyyy").value == date(2000, 2, 29)
    assert run("29/02/1900", "date:dd/mm/yyyy").error is not None


def test_date_year_only() -> None:
    assert run("1998", "date:yyyy").value == 1998
    assert run(1998.0, "date:yyyy").value == 1998
    assert run("98", "date:yyyy").error is not None


def test_date_without_format_tries_the_default_formats() -> None:
    assert run("03/04/1998", "date").value == date(1998, 4, 3)
    assert run("1998", "date").value == 1998
    result = run("1998-04-03", "date")
    assert result.error is not None
    assert "dd/mm/yyyy ni yyyy" in result.error.message


@pytest.mark.parametrize("cell", [datetime(1998, 4, 3, 0, 0), date(1998, 4, 3)])
def test_excel_date_cell_is_exempt_from_the_declared_format(cell: date) -> None:
    result = run(cell, "date:dd/mm/yyyy")
    assert result.value == cell
    assert result.error is None
    assert result.trace[0].note == NOTE_EXCEL_DATE
    assert result.trace[0].as_json()["note"] == NOTE_EXCEL_DATE


def test_excel_date_cell_passes_through_text_transformations() -> None:
    cell = datetime(1998, 4, 3)
    assert run(cell, "trim", "upper", "date:yyyy").value == cell


def test_date_on_a_split_value() -> None:
    assert run("1990; 1998", "split:;", "date:yyyy").value == [1990, 1998]
    assert run("1990; 98", "split:;", "date:yyyy").error is not None


# --- propose_period ------------------------------------------------------------------------


def test_propose_period_keeps_the_text_and_proposes_fields() -> None:
    result = run("ca. 1950", "trim", "propose_period")
    assert result.value == "ca. 1950"
    assert result.proposals == {
        "epoch_type": "APPROXIMATE",
        "epoch_start_year": 1940,
        "epoch_end_year": 1960,
    }
    assert result.trace[-1].after == result.proposals


@pytest.mark.parametrize(
    ("raw", "epoch_type"), [("s. XX", "CENTURY"), ("3000 años", "RELATIVE_AGE"), (1950, "YEAR")]
)
def test_propose_period_cases(raw: Any, epoch_type: str) -> None:
    assert run(raw, "propose_period").proposals["epoch_type"] == epoch_type


def test_unrecognized_period_has_no_proposal_and_no_error() -> None:
    result = run("época republicana", "propose_period")
    assert result.value == "época republicana"
    assert result.proposals == {}
    assert result.error is None
    assert result.trace[0].note == NOTE_NOT_RECOGNIZED


# --- propose_dimensions --------------------------------------------------------------------


def test_propose_dimensions_labeled() -> None:
    result = run("alto 23 cm", "propose_dimensions")
    assert result.value == "alto 23 cm"
    assert result.proposals == {"dimensions": [{"dimension": "alto", "value": 23.0, "unit": "cm"}]}


def test_propose_dimensions_several_labeled() -> None:
    result = run("Alto 35 cm x ancho 20,5 cm; diámetro: 4 cm", "propose_dimensions")
    assert result.proposals["dimensions"] == [
        {"dimension": "alto", "value": 35.0, "unit": "cm"},
        {"dimension": "ancho", "value": 20.5, "unit": "cm"},
        {"dimension": "diámetro", "value": 4.0, "unit": "cm"},
    ]


def test_propose_dimensions_unlabeled_leaves_the_name_empty() -> None:
    result = run("23 x 15 cm", "propose_dimensions")
    assert result.proposals["dimensions"] == [
        {"dimension": None, "value": 23.0, "unit": "cm"},
        {"dimension": None, "value": 15.0, "unit": "cm"},
    ]
    assert run("23 × 15 × 4.5 cm", "propose_dimensions").proposals["dimensions"][2]["value"] == 4.5


@pytest.mark.parametrize(
    "raw",
    [
        "23 x 15",  # no unit
        "alto 23 mm",  # unit not recognized
        "alto 23 cm aprox.",  # trailing text
        "aprox. alto 23 cm",  # leading text
        "alto 23 cm y ancho 15 cm",  # unknown joiner
        "grande",
    ],
)
def test_unrecognized_dimensions_have_no_proposal(raw: str) -> None:
    result = run(raw, "propose_dimensions")
    assert result.proposals == {}
    assert result.error is None
    assert result.trace[0].note == NOTE_NOT_RECOGNIZED


# --- value_map -----------------------------------------------------------------------------


def test_value_map_ignores_case_accents_and_spaces() -> None:
    table = {"madera policromada": "MADERA"}
    result = run(" Madera  Policromáda", "value_map", value_map=table)
    assert result.value == "MADERA"


def test_value_map_leaves_unmatched_values_for_the_mapping() -> None:
    table = {"madera": "MADERA"}
    result = run("madera, maguey", "split:,", "value_map", value_map=table)
    assert result.value == ["MADERA", "maguey"]
    assert result.trace[-1].before == ["madera", "maguey"]


def test_value_map_with_an_empty_table_changes_nothing() -> None:
    assert run("lana", "value_map", value_map={}).value == "lana"


# --- default:<valor> -----------------------------------------------------------------------


def test_default_fills_an_empty_cell() -> None:
    result = run(None, "default:OWNED")
    assert result.value == "OWNED"
    assert result.trace[0].as_json() == {
        "transform": "default:OWNED",
        "before": None,
        "after": "OWNED",
    }


def test_default_does_not_replace_a_value() -> None:
    result = run("LOAN_FOR_USE", "default:OWNED")
    assert result.value == "LOAN_FOR_USE"
    assert result.trace == []


def test_default_after_an_absence_marker() -> None:
    result = run("S/N", "absence_markers", "default:sin código")
    assert result.value == "sin código"
    assert result.is_absent is True


# --- chain ---------------------------------------------------------------------------------


def test_chain_keeps_one_trace_step_per_transformation() -> None:
    result = run(" i 12 / ra 3 ", "trim", "upper", "split_concatenated")
    assert result.value == ["I 12", "RA 3"]
    assert [(step.transform, step.before, step.after) for step in result.trace] == [
        ("trim", " i 12 / ra 3 ", "i 12 / ra 3"),
        ("upper", "i 12 / ra 3", "I 12 / RA 3"),
        ("split_concatenated", "I 12 / RA 3", ["I 12", "RA 3"]),
    ]


def test_as_json_is_serializable() -> None:
    result = run("03/04/1998", "date:dd/mm/yyyy")
    assert result.as_json() == {
        "original": "03/04/1998",
        "value": "1998-04-03",
        "trace": [{"transform": "date:dd/mm/yyyy", "before": "03/04/1998", "after": "1998-04-03"}],
        "proposals": {},
        "error": None,
        "is_absent": False,
    }
