"""Media assets. Files live in S3-compatible storage; only metadata is stored (RF-013, RF-014)."""

import uuid
from datetime import date
from typing import Any

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import (
    Base,
    JsonType,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
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
