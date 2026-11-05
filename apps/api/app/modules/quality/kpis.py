"""Dashboard completeness KPIs (spec calidad-datos; RF-035, design D3).

Reuses `quality.completeness.ALERTS` so each alert keeps exactly one definition: the same
piece counts the same way here, in the piece's own alerts and in the incomplete-pieces report
(spec, escenario "Misma cifra en todos los lugares").

For each alert: `numerator` = pieces it applies to that currently trigger it, `denominator` =
pieces it applies to, `completeness_ratio` = ``1 - numerator / denominator`` or ``None`` (not
applicable) when the denominator is zero — never a division by zero (spec, escenario
"Catálogo vacío").
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.catalog.queries import _descendants
from app.modules.collections.models import Collection
from app.modules.quality.completeness import ALERTS, ActiveRules, AlertCode, load_active_rules

BASE_CONDITIONS = (Piece.deleted_at.is_(None), Piece.merged_into_id.is_(None))


@dataclass(frozen=True)
class AlertKpi:
    alert: AlertCode
    numerator: int
    denominator: int
    completeness_ratio: float | None


@dataclass(frozen=True)
class CollectionKpis:
    collection_id: uuid.UUID
    collection_name: str
    alerts: list[AlertKpi]


@dataclass(frozen=True)
class DashboardKpis:
    total_pieces: int
    alerts: list[AlertKpi]
    by_collection: list[CollectionKpis]
    computed_at: datetime


def _to_alert_kpi(code: AlertCode, numerator: int, denominator: int) -> AlertKpi:
    ratio = None if denominator == 0 else 1 - (numerator / denominator)
    return AlertKpi(
        alert=code, numerator=numerator, denominator=denominator, completeness_ratio=ratio
    )


def _alert_kpis(session: Session, rules: ActiveRules, conditions: tuple) -> list[AlertKpi]:
    """One query for every alert: `SUM(CASE ...)` is portable across PostgreSQL and SQLite,
    unlike the `FILTER` clause."""
    columns = []
    for definition in ALERTS.values():
        applies = definition.applies_to(rules)
        matches = definition.predicate(rules)
        columns.append(func.sum(case((applies, 1), else_=0)))
        columns.append(func.sum(case((applies & matches, 1), else_=0)))
    row = session.execute(select(*columns).select_from(Piece).where(*conditions)).one()
    return [
        _to_alert_kpi(code, numerator=row[2 * i + 1] or 0, denominator=row[2 * i] or 0)
        for i, code in enumerate(ALERTS)
    ]


def _by_collection_kpis(
    session: Session, rules: ActiveRules, conditions: tuple
) -> list[CollectionKpis]:
    roots = session.execute(
        select(Collection.id, Collection.name)
        .where(Collection.parent_id.is_(None), Collection.deleted_at.is_(None))
        .order_by(Collection.name)
    ).all()
    result = []
    for root_id, root_name in roots:
        descendant_ids = _descendants(session, Collection, root_id)
        scoped = (*conditions, Piece.collection_id.in_(descendant_ids))
        result.append(
            CollectionKpis(
                collection_id=root_id,
                collection_name=root_name,
                alerts=_alert_kpis(session, rules, scoped),
            )
        )
    return result


def compute_dashboard_kpis(session: Session, by_collection: bool = False) -> DashboardKpis:
    rules = load_active_rules(session)
    total_pieces = session.scalar(select(func.count()).select_from(Piece).where(*BASE_CONDITIONS))
    return DashboardKpis(
        total_pieces=total_pieces or 0,
        alerts=_alert_kpis(session, rules, BASE_CONDITIONS),
        by_collection=_by_collection_kpis(session, rules, BASE_CONDITIONS) if by_collection else [],
        computed_at=datetime.now(UTC),
    )
