"""Initial load of historical valuations from a CSV file (change reportes-inventario, design D6).

Minimal on purpose: there is no capture screen until the museum confirms RF-037 for phase 1
[SUPUESTO]. Each row names the piece by one of its current codes (exact match on the normalized
value, never a partial one), so a valuation can only land on the piece it was meant for. A
dry-run (the default) validates every row and writes nothing; ``apply`` inserts the valid rows
and records each one in the audit log. A row already loaded (same piece, amount, currency, date
and source) is skipped, so running the same file twice adds nothing.
"""

import csv
import io
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import code_candidates
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.params import session_params
from app.modules.reports.models import PieceValuation

#: Columns of the file, in Spanish like the rest of the museum's spreadsheets.
REQUIRED_COLUMNS = ("codigo", "monto", "moneda", "fecha", "fuente")
OPTIONAL_COLUMNS = ("notas",)
ACTOR_LABEL = "load_valuations"


@dataclass
class RowIssue:
    row_number: int
    message: str


@dataclass
class LoadReport:
    valid: int = 0
    inserted: int = 0
    already_loaded: int = 0
    issues: list[RowIssue] = field(default_factory=list)


@dataclass(frozen=True)
class _Valuation:
    piece_id: uuid.UUID
    amount: Decimal
    currency: str
    valued_on: date
    source: str
    notes: str | None


def _find_piece(session: Session, code: str) -> list[uuid.UUID]:
    candidates = code_candidates(code, params=session_params(session))
    if not candidates:
        return []
    statement = (
        select(PieceIdentifier.piece_id)
        .join(Piece, Piece.id == PieceIdentifier.piece_id)
        .where(
            PieceIdentifier.normalized_value.in_(candidates),
            PieceIdentifier.is_current.is_(True),
            PieceIdentifier.deleted_at.is_(None),
            Piece.deleted_at.is_(None),
            Piece.merged_into_id.is_(None),
        )
        .distinct()
    )
    return list(session.scalars(statement))


def _parse_row(
    session: Session, row_number: int, row: dict[str, str | None]
) -> _Valuation | RowIssue:
    values = {key: (row.get(key) or "").strip() for key in (*REQUIRED_COLUMNS, *OPTIONAL_COLUMNS)}
    missing = [key for key in REQUIRED_COLUMNS if not values[key]]
    if missing:
        return RowIssue(row_number, f"Faltan valores: {', '.join(missing)}.")
    try:
        amount = Decimal(values["monto"].replace(",", ""))
    except InvalidOperation:
        return RowIssue(row_number, f"El monto «{values['monto']}» no es un número.")
    if amount <= 0:
        return RowIssue(row_number, "El monto debe ser mayor que cero.")
    currency = values["moneda"].upper()
    if len(currency) != 3 or not currency.isalpha():
        return RowIssue(
            row_number, f"La moneda «{values['moneda']}» no es un código ISO (PEN, USD)."
        )
    try:
        valued_on = date.fromisoformat(values["fecha"])
    except ValueError:
        return RowIssue(row_number, f"La fecha «{values['fecha']}» no tiene el formato AAAA-MM-DD.")
    pieces = _find_piece(session, values["codigo"])
    if not pieces:
        return RowIssue(row_number, f"Ninguna pieza tiene el código vigente «{values['codigo']}».")
    if len(pieces) > 1:
        return RowIssue(
            row_number, f"El código «{values['codigo']}» corresponde a {len(pieces)} piezas."
        )
    return _Valuation(
        piece_id=pieces[0],
        amount=amount.quantize(Decimal("0.01")),
        currency=currency,
        valued_on=valued_on,
        source=values["fuente"][:200],
        notes=values["notas"] or None,
    )


def _already_loaded(session: Session, valuation: _Valuation) -> bool:
    return (
        session.scalar(
            select(PieceValuation.id).where(
                PieceValuation.piece_id == valuation.piece_id,
                PieceValuation.amount == valuation.amount,
                PieceValuation.currency == valuation.currency,
                PieceValuation.valued_on == valuation.valued_on,
                PieceValuation.source == valuation.source,
            )
        )
        is not None
    )


def load_valuations(
    session: Session, content: str, *, apply: bool = False, file_label: str = "archivo"
) -> LoadReport:
    """Validate (and with ``apply``, insert) the valuations of a CSV file. The caller commits."""
    report = LoadReport()
    reader = csv.DictReader(io.StringIO(content.lstrip("﻿")))
    columns = {name.strip().lower() for name in reader.fieldnames or []}
    missing = [name for name in REQUIRED_COLUMNS if name not in columns]
    if missing:
        report.issues.append(RowIssue(1, f"Faltan columnas: {', '.join(missing)}."))
        return report
    if apply:
        set_audit_context(session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR_LABEL))
    for row_number, raw in enumerate(reader, start=2):  # row 1 is the header
        row = {(key or "").strip().lower(): value for key, value in raw.items()}
        parsed = _parse_row(session, row_number, row)
        if isinstance(parsed, RowIssue):
            report.issues.append(parsed)
            continue
        report.valid += 1
        if _already_loaded(session, parsed):
            report.already_loaded += 1
            continue
        if not apply:
            continue
        valuation = PieceValuation(
            id=new_uuid(),
            piece_id=parsed.piece_id,
            amount=parsed.amount,
            currency=parsed.currency,
            valued_on=parsed.valued_on,
            source=parsed.source,
            notes=parsed.notes,
            recorded_by_label=f"{ACTOR_LABEL} ({file_label})"[:200],
        )
        session.add(valuation)
        session.add(
            AuditLog(
                change_set_id=new_uuid(),
                entity_type="piece_valuation",
                entity_id=valuation.id,
                field=None,
                old_value=None,
                new_value={
                    "piece_id": str(parsed.piece_id),
                    "amount": str(parsed.amount),
                    "currency": parsed.currency,
                    "valued_on": parsed.valued_on.isoformat(),
                    "source": parsed.source,
                },
                action=AuditAction.CREATE,
                origin=AuditOrigin.SYSTEM,
                actor_label=ACTOR_LABEL,
                reason=f"Carga de valorizaciones desde {file_label} (fila {row_number})",
            )
        )
        session.flush()  # the next row sees it as already loaded
        report.inserted += 1
    return report
