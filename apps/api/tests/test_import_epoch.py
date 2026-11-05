"""Spec importacion-datos — Interpretación propuesta de época (RF-007; design D2, [SUPUESTO B9]).

Change plantillas-mapeo-y-normalizacion, task 1.2. Synthetic data only (RNF-014).
"""

import pytest

from app.modules.catalog.enums import PeriodType
from app.modules.imports.epoch import EpochProposal, interpret_epoch


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("s. XX", EpochProposal(PeriodType.CENTURY, 1901, 2000)),
        ("s.XVIII", EpochProposal(PeriodType.CENTURY, 1701, 1800)),
        ("Siglo XIX", EpochProposal(PeriodType.CENTURY, 1801, 1900)),
        ("s. I", EpochProposal(PeriodType.CENTURY, 1, 100)),
        ("década de 1950", EpochProposal(PeriodType.DECADE, 1950, 1959)),
        ("Decada de 1950", EpochProposal(PeriodType.DECADE, 1950, 1959)),
        ("años 50", EpochProposal(PeriodType.DECADE, 1950, 1959)),
        ("1950", EpochProposal(PeriodType.YEAR, 1950, 1950)),
        ("1940-1950", EpochProposal(PeriodType.RANGE, 1940, 1950)),
        ("1940 – 1950", EpochProposal(PeriodType.RANGE, 1940, 1950)),
        ("1950-1950", EpochProposal(PeriodType.RANGE, 1950, 1950)),
        ("ca. 1950", EpochProposal(PeriodType.APPROXIMATE, 1940, 1960)),
        ("CA 1950", EpochProposal(PeriodType.APPROXIMATE, 1940, 1960)),
        ("circa 1950", EpochProposal(PeriodType.APPROXIMATE, 1940, 1960)),
        ("3000 años", EpochProposal(PeriodType.RELATIVE_AGE, None, None)),
        ("  3000   AÑOS ", EpochProposal(PeriodType.RELATIVE_AGE, None, None)),
    ],
)
def test_recognized_periods(text: str, expected: EpochProposal) -> None:
    assert interpret_epoch(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        "republicano",
        "s. XIIII",  # malformed roman numeral
        "s. VX",
        "década de 1955",  # a decade starts on a year ending in 0
        "años 55",
        "1950-1940",  # start after end (validate_epoch)
        "195",
        "19500",
        "ca. 50",
        "s. XX a.C.",
        "entre 1940 y 1950",
    ],
)
def test_unrecognized_periods_produce_no_proposal(text: str) -> None:
    assert interpret_epoch(text) is None


def test_none_produces_no_proposal() -> None:
    assert interpret_epoch(None) is None


def test_approximate_margin_is_configurable() -> None:
    assert interpret_epoch("ca. 1950", approximate_margin=5) == EpochProposal(
        PeriodType.APPROXIMATE, 1945, 1955
    )


def test_proposal_fields_use_internal_codes() -> None:
    proposal = interpret_epoch("s. XX")
    assert proposal is not None
    assert proposal.as_fields() == {
        "epoch_type": "CENTURY",
        "epoch_start_year": 1901,
        "epoch_end_year": 2000,
    }
