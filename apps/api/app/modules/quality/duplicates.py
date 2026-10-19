"""Candidate generation by blocks and the ``SimilarityScorer`` interface (spec calidad-datos).

Change deteccion-duplicados-y-cola-revision, design D1 and D3. Comparing every piece with every
other one (≈2·10⁸ pairs for 20 000 pieces) is not viable, so a pair is only scored when it falls
into at least one block:

1. ``identifier``: the same normalized value of the same identifier type, current or historical;
2. ``denomination``: denomination trigram similarity ≥ ``denomination_block_min`` within the same
   root collection (pieces without collection form their own group);
3. ``author_provenance``: same normalized author and provenance, and denomination trigram
   similarity ≥ ``author_provenance_block_min``.

The trigram similarity is computed in Python with the ``pg_trgm`` definition
(``scoring.trigram_similarity``) through an inverted index per group, so the same code runs on
PostgreSQL and on the SQLite test suite. Only active pieces that were not merged take part.

This module only detects: storing candidates, reopening DISTINCT pairs whose fingerprint changed
and the background jobs belong to tasks 2.3 and 2.4.
"""

import uuid
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import PieceIdentifier
from app.modules.quality.models import QualitySetting
from app.modules.quality.scoring import (
    SETTING_KEY,
    Dimension,
    IdentifierValue,
    PairScore,
    PieceProfile,
    ScoringConfig,
    known_author,
    normalize_text,
    score_pair,
    trigrams,
)

BLOCK_IDENTIFIER = "identifier"
BLOCK_DENOMINATION = "denomination"
BLOCK_AUTHOR_PROVENANCE = "author_provenance"
#: How many subjects are processed between two progress reports.
PROGRESS_EVERY = 100


@dataclass(frozen=True)
class Candidate:
    """A catalogue piece that may be the same object as the scored subject."""

    piece_id: uuid.UUID
    result: PairScore
    blocks: frozenset[str]


class SimilarityScorer(Protocol):
    """Interface used by ``importacion-pipeline-reconciliacion`` to classify an import row.

    ``score`` receives the profile of a piece or of a mapped import row (``piece_id=None``) and
    returns the catalogue pieces that enter the duplicate queue with it, best score first.
    """

    def score(self, subject: PieceProfile) -> list[Candidate]: ...


@dataclass(frozen=True)
class CandidatePair:
    piece_a_id: uuid.UUID
    piece_b_id: uuid.UUID
    result: PairScore
    blocks: frozenset[str]


@dataclass
class DetectionResult:
    pieces: int = 0
    pairs_evaluated: int = 0
    candidates: list[CandidatePair] = field(default_factory=list)


def load_scoring_config(session: Session) -> ScoringConfig:
    """Detection parameters stored in ``quality_setting``; defaults when there is none."""
    value = session.scalar(select(QualitySetting.value).where(QualitySetting.key == SETTING_KEY))
    return ScoringConfig.from_setting(value)


def _lineages(session: Session) -> dict[uuid.UUID, tuple[uuid.UUID, ...]]:
    parents = dict(session.execute(select(Collection.id, Collection.parent_id)).tuples().all())
    lineages: dict[uuid.UUID, tuple[uuid.UUID, ...]] = {}
    for collection_id in parents:
        chain: list[uuid.UUID] = []
        current: uuid.UUID | None = collection_id
        while current is not None and current not in chain:  # guard against a cycle
            chain.append(current)
            current = parents.get(current)
        lineages[collection_id] = tuple(chain)
    return lineages


def _dimensions(raw: Sequence[Mapping[str, Any]] | None) -> tuple[Dimension, ...]:
    result: list[Dimension] = []
    for item in raw or ():
        try:
            result.append(
                Dimension(str(item["dimension"]), float(item["value"]), str(item.get("unit", "cm")))
            )
        except (KeyError, TypeError, ValueError):
            continue  # malformed measures are not compared
    return tuple(result)


def load_profiles(session: Session) -> list[PieceProfile]:
    """Profiles of every active piece that was not merged into another one."""
    lineages = _lineages(session)
    pieces = session.scalars(select(Piece).where(Piece.merged_into_id.is_(None))).all()
    identifiers: dict[uuid.UUID, list[IdentifierValue]] = defaultdict(list)
    for row in session.execute(
        select(
            PieceIdentifier.piece_id,
            PieceIdentifier.identifier_type_code,
            PieceIdentifier.normalized_value,
            PieceIdentifier.original_value,
            PieceIdentifier.is_current,
        )
    ):
        identifiers[row.piece_id].append(
            IdentifierValue(
                row.identifier_type_code, row.normalized_value, row.original_value, row.is_current
            )
        )
    return [
        PieceProfile(
            piece_id=piece.id,
            denomination=piece.denomination,
            collection_lineage=lineages.get(piece.collection_id, ()) if piece.collection_id else (),
            author=piece.author,
            provenance=piece.provenance,
            epoch_start_year=piece.epoch_start_year,
            epoch_end_year=piece.epoch_end_year,
            dimensions=_dimensions(piece.dimensions),
            identifiers=tuple(identifiers.get(piece.id, ())),
        )
        for piece in pieces
    ]


def _jaccard(left: frozenset[str], right: frozenset[str]) -> float:
    union = len(left | right)
    return len(left & right) / union if union else 0.0


def _root(profile: PieceProfile) -> uuid.UUID | None:
    return profile.collection_lineage[-1] if profile.collection_lineage else None


def _author_provenance_key(profile: PieceProfile) -> tuple[str, str] | None:
    author, provenance = known_author(profile.author), normalize_text(profile.provenance)
    return (author, provenance) if author and provenance else None


class CatalogIndex:
    """In-memory blocking index over the catalogue profiles."""

    def __init__(self, profiles: Iterable[PieceProfile], config: ScoringConfig) -> None:
        self.config = config
        self.profiles: dict[uuid.UUID, PieceProfile] = {}
        self._grams: dict[uuid.UUID, frozenset[str]] = {}
        self._by_identifier: dict[tuple[str, str], set[uuid.UUID]] = defaultdict(set)
        self._postings: dict[uuid.UUID | None, dict[str, set[uuid.UUID]]] = defaultdict(
            lambda: defaultdict(set)
        )
        self._by_author_provenance: dict[tuple[str, str], set[uuid.UUID]] = defaultdict(set)
        for profile in profiles:
            if profile.piece_id is None:
                continue
            piece_id = profile.piece_id
            self.profiles[piece_id] = profile
            self._grams[piece_id] = trigrams(profile.denomination)
            for key in profile.shared_identifier_keys():
                self._by_identifier[key].add(piece_id)
            for gram in self._grams[piece_id]:
                self._postings[_root(profile)][gram].add(piece_id)
            if (key := _author_provenance_key(profile)) is not None:
                self._by_author_provenance[key].add(piece_id)

    def _similar_denominations(
        self, grams: frozenset[str], pool: Mapping[str, set[uuid.UUID]], minimum: float
    ) -> set[uuid.UUID]:
        shared: dict[uuid.UUID, int] = defaultdict(int)
        for gram in grams:
            for piece_id in pool.get(gram, ()):
                shared[piece_id] += 1
        return {
            piece_id
            for piece_id, count in shared.items()
            if count / (len(grams) + len(self._grams[piece_id]) - count) >= minimum
        }

    def neighbours(self, subject: PieceProfile) -> dict[uuid.UUID, set[str]]:
        """Catalogue pieces that share at least one block with ``subject``, and which blocks."""
        found: dict[uuid.UUID, set[str]] = defaultdict(set)
        for key in subject.shared_identifier_keys():
            for piece_id in self._by_identifier.get(key, ()):
                found[piece_id].add(BLOCK_IDENTIFIER)
        grams = self._grams.get(subject.piece_id) if subject.piece_id else None
        grams = grams if grams is not None else trigrams(subject.denomination)
        if grams:
            pool = self._postings.get(_root(subject), {})
            minimum = self.config.denomination_block_min
            for piece_id in self._similar_denominations(grams, pool, minimum):
                found[piece_id].add(BLOCK_DENOMINATION)
            if (key := _author_provenance_key(subject)) is not None:
                # Same author and provenance can cross collections: the group is small, so its
                # members are compared directly instead of through the collection postings.
                minimum = self.config.author_provenance_block_min
                for piece_id in self._by_author_provenance.get(key, ()):
                    if _jaccard(grams, self._grams[piece_id]) >= minimum:
                        found[piece_id].add(BLOCK_AUTHOR_PROVENANCE)
        if subject.piece_id is not None:
            found.pop(subject.piece_id, None)
        return found


class RuleBasedSimilarityScorer:
    """``SimilarityScorer`` with the detection rules of design D1 over the active catalogue."""

    def __init__(
        self,
        session: Session,
        config: ScoringConfig | None = None,
        index: CatalogIndex | None = None,
    ) -> None:
        self.config = config or load_scoring_config(session)
        self.index = index or CatalogIndex(load_profiles(session), self.config)

    def score(self, subject: PieceProfile) -> list[Candidate]:
        candidates: list[Candidate] = []
        for piece_id, blocks in self.index.neighbours(subject).items():
            result = score_pair(subject, self.index.profiles[piece_id], self.config)
            if result.enters_queue(self.config):
                candidates.append(Candidate(piece_id, result, frozenset(blocks)))
        return sorted(candidates, key=lambda c: (-c.result.score, str(c.piece_id)))


def find_candidates(
    session: Session,
    config: ScoringConfig | None = None,
    piece_ids: Iterable[uuid.UUID] | None = None,
    on_progress: Callable[[int, int], None] | None = None,
) -> DetectionResult:
    """Duplicate candidates of the whole catalogue, or only those involving ``piece_ids``.

    Each pair appears once, with ``piece_a_id`` < ``piece_b_id`` (by their text form), and is
    scored once even if it falls into several blocks. ``on_progress(processed, total)`` is called
    every ``PROGRESS_EVERY`` subjects and at the end (heartbeat of the background scan).
    """
    config = config or load_scoring_config(session)
    index = CatalogIndex(load_profiles(session), config)
    subjects = (
        [index.profiles[pid] for pid in piece_ids if pid in index.profiles]
        if piece_ids is not None
        else list(index.profiles.values())
    )
    result = DetectionResult(pieces=len(index.profiles))
    seen: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for position, subject in enumerate(subjects, start=1):
        if on_progress is not None and position % PROGRESS_EVERY == 0:
            on_progress(position, len(subjects))
        subject_id = subject.piece_id
        if subject_id is None:
            continue
        for other_id, blocks in index.neighbours(subject).items():
            a_id, b_id = sorted((subject_id, other_id), key=str)
            if (a_id, b_id) in seen:
                continue
            seen.add((a_id, b_id))
            result.pairs_evaluated += 1
            scored = score_pair(index.profiles[a_id], index.profiles[b_id], config)
            if scored.enters_queue(config):
                result.candidates.append(CandidatePair(a_id, b_id, scored, frozenset(blocks)))
    result.candidates.sort(key=lambda c: (-c.result.score, str(c.piece_a_id), str(c.piece_b_id)))
    if on_progress is not None:
        on_progress(len(subjects), len(subjects))
    return result
