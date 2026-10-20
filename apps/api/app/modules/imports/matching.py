"""Multi-code matching of import rows against the catalog (spec importacion-datos: RF-024, RF-023).

For every normalized identifier of a row, look for pieces with the same identifier type and
normalized value among current and historical identifiers (``via``), skipping retired
identifiers and deleted pieces. Matches are grouped by piece; a row whose identifiers point to
different pieces carries a contradiction.

The input is deliberately small (``RowIdentifier``) so this module does not depend on the
``MappedRow`` of ``plantillas-mapeo-y-normalizacion``: the pipeline adapts it before calling.
All rows of a batch are matched with one query per chunk of values.
"""

import uuid
from collections import defaultdict
from collections.abc import Hashable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.identification.models import (
    INVENTORY_CODE_TYPE,
    NormalizationRule,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.identification.normalization import normalize, normalize_for_type

QUERY_CHUNK = 500

Via = Literal["current", "historical"]


@dataclass(frozen=True)
class RowIdentifier:
    """An identifier proposed by an import row, already normalized by its type rule."""

    type_code: str
    original_value: str
    normalized_value: str | None
    status: NormalizationStatus = NormalizationStatus.NORMALIZED
    is_absent: bool = False  # absence marker such as ``S/N``: "no code", never matched

    @classmethod
    def from_raw(
        cls, type_code: str, raw_value: str, rule: NormalizationRule | None = None
    ) -> "RowIdentifier":
        """Normalize ``raw_value`` with the rule of its type (the seeded default if not given)."""
        result = normalize(rule, raw_value) if rule else normalize_for_type(type_code, raw_value)
        return cls(type_code, raw_value, result.normalized, result.status, result.is_absent)

    @property
    def is_matchable(self) -> bool:
        return (
            not self.is_absent
            and self.status == NormalizationStatus.NORMALIZED
            and bool(self.normalized_value)
        )


@dataclass(frozen=True)
class IdentifierMatch:
    piece_id: uuid.UUID
    identifier_type: str
    value: str  # normalized value shared by the row and the piece
    via: Via

    def as_json(self) -> dict[str, Any]:
        return {
            "piece_id": str(self.piece_id),
            "identifier_type": self.identifier_type,
            "value": self.value,
            "via": self.via,
        }


@dataclass
class RowMatches:
    matches: list[IdentifierMatch] = field(default_factory=list)
    # Current inventory codes (I) of every candidate piece, to detect an attempt to change one.
    inventory_codes: dict[uuid.UUID, set[str]] = field(default_factory=dict)

    @property
    def piece_ids(self) -> list[uuid.UUID]:
        """Candidate pieces in first-match order."""
        return list(dict.fromkeys(match.piece_id for match in self.matches))

    @property
    def has_contradiction(self) -> bool:
        return len(self.piece_ids) > 1

    def by_piece(self) -> dict[uuid.UUID, list[IdentifierMatch]]:
        grouped: dict[uuid.UUID, list[IdentifierMatch]] = defaultdict(list)
        for match in self.matches:
            grouped[match.piece_id].append(match)
        return dict(grouped)

    def as_json(self) -> list[dict[str, Any]]:
        """Value stored in ``import_row.matches``: one entry per candidate piece."""
        return [
            {
                "piece_id": str(piece_id),
                "identifiers": [
                    {k: v for k, v in match.as_json().items() if k != "piece_id"}
                    for match in matches
                ],
                "contradicts": [str(other) for other in self.piece_ids if other != piece_id],
            }
            for piece_id, matches in self.by_piece().items()
        ]


def find_matches[K: Hashable](
    session: Session, rows: Mapping[K, Sequence[RowIdentifier]]
) -> dict[K, RowMatches]:
    """Match every row of a batch; keys are whatever identifies a row for the caller."""
    wanted: set[tuple[str, str]] = {
        (identifier.type_code, identifier.normalized_value)
        for identifiers in rows.values()
        for identifier in identifiers
        if identifier.is_matchable and identifier.normalized_value
    }
    index = _catalog_index(session, wanted)
    candidates = {match.piece_id for matches in index.values() for match in matches}
    inventory_codes = _current_inventory_codes(session, candidates)

    result: dict[K, RowMatches] = {}
    for key, identifiers in rows.items():
        row = RowMatches()
        seen: set[tuple[uuid.UUID, str, str]] = set()
        for identifier in identifiers:
            if not identifier.is_matchable or identifier.normalized_value is None:
                continue
            for match in index.get((identifier.type_code, identifier.normalized_value), ()):
                marker = (match.piece_id, match.identifier_type, match.value)
                if marker not in seen:
                    seen.add(marker)
                    row.matches.append(match)
        row.inventory_codes = {
            piece_id: inventory_codes.get(piece_id, set()) for piece_id in row.piece_ids
        }
        result[key] = row
    return result


def _chunks(values: Sequence[str]) -> Iterable[Sequence[str]]:
    for start in range(0, len(values), QUERY_CHUNK):
        yield values[start : start + QUERY_CHUNK]


def _catalog_index(
    session: Session, wanted: set[tuple[str, str]]
) -> dict[tuple[str, str], list[IdentifierMatch]]:
    index: dict[tuple[str, str], list[IdentifierMatch]] = defaultdict(list)
    values = sorted({value for _, value in wanted})
    for chunk in _chunks(values):
        rows = session.execute(
            select(
                PieceIdentifier.piece_id,
                PieceIdentifier.identifier_type_code,
                PieceIdentifier.normalized_value,
                PieceIdentifier.is_current,
            )
            .join(Piece, Piece.id == PieceIdentifier.piece_id)
            .where(
                PieceIdentifier.normalized_value.in_(chunk),
                PieceIdentifier.deleted_at.is_(None),
                Piece.deleted_at.is_(None),
            )
            # Current identifiers first, so a piece matched both ways reports "current".
            .order_by(PieceIdentifier.is_current.desc(), PieceIdentifier.recorded_at)
        )
        for piece_id, type_code, value, is_current in rows:
            key = (type_code, value)
            if key not in wanted:
                continue
            if any(existing.piece_id == piece_id for existing in index[key]):
                continue
            index[key].append(
                IdentifierMatch(
                    piece_id=piece_id,
                    identifier_type=type_code,
                    value=value,
                    via="current" if is_current else "historical",
                )
            )
    return index


def _current_inventory_codes(
    session: Session, piece_ids: set[uuid.UUID]
) -> dict[uuid.UUID, set[str]]:
    codes: dict[uuid.UUID, set[str]] = defaultdict(set)
    ordered = sorted(piece_ids)
    for start in range(0, len(ordered), QUERY_CHUNK):
        rows = session.execute(
            select(PieceIdentifier.piece_id, PieceIdentifier.normalized_value).where(
                PieceIdentifier.piece_id.in_(ordered[start : start + QUERY_CHUNK]),
                PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
                PieceIdentifier.is_current,
                PieceIdentifier.deleted_at.is_(None),
            )
        )
        for piece_id, value in rows:
            if value:
                codes[piece_id].add(value)
    return dict(codes)
