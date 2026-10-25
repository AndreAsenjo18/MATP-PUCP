"""Closed catalog of reports (change reportes-inventario, design D1 and D2; RF-033, RF-034).

``REPORTS`` declares every report: its title, the permission it needs on top of
``reports.view`` and how it is built. An unknown type answers 404 with the reports available to
the caller's role; invalid parameters answer 422 from the builder. ``consistent_session`` opens
the read-only ``REPEATABLE READ`` transaction of D2 on PostgreSQL, so the detail and the totals
come from the same snapshot even while other users register pieces.
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.core.errors import NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.catalog.queries import Viewer
from app.modules.quality.completeness import load_active_rules
from app.modules.quality.incomplete_report import build_incomplete_query, rows_for_pieces
from app.modules.reports.builders import ReportData, by_location, inventory


@dataclass(frozen=True)
class ReportParams:
    collection_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    include_loans_for_use: bool = True
    not_verified_since_days: int | None = None


Builder = Callable[[Session, Viewer, ReportParams], ReportData]


@dataclass(frozen=True)
class ReportDefinition:
    type: str
    title: str
    description: str
    builder: Builder
    permission: str | None = None  # needed on top of reports.view


def _incomplete(session: Session, viewer: Viewer, params: ReportParams) -> ReportData:
    rules = load_active_rules(session)
    pieces = list(
        session.scalars(build_incomplete_query(session, rules, collection_id=params.collection_id))
    )
    rows = rows_for_pieces(session, pieces, rules)
    return ReportData(
        title="Piezas con información incompleta",
        columns=["Denominación", "Colección", "Alertas"],
        rows=[
            [row.title, row.collection_name or "", ", ".join(str(alert) for alert in row.alerts)]
            for row in rows
        ],
        totals={"Piezas": len(rows)},
        message=None if rows else "No hay piezas con alertas de completitud.",
    )


REPORTS: dict[str, ReportDefinition] = {
    definition.type: definition
    for definition in (
        ReportDefinition(
            "inventory",
            "Inventario general",
            "Inventario permanente con subtotales por colección y régimen.",
            lambda s, v, p: inventory(s, v, include_loans_for_use=p.include_loans_for_use),
        ),
        ReportDefinition(
            "by-collection",
            "Inventario por colección",
            "Inventario de una colección y sus subcolecciones (`collection_id`).",
            lambda s, v, p: inventory(
                s,
                v,
                collection_id=_required_collection(p),
                include_loans_for_use=p.include_loans_for_use,
            ),
        ),
        ReportDefinition(
            "by-location",
            "Piezas por ubicación",
            "Piezas de una ubicación y sus descendientes, con su última verificación.",
            lambda s, v, p: by_location(
                s, v, location_id=p.location_id, not_verified_since_days=p.not_verified_since_days
            ),
        ),
        ReportDefinition(
            "incomplete",
            "Piezas incompletas",
            "Piezas con alertas de completitud (RF-035).",
            _incomplete,
        ),
    )
}


def _required_collection(params: ReportParams) -> uuid.UUID:
    if params.collection_id is None:
        raise ValidationFailed(
            "Indique la colección del reporte.",
            code="invalid_report_parameter",
            details={"parameter": "collection_id"},
        )
    return params.collection_id


def available_for(permissions: frozenset[str]) -> list[ReportDefinition]:
    return [d for d in REPORTS.values() if d.permission is None or d.permission in permissions]


def get_definition(report_type: str, permissions: frozenset[str]) -> ReportDefinition:
    definition = REPORTS.get(report_type)
    available = available_for(permissions)
    if definition is None or definition not in available:
        raise NotFound(
            f"El reporte «{report_type}» no existe. Reportes disponibles: "
            f"{', '.join(d.type for d in available)}.",
            code="report_not_found",
            details={"available": [{"type": d.type, "title": d.title} for d in available]},
        )
    return definition


@contextmanager
def consistent_session(session: Session) -> Iterator[Session]:
    """A read-only session on one snapshot (``REPEATABLE READ``) on PostgreSQL; on SQLite, used in
    the tests, the default transaction of ``session``."""
    bind = session.get_bind()
    if bind.dialect.name != "postgresql":
        yield session
        return
    engine = getattr(bind, "engine", bind)
    factory = make_session_factory(
        engine.execution_options(isolation_level="REPEATABLE READ", postgresql_readonly=True)
    )
    with factory() as snapshot:
        try:
            yield snapshot
        finally:
            snapshot.rollback()


def build(
    report_type: str, session: Session, permissions: frozenset[str], params: ReportParams
) -> ReportData:
    definition = get_definition(report_type, permissions)
    with consistent_session(session) as snapshot:
        return definition.builder(snapshot, Viewer(permissions), params)


def serialize_params(params: ReportParams) -> dict[str, Any]:
    """JSON-safe parameters, stored in the export job to rebuild the same report."""
    return {
        key: str(value) if isinstance(value, uuid.UUID) else value
        for key, value in vars(params).items()
    }


def params_from(stored: dict[str, Any]) -> ReportParams:
    def as_uuid(value: Any) -> uuid.UUID | None:
        return uuid.UUID(value) if value else None

    return ReportParams(
        collection_id=as_uuid(stored.get("collection_id")),
        location_id=as_uuid(stored.get("location_id")),
        include_loans_for_use=bool(stored.get("include_loans_for_use", True)),
        not_verified_since_days=stored.get("not_verified_since_days"),
    )


def record_report_export(
    session: Session,
    user_id: uuid.UUID | None,
    actor_label: str,
    report_type: str,
    fmt: str,
    data: ReportData,
    *,
    entity_id: uuid.UUID | None = None,
) -> None:
    """Audit entry of a generated report file (who, which report, filters, rows)."""
    set_audit_context(
        session,
        AuditContext(
            origin=AuditOrigin.MANUAL if user_id else AuditOrigin.SYSTEM,
            user_id=user_id,
            actor_label=actor_label,
            action=AuditAction.EXPORT,
        ),
    )
    session.add(
        AuditLog(
            change_set_id=new_uuid(),
            entity_type="export_job",
            entity_id=entity_id or new_uuid(),
            field=None,
            old_value=None,
            new_value={
                "kind": "report",
                "report_type": report_type,
                "format": fmt,
                "row_count": len(data.rows),
                "filters": data.filters,
                "masked_columns": data.masked_columns,
            },
            action=AuditAction.EXPORT,
            origin=AuditOrigin.MANUAL if user_id else AuditOrigin.SYSTEM,
            user_id=user_id,
            actor_label=actor_label,
            reason=f"Reporte {report_type} ({fmt}) con {len(data.rows)} filas",
        )
    )
