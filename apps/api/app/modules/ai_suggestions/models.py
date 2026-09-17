"""AI suggestions pending human approval (spec ia-asistiva; RN-009, RIA-01..05)."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import Base, JsonType, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class AiFunction(enum.StrEnum):
    RIA_01_EXTRACT_STRUCTURED = "RIA_01"
    RIA_02_DUPLICATE_SUPPORT = "RIA_02"
    RIA_03_SUGGEST_TERMS = "RIA_03"
    RIA_04_DESCRIBE = "RIA_04"
    RIA_05_CATALOG_ASSISTANT = "RIA_05"


class SuggestionStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    REJECTED = "REJECTED"


class AiSuggestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_suggestion"

    function_code: Mapped[AiFunction] = mapped_column(str_enum(AiFunction, "ai_function"))
    status: Mapped[SuggestionStatus] = mapped_column(
        str_enum(SuggestionStatus, "suggestion_status"), default=SuggestionStatus.PENDING
    )
    provider: Mapped[str] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(120))
    piece_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"), index=True)
    import_batch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_batch.id"))
    input_data: Mapped[dict[str, Any]] = mapped_column(JsonType)
    output_data: Mapped[dict[str, Any]] = mapped_column(JsonType)
    # What the reviewer actually accepted (possibly edited or partial).
    approved_data: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column()
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        # RN-009 enforced by the database: no decision without a human reviewer.
        CheckConstraint(
            "status = 'PENDING' OR (reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL)",
            name="decision_requires_reviewer",
        ),
        CheckConstraint(
            "status <> 'REJECTED' OR rejection_reason IS NOT NULL",
            name="rejection_requires_reason",
        ),
        CheckConstraint(
            "status NOT IN ('APPROVED', 'PARTIALLY_APPROVED') OR approved_data IS NOT NULL",
            name="approval_requires_data",
        ),
    )
