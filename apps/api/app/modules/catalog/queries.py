"""Read-side queries of the catalog used by the API (contratos-api-borrador, design D6).

Only portable SQLAlchemy constructs are used so the same code runs on PostgreSQL and on the
SQLite database of the unit tests. Soft-deleted rows are excluded by the global session filter.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Select, and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.api.refs import CollectionRef, LocationRef, TermRef
from app.core.errors import NotFound
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.schemas import (
    CodeBrief,
    Dimension,
    Period,
    PieceDetail,
    PieceSummary,
)
from app.modules.collections.models import Collection, Term
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import (
    DEFAULT_RULES,
    TYPE_INVENTORY,
    canonical,
    normalize_for_type,
    propose_identifiers,
)
from app.modules.identification.schemas import IdentifierOut
from app.modules.locations.models import Location
from app.modules.locations.schemas import PieceLocation
from app.modules.media.models import MediaAsset
from app.modules.users.sensitive import (
    PERM_EXACT_LOCATION,
    PIECE_SENSITIVE_FIELDS,
    PUBLIC_LOCATION_LEVELS,
)


@dataclass
class PieceFilters:
    q: str | None = None
    collection_id: uuid.UUID | None = None
    without_collection: bool | None = None
    tenure_regime: TenureRegime | None = None
    category_term_id: uuid.UUID | None = None
    material_term_id: uuid.UUID | None = None
    conservation_status_term_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    has_inventory_code: bool | None = None
    author: str | None = None
    provenance: str | None = None
    period_text: str | None = None
    sort: str = "title"


@dataclass
class Viewer:
    """Permissions of whoever reads, used to mask sensitive data (RF-041)."""

    permissions: frozenset[str] = field(default_factory=frozenset)

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def _contains(value: str) -> str:
    escaped = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def code_candidates(text: str) -> set[str]:
    """Normalized forms a typed code may have under any identifier rule (N1-N7)."""
    candidates: set[str] = set()
    for part in [text, *[p.result.original for p in propose_identifiers(text)]]:
        for type_code in DEFAULT_RULES:
            normalized = normalize_for_type(type_code, part).normalized
            if normalized:
                candidates.add(normalized)
        if part.strip():
            candidates.add(canonical(part))
    return candidates


def _descendants(
    session: Session, model: type[Collection] | type[Location], root: uuid.UUID
) -> set[uuid.UUID]:
    rows = session.execute(select(model.id, model.parent_id)).all()
    children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for node_id, parent_id in rows:
        children.setdefault(parent_id, []).append(node_id)
    found = {root}
    stack = [root]
    while stack:
        for child in children.get(stack.pop(), []):
            if child not in found:
                found.add(child)
                stack.append(child)
    return found


def identifier_match_condition(text: str) -> Any:
    candidates = code_candidates(text)
    return exists().where(
        PieceIdentifier.piece_id == Piece.id,
        PieceIdentifier.deleted_at.is_(None),
        or_(
            PieceIdentifier.normalized_value.in_(candidates),
            PieceIdentifier.original_value.ilike(_contains(text), escape="\\"),
        ),
    )


def build_piece_query(session: Session, filters: PieceFilters) -> Select[tuple[Piece]]:
    """All filters are combined with AND (RF-032)."""
    statement = select(Piece)
    conditions: list[Any] = []
    if filters.q and filters.q.strip():
        conditions.append(
            or_(
                identifier_match_condition(filters.q),
                Piece.title.ilike(_contains(filters.q), escape="\\"),
            )
        )
    if filters.collection_id is not None:
        ids = _descendants(session, Collection, filters.collection_id)
        conditions.append(Piece.collection_id.in_(ids))
    if filters.without_collection is True:
        conditions.append(Piece.collection_id.is_(None))
    elif filters.without_collection is False:
        conditions.append(Piece.collection_id.is_not(None))
    if filters.tenure_regime is not None:
        conditions.append(Piece.tenure_regime == filters.tenure_regime)
    if filters.category_term_id is not None:
        conditions.append(Piece.category_term_id == filters.category_term_id)
    if filters.conservation_status_term_id is not None:
        conditions.append(Piece.conservation_status_term_id == filters.conservation_status_term_id)
    if filters.material_term_id is not None:
        conditions.append(
            exists().where(
                PieceMaterial.piece_id == Piece.id,
                PieceMaterial.term_id == filters.material_term_id,
                PieceMaterial.deleted_at.is_(None),
            )
        )
    if filters.location_id is not None:
        ids = _descendants(session, Location, filters.location_id)
        conditions.append(Piece.current_location_id.in_(ids))
    if filters.has_inventory_code is not None:
        has_code = exists().where(
            PieceIdentifier.piece_id == Piece.id,
            PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
            PieceIdentifier.is_current.is_(True),
            PieceIdentifier.deleted_at.is_(None),
        )
        conditions.append(has_code if filters.has_inventory_code else ~has_code)
    for column, value in (
        (Piece.author, filters.author),
        (Piece.provenance, filters.provenance),
        (Piece.period_text, filters.period_text),
    ):
        if value and value.strip():
            conditions.append(column.ilike(_contains(value), escape="\\"))
    if conditions:
        statement = statement.where(and_(*conditions))
    order = {
        "title": (Piece.title.asc(), Piece.id.asc()),
        "-title": (Piece.title.desc(), Piece.id.desc()),
        "created_at": (Piece.created_at.asc(), Piece.id.asc()),
        "-created_at": (Piece.created_at.desc(), Piece.id.desc()),
    }[filters.sort]
    return statement.order_by(*order)


def get_piece(session: Session, piece_id: uuid.UUID) -> Piece:
    piece = session.get(Piece, piece_id)
    if piece is None or piece.deleted_at is not None:
        raise NotFound("La pieza no existe o fue eliminada.", details={"piece_id": str(piece_id)})
    return piece


class CatalogReader:
    """Batch loader that turns pieces into API representations with sensitive masking."""

    def __init__(self, session: Session, viewer: Viewer) -> None:
        self.session = session
        self.viewer = viewer
        self._locations: dict[uuid.UUID, Location] | None = None

    # ------------------------------------------------------------------ lookups
    @property
    def locations(self) -> dict[uuid.UUID, Location]:
        if self._locations is None:
            rows = self.session.scalars(
                select(Location).execution_options(**{INCLUDE_DELETED: True})
            )
            self._locations = {location.id: location for location in rows}
        return self._locations

    def terms(self, ids: Iterable[uuid.UUID | None]) -> dict[uuid.UUID, Term]:
        wanted = {term_id for term_id in ids if term_id is not None}
        if not wanted:
            return {}
        rows = self.session.scalars(
            select(Term).where(Term.id.in_(wanted)).execution_options(**{INCLUDE_DELETED: True})
        )
        return {term.id: term for term in rows}

    def collections(self, ids: Iterable[uuid.UUID | None]) -> dict[uuid.UUID, Collection]:
        wanted = {collection_id for collection_id in ids if collection_id is not None}
        if not wanted:
            return {}
        rows = self.session.scalars(
            select(Collection)
            .where(Collection.id.in_(wanted))
            .execution_options(**{INCLUDE_DELETED: True})
        )
        return {collection.id: collection for collection in rows}

    def current_identifiers(
        self, piece_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, list[PieceIdentifier]]:
        result: dict[uuid.UUID, list[PieceIdentifier]] = {piece_id: [] for piece_id in piece_ids}
        if not piece_ids:
            return result
        rows = self.session.scalars(
            select(PieceIdentifier)
            .where(PieceIdentifier.piece_id.in_(piece_ids), PieceIdentifier.is_current.is_(True))
            .order_by(PieceIdentifier.identifier_type_code, PieceIdentifier.recorded_at)
        )
        for identifier in rows:
            result[identifier.piece_id].append(identifier)
        return result

    def media_counts(self, piece_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not piece_ids:
            return {}
        rows = self.session.execute(
            select(MediaAsset.piece_id, func.count(MediaAsset.id))
            .where(MediaAsset.piece_id.in_(piece_ids))
            .group_by(MediaAsset.piece_id)
        ).all()
        return {piece_id: count for piece_id, count in rows}

    # ---------------------------------------------------------------- locations
    def location_path(self, location_id: uuid.UUID | None) -> list[Location]:
        path: list[Location] = []
        cursor = location_id
        seen: set[uuid.UUID] = set()
        while cursor is not None and cursor not in seen and cursor in self.locations:
            seen.add(cursor)
            node = self.locations[cursor]
            path.append(node)
            cursor = node.parent_id
        return list(reversed(path))

    def visible_path(self, location_id: uuid.UUID | None) -> tuple[list[Location], bool]:
        path = self.location_path(location_id)
        if self.viewer.can(PERM_EXACT_LOCATION):
            return path, True
        visible = [node for node in path if node.level in PUBLIC_LOCATION_LEVELS]
        return visible, len(visible) == len(path)

    def piece_location(self, piece: Piece) -> tuple[PieceLocation, bool]:
        path, is_exact = self.visible_path(piece.current_location_id)
        location_id = piece.current_location_id if is_exact else (path[-1].id if path else None)
        return (
            PieceLocation(
                location_id=location_id,
                path=[LocationRef.model_validate(node) for node in path],
                is_exact=is_exact,
            ),
            not is_exact,
        )

    # ---------------------------------------------------------------- builders
    @staticmethod
    def _term(terms: dict[uuid.UUID, Term], term_id: uuid.UUID | None) -> TermRef | None:
        term = terms.get(term_id) if term_id else None
        return TermRef.model_validate(term) if term else None

    def summaries(self, pieces: Sequence[Piece]) -> list[PieceSummary]:
        ids = [piece.id for piece in pieces]
        identifiers = self.current_identifiers(ids)
        media = self.media_counts(ids)
        collections = self.collections(piece.collection_id for piece in pieces)
        terms = self.terms(
            term_id
            for piece in pieces
            for term_id in (piece.category_term_id, piece.conservation_status_term_id)
        )
        result: list[PieceSummary] = []
        for piece in pieces:
            codes = identifiers[piece.id]
            inventory = next(
                (
                    code.original_value
                    for code in codes
                    if code.identifier_type_code == TYPE_INVENTORY
                ),
                None,
            )
            path, _exact = self.visible_path(piece.current_location_id)
            collection = collections.get(piece.collection_id) if piece.collection_id else None
            result.append(
                PieceSummary(
                    id=piece.id,
                    title=piece.title,
                    collection=CollectionRef.model_validate(collection) if collection else None,
                    tenure_regime=piece.tenure_regime,
                    inventory_code=inventory,
                    codes=[
                        CodeBrief(
                            identifier_type_code=code.identifier_type_code,
                            original_value=code.original_value,
                            normalized_value=code.normalized_value,
                        )
                        for code in codes
                    ],
                    category=self._term(terms, piece.category_term_id),
                    conservation_status=self._term(terms, piece.conservation_status_term_id),
                    period_text=piece.period_text,
                    location_label=" › ".join(node.name for node in path) or None,
                    media_count=media.get(piece.id, 0),
                    has_location=piece.current_location_id is not None,
                    updated_at=piece.updated_at,
                )
            )
        return result

    def detail(self, piece: Piece) -> PieceDetail:
        identifiers = self.current_identifiers([piece.id])[piece.id]
        material_ids = list(
            self.session.scalars(
                select(PieceMaterial.term_id).where(PieceMaterial.piece_id == piece.id)
            )
        )
        terms = self.terms(
            [
                piece.acquisition_method_term_id,
                piece.object_type_term_id,
                piece.category_term_id,
                piece.conservation_status_term_id,
                piece.availability_term_id,
                *material_ids,
            ]
        )
        collection = (
            self.collections([piece.collection_id]).get(piece.collection_id)
            if piece.collection_id
            else None
        )
        masked: list[str] = []
        sensitive_values: dict[str, Any] = {}
        for field_name, permission in PIECE_SENSITIVE_FIELDS.items():
            if self.viewer.can(permission):
                sensitive_values[field_name] = getattr(piece, field_name)
            else:
                sensitive_values[field_name] = None
                masked.append(field_name)
        location, location_masked = self.piece_location(piece)
        if location_masked:
            masked.append("location.path")
        return PieceDetail(
            id=piece.id,
            title=piece.title,
            description=piece.description,
            collection=CollectionRef.model_validate(collection) if collection else None,
            tenure_regime=piece.tenure_regime,
            legal_owner=piece.legal_owner,
            temporary_inventory_number=piece.temporary_inventory_number,
            acquisition_method=self._term(terms, piece.acquisition_method_term_id),
            entry_date=piece.entry_date,
            author=piece.author,
            provenance=piece.provenance,
            period=Period(
                text=piece.period_text,
                type=piece.period_type,
                year_from=piece.period_from,
                year_to=piece.period_to,
            ),
            object_type=self._term(terms, piece.object_type_term_id),
            category=self._term(terms, piece.category_term_id),
            materials=[ref for ref in (self._term(terms, t) for t in material_ids) if ref],
            dimensions_text=piece.dimensions_text,
            dimensions=[Dimension.model_validate(item) for item in piece.dimensions]
            if piece.dimensions
            else None,
            conservation_status=self._term(terms, piece.conservation_status_term_id),
            recorded_by=piece.recorded_by,
            notes=piece.notes,
            parent_piece_id=piece.parent_piece_id,
            availability=self._term(terms, piece.availability_term_id),
            location=location,
            identifiers=[IdentifierOut.model_validate(item) for item in identifiers],
            inventory_code=next(
                (
                    item.original_value
                    for item in identifiers
                    if item.identifier_type_code == TYPE_INVENTORY
                ),
                None,
            ),
            media_count=self.media_counts([piece.id]).get(piece.id, 0),
            created_at=piece.created_at,
            updated_at=piece.updated_at,
            masked_fields=masked,
            **sensitive_values,
        )
