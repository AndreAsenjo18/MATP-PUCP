"""Identifier types and external identifiers of pieces (spec identificacion-piezas)."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import (
    Base,
    JsonType,
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
    # System types (I, COLECCION): code and structural rules are fixed; only label, description
    # and order change through the API (RN-002, RN-003; colecciones-y-vocabularios-admin, D1).
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)


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


# --- Normalization parameters as data (plantillas-mapeo-y-normalizacion, design D5) ---------

ABSENCE_MARKERS_KEY = "absence_markers"
CONCATENATION_SEPARATORS_KEY = "concatenation_separators"
# Folded acquisition label -> tenure regime code (ajustes-lectura-importacion, design D1).
TENURE_ALIASES_KEY = "tenure_aliases"
# Extra regular expressions of camera file names, which carry no code (importacion-fotos-a-
# catalogo, design D3); the built-in ones live in ``imports/photo_matching.py``.
PHOTO_CAMERA_PATTERNS_KEY = "photo_camera_patterns"


class NormalizationSetting(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A normalization parameter (RN-010), administrable instead of a constant in the code.

    ``absence_markers``: list of "no code" markers, compared without spaces (N2).
    ``concatenation_separators``: ``{"separators": [...], "unsplit_markers": [...]}``, the
    characters that split a cell with several codes and the markers that are never split (N7).
    The initial values are the constants of ``normalization.py`` (migration 0013).
    """

    __tablename__ = "normalization_setting"

    key: Mapped[str] = mapped_column(String(80))
    value: Mapped[Any] = mapped_column(JsonType)

    __table_args__ = (
        Index(
            "uq_normalization_setting_key_active",
            "key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class CollectionAcronymAlias(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Another acronym of a collection, such as a historical one (design D5): normalized as
    ``collection.acronym_normalized`` and unique among the active aliases."""

    __tablename__ = "collection_acronym_alias"

    alias: Mapped[str] = mapped_column(String(40))
    alias_normalized: Mapped[str] = mapped_column(String(40))
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collection.id"), index=True)

    __table_args__ = (
        Index(
            "uq_collection_acronym_alias_active",
            "alias_normalized",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
