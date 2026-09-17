"""Collections and controlled vocabularies (spec colecciones-vocabularios; RF-010..012, RN-010)."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)
from app.modules.catalog.enums import TenureRegime


class VocabularyCode:
    """Stable codes of the vocabularies seeded by the system (more can be added as data)."""

    CATEGORY = "CATEGORY"
    MATERIAL = "MATERIAL"
    TECHNIQUE = "TECHNIQUE"
    CONSERVATION_STATUS = "CONSERVATION_STATUS"
    ACQUISITION_METHOD = "ACQUISITION_METHOD"
    PHOTO_VIEW_TYPE = "PHOTO_VIEW_TYPE"
    OBJECT_TYPE = "OBJECT_TYPE"
    AVAILABILITY = "AVAILABILITY"
    USAGE_RESTRICTION = "USAGE_RESTRICTION"


class Vocabulary(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "vocabulary"

    code: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)

    terms: Mapped[list["Term"]] = relationship(back_populates="vocabulary")


class Term(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "term"

    vocabulary_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vocabulary.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0)
    # Deactivated terms stay assigned to existing pieces but are not offered anymore.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Optional equivalence with an external thesaurus (e.g. Getty AAT URI).
    external_uri: Mapped[str | None] = mapped_column(String(500))

    vocabulary: Mapped[Vocabulary] = relationship(back_populates="terms")

    __table_args__ = (UniqueConstraint("vocabulary_id", "code"),)


class Collection(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "collection"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("collection.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    # Acronym as written by the museum and its normalized form (M.M.Z. -> MMZ).
    acronym: Mapped[str | None] = mapped_column(String(40))
    acronym_normalized: Mapped[str | None] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(Text)
    default_tenure_regime: Mapped[TenureRegime] = mapped_column(
        str_enum(TenureRegime, "tenure_regime"), default=TenureRegime.OWNED
    )
    # Origin / donor description. Personal data: restricted by role (RF-041, RNF-014).
    origin_description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent: Mapped["Collection | None"] = relationship(remote_side="Collection.id")

    __table_args__ = (
        Index(
            "uq_collection_acronym_active",
            "acronym_normalized",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND acronym_normalized IS NOT NULL"),
            sqlite_where=text("deleted_at IS NULL AND acronym_normalized IS NOT NULL"),
        ),
    )
