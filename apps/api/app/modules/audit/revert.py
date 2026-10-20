"""Revert a change set of the audit log (design D1; RNF-007, RF-040, RN-002, RN-005).

The engine has two halves:

1. **Planner** (:func:`plan_revert`): reads every ``audit_log`` row of the change set in reverse
   order and turns it into a plan of items the user can review before confirming:

   - a field ``UPDATE`` (also ``MERGE`` and a previous ``REVERT``) becomes "restore ``old_value``";
   - a ``CREATE`` becomes "soft-delete the record it created";
   - a ``SOFT_DELETE`` becomes "restore the record", and a ``RESTORE`` becomes "soft-delete it
     again";
   - a ``CORRECTION`` of an inventory code (I) becomes a correction item that only an
     Administrator with ``identifiers.correct_inventory_code`` can apply (RN-002);
   - rows of append-only tables (movements, source records, conservation assessments) are never
     undone: the plan only reports them, because they are corrected by registering a new record
     from their own module.

   Every item carries the value stored **today**, so a change made after the preview is reported
   as a conflict (who, when, current value) and is never overwritten silently.

2. **Applier** (:func:`revert_change_set`): applies the plan in a single transaction with
   ``AuditContext(action=REVERT, origin_ref=<original change set>)``, so the reversal is itself a
   new change set that can be reverted in turn. A change set that was already reverted is
   rejected.

The plan is fingerprinted into a ``preview_token``; confirming with a stale token is rejected with
``revert_plan_changed`` so the user reviews the new situation instead of applying a plan that no
longer matches the data.
"""

import hashlib
import json
import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import Column, event, inspect, select
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, NotFound, PermissionDenied, ValidationFailed
from app.core.models_base import Base, SoftDeleteMixin, to_audit_value, utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import TYPE_INVENTORY
from app.modules.locations.models import PieceMovement
from app.modules.users.models import Permission, Role, RolePermission, UserRole
from app.modules.users.service import ADMIN_ROLE, user_has_role

# [SUPUESTO B7] Permiso exigido según el origen del conjunto de cambios (design D1). Los orígenes
# que no figuran aquí (IA, sistema) solo los revierte un Administrador.
PERMISSION_BY_ORIGIN: dict[AuditOrigin, str] = {
    AuditOrigin.MANUAL: "pieces.update",
    AuditOrigin.IMPORT: "imports.revert",
}
INVENTORY_CODE_PERMISSION = "identifiers.correct_inventory_code"

# Only used for the message of the informational items: the authoritative list of append-only
# tables is the ``__append_only__`` flag of each model (see app/core/cross_cutting.py).
APPEND_ONLY_LABELS: dict[str, str] = {
    "piece_movement": "movimientos de ubicación",
    "piece_source_record": "registros de datos de origen",
    "conservation_assessment": "evaluaciones de conservación",
    "audit_log": "registros de auditoría",
}
APPEND_ONLY_NOTE = (
    "El conjunto incluye {count} {label} que no se modifican (son de solo inserción): "
    "corríjalos registrando un movimiento o una evaluación correctiva desde su módulo."
)

# A movement is append-only and never appears as an audited entity: what the change set records
# is the denormalized current location of the piece, which the movement history owns.
MOVEMENT_MAINTAINED_FIELD = ("piece", "current_location_id")

# Actions whose rows are reverted field by field.
VALUE_ACTIONS = frozenset(
    {AuditAction.UPDATE, AuditAction.MERGE, AuditAction.REVERT, AuditAction.CORRECTION}
)


class AlreadyReverted(BusinessRuleViolation):
    """The change set already has a reversal change set (design D1)."""

    code = "already_reverted"


class RevertPlanChanged(BusinessRuleViolation):
    """The data changed between the preview and the confirmation."""

    code = "revert_plan_changed"


class RevertHasConflicts(BusinessRuleViolation):
    """There are conflicts with later changes and they were not confirmed explicitly."""

    code = "revert_has_conflicts"


class NothingToRevert(BusinessRuleViolation):
    """Every row of the change set is append-only or already in its previous state."""

    code = "nothing_to_revert"


class RevertItemKind(StrEnum):
    RESTORE_VALUE = "RESTORE_VALUE"
    CORRECT_INVENTORY_CODE = "CORRECT_INVENTORY_CODE"
    SOFT_DELETE_ENTITY = "SOFT_DELETE_ENTITY"
    RESTORE_ENTITY = "RESTORE_ENTITY"
    APPEND_ONLY_NOTE = "APPEND_ONLY_NOTE"


class ConflictReason(StrEnum):
    CHANGED_AFTER = "changed_after"
    ENTITY_MISSING = "entity_missing"
    ALREADY_DELETED = "already_deleted"
    NOT_DELETED = "not_deleted"
    NO_SOFT_DELETE = "no_soft_delete"


@dataclass(frozen=True)
class RevertConflict:
    entity_type: str
    entity_id: uuid.UUID
    field: str | None
    reason: ConflictReason
    message: str
    expected_value: Any = None
    current_value: Any = None
    changed_by_id: uuid.UUID | None = None
    changed_at: datetime | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id),
            "field": self.field,
            "reason": str(self.reason),
            "message": self.message,
            "expected_value": self.expected_value,
            "current_value": self.current_value,
            "changed_by_id": str(self.changed_by_id) if self.changed_by_id else None,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
        }


@dataclass(frozen=True)
class RevertItem:
    kind: RevertItemKind
    entity_type: str
    entity_id: uuid.UUID
    source_action: AuditAction
    field: str | None = None
    current_value: Any = None
    target_value: Any = None
    description: str = ""
    # False for informational rows and for states the reversal cannot resolve by itself.
    applicable: bool = True
    conflict: RevertConflict | None = None

    @property
    def restores_value(self) -> bool:
        return self.kind in (RevertItemKind.RESTORE_VALUE, RevertItemKind.CORRECT_INVENTORY_CODE)

    def fingerprint(self) -> dict[str, Any]:
        """Canonical form hashed into the ``preview_token`` (includes the value stored today)."""
        return {
            "kind": str(self.kind),
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id),
            "field": self.field,
            "current_value": self.current_value,
            "target_value": self.target_value,
            "applicable": self.applicable,
            "conflict": str(self.conflict.reason) if self.conflict else None,
        }


@dataclass(frozen=True)
class ChangeSetEntity:
    entity_type: str
    entity_id: uuid.UUID
    field_count: int


@dataclass(frozen=True)
class ChangeSetSummary:
    change_set_id: uuid.UUID
    occurred_at: datetime
    origin: AuditOrigin
    origin_ref: str | None
    user_id: uuid.UUID | None
    actor_label: str | None
    reason: str | None
    actions: tuple[AuditAction, ...]
    field_count: int
    entities: tuple[ChangeSetEntity, ...]
    reverted: bool
    reverted_by_change_set_id: uuid.UUID | None
    reverts_change_set_id: uuid.UUID | None

    @property
    def entity_count(self) -> int:
        return len(self.entities)


@dataclass(frozen=True)
class RevertPlan:
    summary: ChangeSetSummary
    items: tuple[RevertItem, ...]
    notes: tuple[str, ...]
    required_permissions: tuple[str, ...]
    requires_admin: bool
    touches_inventory_code: bool
    preview_token: str

    @property
    def conflicts(self) -> tuple[RevertConflict, ...]:
        return tuple(item.conflict for item in self.items if item.conflict is not None)

    @property
    def applicable_items(self) -> tuple[RevertItem, ...]:
        return tuple(item for item in self.items if item.applicable)


@dataclass
class RevertOutcome:
    """Result of :func:`revert_change_set` (internal interface consumed by other modules)."""

    reverted_change_set_id: uuid.UUID
    new_change_set_id: uuid.UUID
    reverted_fields: int
    restored_entities: int = 0
    deleted_entities: int = 0
    conflicts: list[RevertConflict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- model helpers
def _model_map() -> dict[str, type[Base]]:
    """``{tablename: model}`` for every mapped entity (the registry is already populated)."""
    return {mapper.class_.__tablename__: mapper.class_ for mapper in Base.registry.mappers}


def _column(model: type[Base], attribute: str) -> Column[Any] | None:
    columns = inspect(model).columns
    return columns.get(attribute)


def _coerce(column: Column[Any], value: Any) -> Any:
    """Turn a JSON value of the audit log back into the Python type of its column."""
    if value is None:
        return None
    column_type = column.type
    if isinstance(column_type, SAEnum) and column_type.enum_class is not None:
        return column_type.enum_class(value)
    try:
        python_type: type | None = column_type.python_type
    except NotImplementedError:  # pragma: no cover - JSON and other typeless columns
        python_type = None
    if python_type is uuid.UUID:
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    if python_type is datetime:
        return value if isinstance(value, datetime) else datetime.fromisoformat(str(value))
    if python_type is date:
        return value if isinstance(value, date) else date.fromisoformat(str(value))
    if python_type is Decimal:
        return value if isinstance(value, Decimal) else Decimal(str(value))
    if python_type is bool:
        return bool(value)
    if python_type is int and not isinstance(value, bool):
        return int(value)
    return value


def _load(session: Session, model: type[Base], entity_id: uuid.UUID) -> Base | None:
    """Load an entity even when it is logically deleted (the reversal must see it)."""
    return session.get(model, entity_id, execution_options={INCLUDE_DELETED: True})


def _is_inventory_identifier(obj: Base | None, row: AuditLog) -> bool:
    if row.entity_type != PieceIdentifier.__tablename__:
        return False
    if isinstance(obj, PieceIdentifier):
        return bool(obj.is_locked) or obj.identifier_type_code == TYPE_INVENTORY
    return row.action is AuditAction.CORRECTION


# --------------------------------------------------------------------------- change set reading
def load_change_set(session: Session, change_set_id: uuid.UUID) -> list[AuditLog]:
    """Rows of the change set in reverse order (the newest is undone first)."""
    rows = list(
        session.scalars(
            select(AuditLog)
            .where(AuditLog.change_set_id == change_set_id)
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        )
    )
    if not rows:
        raise NotFound("El conjunto de cambios no existe en la auditoría.")
    return rows


def find_revert_of(session: Session, change_set_id: uuid.UUID) -> uuid.UUID | None:
    """Change set that already reverted this one (``origin_ref`` points at the original)."""
    row = session.scalars(
        select(AuditLog)
        .where(
            AuditLog.origin_ref == str(change_set_id),
            AuditLog.change_set_id != change_set_id,
        )
        .order_by(AuditLog.occurred_at, AuditLog.id)
    ).first()
    return row.change_set_id if row is not None else None


def _movement_of(session: Session, row: AuditLog) -> PieceMovement | None:
    """Movement of the piece that produced this change of ``current_location_id``."""
    statement = select(PieceMovement).where(PieceMovement.piece_id == row.entity_id)
    if row.new_value is None:
        statement = statement.where(PieceMovement.to_location_id.is_(None))
    else:
        try:
            destination = uuid.UUID(str(row.new_value))
        except ValueError:  # pragma: no cover - the column always stores a UUID
            return None
        statement = statement.where(PieceMovement.to_location_id == destination)
    return session.scalars(
        statement.order_by(PieceMovement.occurred_at.desc(), PieceMovement.id.desc())
    ).first()


def _later_change(session: Session, row: AuditLog) -> AuditLog | None:
    """Most recent audit row that touched the same field after this change set."""
    return session.scalars(
        select(AuditLog)
        .where(
            AuditLog.entity_type == row.entity_type,
            AuditLog.entity_id == row.entity_id,
            AuditLog.field == row.field,
            AuditLog.change_set_id != row.change_set_id,
            AuditLog.occurred_at > row.occurred_at,
        )
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    ).first()


def summarize_change_set(session: Session, change_set_id: uuid.UUID) -> ChangeSetSummary:
    """Grouped summary of a change set (design D3): who, when, origin, reason, scope, state."""
    rows = load_change_set(session, change_set_id)
    oldest = rows[-1]
    counts: dict[tuple[str, uuid.UUID], int] = {}
    for row in rows:
        counts[(row.entity_type, row.entity_id)] = (
            counts.get((row.entity_type, row.entity_id), 0) + 1
        )
    reverted_by = find_revert_of(session, change_set_id)
    reverts = None
    if oldest.origin_ref:
        try:
            candidate = uuid.UUID(oldest.origin_ref)
        except ValueError:
            candidate = None
        if candidate is not None and AuditAction.REVERT in {row.action for row in rows}:
            reverts = candidate
    return ChangeSetSummary(
        change_set_id=change_set_id,
        occurred_at=oldest.occurred_at,
        origin=oldest.origin,
        origin_ref=oldest.origin_ref,
        user_id=oldest.user_id,
        actor_label=oldest.actor_label,
        reason=oldest.reason,
        actions=tuple(sorted({row.action for row in rows})),
        field_count=sum(1 for row in rows if row.field is not None),
        entities=tuple(
            ChangeSetEntity(entity_type=entity_type, entity_id=entity_id, field_count=count)
            for (entity_type, entity_id), count in sorted(
                counts.items(), key=lambda item: (item[0][0], str(item[0][1]))
            )
        ),
        reverted=reverted_by is not None,
        reverted_by_change_set_id=reverted_by,
        reverts_change_set_id=reverts,
    )


# --------------------------------------------------------------------------- planner
def _value_item(session: Session, row: AuditLog, model_map: dict[str, type[Base]]) -> RevertItem:
    model = model_map[row.entity_type]
    obj = _load(session, model, row.entity_id)
    inventory = _is_inventory_identifier(obj, row)
    kind = RevertItemKind.CORRECT_INVENTORY_CODE if inventory else RevertItemKind.RESTORE_VALUE
    assert row.field is not None
    if obj is None:
        return RevertItem(
            kind=kind,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            source_action=row.action,
            field=row.field,
            target_value=row.old_value,
            description=f"No se puede restaurar «{row.field}»: el registro ya no existe.",
            applicable=False,
            conflict=RevertConflict(
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                field=row.field,
                reason=ConflictReason.ENTITY_MISSING,
                message="El registro afectado ya no existe en la base de datos.",
                expected_value=row.new_value,
            ),
        )
    current = to_audit_value(getattr(obj, row.field, None))
    conflict: RevertConflict | None = None
    if current != row.new_value:
        later = _later_change(session, row)
        conflict = RevertConflict(
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            field=row.field,
            reason=ConflictReason.CHANGED_AFTER,
            message=(
                f"El campo «{row.field}» cambió después de este conjunto de cambios; "
                "revertirlo descartará ese cambio posterior."
            ),
            expected_value=row.new_value,
            current_value=current,
            changed_by_id=later.user_id if later is not None else None,
            changed_at=later.occurred_at if later is not None else None,
        )
    return RevertItem(
        kind=kind,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        source_action=row.action,
        field=row.field,
        current_value=current,
        target_value=row.old_value,
        description=f"Restaurar «{row.field}» al valor anterior.",
        conflict=conflict,
    )


def _entity_item(
    session: Session,
    *,
    kind: RevertItemKind,
    entity_type: str,
    entity_id: uuid.UUID,
    source_action: AuditAction,
    model_map: dict[str, type[Base]],
) -> RevertItem:
    model = model_map[entity_type]
    obj = _load(session, model, entity_id)
    base = {
        "kind": kind,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "source_action": source_action,
    }
    if obj is None:
        return RevertItem(
            **base,
            description="El registro afectado ya no existe en la base de datos.",
            applicable=False,
            conflict=RevertConflict(
                entity_type=entity_type,
                entity_id=entity_id,
                field=None,
                reason=ConflictReason.ENTITY_MISSING,
                message="El registro afectado ya no existe en la base de datos.",
            ),
        )
    if not isinstance(obj, SoftDeleteMixin):
        return RevertItem(
            **base,
            description=(
                f"El registro de {entity_type} no admite eliminación lógica: no se puede "
                "deshacer su creación automáticamente."
            ),
            applicable=False,
            conflict=RevertConflict(
                entity_type=entity_type,
                entity_id=entity_id,
                field=None,
                reason=ConflictReason.NO_SOFT_DELETE,
                message=(
                    f"El registro de {entity_type} no admite eliminación lógica; "
                    "corríjalo desde su módulo."
                ),
            ),
        )
    deleted = obj.deleted_at is not None
    if kind is RevertItemKind.SOFT_DELETE_ENTITY and deleted:
        return RevertItem(
            **base,
            description="El registro ya está eliminado lógicamente.",
            applicable=False,
            conflict=RevertConflict(
                entity_type=entity_type,
                entity_id=entity_id,
                field=None,
                reason=ConflictReason.ALREADY_DELETED,
                message="El registro ya está eliminado lógicamente; no hay nada que deshacer.",
            ),
        )
    if kind is RevertItemKind.RESTORE_ENTITY and not deleted:
        return RevertItem(
            **base,
            description="El registro ya está activo.",
            applicable=False,
            conflict=RevertConflict(
                entity_type=entity_type,
                entity_id=entity_id,
                field=None,
                reason=ConflictReason.NOT_DELETED,
                message="El registro ya está activo; no hay nada que restaurar.",
            ),
        )
    description = (
        "Eliminar lógicamente el registro creado por este conjunto de cambios."
        if kind is RevertItemKind.SOFT_DELETE_ENTITY
        else "Restaurar el registro eliminado por este conjunto de cambios."
    )
    return RevertItem(**base, current_value=deleted, description=description)


def _plan_items(
    session: Session, rows: Sequence[AuditLog], model_map: dict[str, type[Base]]
) -> tuple[list[RevertItem], list[str]]:
    value_rows: list[AuditLog] = []
    # ``dict`` keeps the reverse order of the audit rows and removes the per-field duplicates.
    to_soft_delete: dict[tuple[str, uuid.UUID], AuditAction] = {}
    to_restore: dict[tuple[str, uuid.UUID], AuditAction] = {}
    append_only: dict[str, set[uuid.UUID]] = {}

    for row in rows:
        model = model_map.get(row.entity_type)
        if model is None:
            # A table that no longer exists in the model: reported, never guessed.
            append_only.setdefault(row.entity_type, set()).add(row.entity_id)
            continue
        if getattr(model, "__append_only__", False):
            append_only.setdefault(row.entity_type, set()).add(row.entity_id)
            continue
        key = (row.entity_type, row.entity_id)
        if row.action in (AuditAction.CREATE, AuditAction.RESTORE):
            to_soft_delete.setdefault(key, row.action)
        elif row.action is AuditAction.SOFT_DELETE:
            to_restore.setdefault(key, row.action)
        elif row.action in VALUE_ACTIONS and row.field is not None:
            value_rows.append(row)

    items: list[RevertItem] = []
    # Order of application: restore first, then field values, and soft-delete last, so the
    # referenced records exist while the values are restored.
    for (entity_type, entity_id), action in to_restore.items():
        items.append(
            _entity_item(
                session,
                kind=RevertItemKind.RESTORE_ENTITY,
                entity_type=entity_type,
                entity_id=entity_id,
                source_action=action,
                model_map=model_map,
            )
        )
    for row in value_rows:
        if (row.entity_type, row.entity_id) in to_soft_delete:
            # The record is going away as a whole; restoring its fields adds nothing.
            continue
        if (row.entity_type, row.field) == MOVEMENT_MAINTAINED_FIELD:
            # The current location mirrors the movement history, which is append-only: it is
            # corrected with a new movement, never by rewriting the field (design D1).
            movement = _movement_of(session, row)
            append_only.setdefault(PieceMovement.__tablename__, set()).add(
                movement.id if movement is not None else row.entity_id
            )
            continue
        items.append(_value_item(session, row, model_map))
    for (entity_type, entity_id), action in to_soft_delete.items():
        items.append(
            _entity_item(
                session,
                kind=RevertItemKind.SOFT_DELETE_ENTITY,
                entity_type=entity_type,
                entity_id=entity_id,
                source_action=action,
                model_map=model_map,
            )
        )

    notes: list[str] = []
    for entity_type, ids in sorted(append_only.items()):
        label = APPEND_ONLY_LABELS.get(entity_type, f"registros de {entity_type}")
        notes.append(APPEND_ONLY_NOTE.format(count=len(ids), label=label))
        items.append(
            RevertItem(
                kind=RevertItemKind.APPEND_ONLY_NOTE,
                entity_type=entity_type,
                entity_id=sorted(ids, key=str)[0],
                source_action=AuditAction.CREATE,
                description=APPEND_ONLY_NOTE.format(count=len(ids), label=label),
                applicable=False,
            )
        )
    return items, notes


def _fingerprint(change_set_id: uuid.UUID, items: Sequence[RevertItem]) -> str:
    payload = {
        "change_set_id": str(change_set_id),
        "items": sorted(
            (item.fingerprint() for item in items),
            key=lambda entry: (entry["entity_type"], entry["entity_id"], entry["field"] or ""),
        ),
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def plan_revert(session: Session, change_set_id: uuid.UUID) -> RevertPlan:
    """Build the preview of the reversal of ``change_set_id`` without writing anything."""
    model_map = _model_map()
    # The preview only reads: pending changes of the caller are never flushed by it.
    with session.no_autoflush:
        rows = load_change_set(session, change_set_id)
        summary = summarize_change_set(session, change_set_id)
        items, notes = _plan_items(session, rows, model_map)
        touches_inventory_code = any(
            item.kind is RevertItemKind.CORRECT_INVENTORY_CODE
            or (
                item.entity_type == PieceIdentifier.__tablename__
                and item.kind in (RevertItemKind.SOFT_DELETE_ENTITY, RevertItemKind.RESTORE_ENTITY)
                and _is_inventory_code_entity(session, item, model_map)
            )
            for item in items
        )
    permissions: list[str] = []
    origin_permission = PERMISSION_BY_ORIGIN.get(summary.origin)
    if origin_permission:
        permissions.append(origin_permission)
    if touches_inventory_code:
        permissions.append(INVENTORY_CODE_PERMISSION)
    return RevertPlan(
        summary=summary,
        items=tuple(items),
        notes=tuple(notes),
        required_permissions=tuple(permissions),
        # RN-002: an inventory code is only corrected by an Administrator, like the audited
        # correction procedure of `identification.service.correct_locked_identifier`.
        requires_admin=origin_permission is None or touches_inventory_code,
        touches_inventory_code=touches_inventory_code,
        preview_token=_fingerprint(change_set_id, items),
    )


def _is_inventory_code_entity(
    session: Session, item: RevertItem, model_map: dict[str, type[Base]]
) -> bool:
    model = model_map.get(item.entity_type)
    if model is None:
        return False
    obj = _load(session, model, item.entity_id)
    return isinstance(obj, PieceIdentifier) and (
        bool(obj.is_locked) or obj.identifier_type_code == TYPE_INVENTORY
    )


# --------------------------------------------------------------------------- permissions
def _user_permissions(session: Session, user_id: uuid.UUID) -> frozenset[str]:
    """Effective permission codes of a user (same query as ``app.api.deps.load_permissions``,
    repeated here so the domain layer does not depend on the API layer)."""
    return frozenset(
        session.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id, Role.is_enabled.is_(True))
        )
    )


def check_revert_permissions(
    session: Session,
    plan: RevertPlan,
    ctx: AuditContext,
    *,
    permissions: frozenset[str] | None = None,
) -> None:
    """Enforce the permissions of design D1 ([SUPUESTO B7]) and RN-002."""
    if ctx.user_id is None:
        raise PermissionDenied(
            "Una reversión debe realizarla una persona identificada.",
            code="user_required",
        )
    granted = _user_permissions(session, ctx.user_id) if permissions is None else permissions
    missing = [code for code in plan.required_permissions if code not in granted]
    if missing:
        raise PermissionDenied(
            "Su rol no tiene el permiso necesario para revertir este conjunto de cambios "
            f"({', '.join(missing)}).",
            details={"permissions": missing, "origin": str(plan.summary.origin)},
        )
    if plan.requires_admin and not user_has_role(session, ctx.user_id, ADMIN_ROLE):
        message = (
            "Esta reversión afecta un código I: se requiere el procedimiento de corrección "
            "de un Administrador (RN-002)."
            if plan.touches_inventory_code
            else "Solo un Administrador puede revertir un conjunto de cambios de este origen."
        )
        raise PermissionDenied(message, code="admin_required")


# --------------------------------------------------------------------------- applier
@contextmanager
def _capture_change_sets(session: Session) -> Iterator[list[uuid.UUID]]:
    """Collect the ``change_set_id`` that the audit tracking assigns to the next flush."""
    captured: list[uuid.UUID] = []

    def listener(flushed: Session, _flush_context: object) -> None:
        for obj in flushed.new:
            if isinstance(obj, AuditLog) and obj.change_set_id not in captured:
                captured.append(obj.change_set_id)

    event.listen(session, "after_flush", listener)
    try:
        yield captured
    finally:
        event.remove(session, "after_flush", listener)


def _apply(
    session: Session,
    item: RevertItem,
    model_map: dict[str, type[Base]],
    ctx: AuditContext,
    reason: str,
) -> bool:
    model = model_map[item.entity_type]
    obj = _load(session, model, item.entity_id)
    if obj is None:  # pragma: no cover - the planner already reports it as a conflict
        return False
    if item.restores_value:
        assert item.field is not None
        column = _column(model, item.field)
        if column is None:  # pragma: no cover - the field is no longer mapped
            return False
        setattr(obj, item.field, _coerce(column, item.target_value))
        return True
    if not isinstance(obj, SoftDeleteMixin):  # pragma: no cover - reported by the planner
        return False
    if item.kind is RevertItemKind.RESTORE_ENTITY:
        obj.deleted_at = None
        obj.deleted_by_id = None
        obj.deletion_reason = None
        return True
    if item.kind is RevertItemKind.SOFT_DELETE_ENTITY:
        obj.deleted_at = utcnow()
        obj.deleted_by_id = ctx.user_id
        obj.deletion_reason = reason
        return True
    return False


def revert_change_set(
    session: Session,
    change_set_id: uuid.UUID,
    ctx: AuditContext,
    *,
    confirm_conflicts: bool,
    preview_token: str | None = None,
    permissions: frozenset[str] | None = None,
) -> RevertOutcome:
    """Revert a change set in a single transaction, as a new change set of type ``REVERT``.

    ``preview_token`` is the fingerprint returned by :func:`plan_revert`; when it no longer
    matches the data the reversal is rejected with ``revert_plan_changed``. Conflicts with later
    changes are only applied when ``confirm_conflicts`` is true, so nothing is overwritten
    silently (design D1). The caller owns the transaction: this function flushes but does not
    commit.
    """
    reason = (ctx.reason or "").strip()
    if not reason:
        raise ValidationFailed("Indique el motivo de la reversión.", code="reason_required")
    plan = plan_revert(session, change_set_id)
    if plan.summary.reverted:
        raise AlreadyReverted(
            "Este conjunto de cambios ya fue revertido; puede revertir la reversión.",
            details={"reverted_by_change_set_id": str(plan.summary.reverted_by_change_set_id)},
        )
    check_revert_permissions(session, plan, ctx, permissions=permissions)
    if preview_token is not None and preview_token != plan.preview_token:
        raise RevertPlanChanged(
            "Los datos cambiaron después de la vista previa: genere una vista previa nueva "
            "y revise los cambios antes de confirmar.",
            details={"preview_token": plan.preview_token},
        )
    conflicts = list(plan.conflicts)
    if conflicts and not confirm_conflicts:
        raise RevertHasConflicts(
            "Hay cambios posteriores en conflicto: confírmelos explícitamente para revertirlos.",
            details={"conflicts": [conflict.as_dict() for conflict in conflicts]},
        )
    to_apply = [
        item for item in plan.applicable_items if item.conflict is None or confirm_conflicts
    ]
    if not to_apply:
        raise NothingToRevert(
            "No hay nada que revertir en este conjunto de cambios.",
            details={"notes": list(plan.notes)},
        )

    model_map = _model_map()
    revert_ctx = replace(
        ctx,
        action=AuditAction.REVERT,
        origin_ref=str(change_set_id),
        reason=reason,
        # RN-002: permissions were already verified, so the flush guard of the identification
        # module lets the reversal restore a locked identifier as an audited correction.
        allow_inventory_code_correction=plan.touches_inventory_code,
    )
    outcome = RevertOutcome(
        reverted_change_set_id=change_set_id,
        new_change_set_id=change_set_id,
        reverted_fields=0,
        conflicts=conflicts,
        notes=list(plan.notes),
    )
    with audit_context(session, revert_ctx), _capture_change_sets(session) as captured:
        # No autoflush while the plan is applied: a single flush at the end keeps the whole
        # reversal inside one change set.
        with session.no_autoflush:
            for item in to_apply:
                if not _apply(session, item, model_map, revert_ctx, reason):
                    continue
                if item.restores_value:
                    outcome.reverted_fields += 1
                elif item.kind is RevertItemKind.RESTORE_ENTITY:
                    outcome.restored_entities += 1
                else:
                    outcome.deleted_entities += 1
        session.flush()
    if not captured:  # pragma: no cover - a flush that writes nothing produces no audit rows
        raise NothingToRevert(
            "No hay nada que revertir en este conjunto de cambios.",
            details={"notes": list(plan.notes)},
        )
    outcome.new_change_set_id = captured[0]
    return outcome
