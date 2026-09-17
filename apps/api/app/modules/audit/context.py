"""Audit context attached to a SQLAlchemy session: who writes, from where and why."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, replace

from sqlalchemy.orm import Session

from app.core.errors import MissingAuditContext
from app.modules.audit.models import AuditAction, AuditOrigin

SESSION_KEY = "matp.audit_context"


@dataclass(frozen=True)
class AuditContext:
    origin: AuditOrigin
    user_id: uuid.UUID | None = None
    actor_label: str | None = None
    origin_ref: str | None = None
    reason: str | None = None
    # Forces the action recorded for updates (e.g. CORRECTION, MERGE, REVERT).
    action: AuditAction | None = None
    # Enables the audited correction procedure of an inventory code (RN-002).
    allow_inventory_code_correction: bool = False

    def __post_init__(self) -> None:
        if self.user_id is None and not (self.origin is AuditOrigin.SYSTEM and self.actor_label):
            raise MissingAuditContext(
                "Toda escritura debe indicar el usuario responsable "
                "(o, para procesos del sistema, el nombre del proceso)."
            )
        if self.origin in (AuditOrigin.IMPORT, AuditOrigin.AI) and not self.origin_ref:
            raise MissingAuditContext(
                "Los cambios por importación o IA deben referenciar el lote o la sugerencia."
            )


def get_audit_context(session: Session) -> AuditContext | None:
    return session.info.get(SESSION_KEY)


def require_audit_context(session: Session) -> AuditContext:
    context = get_audit_context(session)
    if context is None:
        raise MissingAuditContext(
            "Operación rechazada: no se indicó usuario ni origen del cambio "
            "(contexto de auditoría)."
        )
    return context


def set_audit_context(session: Session, context: AuditContext | None) -> None:
    if context is None:
        session.info.pop(SESSION_KEY, None)
    else:
        session.info[SESSION_KEY] = context


@contextmanager
def audit_context(session: Session, context: AuditContext) -> Iterator[AuditContext]:
    """Temporarily set (or refine) the audit context of a session."""
    previous = get_audit_context(session)
    set_audit_context(session, context)
    try:
        yield context
    finally:
        set_audit_context(session, previous)


@contextmanager
def refined_context(session: Session, **changes: object) -> Iterator[AuditContext]:
    """Derive a context from the current one (e.g. adding a reason or a forced action)."""
    current = require_audit_context(session)
    with audit_context(session, replace(current, **changes)) as context:
        yield context
