"""Spec calidad-datos — KPI de completitud con numerador y denominador (RF-035, design D3).

Change alertas-y-reporte-incompletas, tarea 2.2. Cubre los tres escenarios de la spec:
KPI de código I solo sobre propiedad, colección solo en comodato (no aplica) y catálogo vacío
(sin división por cero).
"""

from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.service import create_collection
from app.modules.identification.service import set_inventory_code
from app.modules.quality.completeness import AlertCode
from app.modules.quality.kpis import compute_dashboard_kpis
from tests.conftest import ActAs


def _alert(kpis, code: AlertCode):
    return next(a for a in kpis.alerts if a.alert == code)


def test_inventory_code_kpi_applies_only_to_owned_pieces(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        for i in range(150):
            piece = create_piece(
                session, denomination=f"Propiedad con código {i}", tenure_regime=TenureRegime.OWNED
            )
            set_inventory_code(session, piece, f"I-{10_000 + i}")
        for i in range(100):
            create_piece(
                session, denomination=f"Propiedad sin código {i}", tenure_regime=TenureRegime.OWNED
            )
        for i in range(50):
            create_piece(
                session,
                denomination=f"Comodato {i}",
                tenure_regime=TenureRegime.LOAN_FOR_USE,
                lender_name="Familia sintética",
            )
        session.commit()

    kpis = compute_dashboard_kpis(session)
    assert kpis.total_pieces == 300
    inventory = _alert(kpis, AlertCode.MISSING_INVENTORY_CODE)
    assert (inventory.numerator, inventory.denominator) == (100, 250)
    assert inventory.completeness_ratio == 0.6


def test_collection_entirely_in_loan_for_use_has_no_applicable_inventory_code_kpi(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        collection = create_collection(session, name="Colección AJB (ficticia, en comodato)")
        for i in range(5):
            create_piece(
                session,
                denomination=f"Pieza en comodato {i}",
                tenure_regime=TenureRegime.LOAN_FOR_USE,
                lender_name="Familia sintética",
                collection_id=collection.id,
            )
        session.commit()

    kpis = compute_dashboard_kpis(session, by_collection=True)
    group = next(g for g in kpis.by_collection if g.collection_id == collection.id)
    inventory = _alert(group, AlertCode.MISSING_INVENTORY_CODE)
    assert (inventory.numerator, inventory.denominator) == (0, 0)
    assert inventory.completeness_ratio is None


def test_by_collection_kpi_aggregates_subcollections(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        root = create_collection(session, name="Colección raíz (ficticia)")
        sub = create_collection(session, name="Subcolección (ficticia)", parent_id=root.id)
        create_piece(
            session,
            denomination="Pieza de la subcolección",
            tenure_regime=TenureRegime.OWNED,
            collection_id=sub.id,
        )
        session.commit()

    kpis = compute_dashboard_kpis(session, by_collection=True)
    group = next(g for g in kpis.by_collection if g.collection_id == root.id)
    inventory = _alert(group, AlertCode.MISSING_INVENTORY_CODE)
    assert (inventory.numerator, inventory.denominator) == (1, 1)


def test_empty_catalog_never_divides_by_zero(session: Session) -> None:
    kpis = compute_dashboard_kpis(session, by_collection=True)
    assert kpis.total_pieces == 0
    for alert in kpis.alerts:
        assert alert.denominator == 0
        assert alert.completeness_ratio is None
