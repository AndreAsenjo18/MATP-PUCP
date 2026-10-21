"""Hierarchical locations and movement history (spec ubicacion-movimientos; RF-016, RF-017)."""

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, ClassVar

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
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
    from app.modules.collections.models import Term


class LocationLevel(enum.StrEnum):
    """[SUPUESTO] sede -> espacio -> mueble/rack -> nivel -> contenedor."""

    SITE = "SITE"
    SPACE = "SPACE"
    FURNITURE = "FURNITURE"
    SHELF_LEVEL = "SHELF_LEVEL"
    CONTAINER = "CONTAINER"


class SpaceKind(enum.StrEnum):
    """[SUPUESTO] Tipo de espacio (design D5), solo aplicable a `LocationLevel.SPACE`."""

    DEPOSIT = "DEPOSIT"
    EXHIBITION_ROOM = "EXHIBITION_ROOM"
    WORKSHOP = "WORKSHOP"
    OTHER = "OTHER"


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
    space_kind: Mapped[SpaceKind | None] = mapped_column(str_enum(SpaceKind, "location_space_kind"))


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
    # Movimiento correctivo que repara un registro anterior mal hecho (design D2); el anterior
    # nunca se edita (RN-005).
    corrects_movement_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece_movement.id"))
    # Referencia común a todos los movimientos generados por una misma operación de reubicación
    # de nodo (design D4) o de lote (design D3); no es una FK porque agrupa registros de tablas
    # distintas de entidades (piezas) sin un "lote" propio.
    origin_ref: Mapped[str | None] = mapped_column(String(80), index=True)


class IdempotencyKey(UUIDPrimaryKeyMixin, Base):
    """Respuesta guardada de una operación de lote para que un reintento no la repita.

    (design D3, RNF-005). No se audita: es infraestructura de transporte, no un hecho del
    dominio. Limpieza periódica fuera de este change (ver ADR Propuesto sobre idempotencia).
    """

    __tablename__ = "idempotency_key"
    __audited__: ClassVar[bool] = False

    key: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    scope: Mapped[str] = mapped_column(String(80))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    request_hash: Mapped[str] = mapped_column(String(64))
    response_status: Mapped[int] = mapped_column()
    response_body: Mapped[dict[str, Any]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime] = mapped_column()


class Loan(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Loan or exhibition record, separate from a piece's tenure details (RF-018)."""

    __tablename__ = "loan"

    type_term_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("term.id"), index=True)
    destination_label: Mapped[str] = mapped_column(String(300))
    responsible_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    document_reference: Mapped[str | None] = mapped_column(String(200))
    starts_on: Mapped[date] = mapped_column()
    ends_on: Mapped[date] = mapped_column()
    status_term_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("term.id"), index=True)
    active_availability_term_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("term.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(default=None)
    closed_at: Mapped[datetime | None] = mapped_column(default=None)
    cancelled_at: Mapped[datetime | None] = mapped_column(default=None)

    type_term: Mapped["Term"] = relationship(foreign_keys=[type_term_id])
    status_term: Mapped["Term"] = relationship(foreign_keys=[status_term_id])
    active_availability_term: Mapped["Term | None"] = relationship(
        foreign_keys=[active_availability_term_id]
    )
    items: Mapped[list["LoanItem"]] = relationship(back_populates="loan")

    __table_args__ = (CheckConstraint("starts_on <= ends_on", name="loan_date_range"),)


class LoanItem(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A piece's historical participation in a loan or exhibition (RF-018)."""

    __tablename__ = "loan_item"

    loan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("loan.id"), index=True)
    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)

    loan: Mapped[Loan] = relationship(back_populates="items")
    piece: Mapped["Piece"] = relationship(foreign_keys=[piece_id])

    __table_args__ = (UniqueConstraint("loan_id", "piece_id"),)
