"""Spec calidad-datos — candidate generation by blocks and the ``SimilarityScorer`` interface.

Change deteccion-duplicados-y-cola-revision, task 2.2 (design D1 and D3), checked against the
synthetic seed: 298 pieces with 10 planted duplicate pairs (same collection code written dirty,
variant denomination, same collection and provenance).
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.db import make_session_factory
from app.models import Base, DuplicateCandidate, Piece, PieceIdentifier, QualitySetting
from app.modules.audit.context import audit_context
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.quality.duplicates import (
    BLOCK_DENOMINATION,
    BLOCK_IDENTIFIER,
    RuleBasedSimilarityScorer,
    SimilarityScorer,
    find_candidates,
    load_scoring_config,
)
from app.modules.quality.scoring import SETTING_KEY, IdentifierValue, PieceProfile, ScoringConfig
from app.seed.synthetic import SeedOptions, run_seed
from tests.conftest import SYSTEM_CONTEXT


def _new_session() -> tuple[Engine, Session]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    return engine, make_session_factory(engine)()


@pytest.fixture(scope="module")
def seeded() -> Iterator[Session]:
    engine, session = _new_session()
    run_seed(session, SeedOptions(upload_media=False, admin_password="demo-password-1"))
    session.commit()
    yield session
    session.close()
    engine.dispose()


def _pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    first, second = sorted((a, b), key=str)
    return first, second


@pytest.fixture(scope="module")
def planted(seeded: Session) -> set[tuple[uuid.UUID, uuid.UUID]]:
    rows = seeded.scalars(
        select(DuplicateCandidate).where(DuplicateCandidate.piece_b_id.is_not(None))
    ).all()
    pairs = {_pair(row.piece_a_id, row.piece_b_id) for row in rows if row.piece_b_id}
    assert len(pairs) == 10
    return pairs


@pytest.fixture(scope="module")
def detection(seeded: Session) -> Any:
    return find_candidates(seeded)


def test_every_planted_pair_is_detected_above_the_threshold(
    detection: Any, planted: set[tuple[uuid.UUID, uuid.UUID]]
) -> None:
    found = {(c.piece_a_id, c.piece_b_id): c for c in detection.candidates}
    config = ScoringConfig()
    for pair in planted:
        candidate = found.get(pair)
        assert candidate is not None, f"par sembrado no detectado: {pair}"
        assert candidate.result.score >= config.min_score
        assert {BLOCK_IDENTIFIER, BLOCK_DENOMINATION} <= candidate.blocks
        signals = {signal["field"] for signal in candidate.result.matched_fields()}
        assert {f"identifier:{TYPE_COLLECTION}", "denomination", "collection_id"} <= signals


def test_no_spurious_pair_above_the_threshold(
    detection: Any, planted: set[tuple[uuid.UUID, uuid.UUID]]
) -> None:
    """Outside the planted pairs nothing reaches the threshold.

    A pair may still enter below it only because both pieces share a normalized code (the seed
    draws PUCP codes at random, so two unrelated pieces can share one): that is the spec scenario
    «Mismo código histórico en dos piezas», which must reach a human.
    """
    config = ScoringConfig()
    for candidate in detection.candidates:
        if (candidate.piece_a_id, candidate.piece_b_id) in planted:
            continue
        assert candidate.result.score < config.min_score
        assert candidate.result.shared_identifier
        assert candidate.blocks == {BLOCK_IDENTIFIER}


def test_detection_does_not_compare_every_pair(detection: Any) -> None:
    """Spec: «Catálogo de volumen objetivo» — blocks avoid the all-pairs comparison."""
    all_pairs = detection.pieces * (detection.pieces - 1) // 2
    assert detection.pieces == 298
    assert 0 < detection.pairs_evaluated < all_pairs // 10


def test_each_pair_is_reported_once_in_a_stable_order(detection: Any) -> None:
    keys = [(c.piece_a_id, c.piece_b_id) for c in detection.candidates]
    assert len(keys) == len(set(keys))
    assert all(str(a) < str(b) for a, b in keys)


def test_incremental_detection_only_returns_pairs_of_the_given_piece(
    seeded: Session, planted: set[tuple[uuid.UUID, uuid.UUID]]
) -> None:
    piece_id, other_id = sorted(planted, key=str)[0]
    result = find_candidates(seeded, piece_ids=[piece_id])
    assert all(piece_id in (c.piece_a_id, c.piece_b_id) for c in result.candidates)
    assert (piece_id, other_id) in {(c.piece_a_id, c.piece_b_id) for c in result.candidates}


def test_scorer_finds_the_catalogue_piece_of_an_import_row(
    seeded: Session, planted: set[tuple[uuid.UUID, uuid.UUID]]
) -> None:
    """The import pipeline scores a mapped row (no piece yet) through ``SimilarityScorer``."""
    original = seeded.get(Piece, sorted(planted, key=str)[0][0])
    assert original is not None
    code = seeded.scalars(
        select(PieceIdentifier).where(
            PieceIdentifier.piece_id == original.id,
            PieceIdentifier.identifier_type_code == TYPE_COLLECTION,
        )
    ).first()
    assert code is not None and code.normalized_value
    row = PieceProfile(
        piece_id=None,
        denomination=original.denomination.upper(),
        identifiers=(
            IdentifierValue(TYPE_COLLECTION, code.normalized_value, "valor de la sábana"),
        ),
    )
    scorer: SimilarityScorer = RuleBasedSimilarityScorer(seeded)
    candidates = scorer.score(row)
    assert original.id in {candidate.piece_id for candidate in candidates}
    assert candidates == sorted(candidates, key=lambda c: (-c.result.score, str(c.piece_id)))


def test_merged_and_deleted_pieces_are_not_candidates(seeded: Session) -> None:
    pieces = seeded.scalars(select(Piece).limit(3)).all()
    profiles = RuleBasedSimilarityScorer(seeded).index.profiles
    assert all(piece.id in profiles for piece in pieces)
    try:
        with audit_context(seeded, SYSTEM_CONTEXT):
            pieces[0].merged_into_id = pieces[1].id
            seeded.flush()
        assert pieces[0].id not in RuleBasedSimilarityScorer(seeded).index.profiles
    finally:
        seeded.rollback()


def test_scoring_configuration_is_read_from_quality_setting(seeded: Session) -> None:
    assert load_scoring_config(seeded) == ScoringConfig()
    try:
        with audit_context(seeded, SYSTEM_CONTEXT):
            seeded.add(QualitySetting(key=SETTING_KEY, value={"min_score": 0.75}))
            seeded.flush()
        assert load_scoring_config(seeded).min_score == 0.75
    finally:
        seeded.rollback()
