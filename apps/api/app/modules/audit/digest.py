"""Daily cryptographic digest of the audit log: evidence of integrity (RNF-007, RF-040).

Change de OpenSpec: auditoria-y-soft-delete-transversal (tarea 4.1, decisión D5).
Requirement: «Evidencia diaria de integridad de la auditoría».

CLI (``npm run audit:digest`` / ``npm run audit:verify``; with Docker,
``docker compose exec api python -m app.modules.audit.digest``)::

    python -m app.modules.audit.digest              # seals every closed day without a digest
    python -m app.modules.audit.digest --day DATE   # seals one closed day
    python -m app.modules.audit.digest --verify     # recomputes every digest and reports

The digest of a day covers its ``audit_log`` rows ordered by ``(occurred_at, id)`` with a
canonical JSON serialization, and it chains the digest of the previous sealed day: a single
day cannot be recomputed in isolation, because changing it invalidates every later day too.
``audit_digest`` is append-only in the database (trigger), so an existing digest cannot be
rewritten to hide an alteration. This provides *evidence* of a direct manipulation of the
database, not prevention.
"""

import argparse
import json
import sys
import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from typing import Any

from sqlalchemy import Row, select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditDigest, AuditLog, AuditOrigin

#: Recipe used to build the digests. Stored on every row so a future format can coexist.
DIGEST_ALGORITHM = "sha256/v1"
_HEADER = b"matp-audit-digest/v1"
#: Process recorded in the audit context when a digest row is written.
ACTOR_LABEL = "audit-digest"

_ROW_COLUMNS = (
    AuditLog.id,
    AuditLog.occurred_at,
    AuditLog.change_set_id,
    AuditLog.entity_type,
    AuditLog.entity_id,
    AuditLog.field,
    AuditLog.old_value,
    AuditLog.new_value,
    AuditLog.action,
    AuditLog.origin,
    AuditLog.origin_ref,
    AuditLog.user_id,
    AuditLog.actor_label,
    AuditLog.reason,
)


class DayStatus(StrEnum):
    """Result of verifying one day."""

    OK = "OK"
    #: The rows of the day no longer produce the stored digest.
    ALTERED = "ALTERADO"
    #: The digest does not chain the previous one (a digest row is missing or was inserted).
    CHAIN_BROKEN = "CADENA_ROTA"
    #: The day has audit rows but no digest although later days are already sealed.
    UNSEALED = "SIN_RESUMEN"


def _as_utc(value: datetime) -> datetime:
    """Normalize a timestamp to UTC. SQLite returns naive values, PostgreSQL aware ones."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _day_start(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=UTC)


def _canonical_row(row: Row[Any]) -> bytes:
    """Canonical serialization of one audit row: stable across backends and Python versions."""
    payload: list[Any] = [
        str(row.id),
        _as_utc(row.occurred_at).isoformat(),
        str(row.change_set_id),
        row.entity_type,
        str(row.entity_id),
        row.field,
        row.old_value,
        row.new_value,
        str(row.action),
        str(row.origin),
        row.origin_ref,
        None if row.user_id is None else str(row.user_id),
        row.actor_label,
        row.reason,
    ]
    return json.dumps(
        payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True, default=str
    ).encode()


@dataclass(frozen=True)
class DayRows:
    """Audit rows of one calendar day (UTC) folded into a single digest."""

    day: date
    row_count: int
    first_entry_id: uuid.UUID | None
    last_entry_id: uuid.UUID | None
    rows_sha256: str


def day_sha256(day: date, row_count: int, rows_sha256: str, previous_sha256: str | None) -> str:
    """Digest of a day: its rows plus the digest of the previous sealed day (chaining)."""
    hasher = sha256()
    for part in (
        _HEADER,
        DIGEST_ALGORITHM.encode(),
        day.isoformat().encode(),
        (previous_sha256 or "").encode(),
        str(row_count).encode(),
        rows_sha256.encode(),
    ):
        hasher.update(part + b"\n")
    return hasher.hexdigest()


def _empty_rows_sha256() -> str:
    return sha256().hexdigest()


def scan_days(session: Session, *, until: date | None = None) -> dict[date, DayRows]:
    """Fold ``audit_log`` into one entry per day in a single ordered pass (streamed)."""
    statement = select(*_ROW_COLUMNS).order_by(AuditLog.occurred_at, AuditLog.id)
    if until is not None:
        statement = statement.where(AuditLog.occurred_at < _day_start(until + timedelta(days=1)))
    rows: Iterable[Row[Any]] = session.execute(statement.execution_options(yield_per=1000))

    days: dict[date, DayRows] = {}
    current: date | None = None
    hasher = sha256()
    count = 0
    first_entry_id: uuid.UUID | None = None
    last_entry_id: uuid.UUID | None = None

    def close() -> None:
        if current is not None:
            days[current] = DayRows(
                day=current,
                row_count=count,
                first_entry_id=first_entry_id,
                last_entry_id=last_entry_id,
                rows_sha256=hasher.hexdigest(),
            )

    for row in rows:
        day = _as_utc(row.occurred_at).date()
        if day != current:
            close()
            current, hasher, count, first_entry_id = day, sha256(), 0, row.id
        hasher.update(_canonical_row(row) + b"\n")
        count += 1
        last_entry_id = row.id
    close()
    return days


def stored_digests(session: Session) -> list[AuditDigest]:
    return list(session.scalars(select(AuditDigest).order_by(AuditDigest.day)))


# --------------------------------------------------------------------------- sealing


@dataclass(frozen=True)
class SealResult:
    """Outcome of a sealing run."""

    sealed: tuple[AuditDigest, ...]
    #: ``(day, row_count)`` of days with rows older than the last sealed day and no digest.
    out_of_order: tuple[tuple[date, int], ...]

    @property
    def ok(self) -> bool:
        return not self.out_of_order

    def render(self) -> str:
        lines = [f"Resúmenes diarios de auditoría ({DIGEST_ALGORITHM})"]
        if not self.sealed:
            lines.append("No hay días cerrados pendientes de resumen.")
        for digest in self.sealed:
            lines.append(f"  {digest.day.isoformat()}: {digest.row_count} filas · {digest.sha256}")
        for day, row_count in self.out_of_order:
            lines.append(
                f"ANOMALÍA {day.isoformat()}: {row_count} filas en un día anterior al último "
                "resumen y sin resumen propio (filas agregadas fuera de orden). "
                "Ejecute la verificación: python -m app.modules.audit.digest --verify"
            )
        return "\n".join(lines)


def seal_days(
    session: Session, *, today: date | None = None, only_day: date | None = None
) -> SealResult:
    """Compute and store the digest of every closed day that has none yet.

    Days are sealed in chronological order so each one chains the previous digest. The current
    day is never sealed (rows are still arriving). Rows belonging to a day older than the last
    sealed one are reported as an anomaly instead of being sealed: they can only come from a
    direct insertion into the database, and sealing them would break the chain.
    """
    last_closed = (today or utcnow().date()) - timedelta(days=1)
    if only_day is not None and only_day > last_closed:
        raise ValueError(
            f"El día {only_day.isoformat()} todavía no ha cerrado: solo se resumen días "
            f"anteriores a {(last_closed + timedelta(days=1)).isoformat()}."
        )

    existing = {digest.day: digest for digest in stored_digests(session)}
    scanned = scan_days(session, until=last_closed)
    last_sealed = max(existing, default=None)

    pending = sorted(day for day in scanned if day not in existing)
    if only_day is not None:
        pending = [day for day in pending if day == only_day]
    out_of_order = tuple(
        (day, scanned[day].row_count)
        for day in pending
        if last_sealed is not None and day < last_sealed
    )
    sealed: list[AuditDigest] = []
    previous = existing[last_sealed] if last_sealed is not None else None
    for day in pending:
        if last_sealed is not None and day < last_sealed:
            continue
        rows = scanned[day]
        digest = AuditDigest(
            id=new_uuid(),
            day=day,
            row_count=rows.row_count,
            first_entry_id=rows.first_entry_id,
            last_entry_id=rows.last_entry_id,
            sha256=day_sha256(
                day, rows.row_count, rows.rows_sha256, previous.sha256 if previous else None
            ),
            previous_day=previous.day if previous else None,
            previous_sha256=previous.sha256 if previous else None,
            algorithm=DIGEST_ALGORITHM,
            computed_at=utcnow(),
        )
        session.add(digest)
        sealed.append(digest)
        previous = digest
    if sealed:
        with audit_context(
            session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR_LABEL)
        ):
            session.flush()
    return SealResult(sealed=tuple(sealed), out_of_order=out_of_order)


# --------------------------------------------------------------------------- verification


@dataclass(frozen=True)
class DayVerification:
    """Verification of one day: what was recorded when it was sealed vs. what is there now."""

    day: date
    status: DayStatus
    stored_row_count: int | None
    found_row_count: int
    expected_sha256: str | None
    actual_sha256: str | None
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.status is DayStatus.OK

    def render(self) -> str:
        if self.ok:
            return (
                f"  OK {self.day.isoformat()}: {self.found_row_count} filas · {self.actual_sha256}"
            )
        counts = f"filas registradas {self.stored_row_count}, encontradas {self.found_row_count}"
        hashes = f"resumen esperado {self.expected_sha256}, obtenido {self.actual_sha256}"
        detail = f" {self.detail}" if self.detail else ""
        return f"  {self.status.value} {self.day.isoformat()}: {counts}; {hashes}.{detail}"


@dataclass(frozen=True)
class VerificationReport:
    days: tuple[DayVerification, ...]

    @property
    def checked(self) -> int:
        return len(self.days)

    @property
    def matching(self) -> int:
        return sum(1 for day in self.days if day.ok)

    @property
    def findings(self) -> tuple[DayVerification, ...]:
        return tuple(day for day in self.days if not day.ok)

    @property
    def ok(self) -> bool:
        return not self.findings

    def render(self, *, detailed: bool = False) -> str:
        lines = [f"Verificación de integridad de la auditoría ({DIGEST_ALGORITHM})"]
        if not self.days:
            lines.append(
                "No hay resúmenes diarios registrados: ejecute "
                "python -m app.modules.audit.digest para generarlos."
            )
            return "\n".join(lines)
        lines.append(
            f"Días verificados: {self.checked} · resúmenes que coinciden: {self.matching} · "
            f"con diferencias: {len(self.findings)}"
        )
        if self.ok:
            lines.append(f"Los {self.checked} resúmenes coinciden: la auditoría está intacta.")
        for day in self.days:
            if detailed or not day.ok:
                lines.append(day.render())
        if not self.ok:
            lines.append(
                "Los días reportados fueron alterados por acceso directo a la base de datos: "
                "conserve una copia de la tabla audit_log y avise al Administrador (RNF-007)."
            )
        return "\n".join(lines)


def _verify_day(
    digest: AuditDigest, rows: DayRows | None, previous: AuditDigest | None
) -> DayVerification:
    found_row_count = rows.row_count if rows else 0
    rows_sha256 = rows.rows_sha256 if rows else _empty_rows_sha256()
    actual = day_sha256(digest.day, found_row_count, rows_sha256, digest.previous_sha256)
    expected_previous_day = previous.day if previous else None
    expected_previous_sha = previous.sha256 if previous else None
    if (digest.previous_day, digest.previous_sha256) != (
        expected_previous_day,
        expected_previous_sha,
    ):
        return DayVerification(
            day=digest.day,
            status=DayStatus.CHAIN_BROKEN,
            stored_row_count=digest.row_count,
            found_row_count=found_row_count,
            expected_sha256=digest.sha256,
            actual_sha256=actual,
            detail=(
                f"El resumen encadena el día {digest.previous_day} "
                f"({digest.previous_sha256}) pero el anterior registrado es "
                f"{expected_previous_day} ({expected_previous_sha}): falta un resumen diario."
            ),
        )
    if actual != digest.sha256:
        return DayVerification(
            day=digest.day,
            status=DayStatus.ALTERED,
            stored_row_count=digest.row_count,
            found_row_count=found_row_count,
            expected_sha256=digest.sha256,
            actual_sha256=actual,
            detail=(
                "Las filas de auditoría de ese día ya no producen el resumen registrado."
                if found_row_count == digest.row_count
                else "Cambió el número de filas de auditoría de ese día."
            ),
        )
    return DayVerification(
        day=digest.day,
        status=DayStatus.OK,
        stored_row_count=digest.row_count,
        found_row_count=found_row_count,
        expected_sha256=digest.sha256,
        actual_sha256=actual,
    )


def _unsealed_days(
    scanned: dict[date, DayRows], sealed_days: set[date], last_sealed: date
) -> Iterator[DayVerification]:
    for day in sorted(scanned):
        if day > last_sealed or day in sealed_days:
            continue
        rows = scanned[day]
        yield DayVerification(
            day=day,
            status=DayStatus.UNSEALED,
            stored_row_count=None,
            found_row_count=rows.row_count,
            expected_sha256=None,
            actual_sha256=day_sha256(day, rows.row_count, rows.rows_sha256, None),
            detail=(
                "Ese día no tiene resumen aunque días posteriores sí lo tienen: las filas se "
                "agregaron fuera de orden por acceso directo a la base de datos."
            ),
        )


def verify_digests(session: Session) -> VerificationReport:
    """Recompute every stored digest and report the days that no longer match."""
    digests = stored_digests(session)
    if not digests:
        return VerificationReport(days=())
    last_sealed = digests[-1].day
    scanned = scan_days(session, until=last_sealed)
    sealed_days = {digest.day for digest in digests}

    days: list[DayVerification] = []
    previous: AuditDigest | None = None
    for digest in digests:
        days.append(_verify_day(digest, scanned.get(digest.day), previous))
        previous = digest
    days.extend(_unsealed_days(scanned, sealed_days, last_sealed))
    return VerificationReport(days=tuple(sorted(days, key=lambda day: day.day)))


# --------------------------------------------------------------------------- CLI


def _parse_day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:  # pragma: no cover - argparse formats the message
        raise argparse.ArgumentTypeError(f"Fecha no válida (use AAAA-MM-DD): {value}") from exc


def main(argv: list[str] | None = None) -> int:
    """Return 0 when everything is consistent, 1 on findings, 2 on a configuration error."""
    parser = argparse.ArgumentParser(
        prog="python -m app.modules.audit.digest",
        description="Resumen criptográfico diario de la auditoría y su verificación",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="recalcula los resúmenes guardados y reporta los días alterados",
    )
    parser.add_argument("--day", type=_parse_day, help="resume solo ese día cerrado (AAAA-MM-DD)")
    parser.add_argument(
        "--detailed", action="store_true", help="con --verify, lista también los días que coinciden"
    )
    args = parser.parse_args(argv)
    if args.day and args.verify:
        parser.error("--day no se combina con --verify: la verificación recorre todos los días.")

    from app.core.config import ConfigurationError, load_settings
    from app.core.db import make_engine, make_session_factory

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    engine = make_engine(settings.database_url)
    try:
        with make_session_factory(engine)() as session:
            if args.verify:
                report = verify_digests(session)
                print(report.render(detailed=args.detailed))
                return 0 if report.ok else 1
            try:
                result = seal_days(session, only_day=args.day)
            except ValueError as exc:
                print(exc, file=sys.stderr)
                return 2
            session.commit()
            print(result.render())
            return 0 if result.ok else 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
