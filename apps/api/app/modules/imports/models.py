"""Import reconciliation pipeline tables (spec importacion-datos; RF-021, RF-022, RF-025..028).

Only the data model lives here; the executable pipeline is implemented in a later change.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import (
    Base,
    JsonType,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)


class ImportBatchStatus(enum.StrEnum):
    UPLOADED = "UPLOADED"
    FAILED_INGESTION = "FAILED_INGESTION"
    MAPPED = "MAPPED"
    VALIDATED = "VALIDATED"
    IN_PREVIEW = "IN_PREVIEW"
    APPROVED = "APPROVED"
    APPLIED = "APPLIED"
    FAILED_APPLY = "FAILED_APPLY"
    ABANDONED = "ABANDONED"
    REVERTED = "REVERTED"


class RowClassification(enum.StrEnum):
    NEW = "NEW"
    UPDATE = "UPDATE"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    CONFLICT = "CONFLICT"


class RowDecision(enum.StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXCLUDED = "EXCLUDED"
    REJECTED = "REJECTED"


class ImportMappingTemplate(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "import_mapping_template"

    name: Mapped[str] = mapped_column(String(200))
    source_name: Mapped[str] = mapped_column(String(200))
    # Normalized, sorted header list used to suggest the template for a new file.
    header_signature: Mapped[str] = mapped_column(String(64), index=True)
    # {source column: {"target": field | "identifier:<TYPE>" | "payload", "transform": ...}}
    mapping: Mapped[dict[str, Any]] = mapped_column(JsonType)
    description: Mapped[str | None] = mapped_column(Text)


class ImportBatch(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "import_batch"

    source_name: Mapped[str] = mapped_column(String(200))
    file_name: Mapped[str] = mapped_column(String(300))
    file_storage_key: Mapped[str | None] = mapped_column(String(500))
    file_sha256: Mapped[str | None] = mapped_column(String(64))
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_mapping_template.id"))
    status: Mapped[ImportBatchStatus] = mapped_column(
        str_enum(ImportBatchStatus, "import_batch_status"), default=ImportBatchStatus.UPLOADED
    )
    status_reason: Mapped[str | None] = mapped_column(Text)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    approved_at: Mapped[datetime | None] = mapped_column()
    # {stage: ISO timestamp} and {classification: count} for the load log (RF-028).
    stage_timestamps: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    counts: Mapped[dict[str, Any] | None] = mapped_column(JsonType)


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "import_row"

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batch.id"), index=True)
    source_row_number: Mapped[int] = mapped_column()
    raw_data: Mapped[dict[str, Any]] = mapped_column(JsonType)
    mapped_data: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    classification: Mapped[RowClassification | None] = mapped_column(
        str_enum(RowClassification, "row_classification")
    )
    has_validation_errors: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_errors: Mapped[list[Any] | None] = mapped_column(JsonType)
    # Matches per identifier and contradictions (RF-024).
    matches: Mapped[list[Any] | None] = mapped_column(JsonType)
    # Field-level diff for updates, including excluded fields (RF-026).
    diff: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    decision: Mapped[RowDecision] = mapped_column(
        str_enum(RowDecision, "row_decision"), default=RowDecision.PENDING
    )
    decision_reason: Mapped[str | None] = mapped_column(Text)
    target_piece_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"))

    __table_args__ = (
        UniqueConstraint("batch_id", "source_row_number"),
        Index("ix_import_row_batch_classification", "batch_id", "classification"),
    )
