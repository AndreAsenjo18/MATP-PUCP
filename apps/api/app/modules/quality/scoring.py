"""Explainable duplicate scoring: signals, weights and comparison fingerprint (spec calidad-datos).

Change deteccion-duplicados-y-cola-revision, design D1 and D2. Pure functions over
``PieceProfile`` values, so the same rules score two catalogue pieces or an import row against a
piece (``quality.duplicates.SimilarityScorer``). Nothing here touches the database.

Rules (design D1, weights [SUPUESTO] and configurable through ``quality_setting``):

- the score is the sum of ``weight × similarity`` of every applicable signal, capped at 1;
- a signal applies only when both pieces have the compared data; missing data adds nothing;
- a pair that shares a normalized identifier always enters the queue, even below the threshold
  (spec scenario «Mismo código histórico en dos piezas»); other pairs need ``min_score``;
- two different current inventory codes (I) mark the pair as ``blocking_conflict``.
"""

import difflib
import hashlib
import json
import re
import unicodedata
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field, fields, replace
from typing import Any

from app.modules.identification.normalization import ABSENCE_MARKERS, TYPE_INVENTORY

#: Key of the ``quality_setting`` row that overrides ``ScoringConfig`` defaults.
SETTING_KEY = "duplicates.scoring"


@dataclass(frozen=True)
class ScoringConfig:
    """Weights and thresholds of the detection rules (design D1) [SUPUESTO].

    Without a shared identifier a pair can reach at most 0.75, so it enters the queue only when
    several signals agree (denomination, collection, author and provenance, epoch); a near-equal
    denomination in the same collection alone adds 0.40.
    """

    #: Weight of a shared normalized identifier, by identifier type; I weighs more.
    inventory_code_weight: float = 0.45
    other_identifier_weight: float = 0.35
    denomination_weight: float = 0.30
    collection_weight: float = 0.10
    author_provenance_weight: float = 0.15
    epoch_weight: float = 0.10
    dimensions_weight: float = 0.10
    #: Pairs without a shared identifier enter the queue from this score (DUPLICATE_MIN_SCORE).
    min_score: float = 0.6
    #: Relative tolerance for two measures of the same dimension to be compatible (±5 %).
    dimension_tolerance: float = 0.05
    #: Blocking thresholds used to generate candidate pairs (``quality.duplicates``).
    denomination_block_min: float = 0.45
    author_provenance_block_min: float = 0.3

    @classmethod
    def from_setting(cls, value: Mapping[str, Any] | None) -> "ScoringConfig":
        """Defaults overridden by the JSON stored in ``quality_setting`` (key ``SETTING_KEY``)."""
        if not value:
            return cls()
        known = {item.name for item in fields(cls)}
        unknown = sorted(set(value) - known)
        if unknown:
            raise ValueError(
                f"Parámetros de detección desconocidos: {', '.join(unknown)}. "
                f"Admitidos: {', '.join(sorted(known))}."
            )
        overrides: dict[str, float] = {}
        for name, raw in value.items():
            if isinstance(raw, bool) or not isinstance(raw, int | float) or not 0 <= raw <= 1:
                raise ValueError(
                    f"El parámetro de detección «{name}» debe ser un número entre 0 y 1."
                )
            overrides[name] = float(raw)
        return replace(cls(), **overrides)

    def identifier_weight(self, type_code: str) -> float:
        if type_code == TYPE_INVENTORY:
            return self.inventory_code_weight
        return self.other_identifier_weight


@dataclass(frozen=True)
class IdentifierValue:
    type_code: str
    normalized: str | None
    original: str
    is_current: bool = True


@dataclass(frozen=True)
class Dimension:
    name: str
    value: float
    unit: str = "cm"


@dataclass(frozen=True)
class PieceProfile:
    """The data compared between two pieces, or between an import row and a piece.

    ``collection_lineage`` holds the piece's collection first and then its ancestors, so a
    piece in a subcollection still matches its parent collection. ``piece_id`` is ``None`` for an
    import row that has no piece yet.
    """

    piece_id: uuid.UUID | None
    denomination: str
    collection_lineage: tuple[uuid.UUID, ...] = ()
    author: str | None = None
    provenance: str | None = None
    epoch_start_year: int | None = None
    epoch_end_year: int | None = None
    dimensions: tuple[Dimension, ...] = ()
    identifiers: tuple[IdentifierValue, ...] = ()

    @property
    def collection_id(self) -> uuid.UUID | None:
        return self.collection_lineage[0] if self.collection_lineage else None

    def shared_identifier_keys(self) -> set[tuple[str, str]]:
        return {(i.type_code, i.normalized) for i in self.identifiers if i.normalized}


@dataclass(frozen=True)
class Signal:
    """One explained reason of the score, stored in ``duplicate_candidate.matched_fields``."""

    signal: str
    field: str
    similarity: float
    weight: float
    values: Any = None

    @property
    def contribution(self) -> float:
        return self.weight * self.similarity

    def to_json(self) -> dict[str, Any]:
        return {
            "signal": self.signal,
            "field": self.field,
            "similarity": round(self.similarity, 4),
            "weight": self.weight,
            "contribution": round(self.contribution, 4),
            "values": self.values,
        }


@dataclass(frozen=True)
class PairScore:
    score: float
    signals: tuple[Signal, ...] = field(default=())
    blocking_conflict: bool = False
    shared_identifier: bool = False
    fingerprint: str = ""

    def enters_queue(self, config: ScoringConfig) -> bool:
        """A shared identifier always enters; any other pair needs ``min_score`` (design D1)."""
        return self.shared_identifier or self.score >= config.min_score

    def matched_fields(self) -> list[dict[str, Any]]:
        return [signal.to_json() for signal in self.signals]


_NON_ALNUM = re.compile(r"[^0-9a-z]+")


def normalize_text(value: str | None) -> str:
    """Case-, accent- and punctuation-insensitive form used to compare free text."""
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
    return _NON_ALNUM.sub(" ", without_accents.casefold()).strip()


#: Author values that mean «no known author» [SUPUESTO]: the forms already used in the project
#: (seed «Anónimo», API example «Autor anónimo», «No presenta» as «sin dato» per question L7), the
#: «sin código» markers of question A5, and «Desconocido». Compared after ``normalize_text``.
UNKNOWN_AUTHOR_MARKERS = frozenset(
    {
        "anonimo",
        "anonima",
        "autor anonimo",
        "desconocido",
        "desconocida",
        "autor desconocido",
        "no presenta",
        "sin autor",
    }
    | {normalize_text(marker) for marker in ABSENCE_MARKERS}
)


def known_author(value: str | None) -> str:
    """Normalized author, or ``""`` when it only says that the author is not known.

    Two pieces by «Anónimo» do not share an author: treating that as a match would pair any two
    anonymous pieces from the same place.
    """
    normalized = normalize_text(value)
    return "" if normalized in UNKNOWN_AUTHOR_MARKERS else normalized


def text_similarity(a: str | None, b: str | None) -> float:
    """Similarity in [0, 1] of two free texts after ``normalize_text``; 0 if either is empty."""
    left, right = normalize_text(a), normalize_text(b)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return difflib.SequenceMatcher(None, left, right).ratio()


def trigrams(value: str | None) -> frozenset[str]:
    """Trigrams of each word padded like PostgreSQL ``pg_trgm`` (two spaces before, one after)."""
    grams: set[str] = set()
    for word in normalize_text(value).split():
        padded = f"  {word} "
        grams.update(padded[i : i + 3] for i in range(len(padded) - 2))
    return frozenset(grams)


def trigram_similarity(a: str | None, b: str | None) -> float:
    """``pg_trgm``-style similarity (shared / total trigrams), used for candidate blocking."""
    left, right = trigrams(a), trigrams(b)
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _identifier_signal(a: PieceProfile, b: PieceProfile, config: ScoringConfig) -> Signal | None:
    shared = a.shared_identifier_keys() & b.shared_identifier_keys()
    if not shared:
        return None
    type_code, normalized = max(shared, key=lambda key: (config.identifier_weight(key[0]), key))

    def original(profile: PieceProfile) -> str:
        return next(
            i.original
            for i in profile.identifiers
            if i.type_code == type_code and i.normalized == normalized
        )

    return Signal(
        "identifier",
        f"identifier:{type_code}",
        1.0,
        config.identifier_weight(type_code),
        {"normalized": normalized, "a": original(a), "b": original(b)},
    )


def _inventory_conflict(a: PieceProfile, b: PieceProfile) -> Signal | None:
    def current_codes(profile: PieceProfile) -> set[str]:
        return {
            i.normalized
            for i in profile.identifiers
            if i.type_code == TYPE_INVENTORY and i.is_current and i.normalized
        }

    codes_a, codes_b = current_codes(a), current_codes(b)
    if not codes_a or not codes_b or codes_a & codes_b:
        return None
    return Signal(
        "inventory_code_conflict",
        f"identifier:{TYPE_INVENTORY}",
        0.0,
        0.0,
        {"a": sorted(codes_a), "b": sorted(codes_b)},
    )


def _collection_signal(a: PieceProfile, b: PieceProfile, config: ScoringConfig) -> Signal | None:
    if a.collection_id is None or b.collection_id is None:
        return None
    related = a.collection_id in b.collection_lineage or b.collection_id in a.collection_lineage
    return Signal(
        "collection",
        "collection_id",
        1.0 if related else 0.0,
        config.collection_weight,
        {"a": str(a.collection_id), "b": str(b.collection_id)},
    )


def _author_provenance_signal(
    a: PieceProfile, b: PieceProfile, config: ScoringConfig
) -> Signal | None:
    compared: dict[str, list[str | None]] = {}
    similarities: list[float] = []
    for name in ("author", "provenance"):
        left, right = getattr(a, name), getattr(b, name)
        if name == "author" and not (known_author(left) and known_author(right)):
            continue  # an anonymous or unknown author is missing data, not a match
        if normalize_text(left) and normalize_text(right):
            compared[name] = [left, right]
            similarities.append(text_similarity(left, right))
    if not similarities:
        return None
    return Signal(
        "author_provenance",
        "+".join(compared),
        sum(similarities) / len(similarities),
        config.author_provenance_weight,
        compared,
    )


def _epoch_range(profile: PieceProfile) -> tuple[int, int] | None:
    start = (
        profile.epoch_start_year if profile.epoch_start_year is not None else profile.epoch_end_year
    )
    end = profile.epoch_end_year if profile.epoch_end_year is not None else start
    if start is None or end is None:
        return None
    return (start, end)


def _epoch_signal(a: PieceProfile, b: PieceProfile, config: ScoringConfig) -> Signal | None:
    range_a, range_b = _epoch_range(a), _epoch_range(b)
    if range_a is None or range_b is None:
        return None
    overlap = range_a[0] <= range_b[1] and range_b[0] <= range_a[1]
    return Signal(
        "epoch",
        "epoch_start_year+epoch_end_year",
        1.0 if overlap else 0.0,
        config.epoch_weight,
        {"a": list(range_a), "b": list(range_b)},
    )


def _dimension_key(dimension: Dimension) -> tuple[str, str]:
    return (normalize_text(dimension.name), normalize_text(dimension.unit))


def _dimensions_signal(a: PieceProfile, b: PieceProfile, config: ScoringConfig) -> Signal | None:
    by_key_a = {_dimension_key(d): d.value for d in a.dimensions}
    by_key_b = {_dimension_key(d): d.value for d in b.dimensions}
    shared = sorted(set(by_key_a) & set(by_key_b))
    if not shared:
        return None
    compatible = 0
    for key in shared:
        left, right = by_key_a[key], by_key_b[key]
        largest = max(left, right)
        if largest == 0 or abs(left - right) <= config.dimension_tolerance * largest:
            compatible += 1
    return Signal(
        "dimensions",
        "dimensions",
        compatible / len(shared),
        config.dimensions_weight,
        {
            f"{name} ({unit})": [by_key_a[(name, unit)], by_key_b[(name, unit)]]
            for name, unit in shared
        },
    )


def _fingerprint_payload(profile: PieceProfile) -> dict[str, Any]:
    return {
        "piece": str(profile.piece_id) if profile.piece_id else "",
        "identifiers": sorted(f"{t}:{v}" for t, v in profile.shared_identifier_keys()),
        "denomination": normalize_text(profile.denomination),
        "collection": str(profile.collection_id) if profile.collection_id else "",
        "author": known_author(profile.author),
        "provenance": normalize_text(profile.provenance),
        "epoch": [profile.epoch_start_year, profile.epoch_end_year],
        "dimensions": sorted([*_dimension_key(d), round(d.value, 4)] for d in profile.dimensions),
    }


def comparison_fingerprint(a: PieceProfile, b: PieceProfile) -> str:
    """SHA-256 of the compared values of both pieces, independent of their order (design D2).

    A pair marked DISTINCT is proposed again only when this value changes (RF-030).
    """
    payloads = sorted((_fingerprint_payload(a), _fingerprint_payload(b)), key=lambda p: p["piece"])
    encoded = json.dumps(payloads, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def score_pair(a: PieceProfile, b: PieceProfile, config: ScoringConfig | None = None) -> PairScore:
    """Score two profiles and explain each applicable signal (design D1)."""
    config = config or ScoringConfig()
    identifier = _identifier_signal(a, b, config)
    signals = [
        signal
        for signal in (
            identifier,
            Signal(
                "denomination",
                "denomination",
                text_similarity(a.denomination, b.denomination),
                config.denomination_weight,
                {"a": a.denomination, "b": b.denomination},
            )
            if normalize_text(a.denomination) and normalize_text(b.denomination)
            else None,
            _collection_signal(a, b, config),
            _author_provenance_signal(a, b, config),
            _epoch_signal(a, b, config),
            _dimensions_signal(a, b, config),
        )
        if signal is not None
    ]
    conflict = _inventory_conflict(a, b)
    if conflict is not None:
        signals.append(conflict)
    score = round(min(1.0, sum(signal.contribution for signal in signals)), 4)
    return PairScore(
        score=score,
        signals=tuple(signals),
        blocking_conflict=conflict is not None,
        shared_identifier=identifier is not None,
        fingerprint=comparison_fingerprint(a, b),
    )
