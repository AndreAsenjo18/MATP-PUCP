"""Historical valuations of a piece (change reportes-inventario, design D6; RF-037).

Append-only: a new valuation never replaces an earlier one, it is added with its own date; the
current valuation of a piece is the one with the most recent ``valued_on``. Valuations are very
sensitive data (RNF-014): they are only read by the valuation report, behind
``FEATURE_VALUATION_REPORT`` and the ``sensitive.valuation`` permission.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import ClassVar

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import Base, UUIDPrimaryKeyMixin, utcnow


class PieceValuation(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "piece_valuation"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    piece_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("piece.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    # ISO 4217 code (PEN, USD...). No currency conversion is made (design D6).
    currency: Mapped[str] = mapped_column(String(3))
    valued_on: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(default=utcnow)
    # Who loaded it (the load command records its process label and the CSV file name).
    recorded_by_label: Mapped[str | None] = mapped_column(String(200))
