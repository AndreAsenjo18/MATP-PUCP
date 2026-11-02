"""Report builders (change reportes-inventario, design D3 and D4; RF-033, RF-034, RN-004, RN-006).

Every builder reads through ``CatalogReader`` so the location column is masked exactly as in the
search (RF-041): without ``sensitive.exact_location`` only the site and the space are shown.
Builders return a ``ReportData`` whose totals always add up to the detail: the totals are
computed from the same rows that are returned, inside the caller's (consistent) transaction.
"""

import re
import uuid
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import PermissionDenied, ValidationFailed
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Collection, Term
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_PUCP,
)
from app.modules.locations.models import Location
from app.modules.locations.service import last_seen
from app.modules.reports.models import PieceValuation
from app.modules.search.filters import PieceFilter, strip_accents
from app.modules.search.schemas import GroupBy
from app.modules.users.sensitive import PERM_EXACT_LOCATION, PUBLIC_LOCATION_LEVELS

NO_COLLECTION = "Sin colección"
NEVER_VERIFIED = "Nunca verificada"
PATH_SEPARATOR = " › "


@dataclass
class Subtotal:
    group: str  # "Colección" | "Régimen" | "Espacio"
    label: str
    count: int
    level: int = 0  # depth in the collection tree (0 = main collection)


@dataclass
class ReportData:
    title: str
    columns: list[str]
    rows: list[list[Any]]
    subtotals: list[Subtotal] = field(default_factory=list)
    totals: dict[str, Any] = field(default_factory=dict)
    filters: dict[str, Any] = field(default_factory=dict)
    masked_columns: list[str] = field(default_factory=list)
    message: str | None = None


# --------------------------------------------------------------------------- helpers
def _collection_paths(session: Session) -> dict[uuid.UUID, list[Collection]]:
    collections = {c.id: c for c in session.scalars(select(Collection))}
    paths: dict[uuid.UUID, list[Collection]] = {}
    for collection_id in collections:
        path: list[Collection] = []
        cursor: uuid.UUID | None = collection_id
        seen: set[uuid.UUID] = set()
        while cursor is not None and cursor in collections and cursor not in seen:
            seen.add(cursor)
            path.append(collections[cursor])
            cursor = collections[cursor].parent_id
        paths[collection_id] = list(reversed(path))
    return paths


def _descendants(session: Session, collection_id: uuid.UUID) -> set[uuid.UUID]:
    children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for cid, parent in session.execute(select(Collection.id, Collection.parent_id)):
        children.setdefault(parent, []).append(cid)
    found, pending = {collection_id}, [collection_id]
    while pending:
        for child in children.get(pending.pop(), []):
            if child not in found:
                found.add(child)
                pending.append(child)
    return found


def _natural_key(value: str | None) -> tuple[Any, ...]:
    """Natural order of a normalized code (``MMZ 9`` before ``MMZ 10``); empty values last."""
    if not value:
        return (1,)
    parts = re.split(r"(\d+)", value)
    return (0, *[(int(part), "") if part.isdigit() else (0, part) for part in parts if part])


def _codes(identifiers: list[PieceIdentifier]) -> dict[str, str]:
    by_type: dict[str, list[str]] = {}
    for identifier in identifiers:
        value = identifier.normalized_value or identifier.original_value
        by_type.setdefault(identifier.identifier_type_code, []).append(value)
    return {code: " / ".join(values) for code, values in by_type.items()}


def _active_pieces(session: Session):  # type: ignore[no-untyped-def]
    return select(Piece).where(Piece.deleted_at.is_(None), Piece.merged_into_id.is_(None))


def _require_visible_location(location: Location, viewer: Viewer) -> None:
    """Below the space, a place is only for whoever sees exact locations (RF-041)."""
    if not viewer.can(PERM_EXACT_LOCATION) and location.level not in PUBLIC_LOCATION_LEVELS:
        raise PermissionDenied(
            "El detalle por debajo del espacio exige el permiso de ubicación exacta. Puede pedir "
            "el reporte de la sede o del espacio que contiene esta ubicación: se entrega agregado "
            "por espacio.",
            code="exact_location_required",
            details={"aggregate_available": True},
        )


def _with_piece_filter(  # type: ignore[no-untyped-def]
    statement, session: Session, viewer: Viewer, piece_filter: PieceFilter | None
):
    """The same filters as the search (RF-032). Filtering by a place reveals what is in it, so
    it needs the same permission as listing that place (RF-041)."""
    if piece_filter is None:
        return statement
    if piece_filter.location_id is not None:
        location = session.get(Location, piece_filter.location_id)
        if location is not None:
            _require_visible_location(location, viewer)
    return statement.where(piece_filter.to_where(session, viewer))


def _location_text(reader: CatalogReader, piece: Piece) -> tuple[str, bool]:
    path, is_exact = reader.visible_path(piece.current_location_id)
    return PATH_SEPARATOR.join(node.name for node in path), not is_exact


def _regime(regime: TenureRegime) -> str:
    return TENURE_REGIME_LABELS.get(regime, regime.value)


# ------------------------------------------------------------------------- inventory
INVENTORY_COLUMNS = [
    "Código I",
    "Código de colección",
    "INC / RN",
    "Código PUCP",
    "Denominación",
    "Descripción",
    "Colección",
    "Régimen",
    "Propietario legal",
    "Forma de adquisición",
    "Fecha de ingreso",
    "Autor",
    "Procedencia",
    "Época",
    "Tipo de bien",
    "Materiales",
    "Medidas",
    "Estado de conservación",
    "Ubicación",
]


@dataclass
class _PieceCells:
    """What the columns of a piece need, read once for all the pieces of a report."""

    reader: CatalogReader
    paths: dict[uuid.UUID, list[Collection]]
    identifiers: dict[uuid.UUID, list[PieceIdentifier]]
    terms: dict[uuid.UUID, Term]
    materials: dict[uuid.UUID, list[Term]]

    def collection_label(self, piece: Piece) -> str:
        if piece.collection_id is None or piece.collection_id not in self.paths:
            return NO_COLLECTION
        return PATH_SEPARATOR.join(c.name for c in self.paths[piece.collection_id])

    def order(self, piece: Piece) -> tuple[Any, ...]:
        codes = _codes(self.identifiers[piece.id])
        return (
            self.collection_label(piece) == NO_COLLECTION,
            self.collection_label(piece),
            _natural_key(codes.get(TYPE_COLLECTION)),
            piece.denomination.casefold(),
        )

    def _term_label(self, term_id: uuid.UUID | None) -> str:
        term = self.terms.get(term_id) if term_id else None
        return term.label if term else ""

    def row(self, piece: Piece) -> tuple[list[Any], bool]:
        """The cells of ``INVENTORY_COLUMNS`` and whether the location had to be limited."""
        codes = _codes(self.identifiers[piece.id])
        location, masked = _location_text(self.reader, piece)
        return (
            [
                codes.get(TYPE_INVENTORY, ""),
                codes.get(TYPE_COLLECTION, ""),
                codes.get(TYPE_INC_RN, ""),
                codes.get(TYPE_PUCP, ""),
                piece.denomination,
                piece.description or "",
                self.collection_label(piece),
                _regime(piece.tenure_regime),
                LEGAL_OWNER_PUCP
                if piece.tenure_regime is TenureRegime.OWNED
                else (piece.legal_owner or ""),
                self._term_label(piece.acquisition_method_term_id),
                piece.entry_date.isoformat() if piece.entry_date else "",
                piece.author or "",
                piece.provenance or "",
                piece.epoch_original_text or "",
                self._term_label(piece.object_type_term_id),
                ", ".join(sorted(term.label for term in self.materials.get(piece.id, []))),
                piece.dimensions_text or "",
                self._term_label(piece.conservation_state_id),
                location,
            ],
            masked,
        )


def _piece_cells(
    session: Session,
    viewer: Viewer,
    pieces: list[Piece],
    paths: dict[uuid.UUID, list[Collection]],
) -> _PieceCells:
    reader = CatalogReader(session, viewer)
    ids = [piece.id for piece in pieces]
    terms = reader.terms(
        term_id
        for piece in pieces
        for term_id in (
            piece.acquisition_method_term_id,
            piece.object_type_term_id,
            piece.conservation_state_id,
            piece.category_id,
        )
    )
    materials: dict[uuid.UUID, list[Term]] = {}
    if ids:
        material_rows = session.execute(
            select(PieceMaterial.piece_id, PieceMaterial.term_id).where(
                PieceMaterial.piece_id.in_(ids)
            )
        ).all()
        material_terms = reader.terms(term_id for _piece, term_id in material_rows)
        for piece_id, term_id in material_rows:
            if term_id in material_terms:
                materials.setdefault(piece_id, []).append(material_terms[term_id])
    return _PieceCells(reader, paths, reader.current_identifiers(ids), terms, materials)


def _permanent_regimes(include_loans_for_use: bool) -> list[TenureRegime]:
    """Owned pieces and, by default, loans for use: never temporary loans (RN-004)."""
    return [TenureRegime.OWNED] + ([TenureRegime.LOAN_FOR_USE] if include_loans_for_use else [])


def inventory(
    session: Session,
    viewer: Viewer,
    *,
    collection_id: uuid.UUID | None = None,
    include_loans_for_use: bool = True,
    piece_filter: PieceFilter | None = None,
) -> ReportData:
    """Permanent inventory (D3): owned pieces and, by default, loans for use; never temporary
    loans (RN-004), deleted or merged pieces. With ``collection_id``, that collection and its
    subcollections; ``piece_filter`` narrows it with the filters of the search."""
    regimes = _permanent_regimes(include_loans_for_use)
    statement = _active_pieces(session).where(Piece.tenure_regime.in_(regimes))
    title = "Inventario general"
    filters: dict[str, Any] = {"include_loans_for_use": include_loans_for_use}
    paths = _collection_paths(session)
    if collection_id is not None:
        if collection_id not in paths:
            raise ValidationFailed(
                "La colección indicada no existe.",
                code="invalid_report_parameter",
                details={"parameter": "collection_id", "value": str(collection_id)},
            )
        statement = statement.where(Piece.collection_id.in_(_descendants(session, collection_id)))
        title = f"Inventario de la colección {paths[collection_id][-1].name}"
        filters["collection"] = PATH_SEPARATOR.join(c.name for c in paths[collection_id])
    pieces = list(session.scalars(_with_piece_filter(statement, session, viewer, piece_filter)))

    cells = _piece_cells(session, viewer, pieces, paths)
    rows: list[list[Any]] = []
    masked = False
    for piece in sorted(pieces, key=cells.order):
        row, piece_masked = cells.row(piece)
        masked = masked or piece_masked
        rows.append(row)

    subtotals = _collection_subtotals(pieces, paths)
    regime_counts = Counter(_regime(piece.tenure_regime) for piece in pieces)
    subtotals += [
        Subtotal("Régimen", label, count) for label, count in sorted(regime_counts.items())
    ]
    message = (
        None if rows else "No hay piezas activas en el inventario con estos filtros: cero piezas."
    )
    return ReportData(
        title=title,
        columns=INVENTORY_COLUMNS,
        rows=rows,
        subtotals=subtotals,
        totals={"Piezas": len(rows), **dict(sorted(regime_counts.items()))},
        filters=filters,
        masked_columns=["Ubicación"] if masked else [],
        message=message,
    )


def _collection_subtotals(
    pieces: list[Piece], paths: dict[uuid.UUID, list[Collection]]
) -> list[Subtotal]:
    """One subtotal per collection node that has pieces in it or below it, plus «Sin colección»."""
    counts: Counter[tuple[str, ...]] = Counter()
    without = 0
    for piece in pieces:
        path = paths.get(piece.collection_id) if piece.collection_id else None
        if not path:
            without += 1
            continue
        names = tuple(c.name for c in path)
        for depth in range(1, len(names) + 1):
            counts[names[:depth]] += 1
    subtotals = [
        Subtotal("Colección", PATH_SEPARATOR.join(names), count, level=len(names) - 1)
        for names, count in sorted(counts.items())
    ]
    if without:
        subtotals.append(Subtotal("Colección", NO_COLLECTION, without))
    return subtotals


# ---------------------------------------------------------------------- by attribute
NO_DATA = "Sin dato"
GROUP_COLUMN = "Grupo"
GROUP_LABELS = {
    GroupBy.PROVENANCE: "Procedencia",
    GroupBy.DENOMINATION: "Denominación",
    GroupBy.AUTHOR: "Autor",
    GroupBy.MATERIAL: "Material",
    GroupBy.CONSERVATION_STATE: "Estado de conservación",
    GroupBy.CATEGORY: "Categoría",
    GroupBy.COLLECTION: "Colección",
}
_FREE_TEXT = {
    GroupBy.PROVENANCE: lambda piece: piece.provenance,
    GroupBy.DENOMINATION: lambda piece: piece.denomination,
    GroupBy.AUTHOR: lambda piece: piece.author,
}
EMPTY_FILTERS_MESSAGE = "No hay piezas con estos filtros"
SEVERAL_MATERIALS_MESSAGE = (
    "Una pieza con varios materiales aparece en cada uno de sus grupos: cada subtotal la cuenta, y "
    "el total de piezas la cuenta una sola vez."
)


@dataclass
class _Group:
    label: str
    pieces: list[Piece] = field(default_factory=list)


def _most_frequent_form(forms: Counter[str]) -> str:
    """The most used spelling; on a tie, one with mixed capitals («Ayacucho» over «AYACUCHO»)."""
    return min(forms, key=lambda form: (-forms[form], form.isupper() or form.islower(), form))


def _text_groups(pieces: list[Piece], value_of: Callable[[Piece], str | None]) -> list[_Group]:
    """Groups of free text, without case, accents or extra spaces (reportes-por-atributo D1)."""
    forms: dict[str, Counter[str]] = {}
    members: dict[str, list[Piece]] = {}
    without: list[Piece] = []
    for piece in pieces:
        text = " ".join((value_of(piece) or "").split())
        if not text:
            without.append(piece)
            continue
        key = strip_accents(text)
        forms.setdefault(key, Counter())[text] += 1
        members.setdefault(key, []).append(piece)
    groups = [_Group(_most_frequent_form(forms[key]), members[key]) for key in sorted(members)]
    return groups + ([_Group(NO_DATA, without)] if without else [])


def _term_groups(pieces: list[Piece], terms_of: Callable[[Piece], list[Term]]) -> list[_Group]:
    """Groups of terms, in the order of their list; a piece goes in each of its terms."""
    members: dict[uuid.UUID, list[Piece]] = {}
    found: dict[uuid.UUID, Term] = {}
    without: list[Piece] = []
    for piece in pieces:
        terms = terms_of(piece)
        if not terms:
            without.append(piece)
        for term in terms:
            found[term.id] = term
            members.setdefault(term.id, []).append(piece)
    ordered = sorted(found.values(), key=lambda term: (term.sort_order, term.label.casefold()))
    groups = [_Group(term.label, members[term.id]) for term in ordered]
    return groups + ([_Group(NO_DATA, without)] if without else [])


def _collection_groups(pieces: list[Piece], cells: _PieceCells) -> list[_Group]:
    members: dict[str, list[Piece]] = {}
    without: list[Piece] = []
    for piece in pieces:
        label = cells.collection_label(piece)
        if label == NO_COLLECTION:
            without.append(piece)
        else:
            members.setdefault(label, []).append(piece)
    groups = [_Group(label, members[label]) for label in sorted(members)]
    return groups + ([_Group(NO_DATA, without)] if without else [])


def _groups_of(group_by: GroupBy, pieces: list[Piece], cells: _PieceCells) -> list[_Group]:
    if group_by in _FREE_TEXT:
        return _text_groups(pieces, _FREE_TEXT[group_by])
    if group_by is GroupBy.COLLECTION:
        return _collection_groups(pieces, cells)
    if group_by is GroupBy.MATERIAL:
        return _term_groups(pieces, lambda piece: cells.materials.get(piece.id, []))
    term_id_of = {
        GroupBy.CONSERVATION_STATE: lambda piece: piece.conservation_state_id,
        GroupBy.CATEGORY: lambda piece: piece.category_id,
    }[group_by]

    def single(piece: Piece) -> list[Term]:
        term = cells.terms.get(term_id_of(piece))
        return [term] if term else []

    return _term_groups(pieces, single)


def by_attribute(
    session: Session,
    viewer: Viewer,
    *,
    group_by: GroupBy,
    include_loans_for_use: bool = True,
    piece_filter: PieceFilter | None = None,
) -> ReportData:
    """Pieces grouped by an attribute of the sheet (RF-047, design D1), over the same pieces and
    with the same columns as the inventory, led by the group of each row. A piece with several
    materials has one row per group, so the subtotals add up to the rows and not to the total of
    distinct pieces, which is kept apart."""
    statement = _active_pieces(session).where(
        Piece.tenure_regime.in_(_permanent_regimes(include_loans_for_use))
    )
    pieces = list(session.scalars(_with_piece_filter(statement, session, viewer, piece_filter)))
    cells = _piece_cells(session, viewer, pieces, _collection_paths(session))
    label = GROUP_LABELS[group_by]

    rows: list[list[Any]] = []
    masked = False
    subtotals: list[Subtotal] = []
    for group in _groups_of(group_by, pieces, cells):
        subtotals.append(Subtotal(label, group.label, len(group.pieces)))
        for piece in sorted(group.pieces, key=cells.order):
            row, piece_masked = cells.row(piece)
            masked = masked or piece_masked
            rows.append([group.label, *row])

    totals: dict[str, Any] = {"Piezas": len(pieces)}
    message = None if rows else EMPTY_FILTERS_MESSAGE
    if group_by is GroupBy.MATERIAL:
        totals["Apariciones en grupos"] = len(rows)
        message = message or SEVERAL_MATERIALS_MESSAGE
    return ReportData(
        title=f"Piezas agrupadas por {label.lower()}",
        columns=[GROUP_COLUMN, *INVENTORY_COLUMNS],
        rows=rows,
        subtotals=subtotals,
        totals=totals,
        masked_columns=["Ubicación"] if masked else [],
        message=message,
    )


# ----------------------------------------------------------------------- by location
LOCATION_COLUMNS = [
    "Código I",
    "Código de colección",
    "Denominación",
    "Descripción",
    "Ubicación",
    "Última vez vista",
    "Días desde la última verificación",
]


def _location_descendants(session: Session, location_id: uuid.UUID) -> set[uuid.UUID]:
    children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for lid, parent in session.execute(select(Location.id, Location.parent_id)):
        children.setdefault(parent, []).append(lid)
    found, pending = {location_id}, [location_id]
    while pending:
        for child in children.get(pending.pop(), []):
            if child not in found:
                found.add(child)
                pending.append(child)
    return found


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def by_location(
    session: Session,
    viewer: Viewer,
    *,
    location_id: uuid.UUID | None,
    not_verified_since_days: int | None = None,
    now: datetime | None = None,
    piece_filter: PieceFilter | None = None,
) -> ReportData:
    """Pieces of a location and its descendants with when each was last seen (D4)."""
    if location_id is None:
        raise ValidationFailed(
            "Indique la ubicación del reporte.",
            code="invalid_report_parameter",
            details={"parameter": "location_id"},
        )
    location = session.get(Location, location_id)
    if location is None:
        raise ValidationFailed(
            "La ubicación indicada no existe.",
            code="invalid_report_parameter",
            details={"parameter": "location_id", "value": str(location_id)},
        )
    exact = viewer.can(PERM_EXACT_LOCATION)
    _require_visible_location(location, viewer)
    reader = CatalogReader(session, viewer)
    scope = _location_descendants(session, location_id)
    statement = _active_pieces(session).where(Piece.current_location_id.in_(scope))
    pieces = list(session.scalars(_with_piece_filter(statement, session, viewer, piece_filter)))
    path_text = PATH_SEPARATOR.join(node.name for node in reader.location_path(location_id))
    filters: dict[str, Any] = {"location": path_text}
    if not_verified_since_days is not None:
        filters["not_verified_since_days"] = not_verified_since_days

    if not exact:
        # Aggregated by space: counts only, never the exact place of a piece (RF-041).
        counts: Counter[str] = Counter()
        for piece in pieces:
            visible, _is_exact = reader.visible_path(piece.current_location_id)
            counts[PATH_SEPARATOR.join(node.name for node in visible)] += 1
        rows = [[label, count] for label, count in sorted(counts.items())]
        return ReportData(
            title=f"Piezas por espacio en {path_text}",
            columns=["Espacio", "Piezas"],
            rows=rows,
            subtotals=[
                Subtotal("Espacio", label, count) for label, count in sorted(counts.items())
            ],
            totals={"Piezas": len(pieces)},
            filters=filters,
            masked_columns=["Ubicación"],
            message=None if rows else "La ubicación no tiene piezas.",
        )

    ids = [piece.id for piece in pieces]
    seen_at = last_seen(session, ids)
    identifiers = reader.current_identifiers(ids)
    moment = now or datetime.now(UTC)
    rows: list[list[Any]] = []
    for piece in sorted(
        pieces, key=lambda p: (_location_text(reader, p)[0], p.denomination.casefold())
    ):
        seen = seen_at.get(piece.id)
        days = (moment - _as_utc(seen)).days if seen else None
        if (
            not_verified_since_days is not None
            and days is not None
            and days < not_verified_since_days
        ):
            continue
        codes = _codes(identifiers[piece.id])
        rows.append(
            [
                codes.get(TYPE_INVENTORY, ""),
                codes.get(TYPE_COLLECTION, ""),
                piece.denomination,
                piece.description or "",
                _location_text(reader, piece)[0],
                _as_utc(seen).date().isoformat() if seen else NEVER_VERIFIED,
                days if days is not None else NEVER_VERIFIED,
            ]
        )
    last_seen_column = LOCATION_COLUMNS.index("Última vez vista")
    never = sum(1 for row in rows if row[last_seen_column] == NEVER_VERIFIED)
    message = None
    if not pieces:
        message = "La ubicación no tiene piezas."
    elif not rows:
        message = "Todas las piezas de la ubicación fueron verificadas en ese plazo."
    return ReportData(
        title=f"Piezas en {path_text}",
        columns=LOCATION_COLUMNS,
        rows=rows,
        totals={"Piezas": len(rows), "Nunca verificadas": never},
        filters=filters,
        message=message,
    )


# ------------------------------------------------------------------------- valuation
VALUATION_COLUMNS = ["Colección", "Moneda", "Piezas valorizadas", "Total"]


def _current_valuations(
    session: Session, piece_ids: list[uuid.UUID]
) -> dict[uuid.UUID, PieceValuation]:
    """The most recent valuation of each piece, by ``valued_on`` (ties: the last recorded)."""
    current: dict[uuid.UUID, PieceValuation] = {}
    if not piece_ids:
        return current
    statement = (
        select(PieceValuation)
        .where(PieceValuation.piece_id.in_(piece_ids))
        .order_by(PieceValuation.valued_on.desc(), PieceValuation.recorded_at.desc())
    )
    for valuation_row in session.scalars(statement):
        current.setdefault(valuation_row.piece_id, valuation_row)
    return current


def valuation(
    session: Session,
    viewer: Viewer,
    *,
    collection_id: uuid.UUID | None = None,
    include_loans_for_use: bool = True,
) -> ReportData:
    """Valuation by collection and currency (D6, RF-037) over the same pieces as the permanent
    inventory, with the most recent valuation of each one. No currency conversion: every
    currency has its own total, and the pieces without a valuation are counted apart."""
    regimes = [TenureRegime.OWNED] + ([TenureRegime.LOAN_FOR_USE] if include_loans_for_use else [])
    statement = _active_pieces(session).where(Piece.tenure_regime.in_(regimes))
    title = "Valorización por colección"
    filters: dict[str, Any] = {"include_loans_for_use": include_loans_for_use}
    paths = _collection_paths(session)
    if collection_id is not None:
        if collection_id not in paths:
            raise ValidationFailed(
                "La colección indicada no existe.",
                code="invalid_report_parameter",
                details={"parameter": "collection_id", "value": str(collection_id)},
            )
        statement = statement.where(Piece.collection_id.in_(_descendants(session, collection_id)))
        title = f"Valorización de la colección {paths[collection_id][-1].name}"
        filters["collection"] = PATH_SEPARATOR.join(c.name for c in paths[collection_id])
    pieces = list(session.scalars(statement))
    current = _current_valuations(session, [piece.id for piece in pieces])

    groups: dict[tuple[str, str], tuple[int, Decimal]] = {}
    by_currency: dict[str, tuple[int, Decimal]] = {}
    for piece in pieces:
        found = current.get(piece.id)
        if found is None:
            continue
        name = (
            PATH_SEPARATOR.join(c.name for c in paths[piece.collection_id])
            if piece.collection_id in paths
            else NO_COLLECTION
        )
        count, total = groups.get((name, found.currency), (0, Decimal(0)))
        groups[(name, found.currency)] = (count + 1, total + found.amount)
        count, total = by_currency.get(found.currency, (0, Decimal(0)))
        by_currency[found.currency] = (count + 1, total + found.amount)

    rows: list[list[Any]] = [
        [name, currency, count, total]
        for (name, currency), (count, total) in sorted(
            groups.items(), key=lambda item: (item[0][0] == NO_COLLECTION, item[0])
        )
    ]
    valued = sum(count for count, _total in by_currency.values())
    totals: dict[str, Any] = {
        "Piezas": len(pieces),
        "Piezas valorizadas": valued,
        "Piezas sin valorización": len(pieces) - valued,
    }
    for currency, (_count, total) in sorted(by_currency.items()):
        totals[f"Total {currency}"] = total
    return ReportData(
        title=title,
        columns=VALUATION_COLUMNS,
        rows=rows,
        subtotals=[
            Subtotal("Moneda", currency, count)
            for currency, (count, _total) in sorted(by_currency.items())
        ],
        totals=totals,
        filters=filters,
        message=None if rows else "No hay piezas valorizadas con estos filtros.",
    )
