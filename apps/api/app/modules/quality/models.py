"""Duplicate candidates reviewed by humans (spec calidad-datos; RF-030)."""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, ClassVar

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import expression

from app.core.models_base import Base, JsonType, TimestampMixin, UUIDPrimaryKeyMixin, str_enum


class DuplicateStatus(enum.StrEnum):
    PENDING = "PENDING"
    MERGED = "MERGED"
    DISTINCT = "DISTINCT"
    POSTPONED = "POSTPONED"
    # The pair involved a piece that was merged into another one (design D4, step 6).
    SUPERSEDED = "SUPERSEDED"


class QualityJobType(enum.StrEnum):
    FULL_SCAN = "FULL_SCAN"


class QualityJobStatus(enum.StrEnum):
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class QualityJobItemReason(enum.StrEnum):
    PIECE_CREATED = "PIECE_CREATED"
    PIECE_UPDATED = "PIECE_UPDATED"
    IDENTIFIER_CHANGED = "IDENTIFIER_CHANGED"


class QualityJobItemStatus(enum.StrEnum):
    PENDING = "PENDING"
    DONE = "DONE"
    FAILED = "FAILED"


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
    # A POSTPONED pair returns to PENDING on the first queue read after this date (design D5).
    postponed_until: Mapped[datetime | None] = mapped_column()
    # Both pieces hold different current inventory codes: the merge is blocked (design D1).
    blocking_conflict: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=expression.false()
    )
    # Change set of the merge that resolved the pair, so it can be reverted (design D4).
    change_set_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)

    __table_args__ = (
        CheckConstraint(
            "(piece_b_id IS NOT NULL) <> (import_row_id IS NOT NULL)", name="one_counterpart"
        ),
        CheckConstraint("score >= 0 AND score <= 1", name="score_range"),
        CheckConstraint(
            "status = 'PENDING' OR reviewed_by_id IS NOT NULL", name="review_requires_reviewer"
        ),
    )


class QualitySetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tunable detection parameters (weights and threshold), audited like any other change.

    One row per key; ``value`` holds the JSON document read by ``quality.scoring``. Missing keys
    fall back to the defaults in code, so an empty table is a valid configuration.
    """

    __tablename__ = "quality_setting"

    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[dict[str, Any]] = mapped_column(JsonType)
    description: Mapped[str | None] = mapped_column(Text)


class QualityJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A full duplicate scan run in the background (design D3): state, progress and duration."""

    __tablename__ = "quality_job"
    __audited__: ClassVar[bool] = False

    job_type: Mapped[QualityJobType] = mapped_column(str_enum(QualityJobType, "quality_job_type"))
    status: Mapped[QualityJobStatus] = mapped_column(
        str_enum(QualityJobStatus, "quality_job_status"), default=QualityJobStatus.RUNNING
    )
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    started_at: Mapped[datetime | None] = mapped_column()
    heartbeat_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()
    total_pieces: Mapped[int] = mapped_column(Integer, default=0)
    processed_pieces: Mapped[int] = mapped_column(Integer, default=0)
    pairs_evaluated: Mapped[int] = mapped_column(Integer, default=0)
    candidates_created: Mapped[int] = mapped_column(Integer, default=0)
    candidates_reopened: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)


class QualityJobItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A piece queued for incremental detection after it was created or edited (design D3)."""

    __tablename__ = "quality_job_item"
    __audited__: ClassVar[bool] = False

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    reason: Mapped[QualityJobItemReason] = mapped_column(
        str_enum(QualityJobItemReason, "quality_job_item_reason")
    )
    status: Mapped[QualityJobItemStatus] = mapped_column(
        str_enum(QualityJobItemStatus, "quality_job_item_status"),
        default=QualityJobItemStatus.PENDING,
        index=True,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column()


class CompletenessFieldKind(enum.StrEnum):
    REQUIRED = "REQUIRED"
    RECOMMENDED = "RECOMMENDED"


class CompletenessRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Which `piece` fields count as required/recommended for completeness alerts (design D2).

    `field` is validated against `quality.completeness.FIELD_WHITELIST`, never free text (spec
    calidad-datos, escenario "Campo inexistente en la regla"). Audited like any other change.
    """

    __tablename__ = "completeness_rule"

    field: Mapped[str] = mapped_column(String(80), unique=True)
    kind: Mapped[CompletenessFieldKind] = mapped_column(
        str_enum(CompletenessFieldKind, "completeness_field_kind")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CompletenessSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Daily instantaneous of a completeness indicator, global or per collection (design D5).

    System-generated by `python -m app.quality.snapshot`; a rerun the same day replaces the
    snapshot of that day (idempotent), never appends a second one (spec calidad-datos, escenario
    "Instantánea repetida").
    """

    __tablename__ = "completeness_snapshot"
    __audited__: ClassVar[bool] = False

    taken_on: Mapped[date] = mapped_column(index=True)
    collection_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("collection.id"))
    alert_code: Mapped[str] = mapped_column(String(40))
    numerator: Mapped[int] = mapped_column(Integer)
    denominator: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        Index(
            "uq_completeness_snapshot_global",
            "taken_on",
            "alert_code",
            unique=True,
            postgresql_where=text("collection_id IS NULL"),
            sqlite_where=text("collection_id IS NULL"),
        ),
        Index(
            "uq_completeness_snapshot_collection",
            "taken_on",
            "collection_id",
            "alert_code",
            unique=True,
            postgresql_where=text("collection_id IS NOT NULL"),
            sqlite_where=text("collection_id IS NOT NULL"),
        ),
    )
