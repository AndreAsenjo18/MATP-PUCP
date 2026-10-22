"""Unified piece filtering for search, reports and exports (spec busqueda-reportes; RF-032, RF-041).

Every search, catalog listing, export and quality report relies on `PieceFilter` so that what
users see on screen matches exactly what is exported, including sensitive field restrictions.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import ColumnElement, and_, exists, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.api.errors import NotImplementedEndpoint
from app.api.stubs import CHANGE_INCOMPLETE
from app.core.errors import PermissionDenied
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import Viewer, _contains, _descendants, identifier_match_condition
from app.modules.collections.models import Collection, Term
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.locations.models import Location
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION


class ActiveFilter(BaseModel):
    """Human-readable representation of an active filter for UI chips and Excel exports."""

    model_config = ConfigDict(frozen=True)

    key: str = Field(description="Internal filter field name")
    label: str = Field(description="Human-readable filter category name")
    value_display: str = Field(description="Human-readable filter value")
    removable: bool = True


class PieceFilter(BaseModel):
    """Unified filter parameters for pieces.

    All active filters are combined with AND (RF-032). Sensitive fields check permissions
    against the viewer before building SQL where conditions (RF-041).
    """

    model_config = ConfigDict(extra="ignore")

    q: str | None = None
    collection_id: uuid.UUID | None = None
    collection_code: str | None = None
    without_collection: bool | None = None
    category_id: uuid.UUID | None = None
    conservation_state_id: uuid.UUID | None = None
    material_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    tenure_regime: TenureRegime | None = None
    has_inventory_code: bool | None = None
    author: str | None = None
    provenance: str | None = None
    period_text: str | None = None
    epoch_start_year: int | None = None
    epoch_end_year: int | None = None

    # Incompleteness alert filters (delegated to alertas-y-reporte-incompletas)
    has_alerts: bool | None = None
    alert_code: str | None = None

    # Sensitive fields (require specific permissions)
    valuation_min: float | None = None
    valuation_max: float | None = None
    lender_name: str | None = None
    loan_agreement_ref: str | None = None

    def validate_permissions(self, viewer: Viewer | None = None) -> None:
        """Reject filters on sensitive fields if viewer lacks the required permission (RF-041)."""
        if (self.valuation_min is not None or self.valuation_max is not None) and (
            viewer is None or not viewer.can(PERM_VALUATION)
        ):
            raise PermissionDenied(
                "No tiene permiso para filtrar por valorización.",
                code="filter_not_allowed",
                details={"field": "valuation", "required_permission": PERM_VALUATION},
            )

        if self.lender_name is not None and (
            viewer is None or not viewer.can(PERM_DONOR_DATA)
        ):
            raise PermissionDenied(
                "No tiene permiso para filtrar por datos del donante/comodante.",
                code="filter_not_allowed",
                details={"field": "lender_name", "required_permission": PERM_DONOR_DATA},
            )

        if self.loan_agreement_ref is not None and (
            viewer is None or not viewer.can(PERM_LOAN_TERMS)
        ):
            raise PermissionDenied(
                "No tiene permiso para filtrar por términos del préstamo.",
                code="filter_not_allowed",
                details={"field": "loan_agreement_ref", "required_permission": PERM_LOAN_TERMS},
            )

    def _build_conditions(
        self, session: Session, *, include_epoch: bool = True
    ) -> list[ColumnElement[bool]]:
        """Build SQL conditions list."""
        conditions: list[ColumnElement[bool]] = []

        if self.q and self.q.strip():
            needle = self.q.strip()
            conditions.append(
                or_(
                    identifier_match_condition(needle),
                    Piece.denomination.ilike(_contains(needle), escape="\\"),
                )
            )

        if self.collection_id is not None:
            descendant_ids = _descendants(session, Collection, self.collection_id)
            conditions.append(Piece.collection_id.in_(descendant_ids))
        elif self.collection_code and self.collection_code.strip():
            coll = find_collection_by_code(session, self.collection_code.strip())
            if coll:
                descendant_ids = _descendants(session, Collection, coll.id)
                conditions.append(Piece.collection_id.in_(descendant_ids))
            else:
                conditions.append(Piece.id.is_(None))

        if self.without_collection is True:
            conditions.append(Piece.collection_id.is_(None))
        elif self.without_collection is False:
            conditions.append(Piece.collection_id.is_not(None))

        if self.tenure_regime is not None:
            conditions.append(Piece.tenure_regime == self.tenure_regime)

        if self.category_id is not None:
            conditions.append(Piece.category_id == self.category_id)

        if self.conservation_state_id is not None:
            conditions.append(Piece.conservation_state_id == self.conservation_state_id)

        if self.material_id is not None:
            conditions.append(
                exists().where(
                    PieceMaterial.piece_id == Piece.id,
                    PieceMaterial.term_id == self.material_id,
                    PieceMaterial.deleted_at.is_(None),
                )
            )

        if self.location_id is not None:
            descendant_loc_ids = _descendants(session, Location, self.location_id)
            conditions.append(Piece.current_location_id.in_(descendant_loc_ids))

        if self.has_inventory_code is True:
            conditions.append(
                exists().where(
                    PieceIdentifier.piece_id == Piece.id,
                    PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
                    PieceIdentifier.is_current.is_(True),
                    PieceIdentifier.deleted_at.is_(None),
                )
            )
        elif self.has_inventory_code is False:
            conditions.append(
                ~exists().where(
                    PieceIdentifier.piece_id == Piece.id,
                    PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
                    PieceIdentifier.is_current.is_(True),
                    PieceIdentifier.deleted_at.is_(None),
                )
            )

        if self.author and self.author.strip():
            conditions.append(Piece.author.ilike(_contains(self.author.strip()), escape="\\"))

        if self.provenance and self.provenance.strip():
            conditions.append(
                Piece.provenance.ilike(_contains(self.provenance.strip()), escape="\\")
            )

        if self.period_text and self.period_text.strip():
            conditions.append(
                Piece.epoch_original_text.ilike(_contains(self.period_text.strip()), escape="\\")
            )

        # Epoch range superposition: epoch_start_year <= to_year AND epoch_end_year >= from_year
        if include_epoch:
            if self.epoch_start_year is not None and self.epoch_end_year is not None:
                conditions.append(
                    and_(
                        Piece.epoch_start_year.is_not(None),
                        Piece.epoch_end_year.is_not(None),
                        Piece.epoch_start_year <= self.epoch_end_year,
                        Piece.epoch_end_year >= self.epoch_start_year,
                    )
                )
            elif self.epoch_start_year is not None:
                conditions.append(
                    and_(
                        func.coalesce(Piece.epoch_end_year, Piece.epoch_start_year).is_not(None),
                        func.coalesce(Piece.epoch_end_year, Piece.epoch_start_year)
                        >= self.epoch_start_year,
                    )
                )
            elif self.epoch_end_year is not None:
                conditions.append(
                    and_(
                        func.coalesce(Piece.epoch_start_year, Piece.epoch_end_year).is_not(None),
                        func.coalesce(Piece.epoch_start_year, Piece.epoch_end_year)
                        <= self.epoch_end_year,
                    )
                )

        if self.lender_name and self.lender_name.strip():
            conditions.append(
                Piece.lender_name.ilike(_contains(self.lender_name.strip()), escape="\\")
            )

        if self.loan_agreement_ref and self.loan_agreement_ref.strip():
            conditions.append(
                Piece.loan_agreement_ref.ilike(
                    _contains(self.loan_agreement_ref.strip()), escape="\\"
                )
            )

        return conditions

    def to_where(
        self, session: Session, viewer: Viewer | None = None
    ) -> ColumnElement[bool]:
        """Validate permissions and return SQLAlchemy ColumnElement for WHERE clause."""
        self.validate_permissions(viewer)

        if self.has_alerts is not None or self.alert_code is not None:
            raise NotImplementedEndpoint(CHANGE_INCOMPLETE)

        conditions = self._build_conditions(session, include_epoch=True)
        if not conditions:
            return true()
        return and_(*conditions)

    def count_excluded_uninterpreted_period(
        self, session: Session, viewer: Viewer | None = None
    ) -> int:
        """Count pieces matching all filters except epoch, but having uninterpreted epoch text."""
        if self.epoch_start_year is None and self.epoch_end_year is None:
            return 0

        self.validate_permissions(viewer)
        conditions = self._build_conditions(session, include_epoch=False)
        conditions.extend(
            [
                Piece.epoch_start_year.is_(None),
                Piece.epoch_end_year.is_(None),
                Piece.epoch_original_text.is_not(None),
                func.trim(Piece.epoch_original_text) != "",
            ]
        )

        count = session.scalar(
            select(func.count(Piece.id)).where(and_(*conditions))
        )
        return int(count or 0)

    def describe(self, session: Session | None = None) -> list[ActiveFilter]:
        """Return list of active filters with human-friendly descriptions."""
        active: list[ActiveFilter] = []

        if self.q and self.q.strip():
            active.append(
                ActiveFilter(
                    key="q",
                    label="Búsqueda",
                    value_display=self.q.strip(),
                )
            )

        if self.collection_id is not None:
            name = None
            if session:
                coll = session.get(Collection, self.collection_id)
                if coll:
                    acronym = coll.acronym or coll.acronym_normalized
                    acronym_part = f" ({acronym})" if acronym else ""
                    name = f"{coll.name}{acronym_part} (con subcolecciones)"
            active.append(
                ActiveFilter(
                    key="collection_id",
                    label="Colección",
                    value_display=name or f"Colección {self.collection_id} (con subcolecciones)",
                )
            )
        elif self.collection_code and self.collection_code.strip():
            active.append(
                ActiveFilter(
                    key="collection_code",
                    label="Colección",
                    value_display=f"Sigla {self.collection_code.strip()} (con subcolecciones)",
                )
            )

        if self.without_collection is True:
            active.append(
                ActiveFilter(
                    key="without_collection",
                    label="Colección",
                    value_display="Sin colección asignada",
                )
            )
        elif self.without_collection is False:
            active.append(
                ActiveFilter(
                    key="without_collection",
                    label="Colección",
                    value_display="Con colección asignada",
                )
            )

        if self.tenure_regime is not None:
            label_text = TENURE_REGIME_LABELS.get(self.tenure_regime, self.tenure_regime.value)
            active.append(
                ActiveFilter(
                    key="tenure_regime",
                    label="Régimen de tenencia",
                    value_display=label_text.capitalize(),
                )
            )

        if self.category_id is not None:
            name = None
            if session:
                term = session.get(Term, self.category_id)
                if term:
                    name = term.label
            active.append(
                ActiveFilter(
                    key="category_id",
                    label="Categoría",
                    value_display=name or str(self.category_id),
                )
            )

        if self.conservation_state_id is not None:
            name = None
            if session:
                term = session.get(Term, self.conservation_state_id)
                if term:
                    name = term.label
            active.append(
                ActiveFilter(
                    key="conservation_state_id",
                    label="Estado de conservación",
                    value_display=name or str(self.conservation_state_id),
                )
            )

        if self.material_id is not None:
            name = None
            if session:
                term = session.get(Term, self.material_id)
                if term:
                    name = term.label
            active.append(
                ActiveFilter(
                    key="material_id",
                    label="Material",
                    value_display=name or str(self.material_id),
                )
            )

        if self.location_id is not None:
            name = None
            if session:
                loc = session.get(Location, self.location_id)
                if loc:
                    lvl = loc.level.value if hasattr(loc.level, "value") else str(loc.level)
                    name = f"{loc.name} ({lvl}) (con descendientes)"
            active.append(
                ActiveFilter(
                    key="location_id",
                    label="Ubicación",
                    value_display=name or f"Ubicación {self.location_id} (con descendientes)",
                )
            )

        if self.has_inventory_code is True:
            active.append(
                ActiveFilter(
                    key="has_inventory_code",
                    label="Código de inventario",
                    value_display="Con código I asignado",
                )
            )
        elif self.has_inventory_code is False:
            active.append(
                ActiveFilter(
                    key="has_inventory_code",
                    label="Código de inventario",
                    value_display="Sin código I asignado",
                )
            )

        if self.author and self.author.strip():
            active.append(
                ActiveFilter(
                    key="author",
                    label="Autor",
                    value_display=self.author.strip(),
                )
            )

        if self.provenance and self.provenance.strip():
            active.append(
                ActiveFilter(
                    key="provenance",
                    label="Procedencia",
                    value_display=self.provenance.strip(),
                )
            )

        if self.epoch_start_year is not None and self.epoch_end_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch",
                    label="Época",
                    value_display=f"Entre {self.epoch_start_year} y {self.epoch_end_year}",
                )
            )
        elif self.epoch_start_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch_start_year",
                    label="Época",
                    value_display=f"Desde {self.epoch_start_year}",
                )
            )
        elif self.epoch_end_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch_end_year",
                    label="Época",
                    value_display=f"Hasta {self.epoch_end_year}",
                )
            )

        if self.period_text and self.period_text.strip():
            active.append(
                ActiveFilter(
                    key="period_text",
                    label="Texto de época",
                    value_display=self.period_text.strip(),
                )
            )

        if self.lender_name and self.lender_name.strip():
            active.append(
                ActiveFilter(
                    key="lender_name",
                    label="Comodante",
                    value_display=self.lender_name.strip(),
                )
            )

        if self.loan_agreement_ref and self.loan_agreement_ref.strip():
            active.append(
                ActiveFilter(
                    key="loan_agreement_ref",
                    label="Referencia de acuerdo",
                    value_display=self.loan_agreement_ref.strip(),
                )
            )

        return active
