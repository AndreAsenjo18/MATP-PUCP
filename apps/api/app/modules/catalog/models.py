"""Piece record sheet and related append-only history (spec catalogo-piezas; RF-005..009)."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, ClassVar

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Text
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
from app.modules.catalog.enums import PeriodType, TenureRegime

if TYPE_CHECKING:
    from app.modules.identification.models import PieceIdentifier


class Piece(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A museum piece. Its only key is the internal UUID; museum codes are identifiers (RN-001)."""

    __tablename__ = "piece"

    # Denominación (mandatory, RF-006) and descriptive fields.
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    collection_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("collection.id"), index=True)

    # Tenure regime and its rules (RF-005, RN-003, RN-004, RN-006).
    tenure_regime: Mapped[TenureRegime] = mapped_column(str_enum(TenureRegime, "tenure_regime"))
    legal_owner: Mapped[str | None] = mapped_column(String(200))
    lender_name: Mapped[str | None] = mapped_column(String(300))  # comodante (sensitive)
    loan_agreement_ref: Mapped[str | None] = mapped_column(String(200))
    temporary_inventory_number: Mapped[str | None] = mapped_column(String(60))

    acquisition_method_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    entry_date: Mapped[date | None] = mapped_column(Date)
    author: Mapped[str | None] = mapped_column(String(300))
    provenance: Mapped[str | None] = mapped_column(String(300))

    # Period: original text plus optional structured interpretation (RF-007).
    period_text: Mapped[str | None] = mapped_column(String(200))
    period_type: Mapped[PeriodType | None] = mapped_column(str_enum(PeriodType, "period_type"))
    period_from: Mapped[int | None] = mapped_column()
    period_to: Mapped[int | None] = mapped_column()

    object_type_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    category_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"), index=True)

    # Dimensions: original text + structured list [{dimension, value, unit}] (RF-006).
    dimensions_text: Mapped[str | None] = mapped_column(Text)
    dimensions: Mapped[list[Any] | None] = mapped_column(JsonType)

    conservation_status_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    recorded_by: Mapped[str | None] = mapped_column(String(200))  # registrador
    notes: Mapped[str | None] = mapped_column(Text)

    # Sets / composite pieces (RF-009) and merges of duplicates (RF-030).
    parent_piece_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"), index=True)
    merged_into_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"))

    availability_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    current_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("location.id"), index=True
    )

    identifiers: Mapped[list["PieceIdentifier"]] = relationship(
        back_populates="piece", order_by="PieceIdentifier.recorded_at"
    )

    __table_args__ = (
        CheckConstraint(
            "period_from IS NULL OR period_to IS NULL OR period_from <= period_to",
            name="period_range",
        ),
        Index("ix_piece_title", "title"),
    )


class PieceMaterial(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "piece_material"

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    term_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("term.id"), index=True)


class PieceSourceRecord(UUIDPrimaryKeyMixin, Base):
    """Unmapped source columns of each load, kept separately and read-only (RF-008)."""

    __tablename__ = "piece_source_record"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    import_batch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_batch.id"))
    source_name: Mapped[str] = mapped_column(String(200))
    source_file_name: Mapped[str | None] = mapped_column(String(300))
    source_row_number: Mapped[int | None] = mapped_column()
    payload: Mapped[dict[str, Any]] = mapped_column(JsonType)
    recorded_at: Mapped[datetime] = mapped_column(default=utcnow)


class ConservationAssessment(UUIDPrimaryKeyMixin, Base):
    """History of conservation status evaluations (RF-012). Append-only."""

    __tablename__ = "conservation_assessment"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    status_term_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("term.id"))
    assessed_at: Mapped[datetime] = mapped_column(default=utcnow)
    assessed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    assessed_by_label: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
