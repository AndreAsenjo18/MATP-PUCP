"""Database models for export jobs and tracking (RF-036, RF-044, design D3)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import Base, JsonType, TimestampMixin, UUIDPrimaryKeyMixin, str_enum
from app.modules.users.models import AppUser


class ExportJobStatus(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    READY = "READY"
    FAILED = "FAILED"


class ExportJobKind(enum.StrEnum):
    RESULTS = "results"
    FULL = "full"
    REPORT = "report"


class ExportJobModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An asynchronous or large export job (RF-036, RF-044)."""

    __tablename__ = "export_job"
    __audited__: ClassVar[bool] = False

    kind: Mapped[ExportJobKind] = mapped_column(str_enum(ExportJobKind, "export_job_kind"))
    requested_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    format: Mapped[str] = mapped_column(String(20), default="xlsx")
    params: Mapped[dict[str, Any]] = mapped_column(JsonType)
    status: Mapped[ExportJobStatus] = mapped_column(
        str_enum(ExportJobStatus, "export_job_status"),
        default=ExportJobStatus.PENDING,
        index=True,
    )
    row_count: Mapped[int | None] = mapped_column(Integer)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    sha256: Mapped[str | None] = mapped_column(String(64))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    masked_fields: Mapped[list[str]] = mapped_column(JsonType, default=list)

    requested_by: Mapped[AppUser] = relationship()
