"""Append-only field-level audit log (spec auditoria-trazabilidad; RF-040, RNF-007)."""

import enum
import uuid
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import Base, JsonType, UUIDPrimaryKeyMixin, str_enum, utcnow


class AuditAction(enum.StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    SOFT_DELETE = "SOFT_DELETE"
    RESTORE = "RESTORE"
    CORRECTION = "CORRECTION"
    MERGE = "MERGE"
    REVERT = "REVERT"


class AuditOrigin(enum.StrEnum):
    MANUAL = "MANUAL"
    IMPORT = "IMPORT"
    AI = "AI"
    SYSTEM = "SYSTEM"


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_log"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    occurred_at: Mapped[datetime] = mapped_column(default=utcnow)
    change_set_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    field: Mapped[str | None] = mapped_column(String(100))
    old_value: Mapped[Any | None] = mapped_column(JsonType)
    new_value: Mapped[Any | None] = mapped_column(JsonType)
    action: Mapped[AuditAction] = mapped_column(str_enum(AuditAction, "audit_action"))
    origin: Mapped[AuditOrigin] = mapped_column(str_enum(AuditOrigin, "audit_origin"))
    # Reference to the import batch or AI suggestion that originated the change.
    origin_ref: Mapped[str | None] = mapped_column(String(100))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"), index=True)
    # Process name when the change is made by the system (e.g. "seed").
    actor_label: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_audit_log_entity", "entity_type", "entity_id", "occurred_at"),)
