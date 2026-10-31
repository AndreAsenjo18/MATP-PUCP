"""Row classification of an import batch (spec importacion-datos: RF-025, RN-003, RN-004; D4).

Rules, applied in order and exposed to users as ``classification_rules``:

1. Validation errors (no denomination, no tenure regime, code I in a loan for use (RN-003),
   code I or collection code in a temporary loan (RN-004), unreadable code I) set
   ``has_validation_errors``; the row is still classified so the user sees its candidates.
2. Candidates in two or more pieces, an attempt to change the current code I of the matched
   piece (RN-002), or another row of the batch with the same code I → ``CONFLICT``.
3. A single candidate piece → ``UPDATE`` with that piece as target.
4. No candidate and a similarity score at or above the threshold → ``POSSIBLE_DUPLICATE``.
5. Otherwise → ``NEW``.

Similarity sits behind ``SimilarityScorer`` so ``deteccion-duplicados-y-cola-revision`` can
replace the provisional scorer (denomination tokens and collection) without touching this module.
"""

import re
import unicodedata
import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.identification.models import INVENTORY_CODE_TYPE, NormalizationStatus
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.imports.matching import RowIdentifier, RowMatches, find_matches
from app.modules.imports.models import RowClassification
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus

DUPLICATE_SOURCE = "import"


@dataclass(frozen=True)
class RowError:
    code: str
    message: str  # user-facing, Spanish (ADR-002)
    field: str | None = None

    def as_json(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "field": self.field}


@dataclass
class RowInput:
    """What classification needs from a mapped row (adapted from ``MappedRow`` by the caller)."""

    row_number: int
    denomination: str | None
    tenure_regime: TenureRegime | None
    identifiers: list[RowIdentifier] = field(default_factory=list)
    collection_id: uuid.UUID | None = None
    errors: list[RowError] = field(default_factory=list)  # e.g. transformation errors


@dataclass(frozen=True)
class SimilarPiece:
    piece_id: uuid.UUID
    score: float
    matched_fields: list[dict[str, Any]]


class SimilarityScorer(Protocol):
    threshold: float
    description: str

    def find_similar(self, row: RowInput) -> list[SimilarPiece]:
        """Pieces scoring at or above ``threshold``, best first."""
        ...


@dataclass
class ClassifiedRow:
    row_number: int
    classification: RowClassification
    validation_errors: list[RowError]
    matches: RowMatches
    target_piece_id: uuid.UUID | None = None
    # Other rows of the batch with the same code I, and RN-002 code I change of the candidate.
    batch_conflicts: list[dict[str, Any]] = field(default_factory=list)
    inventory_code_change: dict[str, Any] | None = None
    similar: list[SimilarPiece] = field(default_factory=list)

    @property
    def has_validation_errors(self) -> bool:
        return bool(self.validation_errors)

    def matches_json(self) -> list[dict[str, Any]]:
        """Value for ``import_row.matches``: candidate pieces and conflicting rows of the batch."""
        entries: list[dict[str, Any]] = [
            {"kind": "piece", **entry} for entry in self.matches.as_json()
        ]
        if self.inventory_code_change is not None:
            entries[0]["inventory_code_change"] = self.inventory_code_change
        entries += self.batch_conflicts
        entries += [
            {
                "kind": "similar_piece",
                "piece_id": str(similar.piece_id),
                "score": round(similar.score, 4),
                "matched_fields": similar.matched_fields,
            }
            for similar in self.similar
        ]
        return entries

    def row_values(self) -> dict[str, Any]:
        """Columns of ``import_row`` set by this stage."""
        return {
            "classification": self.classification,
            "has_validation_errors": self.has_validation_errors,
            "validation_errors": [error.as_json() for error in self.validation_errors],
            "matches": self.matches_json(),
            "target_piece_id": self.target_piece_id,
        }


def classification_rules(scorer: SimilarityScorer | None) -> list[dict[str, Any]]:
    """Rules shown in the preview (RF-025), in evaluation order."""
    duplicate = (
        f"Ningún código coincide, pero se parece a una pieza existente (similitud de "
        f"{scorer.threshold:.2f} o más según {scorer.description})."
        if scorer
        else "Desactivada: no hay un evaluador de similitud configurado."
    )
    return [
        {
            "order": 1,
            "result": "validation_errors",
            "description": "La fila tiene errores: falta la denominación o el régimen de "
            "tenencia, trae código I siendo comodato, trae código I o de colección siendo "
            "préstamo temporal, o el código I no se entiende. No se puede aceptar, pero sí "
            "dejar fuera o rechazar.",
        },
        {
            "order": 2,
            "result": RowClassification.CONFLICT.value,
            "description": "Sus códigos apuntan a piezas distintas, traería otro código I "
            "para una pieza que ya tiene uno, o hay otra fila del lote con el mismo código I. "
            "Hay que elegir a qué pieza corresponde.",
        },
        {
            "order": 3,
            "result": RowClassification.UPDATE.value,
            "description": "Sus códigos, vigentes o históricos, coinciden con una sola pieza "
            "del catálogo.",
        },
        {
            "order": 4,
            "result": RowClassification.POSSIBLE_DUPLICATE.value,
            "description": duplicate,
            "threshold": scorer.threshold if scorer else None,
        },
        {
            "order": 5,
            "result": RowClassification.NEW.value,
            "description": "No coincide con ninguna pieza del catálogo: se creará una pieza nueva.",
        },
    ]


def validate_row(row: RowInput) -> list[RowError]:
    errors = list(row.errors)
    if not row.denomination or not row.denomination.strip():
        errors.append(RowError("title_required", "La denominación es obligatoria.", "denomination"))
    # A mapping error already explains a missing regime (invalid or not deducible).
    if row.tenure_regime is None and not any(e.field == "tenure_regime" for e in errors):
        errors.append(RowError("tenure_required", "Falta el régimen de tenencia.", "tenure_regime"))
    present = [identifier for identifier in row.identifiers if not identifier.is_absent]
    inventory = [i for i in present if i.type_code == INVENTORY_CODE_TYPE]
    collection = [i for i in present if i.type_code == TYPE_COLLECTION]
    if row.tenure_regime == TenureRegime.LOAN_FOR_USE and inventory:
        errors.append(
            RowError(
                "loan_for_use_with_inventory_code",
                "Una pieza en comodato no puede tener código I.",
                f"identifier:{INVENTORY_CODE_TYPE}",
            )
        )
    if row.tenure_regime == TenureRegime.TEMPORARY_LOAN and (inventory or collection):
        errors.append(
            RowError(
                "temporary_loan_with_code",
                "Un préstamo temporal no recibe código I ni código de colección.",
                f"identifier:{INVENTORY_CODE_TYPE if inventory else TYPE_COLLECTION}",
            )
        )
    for identifier in inventory:
        if identifier.status == NormalizationStatus.UNPARSEABLE:
            errors.append(
                RowError(
                    "invalid_inventory_code",
                    f"El código I «{identifier.original_value}» no tiene un formato reconocido.",
                    f"identifier:{INVENTORY_CODE_TYPE}",
                )
            )
    return errors


def classify_batch(
    session: Session, rows: Sequence[RowInput], scorer: SimilarityScorer | None = None
) -> list[ClassifiedRow]:
    matches = find_matches(session, {row.row_number: row.identifiers for row in rows})
    rows_by_code: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        for code in _inventory_codes(row):
            rows_by_code[code].append(row.row_number)

    classified: list[ClassifiedRow] = []
    for row in rows:
        row_matches = matches[row.row_number]
        result = ClassifiedRow(
            row_number=row.row_number,
            classification=RowClassification.NEW,
            validation_errors=validate_row(row),
            matches=row_matches,
            batch_conflicts=_batch_conflicts(row, rows_by_code),
            inventory_code_change=_inventory_code_change(row, row_matches),
        )
        if result.batch_conflicts or result.inventory_code_change or row_matches.has_contradiction:
            result.classification = RowClassification.CONFLICT
        elif row_matches.piece_ids:
            result.classification = RowClassification.UPDATE
            result.target_piece_id = row_matches.piece_ids[0]
        elif scorer is not None:
            result.similar = scorer.find_similar(row)
            if result.similar:
                result.classification = RowClassification.POSSIBLE_DUPLICATE
        classified.append(result)
    return classified


def _inventory_codes(row: RowInput) -> set[str]:
    return {
        identifier.normalized_value
        for identifier in row.identifiers
        if identifier.type_code == INVENTORY_CODE_TYPE
        and identifier.is_matchable
        and identifier.normalized_value
    }


def _batch_conflicts(row: RowInput, rows_by_code: dict[str, list[int]]) -> list[dict[str, Any]]:
    return [
        {
            "kind": "batch_row",
            "row_number": other,
            "identifier_type": INVENTORY_CODE_TYPE,
            "value": code,
        }
        for code in sorted(_inventory_codes(row))
        for other in rows_by_code[code]
        if other != row.row_number
    ]


def _inventory_code_change(row: RowInput, matches: RowMatches) -> dict[str, Any] | None:
    """RN-002: the row brings a code I different from the current one of its single candidate."""
    incoming = _inventory_codes(row)
    if not incoming or len(matches.piece_ids) != 1:
        return None
    current = matches.inventory_codes.get(matches.piece_ids[0], set())
    if not current or incoming & current:
        return None
    return {"current": sorted(current), "incoming": sorted(incoming)}


# --- Provisional similarity -----------------------------------------------------------------
_STOPWORDS = frozenset({"de", "del", "la", "las", "el", "los", "y", "con", "en", "para", "por"})


def _tokens(text: str | None) -> frozenset[str]:
    if not text:
        return frozenset()
    folded = unicodedata.normalize("NFKD", text.casefold())
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    return frozenset(
        token
        for token in re.findall(r"[a-z0-9]+", folded)
        if len(token) > 1 and token not in _STOPWORDS
    )


class ProvisionalSimilarityScorer:
    """Denomination tokens (Jaccard, weight 0.8) plus same collection (0.2) [SUPUESTO].

    Stand-in until ``deteccion-duplicados-y-cola-revision`` provides the real scorer. Loads
    the non-deleted pieces once and compares only pieces sharing a denomination token.
    """

    description = "denominación y colección, evaluador provisional"

    def __init__(self, session: Session, *, threshold: float = 0.75, limit: int = 3) -> None:
        self.threshold = threshold
        self.limit = limit
        self._session = session
        self._pieces: dict[uuid.UUID, tuple[frozenset[str], uuid.UUID | None]] | None = None
        self._by_token: dict[str, set[uuid.UUID]] = defaultdict(set)

    def _load(self) -> dict[uuid.UUID, tuple[frozenset[str], uuid.UUID | None]]:
        if self._pieces is None:
            self._pieces = {}
            rows = self._session.execute(
                select(Piece.id, Piece.denomination, Piece.collection_id).where(
                    Piece.deleted_at.is_(None)
                )
            )
            for piece_id, denomination, collection_id in rows:
                tokens = _tokens(denomination)
                self._pieces[piece_id] = (tokens, collection_id)
                for token in tokens:
                    self._by_token[token].add(piece_id)
        return self._pieces

    def find_similar(self, row: RowInput) -> list[SimilarPiece]:
        pieces = self._load()
        tokens = _tokens(row.denomination)
        candidates = set().union(*(self._by_token.get(token, set()) for token in tokens))
        found: list[SimilarPiece] = []
        for piece_id in candidates:
            piece_tokens, collection_id = pieces[piece_id]
            title = len(tokens & piece_tokens) / len(tokens | piece_tokens)
            same_collection = row.collection_id is not None and row.collection_id == collection_id
            score = 0.8 * title + (0.2 if same_collection else 0.0)
            if score >= self.threshold:
                fields: list[dict[str, Any]] = [
                    {"field": "denomination", "similarity": round(title, 4)}
                ]
                if same_collection:
                    fields.append({"field": "collection", "similarity": 1.0})
                found.append(SimilarPiece(piece_id, score, fields))
        found.sort(key=lambda similar: (-similar.score, str(similar.piece_id)))
        return found[: self.limit]


def record_duplicate_candidates(
    session: Session, import_row_id: uuid.UUID, similar: Sequence[SimilarPiece]
) -> list[DuplicateCandidate]:
    """Link a possible duplicate row to the review queue (RF-030).

    Idempotent: pending candidates of the row from a previous validation are replaced; reviewed
    ones are kept.
    """
    session.execute(
        delete(DuplicateCandidate).where(
            DuplicateCandidate.import_row_id == import_row_id,
            DuplicateCandidate.status == DuplicateStatus.PENDING,
        )
    )
    created = [
        DuplicateCandidate(
            id=new_uuid(),
            piece_a_id=candidate.piece_id,
            import_row_id=import_row_id,
            score=Decimal(str(round(candidate.score, 4))),
            matched_fields=candidate.matched_fields,
            detected_by=DUPLICATE_SOURCE,
        )
        for candidate in similar
    ]
    session.add_all(created)
    session.flush()
    return created
