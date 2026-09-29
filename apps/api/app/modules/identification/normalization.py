"""Normalization of museum identifiers (spec identificacion-piezas: RF-023, RF-004, RN-010).

Pure functions, no database access. Every rule below is a [SUPUESTO] until validated with the
museum (docs/preguntas-contraparte.md, questions A2, A4, A5, A8 and B8):

- N1  Unicode NFKC, trim, collapse inner whitespace, uppercase. The original value is kept
      untouched by the caller.
- N2  Absence markers (``S/N``, ``s/c``, ``-``, ``0``, ``N/A``, "sin código", empty) mean
      "no code"; they are never stored as an inventory code.
- N3  Inventory code (I): optional ``I`` prefix, optional separator (``-``, ``.``, space, ``:``,
      ``#``) and digits. Leading zeros are not significant: ``I-0236``, ``I 236`` -> ``I-236``.
- N4  Collection code: acronym letters with optional dots/spaces, optional separator, number and
      optional component suffix. Dots/spaces in the acronym and leading zeros are removed:
      ``M.M.Z. 015``, ``M M Z 15``, ``mmz 15`` -> ``MMZ 15``; ``MBB 40.1`` -> ``MBB 40.1``.
- N5  INC / Registro Nacional: optional ``INC``, ``RN`` or ``N°`` prefix and 4 or 6 digits
      (grouping dots, spaces or hyphens ignored). Digits are kept as written (fixed width,
      zeros significant) and the format (4 or 6 digits) is reported. Other lengths are
      "not normalizable" and kept for review.
- N6  Generic types (PUCP, owner, other): N1 plus removal of spaces around ``-``, ``/``, ``.``.
- N7  A cell may contain several codes separated by ``/``, ``;``, ``|``, ``,`` or line breaks;
      each part is proposed as a separate identifier pending human confirmation.
"""

import re
import unicodedata
from dataclasses import dataclass, field

from app.modules.identification.models import NormalizationRule, NormalizationStatus

# Default identifier type codes seeded by the system (parametrizable data, RN-010).
TYPE_INVENTORY = "I"
TYPE_COLLECTION = "COLECCION"
TYPE_INC_RN = "INC_RN"
TYPE_PUCP = "PUCP"
TYPE_OWNER = "PROPIETARIO"
TYPE_OTHER = "OTRO"

DEFAULT_RULES: dict[str, NormalizationRule] = {
    TYPE_INVENTORY: NormalizationRule.INVENTORY,
    TYPE_COLLECTION: NormalizationRule.COLLECTION,
    TYPE_INC_RN: NormalizationRule.INC_RN,
    TYPE_PUCP: NormalizationRule.GENERIC,
    TYPE_OWNER: NormalizationRule.GENERIC,
    TYPE_OTHER: NormalizationRule.GENERIC,
}

# N2 — compared after removing all whitespace.
ABSENCE_MARKERS = frozenset(
    {
        "",
        "S/N",
        "SN",
        "S.N.",
        "S/C",
        "SC",
        "S.C.",
        "-",
        "--",
        "---",
        "—",
        "0",
        "N/A",
        "NA",
        "SINCODIGO",
        "SINCÓDIGO",
        "SINNUMERO",
        "SINNÚMERO",
    }
)

FORMAT_I_PREFIXED = "I_PREFIJO"
FORMAT_I_NUMBER_ONLY = "SOLO_NUMERO"
FORMAT_COLLECTION = "SIGLA_NUMERO"
FORMAT_COLLECTION_SUFFIX = "SIGLA_NUMERO_SUFIJO"
FORMAT_INC_4 = "INC_4_DIGITOS"
FORMAT_INC_6 = "INC_6_DIGITOS"

_INVENTORY_RE = re.compile(r"^(I)?\s*[-.:#_]?\s*(\d+)$")
_COLLECTION_RE = re.compile(
    r"^(?P<acronym>[A-Z](?:[\s.]*[A-Z])*)[\s.\-_:#]*(?P<number>\d+)"
    r"(?P<suffix>(?:\s*[.\-]\s*[0-9A-Z]+)*)$"
)
_INC_PREFIX_RE = re.compile(r"^(?:INC|R\.?\s*N\.?|N\s*[°º.]?)?\s*[-:#°º.]?\s*(?P<body>[\d\s.\-]+)$")
# "/" separates codes, except inside the absence markers S/N and S/C.
_SPLIT_RE = re.compile(r"\s*(?:(?<![Ss]\s)(?<![Ss])/(?!\s?[NnCc]\b)|;|\||,|\n|\r)\s*")
_GENERIC_SEPARATORS_RE = re.compile(r"\s*([-/.])\s*")


@dataclass(frozen=True)
class NormalizationResult:
    original: str
    normalized: str | None
    status: NormalizationStatus
    detected_format: str | None = None
    is_absent: bool = False


@dataclass(frozen=True)
class IdentifierProposal:
    """A code detected inside a (possibly compound) cell, always pending human confirmation."""

    type_code: str | None
    result: NormalizationResult
    requires_confirmation: bool = True
    notes: list[str] = field(default_factory=list)


def canonical(raw: str) -> str:
    """N1: NFKC, trim, collapse whitespace, uppercase."""
    text = unicodedata.normalize("NFKC", raw)
    return re.sub(r"\s+", " ", text).strip().upper()


def is_absence_marker(raw: str | None) -> bool:
    if raw is None:
        return True
    return re.sub(r"\s+", "", canonical(raw)) in ABSENCE_MARKERS


def _absent(original: str) -> NormalizationResult:
    return NormalizationResult(original, None, NormalizationStatus.UNPARSEABLE, is_absent=True)


def _unparseable(original: str) -> NormalizationResult:
    return NormalizationResult(original, None, NormalizationStatus.UNPARSEABLE)


def normalize_inventory_code(raw: str) -> NormalizationResult:
    if is_absence_marker(raw):
        return _absent(raw)
    match = _INVENTORY_RE.match(canonical(raw))
    if not match:
        return _unparseable(raw)
    number = int(match.group(2))
    if number == 0:
        return _unparseable(raw)
    detected = FORMAT_I_PREFIXED if match.group(1) else FORMAT_I_NUMBER_ONLY
    return NormalizationResult(raw, f"I-{number}", NormalizationStatus.NORMALIZED, detected)


def normalize_acronym(raw: str | None) -> str | None:
    """Collection acronym without dots or spaces (``M.M.Z.`` -> ``MMZ``)."""
    if raw is None:
        return None
    value = re.sub(r"[^A-Z0-9]", "", canonical(raw))
    return value or None


def normalize_collection_code(raw: str) -> NormalizationResult:
    if is_absence_marker(raw):
        return _absent(raw)
    match = _COLLECTION_RE.match(canonical(raw))
    if not match:
        return _unparseable(raw)
    acronym = re.sub(r"[\s.]", "", match.group("acronym"))
    number = int(match.group("number"))
    suffix_parts = [part for part in re.split(r"\s*[.\-]\s*", match.group("suffix")) if part]
    normalized = f"{acronym} {number}"
    detected = FORMAT_COLLECTION
    if suffix_parts:
        normalized += "".join(f".{part.lstrip('0') or '0'}" for part in suffix_parts)
        detected = FORMAT_COLLECTION_SUFFIX
    return NormalizationResult(raw, normalized, NormalizationStatus.NORMALIZED, detected)


def normalize_inc_code(raw: str) -> NormalizationResult:
    if is_absence_marker(raw):
        return _absent(raw)
    match = _INC_PREFIX_RE.match(canonical(raw))
    if not match:
        return _unparseable(raw)
    digits = re.sub(r"\D", "", match.group("body"))
    if len(digits) == 4:
        return NormalizationResult(raw, digits, NormalizationStatus.NORMALIZED, FORMAT_INC_4)
    if len(digits) == 6:
        return NormalizationResult(raw, digits, NormalizationStatus.NORMALIZED, FORMAT_INC_6)
    return _unparseable(raw)


def normalize_generic_code(raw: str) -> NormalizationResult:
    if is_absence_marker(raw):
        return _absent(raw)
    value = _GENERIC_SEPARATORS_RE.sub(r"\1", canonical(raw))
    return NormalizationResult(raw, value, NormalizationStatus.NORMALIZED)


_NORMALIZERS = {
    NormalizationRule.INVENTORY: normalize_inventory_code,
    NormalizationRule.COLLECTION: normalize_collection_code,
    NormalizationRule.INC_RN: normalize_inc_code,
    NormalizationRule.GENERIC: normalize_generic_code,
}


def normalize(rule: NormalizationRule, raw: str) -> NormalizationResult:
    return _NORMALIZERS[rule](raw)


def normalize_for_type(type_code: str, raw: str) -> NormalizationResult:
    return normalize(DEFAULT_RULES.get(type_code, NormalizationRule.GENERIC), raw)


def split_compound(raw: str | None) -> list[str]:
    """N7: split a cell with several codes. Absence markers such as ``S/N`` are not split."""
    if raw is None or is_absence_marker(raw):
        return []
    parts = [part.strip() for part in _SPLIT_RE.split(unicodedata.normalize("NFKC", raw))]
    return [part for part in parts if part and not is_absence_marker(part)]


def detect_type(part: str) -> str | None:
    """Guess the identifier type of a single code; None when it cannot be told apart."""
    value = canonical(part)
    if re.match(r"^I\s*[-.:#_]?\s*\d+$", value):
        return TYPE_INVENTORY
    if re.match(r"^(?:INC|R\.?\s*N\.?)\b", value) and normalize_inc_code(part).normalized:
        return TYPE_INC_RN
    match = _COLLECTION_RE.match(value)
    if match and len(re.sub(r"[\s.]", "", match.group("acronym"))) >= 2:
        return TYPE_COLLECTION
    return None


def propose_identifiers(
    raw: str | None, default_type: str | None = None
) -> list[IdentifierProposal]:
    """Detect every identifier inside a cell. Results always require human confirmation."""
    parts = split_compound(raw)
    proposals: list[IdentifierProposal] = []
    for part in parts:
        detected = detect_type(part)
        type_code = detected or default_type
        notes: list[str] = []
        if len(parts) > 1:
            notes.append("Celda con varios códigos: confirme la separación.")
        if detected and default_type and detected != default_type:
            notes.append(f"El valor parece de tipo {detected} y no {default_type}.")
        if type_code is None:
            notes.append("No se pudo determinar el tipo de identificador.")
            result = normalize_generic_code(part)
        else:
            result = normalize_for_type(type_code, part)
        proposals.append(IdentifierProposal(type_code=type_code, result=result, notes=notes))
    return proposals
