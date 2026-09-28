"""Automatic soft-delete filtering, physical-delete blocking and field-level auditing.

These hooks are installed on the SQLAlchemy ``Session`` class, so they apply to every
session created by the application, independently of which endpoint or service performs
the write (spec auditoria-trazabilidad: "Ninguna escritura sin contexto de auditoría").
"""

import uuid
from collections.abc import Callable
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.core.errors import AppendOnlyViolation, PhysicalDeleteForbidden
from app.core.models_base import Base, SoftDeleteMixin, new_uuid, to_audit_value, utcnow
from app.modules.audit.context import AuditContext, require_audit_context
from app.modules.audit.models import AuditAction, AuditLog

# Extra validations executed before each flush (e.g. inventory code immutability).
FlushGuard = Callable[[Session, AuditContext | None], None]
_flush_guards: list[FlushGuard] = []
_installed = False

INCLUDE_DELETED = "include_deleted"


def register_flush_guard(guard: FlushGuard) -> FlushGuard:
    if guard not in _flush_guards:
        _flush_guards.append(guard)
    return guard


def column_changes(obj: Base) -> dict[str, tuple[Any, Any]]:
    """Return {column: (old, new)} for mapped columns whose value really changed."""
    state = inspect(obj)
    changes: dict[str, tuple[Any, Any]] = {}
    for attr in state.mapper.column_attrs:
        history = state.attrs[attr.key].history
        if not history.has_changes():
            continue
        old = history.deleted[0] if history.deleted else None
        new = history.added[0] if history.added else None
        if old != new:
            changes[attr.key] = (old, new)
    return changes


def _entity_type(obj: Base) -> str:
    return obj.__tablename__  # type: ignore[attr-defined,no-any-return]


def _audit_entries(
    obj: Base, context: AuditContext, change_set_id: uuid.UUID, *, is_new: bool
) -> list[AuditLog]:
    excluded = obj.__audit_exclude__
    entries: list[AuditLog] = []

    def entry(field: str | None, old: Any, new: Any, action: AuditAction) -> AuditLog:
        return AuditLog(
            id=new_uuid(),
            occurred_at=utcnow(),
            change_set_id=change_set_id,
            entity_type=_entity_type(obj),
            entity_id=obj.id,  # type: ignore[attr-defined]
            field=field,
            old_value=to_audit_value(old),
            new_value=to_audit_value(new),
            action=action,
            origin=context.origin,
            origin_ref=context.origin_ref,
            user_id=context.user_id,
            actor_label=context.actor_label,
            reason=context.reason,
        )

    if is_new:
        state = inspect(obj)
        for attr in state.mapper.column_attrs:
            if attr.key in excluded:
                continue
            value = getattr(obj, attr.key)
            if value is not None:
                entries.append(entry(attr.key, None, value, AuditAction.CREATE))
        return entries

    changes = column_changes(obj)
    action = context.action or AuditAction.UPDATE
    if "deleted_at" in changes:
        old_deleted, new_deleted = changes["deleted_at"]
        if new_deleted is not None and old_deleted is None:
            action = AuditAction.SOFT_DELETE
        elif new_deleted is None and old_deleted is not None:
            action = AuditAction.RESTORE
    for field, (old, new) in changes.items():
        if field not in excluded:
            entries.append(entry(field, old, new, action))
    return entries


def _before_flush(session: Session, _flush_context: object, _instances: object) -> None:
    for obj in session.deleted:
        if isinstance(obj, SoftDeleteMixin) or getattr(obj, "__append_only__", False):
            raise PhysicalDeleteForbidden(
                "No se permite el borrado físico de información: use la eliminación lógica "
                "con motivo (RN-005)."
            )

    for obj in session.dirty:
        if getattr(obj, "__append_only__", False) and column_changes(obj):
            raise AppendOnlyViolation(
                f"Los registros de {_entity_type(obj)} no se pueden modificar; "
                "registre un movimiento o corrección nueva."
            )

    context = session.info.get("matp.audit_context")
    for guard in _flush_guards:
        guard(session, context)

    audited_new = [obj for obj in session.new if isinstance(obj, Base) and obj.__audited__]
    audited_dirty = [
        obj
        for obj in session.dirty
        if isinstance(obj, Base) and obj.__audited__ and column_changes(obj)
    ]
    append_only_new = [obj for obj in session.new if isinstance(obj, Base) and obj.__append_only__]
    if not (audited_new or audited_dirty or append_only_new):
        return

    context = require_audit_context(session)
    change_set_id = new_uuid()
    entries: list[AuditLog] = []
    for obj in audited_new:
        if getattr(obj, "id", None) is None:
            obj.id = new_uuid()  # type: ignore[attr-defined]
        entries.extend(_audit_entries(obj, context, change_set_id, is_new=True))
    for obj in audited_dirty:
        entries.extend(_audit_entries(obj, context, change_set_id, is_new=False))
    session.add_all(entries)


def _filter_soft_deleted(execute_state: ORMExecuteState) -> None:
    if (
        execute_state.is_select
        and not execute_state.is_column_load
        and not execute_state.is_relationship_load
        and not execute_state.execution_options.get(INCLUDE_DELETED, False)
    ):
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                SoftDeleteMixin,
                lambda cls: cls.deleted_at.is_(None),
                include_aliases=True,
            )
        )


def install_persistence_hooks() -> None:
    """Idempotently register the session-level hooks."""
    global _installed
    if _installed:
        return
    event.listen(Session, "before_flush", _before_flush)
    event.listen(Session, "do_orm_execute", _filter_soft_deleted)
    _installed = True
