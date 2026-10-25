"""Report builders (change reportes-inventario, design D3 and D4; RF-033, RF-034, RN-004, RN-006).

Every builder reads through ``CatalogReader`` so the location column is masked exactly as in the
search (RF-041): without ``sensitive.exact_location`` only the site and the space are shown.
Builders return a ``ReportData`` whose totals always add up to the detail: the totals are
computed from the same rows that are returned, inside the caller's (consistent) transaction.
"""

import re
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import PermissionDenied, ValidationFailed
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Collection
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_PUCP,
)
from app.modules.locations.models import Location, PieceMovement
from app.modules.reports.models import PieceValuation
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


def inventory(
    session: Session,
    viewer: Viewer,
    *,
    collection_id: uuid.UUID | None = None,
    include_loans_for_use: bool = True,
) -> ReportData:
    """Permanent inventory (D3): owned pieces and, by default, loans for use; never temporary
    loans (RN-004), deleted or merged pieces. With ``collection_id``, that collection and its
    subcollections."""
    regimes = [TenureRegime.OWNED] + ([TenureRegime.LOAN_FOR_USE] if include_loans_for_use else [])
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
    pieces = list(session.scalars(statement))

    reader = CatalogReader(session, viewer)
    ids = [piece.id for piece in pieces]
    identifiers = reader.current_identifiers(ids)
    terms = reader.terms(
        term_id
        for piece in pieces
        for term_id in (
            piece.acquisition_method_term_id,
            piece.object_type_term_id,
            piece.conservation_state_id,
        )
    )
    materials: dict[uuid.UUID, list[str]] = {}
    if ids:
        material_rows = session.execute(
            select(PieceMaterial.piece_id, PieceMaterial.term_id).where(
                PieceMaterial.piece_id.in_(ids)
            )
        ).all()
        material_terms = reader.terms(term_id for _piece, term_id in material_rows)
        for piece_id, term_id in material_rows:
            if term_id in material_terms:
                materials.setdefault(piece_id, []).append(material_terms[term_id].label)

    def collection_label(piece: Piece) -> str:
        if piece.collection_id is None or piece.collection_id not in paths:
            return NO_COLLECTION
        return PATH_SEPARATOR.join(c.name for c in paths[piece.collection_id])

    def sort_key(piece: Piece) -> tuple[Any, ...]:
        codes = _codes(identifiers[piece.id])
        return (
            collection_label(piece) == NO_COLLECTION,
            collection_label(piece),
            _natural_key(codes.get(TYPE_COLLECTION)),
            piece.denomination.casefold(),
        )

    rows: list[list[Any]] = []
    masked = False
    for piece in sorted(pieces, key=sort_key):
        codes = _codes(identifiers[piece.id])
        location, piece_masked = _location_text(reader, piece)
        masked = masked or piece_masked
        term = terms.get
        rows.append(
            [
                codes.get(TYPE_INVENTORY, ""),
                codes.get(TYPE_COLLECTION, ""),
                codes.get(TYPE_INC_RN, ""),
                codes.get(TYPE_PUCP, ""),
                piece.denomination,
                collection_label(piece),
                _regime(piece.tenure_regime),
                LEGAL_OWNER_PUCP
                if piece.tenure_regime is TenureRegime.OWNED
                else (piece.legal_owner or ""),
                term(piece.acquisition_method_term_id).label
                if term(piece.acquisition_method_term_id)
                else "",  # type: ignore[union-attr]
                piece.entry_date.isoformat() if piece.entry_date else "",
                piece.author or "",
                piece.provenance or "",
                piece.epoch_original_text or "",
                term(piece.object_type_term_id).label if term(piece.object_type_term_id) else "",  # type: ignore[union-attr]
                ", ".join(sorted(materials.get(piece.id, []))),
                piece.dimensions_text or "",
                term(piece.conservation_state_id).label
                if term(piece.conservation_state_id)
                else "",  # type: ignore[union-attr]
                location,
            ]
        )

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


# ----------------------------------------------------------------------- by location
LOCATION_COLUMNS = [
    "Código I",
    "Código de colección",
    "Denominación",
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
    if not exact and location.level not in PUBLIC_LOCATION_LEVELS:
        raise PermissionDenied(
            "El detalle por debajo del espacio exige el permiso de ubicación exacta. Puede pedir "
            "el reporte de la sede o del espacio que contiene esta ubicación: se entrega agregado "
            "por espacio.",
            code="exact_location_required",
            details={"aggregate_available": True},
        )
    reader = CatalogReader(session, viewer)
    scope = _location_descendants(session, location_id)
    pieces = list(
        session.scalars(_active_pieces(session).where(Piece.current_location_id.in_(scope)))
    )
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
    last_seen = (
        dict(
            session.execute(
                select(PieceMovement.piece_id, func.max(PieceMovement.occurred_at))
                .where(PieceMovement.piece_id.in_(ids))
                .group_by(PieceMovement.piece_id)
            ).all()
        )
        if ids
        else {}
    )
    identifiers = reader.current_identifiers(ids)
    moment = now or datetime.now(UTC)
    rows: list[list[Any]] = []
    for piece in sorted(
        pieces, key=lambda p: (_location_text(reader, p)[0], p.denomination.casefold())
    ):
        seen = last_seen.get(piece.id)
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
                _location_text(reader, piece)[0],
                _as_utc(seen).date().isoformat() if seen else NEVER_VERIFIED,
                days if days is not None else NEVER_VERIFIED,
            ]
        )
    never = sum(1 for row in rows if row[4] == NEVER_VERIFIED)
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
