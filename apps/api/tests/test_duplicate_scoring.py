"""Spec calidad-datos — explainable duplicate scoring, one test per signal and per fingerprint.

Change deteccion-duplicados-y-cola-revision, task 2.1 (design D1 and D2). Pure functions: no
database involved.
"""

import uuid

import pytest

from app.modules.quality.scoring import (
    Dimension,
    IdentifierValue,
    PieceProfile,
    ScoringConfig,
    comparison_fingerprint,
    known_author,
    normalize_text,
    score_pair,
    text_similarity,
    trigram_similarity,
)

ROOT = uuid.UUID(int=100)
SUBCOLLECTION = uuid.UUID(int=101)
OTHER = uuid.UUID(int=200)
CONFIG = ScoringConfig()


def piece(n: int, denomination: str = "Retablo ayacuchano", **data: object) -> PieceProfile:
    return PieceProfile(piece_id=uuid.UUID(int=n), denomination=denomination, **data)  # type: ignore[arg-type]


def signal(result, name: str):  # type: ignore[no-untyped-def]
    return next((s for s in result.signals if s.signal == name), None)


def inc(original: str, normalized: str = "001234") -> IdentifierValue:
    return IdentifierValue("INC_RN", normalized, original, is_current=False)


def code_i(normalized: str, *, current: bool = True) -> IdentifierValue:
    return IdentifierValue("I", normalized, normalized, is_current=current)


# --- text helpers ----------------------------------------------------------------------------


def test_normalize_text_ignores_case_accents_and_punctuation() -> None:
    assert normalize_text("  Máscara  de Diablo, (Puno)! ") == "mascara de diablo puno"
    assert normalize_text(None) == ""


def test_text_similarity_is_one_for_the_same_normalized_text_and_zero_when_missing() -> None:
    assert text_similarity("Retablo ayacuchano", "RETABLO AYACUCHANO") == 1.0
    assert 0 < text_similarity("Retablo ayacuchano", "Retablo ayacuchano s/n") < 1
    assert text_similarity("Retablo", None) == 0.0


def test_trigram_similarity_follows_pg_trgm() -> None:
    assert trigram_similarity("Retablo", "retablo") == 1.0
    assert trigram_similarity("Retablo ayacuchano", "Vasija ceremonial") == 0.0
    assert 0.45 < trigram_similarity("Retablo ayacuchano", "Retablo ayacuchano (3 pisos)") < 1


# --- signals ---------------------------------------------------------------------------------


def test_shared_historical_code_is_a_signal_with_both_original_values() -> None:
    """Spec: «Mismo código histórico en dos piezas» enters the queue with both values."""
    a = piece(1, "Retablo de Huamanga", identifiers=(inc("INC-1234"),))
    b = piece(2, "Caja de imaginero", identifiers=(inc("001234"),))
    result = score_pair(a, b)

    found = signal(result, "identifier")
    assert found is not None
    assert found.field == "identifier:INC_RN"
    assert found.values == {"normalized": "001234", "a": "INC-1234", "b": "001234"}
    assert found.contribution == pytest.approx(0.35)
    assert result.shared_identifier
    assert result.score < CONFIG.min_score  # distinct denominations…
    assert result.enters_queue(CONFIG)  # …but a shared identifier always enters (design D1)


def test_inventory_code_weighs_more_than_other_identifiers() -> None:
    a = piece(1, identifiers=(code_i("I-236"), inc("001234")))
    b = piece(2, identifiers=(code_i("I-236"), inc("001234")))
    found = signal(score_pair(a, b), "identifier")
    assert found.field == "identifier:I"
    assert found.weight == 0.45


def test_same_value_in_different_identifier_types_is_not_a_match() -> None:
    a = piece(1, identifiers=(IdentifierValue("COLECCION", "236", "236"),))
    b = piece(2, identifiers=(IdentifierValue("PUCP", "236", "236"),))
    assert signal(score_pair(a, b), "identifier") is None


def test_identifiers_without_normalized_value_are_ignored() -> None:
    a = piece(1, identifiers=(IdentifierValue("OTRO", None, "s/n"),))
    b = piece(2, identifiers=(IdentifierValue("OTRO", None, "s/n"),))
    assert not score_pair(a, b).shared_identifier


def test_two_different_current_inventory_codes_block_the_merge() -> None:
    a = piece(1, identifiers=(code_i("I-100"),))
    b = piece(2, identifiers=(code_i("I-200"),))
    result = score_pair(a, b)
    assert result.blocking_conflict
    conflict = signal(result, "inventory_code_conflict")
    assert conflict.values == {"a": ["I-100"], "b": ["I-200"]}
    assert conflict.contribution == 0


def test_a_historical_inventory_code_does_not_block_the_merge() -> None:
    a = piece(1, identifiers=(code_i("I-100"),))
    b = piece(2, identifiers=(code_i("I-200", current=False),))
    assert not score_pair(a, b).blocking_conflict


def test_denomination_signal_uses_the_normalized_text() -> None:
    result = score_pair(piece(1, "Retablo ayacuchano"), piece(2, "RETABLO AYACUCHANO"))
    found = signal(result, "denomination")
    assert found.similarity == 1.0
    assert found.values == {"a": "Retablo ayacuchano", "b": "RETABLO AYACUCHANO"}


@pytest.mark.parametrize(
    ("lineage_a", "lineage_b", "expected"),
    [
        ((ROOT,), (ROOT,), 1.0),  # same collection
        ((SUBCOLLECTION, ROOT), (ROOT,), 1.0),  # subcollection of the other one
        ((ROOT,), (OTHER,), 0.0),  # unrelated collections
    ],
)
def test_collection_signal(
    lineage_a: tuple[uuid.UUID, ...], lineage_b: tuple[uuid.UUID, ...], expected: float
) -> None:
    found = signal(
        score_pair(piece(1, collection_lineage=lineage_a), piece(2, collection_lineage=lineage_b)),
        "collection",
    )
    assert found.similarity == expected


def test_collection_signal_needs_both_collections() -> None:
    assert signal(score_pair(piece(1, collection_lineage=(ROOT,)), piece(2)), "collection") is None


def test_author_and_provenance_are_averaged_over_the_fields_both_have() -> None:
    a = piece(1, author="Jesús Urbano", provenance="Ayacucho")
    b = piece(2, author="Jesus Urbano", provenance=None)
    found = signal(score_pair(a, b), "author_provenance")
    assert found.field == "author"
    assert found.similarity == 1.0
    assert signal(score_pair(piece(1), piece(2)), "author_provenance") is None


def test_two_anonymous_authors_do_not_add_the_author_signal() -> None:
    a = piece(1, author="Anónimo", provenance="Lima")
    b = piece(2, author="Anónimo", provenance="Cusco")
    found = signal(score_pair(a, b), "author_provenance")
    assert found.field == "provenance"  # only the provenance is compared
    assert "author" not in found.values
    assert found.similarity < 0.5  # Lima ≠ Cusco: no free point from the author


@pytest.mark.parametrize(
    "unknown",
    ["Anónimo", "ANONIMO", "anónima", "Autor anónimo", "Desconocido", "No presenta", "S/N", "-"],
)
def test_unknown_author_markers_count_as_missing_author(unknown: str) -> None:
    assert known_author(unknown) == ""
    a = piece(1, author=unknown)
    b = piece(2, author="Jesús Urbano")
    assert signal(score_pair(a, b), "author_provenance") is None


def test_a_known_author_still_counts() -> None:
    assert known_author("Taller Urbano") == "taller urbano"
    found = signal(
        score_pair(piece(1, author="Taller Urbano"), piece(2, author="TALLER URBANO")),
        "author_provenance",
    )
    assert found.field == "author"
    assert found.similarity == 1.0


def test_an_anonymous_author_does_not_change_the_fingerprint() -> None:
    a, b = piece(1, author="Anónimo"), piece(2)
    assert comparison_fingerprint(a, b) == comparison_fingerprint(piece(1, author=None), b)


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [
        ((1940, 1960), (1950, 1950), 1.0),  # «ca. 1950» inside a range
        ((1801, 1900), (1901, 2000), 0.0),  # different centuries
        ((1950, None), (None, 1950), 1.0),  # a single bound is a one-year range
    ],
)
def test_epoch_signal_checks_overlapping_ranges(
    a: tuple[int | None, int | None], b: tuple[int | None, int | None], expected: float
) -> None:
    found = signal(
        score_pair(
            piece(1, epoch_start_year=a[0], epoch_end_year=a[1]),
            piece(2, epoch_start_year=b[0], epoch_end_year=b[1]),
        ),
        "epoch",
    )
    assert found.similarity == expected


def test_dimensions_are_compatible_within_five_percent() -> None:
    a = piece(1, dimensions=(Dimension("alto", 35), Dimension("ancho", 20)))
    b = piece(
        2, dimensions=(Dimension("Alto", 36), Dimension("ancho", 30), Dimension("peso", 2, "kg"))
    )
    found = signal(score_pair(a, b), "dimensions")
    assert found.similarity == 0.5  # alto 35 ≈ 36 (2.8 %), ancho 20 ≠ 30
    assert set(found.values) == {"alto (cm)", "ancho (cm)"}


def test_dimensions_in_different_units_are_not_compared() -> None:
    a = piece(1, dimensions=(Dimension("alto", 35, "cm"),))
    b = piece(2, dimensions=(Dimension("alto", 350, "mm"),))
    assert signal(score_pair(a, b), "dimensions") is None


# --- score and queue rule --------------------------------------------------------------------


def test_score_is_the_sum_of_weighted_signals() -> None:
    a = piece(
        1,
        "Retablo ayacuchano",
        collection_lineage=(ROOT,),
        provenance="Ayacucho",
        identifiers=(IdentifierValue("COLECCION", "MMZ 12", "MMZ 012"),),
    )
    b = piece(
        2,
        "RETABLO AYACUCHANO",
        collection_lineage=(ROOT,),
        provenance="Ayacucho",
        identifiers=(IdentifierValue("COLECCION", "MMZ 12", "M.M.Z. 012"),),
    )
    result = score_pair(a, b)
    assert result.score == pytest.approx(0.35 + 0.30 + 0.10 + 0.15)
    assert [s["signal"] for s in result.matched_fields()] == [
        "identifier",
        "denomination",
        "collection",
        "author_provenance",
    ]


def test_a_near_equal_denomination_in_the_same_collection_is_not_enough() -> None:
    a = piece(1, "Retablo ayacuchano", collection_lineage=(ROOT,))
    b = piece(2, "Retablo ayacuchano", collection_lineage=(ROOT,))
    result = score_pair(a, b)
    assert result.score == pytest.approx(0.40)
    assert not result.enters_queue(CONFIG)


def test_several_agreeing_signals_enter_the_queue_without_a_shared_identifier() -> None:
    """Spec: «Detección incremental al editar» — same collection, author, provenance and epoch."""
    shared = {
        "collection_lineage": (ROOT,),
        "author": "Taller Urbano",
        "provenance": "Ayacucho",
        "epoch_start_year": 1950,
        "epoch_end_year": 1950,
    }
    a = piece(1, "Retablo ayacuchano de tres pisos", **shared)
    b = piece(2, "Retablo ayacuchano de 3 pisos", **shared)
    result = score_pair(a, b)
    assert not result.shared_identifier
    assert result.score >= CONFIG.min_score
    assert result.enters_queue(CONFIG)


def test_without_a_shared_identifier_the_score_tops_out_at_075() -> None:
    same = {
        "collection_lineage": (ROOT,),
        "author": "Urbano",
        "provenance": "Ayacucho",
        "epoch_start_year": 1950,
        "dimensions": (Dimension("alto", 35),),
    }
    assert score_pair(piece(1, **same), piece(2, **same)).score == pytest.approx(0.75)


def test_score_never_exceeds_one() -> None:
    heavy = ScoringConfig(inventory_code_weight=1.0, denomination_weight=1.0)
    a = piece(1, identifiers=(code_i("I-1"),))
    b = piece(2, identifiers=(code_i("I-1"),))
    assert score_pair(a, b, heavy).score == 1.0


# --- fingerprint (design D2) -----------------------------------------------------------------


def test_fingerprint_does_not_depend_on_the_order_of_the_pieces() -> None:
    a, b = piece(1, author="Urbano"), piece(2, "RETABLO")
    assert comparison_fingerprint(a, b) == comparison_fingerprint(b, a)
    assert score_pair(a, b).fingerprint == score_pair(b, a).fingerprint
    assert len(comparison_fingerprint(a, b)) == 64


def test_fingerprint_ignores_cosmetic_changes_of_compared_text() -> None:
    a, b = piece(1, "Retablo ayacuchano"), piece(2, "Caja")
    assert comparison_fingerprint(a, b) == comparison_fingerprint(
        piece(1, "RETABLO  Ayacuchano."), b
    )


def test_fingerprint_changes_when_a_compared_value_changes() -> None:
    """Spec: «Par distinto con datos modificados» reopens the pair (new collection code)."""
    a = piece(1, identifiers=(IdentifierValue("COLECCION", "MMZ 12", "MMZ 012"),))
    b = piece(2)
    before = comparison_fingerprint(a, b)
    with_code = piece(2, identifiers=(IdentifierValue("COLECCION", "MMZ 12", "MMZ-12"),))
    assert comparison_fingerprint(a, with_code) != before
    assert comparison_fingerprint(a, piece(2, provenance="Puno")) != before


# --- configuration ---------------------------------------------------------------------------


def test_configuration_overrides_defaults_from_quality_setting() -> None:
    config = ScoringConfig.from_setting({"min_score": 0.7, "denomination_weight": 0.3})
    assert config.min_score == 0.7
    assert config.denomination_weight == 0.3
    assert config.inventory_code_weight == 0.45
    assert ScoringConfig.from_setting(None) == ScoringConfig()


@pytest.mark.parametrize(
    "value", [{"min_score": 1.5}, {"min_score": -0.1}, {"min_score": "0.6"}, {"umbral": 0.6}]
)
def test_invalid_configuration_is_rejected_with_a_clear_message(value: dict[str, object]) -> None:
    with pytest.raises(ValueError, match="detección"):
        ScoringConfig.from_setting(value)
