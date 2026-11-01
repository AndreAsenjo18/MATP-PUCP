"""Media assets. Files live in S3-compatible storage; only metadata is stored (RF-013, RF-014)."""

import enum
import uuid
from datetime import date, datetime
from typing import Any, ClassVar

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import (
    Base,
    JsonType,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)


class MediaAsset(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "media_asset"

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    original_filename: Mapped[str | None] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_sha256: Mapped[str] = mapped_column(String(64))
    width_px: Mapped[int | None] = mapped_column()
    height_px: Mapped[int | None] = mapped_column()
    view_type_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    sort_order: Mapped[int] = mapped_column(default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    photographer: Mapped[str | None] = mapped_column(String(200))
    taken_on: Mapped[date | None] = mapped_column(Date)
    # Usage/publication restriction (term of USAGE_RESTRICTION vocabulary, RN-008).
    usage_restriction_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    restriction_note: Mapped[str | None] = mapped_column(Text)
    extra_metadata: Mapped[dict[str, Any] | None] = mapped_column(JsonType)

    __table_args__ = (Index("ix_media_asset_piece_hash", "piece_id", "content_sha256"),)


class BulkDownloadStatus(enum.StrEnum):
    """Life of a photo package (descargas-masivas-y-enriquecimiento-lote, design D1)."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    READY = "READY"
    FAILED = "FAILED"


class MediaBulkDownload(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A ZIP with the photos of a group of pieces, built in the background (design D1, D2).

    The photos whose effective restriction forbids the download stay out, with their restriction,
    in ``omitted`` (D3, RN-008). An expired package keeps its row; only its file stops being
    served. Only the person who asked for it can see it.
    """

    __tablename__ = "media_bulk_download"
    # The heartbeat moves every few seconds while the package is built: it is never audited.
    __audit_exclude__: ClassVar[frozenset[str]] = frozenset(
        {"created_at", "updated_at", "heartbeat_at"}
    )

    requested_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    piece_ids: Mapped[list[Any]] = mapped_column(JsonType)
    status: Mapped[BulkDownloadStatus] = mapped_column(
        str_enum(BulkDownloadStatus, "media_bulk_download_status"),
        default=BulkDownloadStatus.PENDING,
        index=True,
    )
    included_photos: Mapped[int | None] = mapped_column(Integer)
    omitted: Mapped[list[Any]] = mapped_column(JsonType, default=list)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    expires_at: Mapped[datetime | None] = mapped_column()
    error: Mapped[str | None] = mapped_column(Text)
    heartbeat_at: Mapped[datetime | None] = mapped_column()
