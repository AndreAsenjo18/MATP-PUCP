"""Hierarchical locations and movement history (spec ubicacion-movimientos; RF-016, RF-017)."""

import enum
import uuid
from datetime import datetime
from typing import ClassVar

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
    utcnow,
)


class LocationLevel(enum.StrEnum):
    """[SUPUESTO] sede -> espacio -> mueble/rack -> nivel -> contenedor."""

    SITE = "SITE"
    SPACE = "SPACE"
    FURNITURE = "FURNITURE"
    SHELF_LEVEL = "SHELF_LEVEL"
    CONTAINER = "CONTAINER"


class MovementType(enum.StrEnum):
    MOVE = "MOVE"
    VERIFICATION = "VERIFICATION"  # physical check without location change
    CORRECTION = "CORRECTION"  # corrective movement (history is never edited)


class Location(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "location"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("location.id"), index=True)
    level: Mapped[LocationLevel] = mapped_column(str_enum(LocationLevel, "location_level"))
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PieceMovement(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "piece_movement"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    movement_type: Mapped[MovementType] = mapped_column(str_enum(MovementType, "movement_type"))
    from_location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("location.id"))
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("location.id"))
    reason: Mapped[str | None] = mapped_column(Text)
    performed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    performed_by_label: Mapped[str | None] = mapped_column(String(200))
    occurred_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
