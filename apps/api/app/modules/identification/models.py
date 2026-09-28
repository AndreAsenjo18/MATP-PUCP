"""Identifier types and external identifiers of pieces (spec identificacion-piezas)."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
    utcnow,
)

if TYPE_CHECKING:
    from app.modules.catalog.models import Piece

INVENTORY_CODE_TYPE = "I"


class NormalizationRule(enum.StrEnum):
    INVENTORY = "INVENTORY"  # código I
    COLLECTION = "COLLECTION"  # sigla + correlativo
    INC_RN = "INC_RN"  # Ministerio de Cultura / Registro Nacional
    GENERIC = "GENERIC"


class NormalizationStatus(enum.StrEnum):
    NORMALIZED = "NORMALIZED"
    UNPARSEABLE = "UNPARSEABLE"  # kept for human review, never discarded


class IdentifierType(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Parametrizable identifier type (RN-010).

    ``code`` is a stable system code, not a museum code.
    """

    __tablename__ = "identifier_type"

    code: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    normalization_rule: Mapped[NormalizationRule] = mapped_column(
        str_enum(NormalizationRule, "normalization_rule"), default=NormalizationRule.GENERIC
    )
    # I: unique among current identifiers, locked once assigned, only for owned pieces.
    is_unique_when_current: Mapped[bool] = mapped_column(Boolean, default=False)
    locks_on_assignment: Mapped[bool] = mapped_column(Boolean, default=False)
    owned_pieces_only: Mapped[bool] = mapped_column(Boolean, default=False)
    # Temporary loans get neither I nor collection code (RN-004).
    allowed_for_temporary_loan: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PieceIdentifier(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """External identifier of a piece (1:N). Historical values are kept as not current."""

    __tablename__ = "piece_identifier"

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    identifier_type_code: Mapped[str] = mapped_column(
        ForeignKey("identifier_type.code"), index=True
    )
    original_value: Mapped[str] = mapped_column(Text)
    normalized_value: Mapped[str | None] = mapped_column(String(200))
    normalization_status: Mapped[NormalizationStatus] = mapped_column(
        str_enum(NormalizationStatus, "normalization_status")
    )
    detected_format: Mapped[str | None] = mapped_column(String(40))
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str | None] = mapped_column(String(200))
    recorded_at: Mapped[datetime] = mapped_column(default=utcnow)
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece_identifier.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    piece: Mapped["Piece"] = relationship(back_populates="identifiers")

    __table_args__ = (
        Index("ix_piece_identifier_normalized_value", "normalized_value"),
        # RN-002: one current inventory code value across all non-deleted identifiers.
        # Identifiers of soft-deleted pieces stay active, so their I is never reused silently.
        Index(
            "uq_piece_identifier_current_inventory_code",
            "normalized_value",
            unique=True,
            postgresql_where=text(
                "identifier_type_code = 'I' AND is_current AND deleted_at IS NULL"
            ),
            sqlite_where=text(
                "identifier_type_code = 'I' AND is_current = 1 AND deleted_at IS NULL"
            ),
        ),
    )
