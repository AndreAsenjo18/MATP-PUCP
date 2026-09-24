"""Spec identificacion-piezas — Normalización de identificadores (RF-023, RF-004).

Rules are [SUPUESTO] until validated with the museum.
"""

import pytest

from app.modules.identification.models import NormalizationRule, NormalizationStatus
from app.modules.identification.normalization import (
    FORMAT_COLLECTION,
    FORMAT_COLLECTION_SUFFIX,
    FORMAT_I_NUMBER_ONLY,
    FORMAT_I_PREFIXED,
    FORMAT_INC_4,
    FORMAT_INC_6,
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    canonical,
    detect_type,
    is_absence_marker,
    normalize,
    normalize_acronym,
    normalize_collection_code,
    normalize_generic_code,
    normalize_inc_code,
    normalize_inventory_code,
    propose_identifiers,
    split_compound,
)


# --- N1 canonical form --------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  mmz   15 ", "MMZ 15"),
        ("ｍｍｚ　15", "MMZ 15"),
        ("i-0236\n", "I-0236"),
        ("Ra\t28", "RA 28"),
    ],
)
def test_canonical_form(raw: str, expected: str) -> None:
    assert canonical(raw) == expected


# --- N2 absence markers -------------------------------------------------------------------
@pytest.mark.parametrize(
    "raw", ["", "   ", "S/N", "s/n", "S / N", "s/c", "S.C.", "-", "---", "0", "N/A", "sin código"]
)
def test_absence_markers(raw: str) -> None:
    assert is_absence_marker(raw)
    result = normalize_inventory_code(raw)
    assert result.is_absent
    assert result.normalized is None


@pytest.mark.parametrize("raw", ["I-1", "MMZ 15", "1234", "?", "00"])
def test_values_that_are_not_absence_markers(raw: str) -> None:
    assert not is_absence_marker(raw)


# --- N3 inventory code --------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "normalized", "detected"),
    [
        ("I-0236", "I-236", FORMAT_I_PREFIXED),
        ("I 236", "I-236", FORMAT_I_PREFIXED),
        ("I236", "I-236", FORMAT_I_PREFIXED),
        ("i-236", "I-236", FORMAT_I_PREFIXED),
        ("I.0236", "I-236", FORMAT_I_PREFIXED),
        ("I:236", "I-236", FORMAT_I_PREFIXED),
        ("I # 236", "I-236", FORMAT_I_PREFIXED),
        ("  I -  00236 ", "I-236", FORMAT_I_PREFIXED),
        ("236", "I-236", FORMAT_I_NUMBER_ONLY),
        ("0236", "I-236", FORMAT_I_NUMBER_ONLY),
        ("I-2362", "I-2362", FORMAT_I_PREFIXED),
    ],
)
def test_inventory_code_variants(raw: str, normalized: str, detected: str) -> None:
    result = normalize_inventory_code(raw)
    assert result.status is NormalizationStatus.NORMALIZED
    assert result.normalized == normalized
    assert result.detected_format == detected
    assert result.original == raw  # original value is never altered


def test_leading_zeros_are_not_significant_for_inventory_code() -> None:
    assert (
        normalize_inventory_code("I-0236").normalized
        == normalize_inventory_code("I 236").normalized
    )


@pytest.mark.parametrize("raw", ["I-0", "I-00", "IX-236", "I-23A", "???", "I 23 45", "RA 28"])
def test_unparseable_inventory_code(raw: str) -> None:
    result = normalize_inventory_code(raw)
    assert result.status is NormalizationStatus.UNPARSEABLE
    assert result.normalized is None
    assert not result.is_absent


# --- N4 collection code -------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("M.M.Z. 15", "MMZ 15"),
        ("M M Z 15", "MMZ 15"),
        ("mmz 15", "MMZ 15"),
        ("MMZ 015", "MMZ 15"),
        ("M.M.Z. 015", "MMZ 15"),
        ("MMZ-015", "MMZ 15"),
        ("MMZ15", "MMZ 15"),
        ("M.M.Z.15", "MMZ 15"),
        ("RA 28", "RA 28"),
        ("R.A. 0028", "RA 28"),
        ("RAB 3", "RAB 3"),
        ("ajb 12", "AJB 12"),
        ("L R M 7", "LRM 7"),
    ],
)
def test_collection_code_variants(raw: str, normalized: str) -> None:
    result = normalize_collection_code(raw)
    assert result.normalized == normalized
    assert result.detected_format == FORMAT_COLLECTION


def test_three_spellings_share_normalized_value_but_keep_originals() -> None:
    results = [normalize_collection_code(raw) for raw in ("M.M.Z. 15", "M M Z 15", "mmz 15")]
    assert {r.normalized for r in results} == {"MMZ 15"}
    assert [r.original for r in results] == ["M.M.Z. 15", "M M Z 15", "mmz 15"]


@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("MBB 40.1", "MBB 40.1"),
        ("MBB 40-01", "MBB 40.1"),
        ("mbb 040.a", "MBB 40.A"),
        ("MBB 40.1.2", "MBB 40.1.2"),
    ],
)
def test_collection_code_with_component_suffix(raw: str, normalized: str) -> None:
    result = normalize_collection_code(raw)
    assert result.normalized == normalized
    assert result.detected_format == FORMAT_COLLECTION_SUFFIX


@pytest.mark.parametrize("raw", ["???", "15", "MMZ", "MMZ 15 / RA 3", "M@Z 15"])
def test_unparseable_collection_code(raw: str) -> None:
    result = normalize_collection_code(raw)
    assert result.status is NormalizationStatus.UNPARSEABLE
    assert result.original == raw


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("M.M.Z.", "MMZ"), ("m m z", "MMZ"), ("RA-B", "RAB"), ("", None), (None, None)],
)
def test_normalize_acronym(raw: str | None, expected: str | None) -> None:
    assert normalize_acronym(raw) == expected


# --- N5 INC / Registro Nacional -----------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "normalized", "detected"),
    [
        ("1234", "1234", FORMAT_INC_4),
        ("INC 1234", "1234", FORMAT_INC_4),
        ("inc-1234", "1234", FORMAT_INC_4),
        ("123456", "123456", FORMAT_INC_6),
        ("RN 123456", "123456", FORMAT_INC_6),
        ("R.N. 123456", "123456", FORMAT_INC_6),
        ("RN 12.345-6", "123456", FORMAT_INC_6),
        ("N° 004521", "004521", FORMAT_INC_6),
        ("0045", "0045", FORMAT_INC_4),
    ],
)
def test_inc_code_formats(raw: str, normalized: str, detected: str) -> None:
    result = normalize_inc_code(raw)
    assert result.normalized == normalized
    assert result.detected_format == detected


@pytest.mark.parametrize("raw", ["???", "12345", "123", "1234567", "INC ABC"])
def test_unparseable_inc_code_is_kept_for_review(raw: str) -> None:
    result = normalize_inc_code(raw)
    assert result.status is NormalizationStatus.UNPARSEABLE
    assert result.normalized is None
    assert result.original == raw


# --- N6 generic ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "normalized"),
    [("pucp - 001", "PUCP-001"), (" N° antiguo  12 ", "N° ANTIGUO 12"), ("a / b", "A/B")],
)
def test_generic_code(raw: str, normalized: str) -> None:
    assert normalize_generic_code(raw).normalized == normalized


def test_dispatch_by_rule() -> None:
    assert normalize(NormalizationRule.INVENTORY, "I 5").normalized == "I-5"
    assert normalize(NormalizationRule.COLLECTION, "mmz 5").normalized == "MMZ 5"
    assert normalize(NormalizationRule.INC_RN, "1234").normalized == "1234"
    assert normalize(NormalizationRule.GENERIC, "x 1").normalized == "X 1"


# --- N7 compound cells --------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "parts"),
    [
        ("I 2362 / RA 28", ["I 2362", "RA 28"]),
        ("I-23; MMZ 4 | INC 1234", ["I-23", "MMZ 4", "INC 1234"]),
        ("I-23\nMMZ 4", ["I-23", "MMZ 4"]),
        ("I-23, MMZ 4", ["I-23", "MMZ 4"]),
        ("I-0236", ["I-0236"]),
        ("S/N", []),
        ("I-23 / S/N", ["I-23"]),
        (None, []),
    ],
)
def test_split_compound(raw: str | None, parts: list[str]) -> None:
    assert split_compound(raw) == parts


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("I 2362", TYPE_INVENTORY),
        ("RA 28", TYPE_COLLECTION),
        ("M.M.Z. 15", TYPE_COLLECTION),
        ("INC 1234", TYPE_INC_RN),
        ("1234", None),
    ],
)
def test_detect_type(raw: str, expected: str | None) -> None:
    assert detect_type(raw) == expected


def test_compound_cell_proposes_two_identifiers_pending_confirmation() -> None:
    proposals = propose_identifiers("I 2362 / RA 28")
    assert [(p.type_code, p.result.normalized) for p in proposals] == [
        (TYPE_INVENTORY, "I-2362"),
        (TYPE_COLLECTION, "RA 28"),
    ]
    assert all(p.requires_confirmation for p in proposals)
    assert all("varios códigos" in " ".join(p.notes) for p in proposals)


def test_proposal_uses_default_type_when_undetectable() -> None:
    [proposal] = propose_identifiers("1234", default_type=TYPE_INC_RN)
    assert proposal.type_code == TYPE_INC_RN
    assert proposal.result.detected_format == FORMAT_INC_4


def test_proposal_warns_on_type_mismatch_and_unknown_type() -> None:
    [mismatch] = propose_identifiers("RA 28", default_type=TYPE_INVENTORY)
    assert mismatch.type_code == TYPE_COLLECTION
    assert any("parece de tipo" in note for note in mismatch.notes)
    [unknown] = propose_identifiers("??? 7")
    assert unknown.type_code is None
    assert any("No se pudo determinar" in note for note in unknown.notes)
