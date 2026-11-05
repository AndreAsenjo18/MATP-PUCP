"""Consulta de la auditoría: filtros, agrupación por conjunto de cambios, enmascarado y CSV.

Diseño D3 del change `auditoria-y-soft-delete-transversal` (RF-040, RF-041).

- La vista campo a campo devuelve las filas de `audit_log` tal como se registraron, salvo los
  valores de campos sensibles, que se ocultan según los permisos de quien consulta reutilizando
  la política de `app.modules.users.sensitive` (la misma de las lecturas del catálogo).
- La vista agrupada (`group_by=change_set`) resume cada conjunto de cambios: quién, cuándo,
  origen, motivo, entidades afectadas con su conteo, campos afectados y si ya fue revertido.
- `format=csv` exporta la vista activa en streaming, con el mismo enmascarado.
"""

import csv
import enum
import io
import uuid
from collections.abc import Callable, Iterator, Sequence
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.api.refs import EX_DATETIME, EX_PIECE_ID, EX_USER_ID
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.audit.schemas import AuditEntryOut
from app.modules.users.sensitive import COLLECTION_SENSITIVE_FIELDS, PIECE_SENSITIVE_FIELDS

# Campos cuyos valores anteriores y nuevos solo ve quien tiene el permiso (RF-041).
# Reutiliza la política única de `users.sensitive`, indexada por el `entity_type` del registro
# de auditoría (que es el nombre de la tabla).
SENSITIVE_FIELDS_BY_ENTITY: dict[str, dict[str, str]] = {
    "piece": PIECE_SENSITIVE_FIELDS,
    "collection": COLLECTION_SENSITIVE_FIELDS,
}

CSV_FILENAME = "auditoria.csv"
# Excel abre el archivo con acentos correctos si lleva marca de orden de bytes.
CSV_BOM = "﻿"
# Filas leídas por viaje a la base durante la exportación en streaming.
CSV_CHUNK = 500

ENTRY_COLUMNS = (
    "occurred_at",
    "change_set_id",
    "entity_type",
    "entity_id",
    "field",
    "old_value",
    "new_value",
    "values_masked",
    "action",
    "origin",
    "origin_ref",
    "user_id",
    "actor_label",
    "reason",
)

CHANGE_SET_COLUMNS = (
    "change_set_id",
    "occurred_at",
    "last_occurred_at",
    "user_id",
    "actor_label",
    "origin",
    "origin_ref",
    "reason",
    "actions",
    "entity_count",
    "entity_counts",
    "field_count",
    "reverted",
    "reverted_by_change_set_id",
)


class AuditGroupBy(enum.StrEnum):
    CHANGE_SET = "change_set"


class AuditExportFormat(enum.StrEnum):
    CSV = "csv"


class AuditFilters(BaseModel):
    """Filtros comunes a la vista campo a campo, la agrupada y la exportación."""

    entity_type: str | None = None
    entity_id: uuid.UUID | None = None
    change_set_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    origin: AuditOrigin | None = None
    origin_ref: str | None = None
    action: AuditAction | None = None
    field: str | None = None
    occurred_from: datetime | None = None
    occurred_to: datetime | None = None

    def conditions(self) -> list[Any]:
        conditions: list[Any] = []
        if self.entity_type:
            conditions.append(AuditLog.entity_type == self.entity_type)
        if self.entity_id is not None:
            conditions.append(AuditLog.entity_id == self.entity_id)
        if self.change_set_id is not None:
            conditions.append(AuditLog.change_set_id == self.change_set_id)
        if self.user_id is not None:
            conditions.append(AuditLog.user_id == self.user_id)
        if self.origin is not None:
            conditions.append(AuditLog.origin == self.origin)
        if self.origin_ref:
            conditions.append(AuditLog.origin_ref == self.origin_ref)
        if self.action is not None:
            conditions.append(AuditLog.action == self.action)
        if self.field:
            conditions.append(AuditLog.field == self.field)
        if self.occurred_from is not None:
            conditions.append(AuditLog.occurred_at >= self.occurred_from)
        if self.occurred_to is not None:
            conditions.append(AuditLog.occurred_at <= self.occurred_to)
        return conditions


class AuditEntryView(AuditEntryOut):
    """Fila de auditoría como la ve un rol concreto: con los valores sensibles ocultos."""

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000a01",
                    "occurred_at": EX_DATETIME,
                    "change_set_id": "01920000-0000-7000-8000-000000000a00",
                    "entity_type": "piece",
                    "entity_id": EX_PIECE_ID,
                    "field": "lender_name",
                    "old_value": None,
                    "new_value": None,
                    "action": "UPDATE",
                    "origin": "MANUAL",
                    "origin_ref": None,
                    "user_id": EX_USER_ID,
                    "actor_label": None,
                    "reason": None,
                    "values_masked": True,
                }
            ]
        },
    )

    values_masked: bool = Field(
        default=False,
        description=(
            "El campo cambió, pero su valor anterior y nuevo están ocultos porque el rol no "
            "tiene el permiso correspondiente (RF-041)."
        ),
    )


class AuditChangeSetSummary(BaseModel):
    """Resumen de un conjunto de cambios (una operación: edición, carga, fusión, reversión)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "change_set_id": "01920000-0000-7000-8000-000000000a00",
                    "occurred_at": EX_DATETIME,
                    "last_occurred_at": EX_DATETIME,
                    "user_id": EX_USER_ID,
                    "actor_label": None,
                    "origin": "IMPORT",
                    "origin_ref": "01920000-0000-7000-8000-000000000601",
                    "reason": "Carga de la sábana 2024",
                    "actions": ["CREATE"],
                    "entity_count": 54,
                    "entity_counts": {"piece": 54},
                    "field_count": 486,
                    "reverted": False,
                    "reverted_by_change_set_id": None,
                }
            ]
        }
    )

    change_set_id: uuid.UUID
    occurred_at: datetime = Field(description="Primer registro del conjunto.")
    last_occurred_at: datetime
    user_id: uuid.UUID | None
    actor_label: str | None
    origin: AuditOrigin
    origin_ref: str | None
    reason: str | None
    actions: list[AuditAction]
    entity_count: int = Field(description="Entidades distintas afectadas.")
    entity_counts: dict[str, int] = Field(
        description="Entidades distintas por tipo, p. ej. 54 piezas en una carga."
    )
    field_count: int = Field(description="Campos registrados en el conjunto.")
    reverted: bool
    reverted_by_change_set_id: uuid.UUID | None


class AuditLogPage(BaseModel):
    """Página de la consulta de auditoría: filas campo a campo o conjuntos agrupados."""

    items: list[AuditEntryView] = Field(
        default_factory=list, description="Vacío cuando se agrupa por conjunto de cambios."
    )
    change_sets: list[AuditChangeSetSummary] = Field(
        default_factory=list, description="Solo con `group_by=change_set`."
    )
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)


# --- enmascarado ------------------------------------------------------------------------------
def required_permission(entity_type: str, field: str | None) -> str | None:
    """Permiso necesario para ver los valores de ese campo (None si no es sensible)."""
    if not field:
        return None
    return SENSITIVE_FIELDS_BY_ENTITY.get(entity_type, {}).get(field)


def masked_pairs(permissions: frozenset[str] | set[str]) -> list[tuple[str, str]]:
    """Pares (entity_type, field) cuyos valores debe ocultar quien tiene esos permisos."""
    return [
        (entity_type, field)
        for entity_type, fields in SENSITIVE_FIELDS_BY_ENTITY.items()
        for field, permission in fields.items()
        if permission not in permissions
    ]


def entry_view(row: AuditLog, permissions: frozenset[str] | set[str]) -> AuditEntryView:
    """Fila de auditoría con los valores sensibles ocultos para ese conjunto de permisos."""
    permission = required_permission(row.entity_type, row.field)
    view = AuditEntryView.model_validate(row)
    if permission is not None and permission not in permissions:
        return view.model_copy(update={"old_value": None, "new_value": None, "values_masked": True})
    return view


# --- vista campo a campo ----------------------------------------------------------------------
def entries_statement(filters: AuditFilters) -> Select[Any]:
    return (
        select(AuditLog)
        .where(*filters.conditions())
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    )


def list_entries(
    session: Session,
    filters: AuditFilters,
    *,
    permissions: frozenset[str] | set[str],
    limit: int,
    offset: int,
) -> tuple[list[AuditEntryView], int]:
    statement = entries_statement(filters)
    total = session.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    rows = session.scalars(statement.limit(limit).offset(offset))
    return [entry_view(row, permissions) for row in rows], total or 0


# --- vista agrupada por conjunto de cambios ---------------------------------------------------
def _reverted_index(session: Session, change_set_ids: Sequence[uuid.UUID]) -> dict[str, uuid.UUID]:
    """{conjunto revertido: conjunto de reversión}, leído de las filas con acción REVERT."""
    if not change_set_ids:
        return {}
    rows = session.execute(
        select(AuditLog.origin_ref, AuditLog.change_set_id)
        .where(
            AuditLog.action == AuditAction.REVERT,
            AuditLog.origin_ref.in_([str(value) for value in change_set_ids]),
        )
        .distinct()
    ).all()
    return {str(origin_ref): change_set_id for origin_ref, change_set_id in rows}


def list_change_sets(
    session: Session, filters: AuditFilters, *, limit: int, offset: int
) -> tuple[list[AuditChangeSetSummary], int]:
    """Conjuntos de cambios que cumplen los filtros, del más reciente al más antiguo."""
    conditions = filters.conditions()
    grouped = (
        select(AuditLog.change_set_id, func.max(AuditLog.occurred_at).label("last_occurred_at"))
        .where(*conditions)
        .group_by(AuditLog.change_set_id)
    )
    total = session.scalar(select(func.count()).select_from(grouped.subquery()))
    page_rows = session.execute(
        grouped.order_by(func.max(AuditLog.occurred_at).desc(), AuditLog.change_set_id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    change_set_ids = [row[0] for row in page_rows]
    if not change_set_ids:
        return [], total or 0

    # Un conjunto de cambios es una operación con un único usuario, origen y motivo, así que
    # agrupar por esas columnas devuelve pocas filas por conjunto (una por tipo y acción).
    detail = session.execute(
        select(
            AuditLog.change_set_id,
            AuditLog.entity_type,
            AuditLog.action,
            AuditLog.user_id,
            AuditLog.actor_label,
            AuditLog.origin,
            AuditLog.origin_ref,
            AuditLog.reason,
            func.min(AuditLog.occurred_at),
            func.max(AuditLog.occurred_at),
            func.count(func.distinct(AuditLog.entity_id)),
            func.count(),
        )
        .where(AuditLog.change_set_id.in_(change_set_ids), *conditions)
        .group_by(
            AuditLog.change_set_id,
            AuditLog.entity_type,
            AuditLog.action,
            AuditLog.user_id,
            AuditLog.actor_label,
            AuditLog.origin,
            AuditLog.origin_ref,
            AuditLog.reason,
        )
    ).all()

    reverted = _reverted_index(session, change_set_ids)
    accumulator: dict[uuid.UUID, dict[str, Any]] = {}
    for row in detail:
        (
            change_set_id,
            entity_type,
            action,
            user_id,
            actor_label,
            origin,
            origin_ref,
            reason,
            first_at,
            last_at,
            entities,
            fields,
        ) = row
        summary = accumulator.setdefault(
            change_set_id,
            {
                "change_set_id": change_set_id,
                "occurred_at": first_at,
                "last_occurred_at": last_at,
                "user_id": user_id,
                "actor_label": actor_label,
                "origin": origin,
                "origin_ref": origin_ref,
                "reason": reason,
                "actions": set(),
                "entity_counts": {},
                "field_count": 0,
            },
        )
        summary["occurred_at"] = min(summary["occurred_at"], first_at)
        summary["last_occurred_at"] = max(summary["last_occurred_at"], last_at)
        summary["actions"].add(AuditAction(action))
        counts: dict[str, int] = summary["entity_counts"]
        # Una entidad puede recibir varias acciones en el mismo conjunto: el conteo por tipo se
        # toma como el máximo de entidades distintas vistas en cualquiera de ellas.
        counts[entity_type] = max(counts.get(entity_type, 0), entities)
        summary["field_count"] += fields

    summaries = []
    for change_set_id in change_set_ids:
        data = accumulator.get(change_set_id)
        if data is None:  # pragma: no cover - el conjunto siempre tiene filas
            continue
        revert_set = reverted.get(str(change_set_id))
        summaries.append(
            AuditChangeSetSummary(
                **{key: value for key, value in data.items() if key != "actions"},
                actions=sorted(data["actions"]),
                entity_count=sum(data["entity_counts"].values()),
                reverted=revert_set is not None,
                reverted_by_change_set_id=revert_set,
            )
        )
    return summaries, total or 0


# --- exportación a CSV en streaming -----------------------------------------------------------
def _csv_line(writer: Any, buffer: io.StringIO, values: Sequence[Any]) -> str:
    buffer.seek(0)
    buffer.truncate(0)
    writer.writerow(["" if value is None else value for value in values])
    return buffer.getvalue()


def _csv_writer() -> tuple[Any, io.StringIO]:
    buffer = io.StringIO(newline="")
    return csv.writer(buffer, lineterminator="\r\n"), buffer


def _flat_value(value: Any) -> Any:
    if isinstance(value, dict | list):
        return str(value)
    return value


def stream_entries_csv(
    session_factory: Callable[[], Session],
    filters: AuditFilters,
    *,
    permissions: frozenset[str] | set[str],
) -> Iterator[str]:
    """Exporta la vista campo a campo leyendo la base por lotes (no carga todo en memoria)."""
    writer, buffer = _csv_writer()
    yield CSV_BOM + _csv_line(writer, buffer, ENTRY_COLUMNS)
    with session_factory() as session:
        statement = entries_statement(filters).execution_options(yield_per=CSV_CHUNK)
        for row in session.scalars(statement):
            view = entry_view(row, permissions)
            yield _csv_line(
                writer,
                buffer,
                [
                    view.occurred_at.isoformat(),
                    view.change_set_id,
                    view.entity_type,
                    view.entity_id,
                    view.field,
                    _flat_value(view.old_value),
                    _flat_value(view.new_value),
                    "true" if view.values_masked else "false",
                    view.action.value,
                    view.origin.value,
                    view.origin_ref,
                    view.user_id,
                    view.actor_label,
                    view.reason,
                ],
            )


def stream_change_sets_csv(
    session_factory: Callable[[], Session], filters: AuditFilters, *, chunk: int = CSV_CHUNK
) -> Iterator[str]:
    """Exporta la vista agrupada paginando los conjuntos de cambios."""
    writer, buffer = _csv_writer()
    yield CSV_BOM + _csv_line(writer, buffer, CHANGE_SET_COLUMNS)
    with session_factory() as session:
        offset = 0
        while True:
            page, _total = list_change_sets(session, filters, limit=chunk, offset=offset)
            if not page:
                return
            for summary in page:
                yield _csv_line(
                    writer,
                    buffer,
                    [
                        summary.change_set_id,
                        summary.occurred_at.isoformat(),
                        summary.last_occurred_at.isoformat(),
                        summary.user_id,
                        summary.actor_label,
                        summary.origin.value,
                        summary.origin_ref,
                        summary.reason,
                        " ".join(action.value for action in summary.actions),
                        summary.entity_count,
                        "; ".join(
                            f"{name}={count}"
                            for name, count in sorted(summary.entity_counts.items())
                        ),
                        summary.field_count,
                        "true" if summary.reverted else "false",
                        summary.reverted_by_change_set_id,
                    ],
                )
            offset += chunk
