"""Incomplete-pieces report (spec calidad-datos; RF-019, RF-035, design D4).

Reuses the single alert definitions from `quality.completeness` (design D1): the count behind
"piezas sin fotografía" here is the same as the dashboard KPI's numerator for that alert and the
one the piece's own `/alerts` endpoint would return (spec, escenario "Misma cifra en todos los
lugares"). `IncompletePiece` only exposes the denomination, the collection name and the list of
active alert codes — none of `PIECE_SENSITIVE_FIELDS` (`lender_name`, `loan_agreement_ref`,
masked location) — so there is nothing to mask for this report today; if a future task adds a
sensitive field here, mask it the way `CatalogReader.detail` does.
"""

import csv
import io
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

from openpyxl import Workbook
from sqlalchemy import Select, and_, case, or_, select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.catalog.queries import _descendants
from app.modules.collections.models import Collection
from app.modules.quality.completeness import (
    ALERTS,
    ActiveRules,
    AlertCode,
    active_alerts_for_pieces,
    alert_condition,
)

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _alert_count_column(rules: ActiveRules):
    return sum(case((alert_condition(code, rules), 1), else_=0) for code in ALERTS)


def build_incomplete_query(
    session: Session,
    rules: ActiveRules,
    *,
    alert_codes: Sequence[AlertCode] | None = None,
    collection_id: uuid.UUID | None = None,
    include_subcollections: bool = True,
) -> Select:
    """Piezas activas con al menos una alerta (o, con `alert_codes`, con todas las indicadas —
    semántica AND), ordenadas por número de alertas activas descendente (design D4)."""
    conditions = [Piece.deleted_at.is_(None), Piece.merged_into_id.is_(None)]
    if collection_id is not None:
        ids = (
            _descendants(session, Collection, collection_id)
            if include_subcollections
            else {collection_id}
        )
        conditions.append(Piece.collection_id.in_(ids))
    if alert_codes:
        conditions.append(and_(*(alert_condition(code, rules) for code in alert_codes)))
    else:
        conditions.append(or_(*(alert_condition(code, rules) for code in ALERTS)))
    return (
        select(Piece)
        .where(*conditions)
        .order_by(_alert_count_column(rules).desc(), Piece.denomination)
    )


@dataclass(frozen=True)
class IncompleteRow:
    piece_id: uuid.UUID
    title: str
    collection_name: str | None
    alerts: list[AlertCode]


def rows_for_pieces(
    session: Session, pieces: Sequence[Piece], rules: ActiveRules
) -> list[IncompleteRow]:
    collection_ids = {p.collection_id for p in pieces if p.collection_id is not None}
    names = (
        {
            c.id: c.name
            for c in session.scalars(select(Collection).where(Collection.id.in_(collection_ids)))
        }
        if collection_ids
        else {}
    )
    alerts = active_alerts_for_pieces(session, [piece.id for piece in pieces], rules)
    return [
        IncompleteRow(
            piece_id=piece.id,
            title=piece.denomination,
            collection_name=names.get(piece.collection_id) if piece.collection_id else None,
            alerts=alerts.get(piece.id, []),
        )
        for piece in pieces
    ]


_FILTER_LABELS = (
    ("alert", "Alertas filtradas"),
    ("collection_id", "Colección"),
    ("include_subcollections", "Incluye subcolecciones"),
)


def incomplete_report_csv(rows: list[IncompleteRow], filters: dict[str, object]) -> bytes:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Reporte de piezas incompletas"])
    writer.writerow(["Generado", datetime.now(UTC).isoformat()])
    for key, label in _FILTER_LABELS:
        if filters.get(key):
            writer.writerow([label, filters[key]])
    writer.writerow([])
    writer.writerow(["Pieza", "Denominación", "Colección", "Alertas"])
    for row in rows:
        writer.writerow(
            [str(row.piece_id), row.title, row.collection_name or "", ", ".join(row.alerts)]
        )
    return stream.getvalue().encode("utf-8-sig")


def incomplete_report_workbook(rows: list[IncompleteRow], filters: dict[str, object]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Piezas incompletas"
    sheet.append(["Reporte de piezas incompletas"])
    sheet.append(["Generado", datetime.now(UTC).isoformat()])
    for key, label in _FILTER_LABELS:
        if filters.get(key):
            sheet.append([label, filters[key]])
    sheet.append([])
    sheet.append(["Pieza", "Denominación", "Colección", "Alertas"])
    for row in rows:
        sheet.append(
            [str(row.piece_id), row.title, row.collection_name or "", ", ".join(row.alerts)]
        )
    stream = io.BytesIO()
    workbook.save(stream)
    return stream.getvalue()
