"""Daily completeness snapshots (spec calidad-datos; RF-035, design D5).

`replace_daily_snapshot` is idempotent: running it twice the same day leaves exactly one row per
(day, collection, alert) — the values of the last run — because it deletes that day's rows
before inserting (spec, escenario "Instantánea repetida"). `dashboard_history` reads them back
for the evolution chart (escenario "Evolución mensual") and rejects an inverted date range with
`ValidationFailed` → 422 (escenario "Rango de fechas inválido").
"""

import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.core.models_base import new_uuid
from app.modules.quality.completeness import AlertCode
from app.modules.quality.kpis import compute_dashboard_kpis
from app.modules.quality.models import CompletenessSnapshot


def replace_daily_snapshot(session: Session, taken_on: date) -> list[CompletenessSnapshot]:
    kpis = compute_dashboard_kpis(session, by_collection=True)
    session.execute(delete(CompletenessSnapshot).where(CompletenessSnapshot.taken_on == taken_on))
    rows = [
        CompletenessSnapshot(
            id=new_uuid(),
            taken_on=taken_on,
            collection_id=None,
            alert_code=alert.alert.value,
            numerator=alert.numerator,
            denominator=alert.denominator,
        )
        for alert in kpis.alerts
    ]
    for group in kpis.by_collection:
        rows.extend(
            CompletenessSnapshot(
                id=new_uuid(),
                taken_on=taken_on,
                collection_id=group.collection_id,
                alert_code=alert.alert.value,
                numerator=alert.numerator,
                denominator=alert.denominator,
            )
            for alert in group.alerts
        )
    session.add_all(rows)
    session.flush()
    return rows


@dataclass(frozen=True)
class SnapshotPoint:
    taken_on: date
    alert: AlertCode
    numerator: int
    denominator: int
    completeness_ratio: float | None = field(init=False)

    def __post_init__(self) -> None:
        ratio = None if self.denominator == 0 else 1 - (self.numerator / self.denominator)
        object.__setattr__(self, "completeness_ratio", ratio)


def dashboard_history(
    session: Session, date_from: date, date_to: date, collection_id: uuid.UUID | None = None
) -> list[SnapshotPoint]:
    if date_from > date_to:
        raise ValidationFailed(
            "La fecha inicial no puede ser posterior a la final.",
            code="invalid_date_range",
            details={"from": str(date_from), "to": str(date_to)},
        )
    collection_filter = (
        CompletenessSnapshot.collection_id == collection_id
        if collection_id is not None
        else CompletenessSnapshot.collection_id.is_(None)
    )
    rows = session.scalars(
        select(CompletenessSnapshot)
        .where(
            CompletenessSnapshot.taken_on >= date_from,
            CompletenessSnapshot.taken_on <= date_to,
            collection_filter,
        )
        .order_by(CompletenessSnapshot.taken_on, CompletenessSnapshot.alert_code)
    ).all()
    return [
        SnapshotPoint(
            taken_on=row.taken_on,
            alert=AlertCode(row.alert_code),
            numerator=row.numerator,
            denominator=row.denominator,
        )
        for row in rows
    ]
