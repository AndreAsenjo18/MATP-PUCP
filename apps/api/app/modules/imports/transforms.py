"""Column transformations of ``MappingSpec`` v1 (spec importacion-datos: RF-022, RF-023, RF-007,
RF-006; design D2).

Pure functions, no database access. A column declares an ordered chain of predefined
transformations (no scripting); ``run_transforms`` applies it to one cell and keeps, for every
step, what the value was before and after, so the preview can explain each result.

Transformations v1 (``AVAILABLE_TRANSFORMS``):

- ``trim``                 strip leading and trailing whitespace.
- ``upper``                uppercase.
- ``absence_markers``      a "no code" marker (``S/N``, ``s/c``, ``-``… N2) becomes empty.
- ``split_concatenated``   several codes in one cell (N7), ``S/N`` and ``S/C`` are not split.
- ``split:<sep>``          split on a literal separator.
- ``date:<formato>``       ``dd/mm/yyyy`` or ``yyyy`` [SUPUESTO S5]; without a format, both are
                           tried in that order. Never guesses: any other shape is an error.
                           A cell the Excel reader already returns as a date is exempt.
- ``propose_period``       proposes ``epoch_type``/``epoch_start_year``/``epoch_end_year``.
- ``propose_dimensions``   proposes ``dimensions`` from ``alto 23 cm`` or ``23 x 15 cm``.
- ``value_map``            replaces values listed in the column's ``value_map``.
- ``default:<valor>``      fills an empty value.

Text transformations work element by element once a value has been split. Proposals never
replace the value: they are returned apart, marked as proposals. After an error the chain
stops, the value is left empty and the original cell is kept (``TransformedValue.original``).
Empty values skip every transformation except ``default``.
"""

import re
import unicodedata
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from app.modules.identification.normalization import is_absence_marker, split_compound
from app.modules.imports.epoch import interpret_epoch

AVAILABLE_TRANSFORMS = (
    "trim",
    "upper",
    "absence_markers",
    "split_concatenated",
    "split:<sep>",
    "date:<formato>",
    "propose_period",
    "propose_dimensions",
    "value_map",
    "default:<valor>",
)
DATE_FORMATS = ("dd/mm/yyyy", "yyyy")  # [SUPUESTO S5] formats known so far
DIMENSION_UNIT = "cm"  # [SUPUESTO S5] the only unit recognized

NOTE_EXCEL_DATE = "excel_date_cell"
NOTE_NOT_RECOGNIZED = "not_recognized"

_DAY_MONTH_YEAR_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
_YEAR_RE = re.compile(r"^\d{4}$")
_NUMBER = r"\d+(?:[.,]\d+)?"  # [SUPUESTO S5] decimal point or comma
_LABELED_DIMENSION_RE = re.compile(rf"([^\W\d_]+)\s*:?\s*({_NUMBER})\s*{DIMENSION_UNIT}\b")
_DIMENSION_JOINER_RE = re.compile(r"^\s*(?:[x×,;]\s*)?$")
_UNLABELED_DIMENSIONS_RE = re.compile(rf"^({_NUMBER}(?:\s*[x×]\s*{_NUMBER})*)\s*{DIMENSION_UNIT}$")


class TransformSpecError(ValueError):
    """The chain of a column cannot be used (unknown transformation or missing argument)."""

    def __init__(self, message: str, transform: str) -> None:
        super().__init__(message)
        self.message = message  # user-facing, Spanish (ADR-002)
        self.transform = transform


@dataclass(frozen=True)
class TransformError:
    code: str
    message: str  # user-facing, Spanish (ADR-002)
    transform: str

    def as_json(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "transform": self.transform}


@dataclass(frozen=True)
class TraceStep:
    transform: str
    before: Any
    after: Any
    note: str | None = None

    def as_json(self) -> dict[str, Any]:
        step = {
            "transform": self.transform,
            "before": _json_value(self.before),
            "after": _json_value(self.after),
        }
        if self.note is not None:
            step["note"] = self.note
        return step


@dataclass
class TransformedValue:
    original: Any
    value: Any
    trace: list[TraceStep] = field(default_factory=list)
    proposals: dict[str, Any] = field(default_factory=dict)
    error: TransformError | None = None
    is_absent: bool = False

    @property
    def split_proposed(self) -> bool:
        """The cell was split into several values (a proposal pending human confirmation)."""
        return isinstance(self.value, list) and len(self.value) > 1

    def as_json(self) -> dict[str, Any]:
        return {
            "original": _json_value(self.original),
            "value": _json_value(self.value),
            "trace": [step.as_json() for step in self.trace],
            "proposals": self.proposals,
            "error": self.error.as_json() if self.error else None,
            "is_absent": self.is_absent,
        }


@dataclass(frozen=True)
class Transform:
    name: str
    arg: str | None = None

    def __str__(self) -> str:
        return self.name if self.arg is None else f"{self.name}:{self.arg}"


class _Failed(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    return value


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.strip().casefold())
    return " ".join("".join(c for c in folded if not unicodedata.combining(c)).split())


def _as_text(value: Any) -> Any:
    """Numbers read from Excel become text; dates are left as they are."""
    if isinstance(value, bool | datetime | date):
        return value
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int | float):
        return str(value)
    return value


def _each(value: Any, function: Callable[[Any], Any]) -> Any:
    if isinstance(value, list):
        return [function(item) for item in value]
    return function(value)


def _text_only(function: Callable[[str], Any]) -> Callable[[Any], Any]:
    def wrapper(value: Any) -> Any:
        value = _as_text(value)
        return function(value) if isinstance(value, str) else value

    return wrapper


# --- parsing -------------------------------------------------------------------------------

_WITH_ARGUMENT = {"split", "date", "default"}
_WITHOUT_ARGUMENT = {
    "trim",
    "upper",
    "absence_markers",
    "split_concatenated",
    "propose_period",
    "propose_dimensions",
    "value_map",
}


def parse_transform(spec: str, value_map: Mapping[str, str] | None = None) -> Transform:
    name, separator, arg = spec.partition(":")
    available = ", ".join(AVAILABLE_TRANSFORMS)
    if name in _WITHOUT_ARGUMENT:
        if separator:
            raise TransformSpecError(f"La transformación «{name}» no admite argumento.", spec)
        if name == "value_map" and value_map is None:
            raise TransformSpecError(
                "La transformación «value_map» requiere la tabla de correspondencias de la "
                "columna.",
                spec,
            )
        return Transform(name)
    if name in _WITH_ARGUMENT:
        if name == "date":
            if separator and arg not in DATE_FORMATS:
                raise TransformSpecError(
                    f"El formato de fecha «{arg}» no está disponible. Formatos disponibles: "
                    f"{', '.join(DATE_FORMATS)}.",
                    spec,
                )
            return Transform(name, arg or None)
        if not arg:
            raise TransformSpecError(f"La transformación «{name}» requiere un valor.", spec)
        return Transform(name, arg)
    raise TransformSpecError(
        f"La transformación «{spec}» no existe. Transformaciones disponibles: {available}.", spec
    )


def parse_transforms(
    specs: Sequence[str], value_map: Mapping[str, str] | None = None
) -> list[Transform]:
    return [parse_transform(spec, value_map) for spec in specs]


# --- transformations -----------------------------------------------------------------------


def _trim(value: Any) -> Any:
    return _each(value, _text_only(str.strip))


def _upper(value: Any) -> Any:
    return _each(value, _text_only(str.upper))


def _split_on(value: Any, separator: str) -> Any:
    def split(item: Any) -> list[Any]:
        text = _as_text(item)
        if not isinstance(text, str):
            return [item]
        return [part.strip() for part in text.split(separator) if part.strip()]

    items = value if isinstance(value, list) else [value]
    parts = [part for item in items for part in split(item)]
    return parts or None


def _parse_date(text: str, date_format: str) -> date | int | None:
    """The value in ``date_format``, or None when the text does not have that shape."""
    if date_format == "yyyy":
        # [SUPUESTO S5] a bare year is kept as a number, not as a date
        return int(text) if _YEAR_RE.match(text) else None
    match = _DAY_MONTH_YEAR_RE.match(text)
    if match is None:
        return None
    day, month, year = (int(group) for group in match.groups())
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise _Failed("invalid_date", f"«{text}» no es una fecha válida.") from exc


def _date(value: Any, date_format: str | None) -> Any:
    formats = (date_format,) if date_format else DATE_FORMATS

    def convert(item: Any) -> Any:
        item = _as_text(item)
        if not isinstance(item, str):
            return item  # a cell Excel already stores as a date is exempt
        text = item.strip()
        for candidate in formats:
            parsed = _parse_date(text, candidate)
            if parsed is not None:
                return parsed
        raise _Failed(
            "date_format_mismatch",
            f"«{text}» no tiene el formato {' ni '.join(formats)}; no se adivina el formato.",
        )

    return _each(value, convert)


def _value_map(value: Any, mapping: Mapping[str, str]) -> Any:
    # [SUPUESTO] keys are compared ignoring case, accents and repeated spaces.
    folded = {_fold(key): target for key, target in mapping.items()}
    return _each(value, _text_only(lambda text: folded.get(_fold(text), text)))


def _dimensions(text: str) -> list[dict[str, Any]] | None:
    """``dimensions`` entries as in ``catalog.schemas.Dimension`` [SUPUESTO S7]."""

    def number(raw: str) -> float:
        return float(raw.replace(",", "."))

    value = " ".join(text.casefold().split())
    if match := _UNLABELED_DIMENSIONS_RE.match(value):
        # [SUPUESTO S7] the order of unlabeled measures (alto x ancho…) is not assumed:
        # ``dimension`` stays empty for a person to name it when approving the proposal.
        numbers = re.split(r"\s*[x×]\s*", match.group(1))
        return [{"dimension": None, "value": number(n), "unit": DIMENSION_UNIT} for n in numbers]
    entries: list[dict[str, Any]] = []
    position = 0
    for match in _LABELED_DIMENSION_RE.finditer(value):
        gap = value[position : match.start()]
        if gap.strip() if position == 0 else not _DIMENSION_JOINER_RE.match(gap):
            return None  # text between measures that is not a joiner: do not guess
        entries.append(
            {"dimension": match.group(1), "value": number(match.group(2)), "unit": DIMENSION_UNIT}
        )
        position = match.end()
    if not entries or value[position:].strip():
        return None
    return entries


# --- runner --------------------------------------------------------------------------------


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == []


@dataclass(frozen=True)
class _Step:
    after: Any
    note: str | None = None


def run_transforms(
    raw: Any, transforms: Sequence[Transform], value_map: Mapping[str, str] | None = None
) -> TransformedValue:
    result = TransformedValue(original=raw, value=None if _is_empty(raw) else raw)
    for transform in transforms:
        label = str(transform)
        before = result.value
        if transform.name == "default":
            if _is_empty(before):
                result.value = transform.arg
                result.trace.append(TraceStep(label, before, result.value))
            continue
        if _is_empty(before):
            continue
        try:
            step = _apply(result, transform, value_map)
        except _Failed as failure:
            result.value = None
            result.error = TransformError(failure.code, failure.message, label)
            result.trace.append(TraceStep(label, before, None))
            break
        result.trace.append(TraceStep(label, before, step.after, step.note))
    return result


def _apply(
    result: TransformedValue, transform: Transform, value_map: Mapping[str, str] | None
) -> _Step:
    """Apply one transformation in place. The trace shows the new value, or the proposal."""
    value = result.value
    match transform.name:
        case "trim":
            result.value = _trim(value)
        case "upper":
            result.value = _upper(value)
        case "absence_markers":
            _absence_markers(result)
        case "split_concatenated":
            _split_concatenated(result)
        case "split":
            result.value = _split_on(value, transform.arg or "")
        case "date":
            items = value if isinstance(value, list) else [value]
            result.value = _date(value, transform.arg)
            if any(isinstance(item, datetime | date) for item in items):
                # The cell came as a date from Excel: exempt from the declared format.
                return _Step(result.value, NOTE_EXCEL_DATE)
        case "value_map":
            result.value = _value_map(value, value_map or {})
        case "propose_period":
            text = _proposal_text(value)
            epoch = interpret_epoch(text) if text is not None else None
            if epoch is None:
                return _Step(None, NOTE_NOT_RECOGNIZED)
            result.proposals.update(epoch.as_fields())
            return _Step(epoch.as_fields())
        case "propose_dimensions":
            text = _proposal_text(value)
            dimensions = _dimensions(text) if text is not None else None
            if dimensions is None:
                return _Step(None, NOTE_NOT_RECOGNIZED)
            result.proposals["dimensions"] = dimensions
            return _Step(dimensions)
    return _Step(result.value)


def _absence_markers(result: TransformedValue) -> None:
    value = result.value
    if isinstance(value, list):
        kept = [item for item in value if not _is_marker(item)]
        result.value = kept or None
        result.is_absent = not kept
    elif _is_marker(value):
        result.value = None
        result.is_absent = True


def _is_marker(value: Any) -> bool:
    text = _as_text(value)
    return isinstance(text, str) and is_absence_marker(text)


def _split_concatenated(result: TransformedValue) -> None:
    items = result.value if isinstance(result.value, list) else [result.value]
    parts: list[Any] = []
    for item in items:
        text = _as_text(item)
        if not isinstance(text, str):
            parts.append(item)
        elif not is_absence_marker(text):
            parts += split_compound(text)
    result.value = parts or None
    result.is_absent = result.is_absent or all(_is_marker(item) for item in items)


def _proposal_text(value: Any) -> str | None:
    text = _as_text(value)
    return text if isinstance(text, str) else None
