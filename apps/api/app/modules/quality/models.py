"""Duplicate candidates reviewed by humans (spec calidad-datos; RF-030)."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import Base, JsonType, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class DuplicateStatus(enum.StrEnum):
    PENDING = "PENDING"
    MERGED = "MERGED"
    DISTINCT = "DISTINCT"
    POSTPONED = "POSTPONED"


class DuplicateCandidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "duplicate_candidate"

    piece_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    # Either another piece or an import row is compared with piece A.
    piece_b_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"), index=True)
    import_row_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_row.id"))
    score: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    # [{"field": "title", "similarity": 0.93}, {"field": "identifier:COLLECTION", ...}]
    matched_fields: Mapped[list[Any]] = mapped_column(JsonType)
    status: Mapped[DuplicateStatus] = mapped_column(
        str_enum(DuplicateStatus, "duplicate_status"), default=DuplicateStatus.PENDING
    )
    # Hash of compared data: a DISTINCT pair is proposed again only if the data changes.
    compared_fingerprint: Mapped[str | None] = mapped_column(String(64))
    detected_by: Mapped[str] = mapped_column(String(40), default="rules")
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column()
    resolution_note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "(piece_b_id IS NOT NULL) <> (import_row_id IS NOT NULL)", name="one_counterpart"
        ),
        CheckConstraint("score >= 0 AND score <= 1", name="score_range"),
        CheckConstraint(
            "status = 'PENDING' OR reviewed_by_id IS NOT NULL", name="review_requires_reviewer"
        ),
    )
