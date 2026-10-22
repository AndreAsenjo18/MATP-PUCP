"""Unit tests for unified PieceFilter (spec busqueda-reportes; RF-032, RF-041)."""

import pytest
from sqlalchemy import select

from app.api.errors import NotImplementedEndpoint
from app.api.stubs import CHANGE_INCOMPLETE
from app.core.errors import PermissionDenied
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import Viewer
from app.modules.collections.models import Collection
from app.modules.locations.models import Location, LocationLevel
from app.modules.search.filters import PieceFilter
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION
from tests.conftest import ActAs


def test_empty_filter_produces_true_condition(session) -> None:
    piece_filter = PieceFilter()
    where_clause = piece_filter.to_where(session)
    assert where_clause is not None
    assert piece_filter.describe(session) == []
    assert piece_filter.count_excluded_uninterpreted_period(session) == 0


def test_sensitive_filters_require_permissions() -> None:
    # Valuation without permission
    viewer_no_perm = Viewer(permissions=frozenset())
    f_val = PieceFilter(valuation_min=100.0)
    with pytest.raises(PermissionDenied) as exc_info:
        f_val.validate_permissions(viewer_no_perm)
    assert exc_info.value.code == "filter_not_allowed"

    # Valuation with permission
    viewer_val = Viewer(permissions=frozenset({PERM_VALUATION}))
    f_val.validate_permissions(viewer_val)  # does not raise

    # Donor data without permission
    f_lender = PieceFilter(lender_name="García")
    with pytest.raises(PermissionDenied) as exc_info:
        f_lender.validate_permissions(viewer_no_perm)
    assert exc_info.value.code == "filter_not_allowed"

    viewer_donor = Viewer(permissions=frozenset({PERM_DONOR_DATA}))
    f_lender.validate_permissions(viewer_donor)  # does not raise

    # Loan terms without permission
    f_loan = PieceFilter(loan_agreement_ref="EXP-2026-01")
    with pytest.raises(PermissionDenied) as exc_info:
        f_loan.validate_permissions(viewer_no_perm)
    assert exc_info.value.code == "filter_not_allowed"

    viewer_loan = Viewer(permissions=frozenset({PERM_LOAN_TERMS}))
    f_loan.validate_permissions(viewer_loan)  # does not raise


def test_alerts_filter_raises_not_implemented(session) -> None:
    f_alert = PieceFilter(has_alerts=True)
    with pytest.raises(NotImplementedEndpoint) as exc:
        f_alert.to_where(session)
    assert exc.value.change == CHANGE_INCOMPLETE

    f_code = PieceFilter(alert_code="MISSING_PHOTO")
    with pytest.raises(NotImplementedEndpoint) as exc:
        f_code.to_where(session)
    assert exc.value.change == CHANGE_INCOMPLETE


def test_collection_descendants_included(session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        parent = Collection(name="Colección Raíz", acronym="RZ", acronym_normalized="RZ")
        session.add(parent)
        session.flush()

        child = Collection(
            name="Subcolección Hija", acronym="HJ", acronym_normalized="HJ", parent_id=parent.id
        )
        session.add(child)
        session.flush()

        p1 = Piece(
            denomination="Pieza en Raíz",
            collection_id=parent.id,
            tenure_regime=TenureRegime.OWNED,
        )
        p2 = Piece(
            denomination="Pieza en Hija",
            collection_id=child.id,
            tenure_regime=TenureRegime.OWNED,
        )
        p3 = Piece(
            denomination="Pieza sin Colección",
            collection_id=None,
            tenure_regime=TenureRegime.OWNED,
        )
        session.add_all([p1, p2, p3])
        session.commit()

    f = PieceFilter(collection_id=parent.id)
    rows = session.scalars(select(Piece).where(f.to_where(session))).all()
    piece_ids = {p.id for p in rows}
    assert p1.id in piece_ids
    assert p2.id in piece_ids
    assert p3.id not in piece_ids


def test_location_descendants_included(session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        site = Location(name="Sede Central", code="SC", level=LocationLevel.SITE)
        session.add(site)
        session.flush()

        space = Location(
            name="Depósito 1",
            code="DEP1",
            level=LocationLevel.SPACE,
            parent_id=site.id,
        )
        session.add(space)
        session.flush()

        box = Location(
            name="Caja 5",
            code="CJ5",
            level=LocationLevel.CONTAINER,
            parent_id=space.id,
        )
        session.add(box)
        session.flush()

        p_space = Piece(
            denomination="Pieza en espacio",
            current_location_id=space.id,
            tenure_regime=TenureRegime.OWNED,
        )
        p_box = Piece(
            denomination="Pieza en caja",
            current_location_id=box.id,
            tenure_regime=TenureRegime.OWNED,
        )
        p_outside = Piece(
            denomination="Pieza sin ubicación",
            current_location_id=None,
            tenure_regime=TenureRegime.OWNED,
        )
        session.add_all([p_space, p_box, p_outside])
        session.commit()

    # Filtering by space includes box descendants
    f_space = PieceFilter(location_id=space.id)
    rows = session.scalars(select(Piece).where(f_space.to_where(session))).all()
    piece_ids = {p.id for p in rows}
    assert p_space.id in piece_ids
    assert p_box.id in piece_ids
    assert p_outside.id not in piece_ids


def test_epoch_filtering_and_uninterpreted_count(session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        # 1. Piece with interpreted epoch 1820-1850
        p1 = Piece(
            denomination="Pieza Republicana",
            epoch_start_year=1820,
            epoch_end_year=1850,
            epoch_original_text="Siglo XIX temprano",
            tenure_regime=TenureRegime.OWNED,
        )
        # 2. Piece with interpreted epoch 1900-1920
        p2 = Piece(
            denomination="Pieza Siglo XX",
            epoch_start_year=1900,
            epoch_end_year=1920,
            epoch_original_text="Inicios siglo XX",
            tenure_regime=TenureRegime.OWNED,
        )
        # 3. Piece with uninterpreted text only
        p3 = Piece(
            denomination="Pieza Época Desconocida",
            epoch_start_year=None,
            epoch_end_year=None,
            epoch_original_text="Probable colonial tardío",
            tenure_regime=TenureRegime.OWNED,
        )
        session.add_all([p1, p2, p3])
        session.commit()

    # Query 1800 to 1840 -> matches p1 (1820 <= 1840 and 1850 >= 1800)
    f_epoch = PieceFilter(epoch_start_year=1800, epoch_end_year=1840)
    rows = session.scalars(select(Piece).where(f_epoch.to_where(session))).all()
    assert len(rows) == 1
    assert rows[0].id == p1.id

    # Excluded count should find p3 (has text, lacks start/end)
    excluded = f_epoch.count_excluded_uninterpreted_period(session)
    assert excluded >= 1


def test_describe_returns_active_filters(session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        coll = Collection(name="Colección Artesanía", acronym="ART", acronym_normalized="ART")
        session.add(coll)
        session.commit()

    f = PieceFilter(
        q="retablo",
        collection_id=coll.id,
        tenure_regime=TenureRegime.OWNED,
        has_inventory_code=True,
        epoch_start_year=1950,
        epoch_end_year=1980,
    )
    described = f.describe(session)
    keys = {af.key for af in described}
    assert keys == {"q", "collection_id", "tenure_regime", "has_inventory_code", "epoch"}

    # Check labels
    epoch_af = next(af for af in described if af.key == "epoch")
    assert epoch_af.value_display == "Entre 1950 y 1980"
