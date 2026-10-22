"""Unified piece filtering for search, reports and exports (spec busqueda-reportes; RF-032, RF-041).

Every search, catalog listing, export and quality report relies on `PieceFilter` so that what
users see on screen matches exactly what is exported, including sensitive field restrictions.
"""

from __future__ import annotations

import unicodedata
import uuid
from collections.abc import Callable

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import ColumnElement, and_, exists, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.api.errors import NotImplementedEndpoint
from app.api.stubs import CHANGE_INCOMPLETE
from app.core.errors import PermissionDenied
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import (
    Viewer,
    _contains,
    _descendants,
    code_candidates,
    identifier_match_condition,
)
from app.modules.collections.models import Collection, Term
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.locations.models import Location
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION

ALERT_PREDICATES: dict[str, Callable[[Session], ColumnElement[bool]]] = {}


def register_alert_predicate(
    name: str, predicate_factory: Callable[[Session], ColumnElement[bool]]
) -> None:
    """Register alert predicate factory for change alertas-y-reporte-incompletas (RF-032)."""
    ALERT_PREDICATES[name] = predicate_factory


def strip_accents(val: str | None) -> str:
    """Normalize and strip accents/diacritics for insensitive comparison."""
    if not val:
        return ""
    nfkd = unicodedata.normalize("NFKD", val)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).casefold().strip()


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
    tenure_regime: TenureRegime | None = None
    category_id: uuid.UUID | None = None
    conservation_state_id: uuid.UUID | None = None
    material_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    has_inventory_code: bool | None = None
    author: str | None = None
    provenance: str | None = None
    period_text: str | None = None
    epoch_start_year: int | None = None
    epoch_end_year: int | None = None

    # Sensitive fields (checked against permissions RF-041)
    valuation_min: float | None = None
    valuation_max: float | None = None
    lender_name: str | None = None
    loan_agreement_ref: str | None = None

    # Alerts (from change alertas-y-reporte-incompletas)
    has_alerts: bool | None = None
    alert_code: str | None = None

    def validate_permissions(self, viewer: Viewer | None) -> None:
        """Reject filters on sensitive fields if user lacks required permissions (RF-041)."""
        perms = viewer.permissions if viewer else set()

        if (self.valuation_min is not None or self.valuation_max is not None) and (
            PERM_VALUATION not in perms
        ):
            raise PermissionDenied(
                "No tiene permisos para filtrar por valorizacin (filter_not_allowed).",
                code="filter_not_allowed",
            )

        if self.lender_name and self.lender_name.strip() and (PERM_DONOR_DATA not in perms):
            raise PermissionDenied(
                "No tiene permisos para filtrar por comodante/donante (filter_not_allowed).",
                code="filter_not_allowed",
            )

        if (
            self.loan_agreement_ref
            and self.loan_agreement_ref.strip()
            and (PERM_LOAN_TERMS not in perms)
        ):
            raise PermissionDenied(
                "No tiene permisos para filtrar por convenio de prstamo (filter_not_allowed).",
                code="filter_not_allowed",
            )

    def _build_conditions(
        self, session: Session, *, include_epoch: bool = True
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = []

        if self.q and self.q.strip():
            needle = self.q.strip()
            clean_needle = strip_accents(needle)
            terms = [t for t in clean_needle.split() if t]

            text_match_clauses = []
            term_conditions = []
            for term in (terms or [clean_needle]):
                pattern = f"%{term}%"
                field_conds = [
                    func.immutable_unaccent(func.lower(Piece.denomination)).like(pattern),
                    func.immutable_unaccent(
                        func.lower(func.coalesce(Piece.author, ""))
                    ).like(pattern),
                    func.immutable_unaccent(
                        func.lower(func.coalesce(Piece.provenance, ""))
                    ).like(pattern),
                    func.immutable_unaccent(
                        func.lower(func.coalesce(Piece.epoch_original_text, ""))
                    ).like(pattern),
                    exists().where(
                        Term.id == Piece.category_id,
                        func.immutable_unaccent(func.lower(Term.label)).like(pattern),
                    ),
                    exists().where(
                        Term.id == Piece.conservation_state_id,
                        func.immutable_unaccent(func.lower(Term.label)).like(pattern),
                    ),
                    exists().where(
                        PieceMaterial.piece_id == Piece.id,
                        PieceMaterial.deleted_at.is_(None),
                        PieceMaterial.term_id == Term.id,
                        func.immutable_unaccent(func.lower(Term.label)).like(pattern),
                    ),
                ]
                term_conditions.append(or_(*field_conds))
            if term_conditions:
                text_match_clauses.append(and_(*term_conditions))

            for cand in code_candidates(needle):
                c_clean = strip_accents(cand)
                for variant in {c_clean, c_clean.replace(" ", ""), c_clean.replace("-", "")}:
                    if variant and len(variant) >= 3 and variant not in terms:
                        v_pat = f"%{variant}%"
                        text_match_clauses.append(
                            func.immutable_unaccent(func.lower(Piece.denomination)).like(v_pat)
                        )

            conditions.append(
                or_(
                    identifier_match_condition(needle),
                    or_(*text_match_clauses),
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

        alert_key = self.alert_code or ("has_alerts" if self.has_alerts else None)
        alert_pred = None
        if alert_key:
            pred_factory = ALERT_PREDICATES.get(alert_key)
            if pred_factory is not None:
                alert_pred = pred_factory(session)
            else:
                raise NotImplementedEndpoint(CHANGE_INCOMPLETE)
        elif self.has_alerts is not None:
            raise NotImplementedEndpoint(CHANGE_INCOMPLETE)

        conditions = self._build_conditions(session, include_epoch=True)
        if alert_pred is not None:
            conditions.append(alert_pred)

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
                    label="Bsqueda",
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
                    label="Coleccin",
                    value_display=name or f"Coleccin {self.collection_id} (con subcolecciones)",
                )
            )
        elif self.collection_code and self.collection_code.strip():
            active.append(
                ActiveFilter(
                    key="collection_code",
                    label="Coleccin",
                    value_display=f"Cdigo '{self.collection_code.strip()}'",
                )
            )

        if self.without_collection is True:
            active.append(
                ActiveFilter(
                    key="without_collection",
                    label="Coleccin",
                    value_display="Sin coleccin asignada",
                )
            )
        elif self.without_collection is False:
            active.append(
                ActiveFilter(
                    key="without_collection",
                    label="Coleccin",
                    value_display="Con coleccin asignada",
                )
            )

        if self.tenure_regime is not None:
            label = TENURE_REGIME_LABELS.get(self.tenure_regime, self.tenure_regime.value)
            active.append(
                ActiveFilter(
                    key="tenure_regime",
                    label="Rgimen de tenencia",
                    value_display=label,
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
                    label="Categora",
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
                    label="Estado de conservacin",
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
            loc_name = None
            if session:
                loc = session.get(Location, self.location_id)
                if loc:
                    loc_name = f"{loc.name} ({loc.code})" if loc.code else loc.name
            active.append(
                ActiveFilter(
                    key="location_id",
                    label="Ubicacin",
                    value_display=f"{loc_name or self.location_id} (con descendientes)",
                )
            )

        if self.has_inventory_code is True:
            active.append(
                ActiveFilter(
                    key="has_inventory_code",
                    label="Cdigo de inventario",
                    value_display="Con cdigo I vigente",
                )
            )
        elif self.has_inventory_code is False:
            active.append(
                ActiveFilter(
                    key="has_inventory_code",
                    label="Cdigo de inventario",
                    value_display="Sin cdigo I vigente",
                )
            )

        if self.author and self.author.strip():
            active.append(
                ActiveFilter(key="author", label="Autor", value_display=self.author.strip())
            )

        if self.provenance and self.provenance.strip():
            active.append(
                ActiveFilter(
                    key="provenance", label="Procedencia", value_display=self.provenance.strip()
                )
            )

        if self.period_text and self.period_text.strip():
            active.append(
                ActiveFilter(
                    key="period_text", label="poca (texto)", value_display=self.period_text.strip()
                )
            )

        if self.epoch_start_year is not None and self.epoch_end_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch",
                    label="poca",
                    value_display=f"Entre {self.epoch_start_year} y {self.epoch_end_year}",
                )
            )
        elif self.epoch_start_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch_start_year",
                    label="poca desde",
                    value_display=str(self.epoch_start_year),
                )
            )
        elif self.epoch_end_year is not None:
            active.append(
                ActiveFilter(
                    key="epoch_end_year",
                    label="poca hasta",
                    value_display=str(self.epoch_end_year),
                )
            )

        if self.valuation_min is not None and self.valuation_max is not None:
            active.append(
                ActiveFilter(
                    key="valuation_range",
                    label="Valorizacin",
                    value_display=f"{self.valuation_min} - {self.valuation_max}",
                )
            )
        elif self.valuation_min is not None:
            active.append(
                ActiveFilter(
                    key="valuation_min",
                    label="Valorizacin mnima",
                    value_display=str(self.valuation_min),
                )
            )
        elif self.valuation_max is not None:
            active.append(
                ActiveFilter(
                    key="valuation_max",
                    label="Valorizacin mxima",
                    value_display=str(self.valuation_max),
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
                    label="Convenio de prstamo",
                    value_display=self.loan_agreement_ref.strip(),
                )
            )

        if self.alert_code or self.has_alerts:
            active.append(
                ActiveFilter(
                    key="alert_code" if self.alert_code else "has_alerts",
                    label="Alertas",
                    value_display=self.alert_code or "Con alertas",
                )
            )

        return active
