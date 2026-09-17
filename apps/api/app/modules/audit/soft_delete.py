"""Logical deletion and restoration (spec auditoria-trazabilidad: sin borrado físico)."""

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, PermissionDenied, ValidationFailed
from app.core.models_base import SoftDeleteMixin, utcnow
from app.modules.audit.context import refined_context, require_audit_context
from app.modules.users.service import ADMIN_ROLE, user_has_role


def soft_delete(session: Session, obj: SoftDeleteMixin, reason: str | None) -> None:
    context = require_audit_context(session)
    if not reason or not reason.strip():
        raise ValidationFailed("Indique el motivo de la eliminación.", code="reason_required")
    if obj.deleted_at is not None:
        raise BusinessRuleViolation("El registro ya está eliminado.", code="already_deleted")
    obj.deleted_at = utcnow()
    obj.deleted_by_id = context.user_id
    obj.deletion_reason = reason.strip()
    with refined_context(session, reason=reason.strip()):
        session.flush()


def restore(session: Session, obj: SoftDeleteMixin, reason: str | None = None) -> None:
    context = require_audit_context(session)
    if context.user_id is None or not user_has_role(session, context.user_id, ADMIN_ROLE):
        raise PermissionDenied(
            "Solo un Administrador puede restaurar registros eliminados.", code="admin_required"
        )
    if obj.deleted_at is None:
        raise BusinessRuleViolation("El registro no está eliminado.", code="not_deleted")
    obj.deleted_at = None
    obj.deleted_by_id = None
    obj.deletion_reason = None
    with refined_context(session, reason=reason):
        session.flush()
