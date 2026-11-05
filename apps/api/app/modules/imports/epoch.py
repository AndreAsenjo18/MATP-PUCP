"""Proposed interpretation of a free-text period (spec importacion-datos: RF-007; design D2).

Pure function, no database access, reusable later by the record form. It only *proposes*: the
original text is always kept by the caller (``epoch_original_text``) and a text that is not
recognized produces no proposal. Every rule is a [SUPUESTO B9] until validated with the museum
(docs/preguntas-contraparte.md):

- ``s. XX`` / ``siglo XX``      -> CENTURY 1901-2000
- ``década de 1950``            -> DECADE 1950-1959
- ``años 50``                   -> DECADE 1950-1959 (two digits are read as the 1900s)
- ``1950``                      -> YEAR 1950-1950
- ``1940-1950``                 -> RANGE 1940-1950 (start must not be after end)
- ``ca. 1950`` / ``circa 1950`` -> APPROXIMATE 1940-1960 (margin of ±10 years, configurable)
- ``3000 años``                 -> RELATIVE_AGE without computed years

Comparison ignores case, accents and repeated spaces. Eras (``a.C.``) are not interpreted.
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from app.modules.catalog.enums import PeriodType

DEFAULT_APPROXIMATE_MARGIN = 10  # [SUPUESTO B9] width of "ca. 1950"

_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
_CENTURY_RE = re.compile(r"^(?:s\.?|siglo)\s*([ivxlc]+)$")
_DECADE_FULL_RE = re.compile(r"^decada\s+de\s+(\d{3}0)$")
_DECADE_SHORT_RE = re.compile(r"^anos\s+([1-9]0)$")
_YEAR_RE = re.compile(r"^(\d{4})$")
_RANGE_RE = re.compile(r"^(\d{4})\s*[-–]\s*(\d{4})$")
_APPROXIMATE_RE = re.compile(r"^(?:ca\.?|circa)\s*(\d{4})$")
_RELATIVE_AGE_RE = re.compile(r"^\d+\s+anos$")


@dataclass(frozen=True)
class EpochProposal:
    type: PeriodType
    start_year: int | None
    end_year: int | None

    def as_fields(self) -> dict[str, Any]:
        """Record fields the proposal fills (internal codes, ADR-002)."""
        return {
            "epoch_type": self.type.value,
            "epoch_start_year": self.start_year,
            "epoch_end_year": self.end_year,
        }


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.strip().casefold())
    return " ".join("".join(c for c in folded if not unicodedata.combining(c)).split())


def _roman_to_int(numeral: str) -> int | None:
    values = [_ROMAN[c] for c in numeral.upper()]
    total = 0
    for index, value in enumerate(values):
        following = values[index + 1] if index + 1 < len(values) else 0
        total += -value if value < following else value
    # Reject malformed numerals (``IIII``, ``VX``) by rendering the total back.
    return total if total > 0 and _int_to_roman(total) == numeral.upper() else None


def _int_to_roman(number: int) -> str:
    parts = [(100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX")]
    parts += [(5, "V"), (4, "IV"), (1, "I")]
    result = ""
    for value, symbol in parts:
        while number >= value:
            result += symbol
            number -= value
    return result


def interpret_epoch(
    text: str | None, *, approximate_margin: int = DEFAULT_APPROXIMATE_MARGIN
) -> EpochProposal | None:
    if text is None:
        return None
    value = _fold(text)
    if match := _CENTURY_RE.match(value):
        century = _roman_to_int(match.group(1))
        if century is None:
            return None
        return EpochProposal(PeriodType.CENTURY, (century - 1) * 100 + 1, century * 100)
    if match := _DECADE_FULL_RE.match(value):
        start = int(match.group(1))
        return EpochProposal(PeriodType.DECADE, start, start + 9)
    if match := _DECADE_SHORT_RE.match(value):
        start = 1900 + int(match.group(1))
        return EpochProposal(PeriodType.DECADE, start, start + 9)
    if match := _YEAR_RE.match(value):
        year = int(match.group(1))
        return EpochProposal(PeriodType.YEAR, year, year)
    if match := _RANGE_RE.match(value):
        start, end = int(match.group(1)), int(match.group(2))
        if start > end:
            return None
        return EpochProposal(PeriodType.RANGE, start, end)
    if match := _APPROXIMATE_RE.match(value):
        year = int(match.group(1))
        return EpochProposal(
            PeriodType.APPROXIMATE, year - approximate_margin, year + approximate_margin
        )
    if _RELATIVE_AGE_RE.match(value):
        return EpochProposal(PeriodType.RELATIVE_AGE, None, None)
    return None
