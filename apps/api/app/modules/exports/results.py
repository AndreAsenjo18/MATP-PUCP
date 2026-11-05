"""Columns of the search results export (RF-036, RF-041, design D3).

The synchronous export and the background worker share this catalog, so the same request
produces the same columns in both paths. `columns` in `SearchExportRequest` selects and orders
them by key; sensitive columns the role cannot see are omitted and reported as masked.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import ValidationFailed
from app.modules.catalog.models import Piece
from app.modules.catalog.schemas import PieceSummary
from app.modules.collections.models import Collection, Term
from app.modules.locations.models import Location
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION


@dataclass(frozen=True)
class ResultColumn:
    key: str
    header: str
    value: Callable[[Session, Piece, PieceSummary | None], object]
    permission: str | None = None


def _term(session: Session, term_id: object) -> str:
    term = session.get(Term, term_id) if term_id else None
    return term.label if term else ""


def _collection(session: Session, piece: Piece, _summary: PieceSummary | None) -> str:
    collection = session.get(Collection, piece.collection_id) if piece.collection_id else None
    return collection.name if collection else ""


def _location(session: Session, piece: Piece, _summary: PieceSummary | None) -> str:
    if not piece.current_location_id:
        return ""
    location = session.get(Location, piece.current_location_id)
    return location.name if location else ""


def _tenure(_session: Session, piece: Piece, _summary: PieceSummary | None) -> str:
    if not piece.tenure_regime:
        return ""
    return TENURE_REGIME_LABELS.get(piece.tenure_regime, piece.tenure_regime.value)


RESULT_COLUMNS: tuple[ResultColumn, ...] = (
    ResultColumn("code_i", "Código I", lambda _s, _p, summary: summary.code_i if summary else ""),
    ResultColumn("denomination", "Denominación", lambda _s, piece, _m: piece.denomination),
    ResultColumn("collection", "Colección", _collection),
    ResultColumn("tenure_regime", "Régimen de tenencia", _tenure),
    ResultColumn("category", "Categoría", lambda s, piece, _m: _term(s, piece.category_id)),
    ResultColumn(
        "conservation_state",
        "Estado de conservación",
        lambda s, piece, _m: _term(s, piece.conservation_state_id),
    ),
    ResultColumn("location", "Ubicación", _location),
    ResultColumn("author", "Autor", lambda _s, piece, _m: piece.author or ""),
    ResultColumn("provenance", "Procedencia", lambda _s, piece, _m: piece.provenance or ""),
    ResultColumn("period", "Época", lambda _s, piece, _m: piece.epoch_original_text or ""),
    ResultColumn(
        "lender_name",
        "Comodante",
        lambda _s, piece, _m: piece.lender_name or "",
        permission=PERM_DONOR_DATA,
    ),
    ResultColumn(
        "loan_agreement_ref",
        "Convenio de préstamo",
        lambda _s, piece, _m: piece.loan_agreement_ref or "",
        permission=PERM_LOAN_TERMS,
    ),
)
COLUMN_KEYS = tuple(column.key for column in RESULT_COLUMNS)


def masked_fields(permissions: frozenset[str] | set[str]) -> list[str]:
    """Sensitive fields the role cannot see (header `X-Omited-Columns`, job `masked_fields`)."""
    masked = [
        column.key
        for column in RESULT_COLUMNS
        if column.permission and column.permission not in permissions
    ]
    if PERM_VALUATION not in permissions:
        masked.append("valuation")
    return masked


def resolve_columns(
    requested: Sequence[str] | None, permissions: frozenset[str] | set[str]
) -> list[ResultColumn]:
    """Requested columns in the requested order (all of them without a selection), minus the
    sensitive ones the role cannot see. An unknown key is rejected with 422."""
    by_key = {column.key: column for column in RESULT_COLUMNS}
    keys = list(requested) if requested else list(COLUMN_KEYS)
    unknown = [key for key in keys if key not in by_key]
    if unknown:
        raise ValidationFailed(
            f"Columnas desconocidas: {', '.join(unknown)}.",
            code="unknown_export_column",
            details={"allowed": list(COLUMN_KEYS)},
        )
    visible = [by_key[key] for key in dict.fromkeys(keys)]
    return [c for c in visible if c.permission is None or c.permission in permissions]


def result_row(
    session: Session, piece: Piece, summary: PieceSummary | None, columns: Sequence[ResultColumn]
) -> list[object]:
    return [column.value(session, piece, summary) for column in columns]
