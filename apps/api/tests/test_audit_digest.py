"""Spec auditoria-trazabilidad: «Evidencia diaria de integridad de la auditoría» (RNF-007).

Change auditoria-y-soft-delete-transversal, tarea 4.1. Las pruebas corren sobre una base
SQLite **migrada**, no sobre ``Base.metadata.create_all``, porque necesitan los disparadores
de solo inserción reales: el escenario «Alteración directa en la base» consiste en desactivar
el disparador, modificar una fila y volver a dejarlo puesto.
"""

import io
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine, event, insert, select, text
from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.core.models_base import new_uuid
from app.models import AuditLog
from app.modules.audit.digest import (
    DIGEST_ALGORITHM,
    DayStatus,
    day_sha256,
    main,
    seal_days,
    stored_digests,
    verify_digests,
)
from app.modules.audit.models import AuditAction, AuditOrigin

API_DIR = Path(__file__).resolve().parents[1]
SECRET = "test-secret-value-not-for-production"
TODAY = date(2026, 10, 20)


def _alembic_config(url: str) -> Config:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.cmd_opts = None
    config.set_section_option("alembic", "sqlalchemy.url", url)
    return config


def _migrated_engine(tmp_path: Path) -> Engine:
    """SQLite database migrated to head: tables *and* append-only triggers."""
    database = tmp_path / "matp.db"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    config = _alembic_config(str(engine.url))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    return engine


@pytest.fixture
def engine(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'matp.db').as_posix()}")
    monkeypatch.setenv("S3_BUCKET", "matp-test")
    monkeypatch.setenv("JWT_SECRET", SECRET)
    engine = _migrated_engine(tmp_path)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    with make_session_factory(engine)() as session:
        yield session


def _insert_audit_rows(session: Session, day: date, count: int, *, label: str = "tests") -> None:
    """Insert ``count`` audit rows on ``day`` with Core (no ORM flush, as a real write would)."""
    change_set_id = new_uuid()
    session.execute(
        insert(AuditLog),
        [
            {
                "id": new_uuid(),
                "occurred_at": datetime(day.year, day.month, day.day, 9, minute, tzinfo=UTC),
                "change_set_id": change_set_id,
                "entity_type": "piece",
                "entity_id": new_uuid(),
                "field": "denomination",
                "old_value": None,
                "new_value": f"Retablo {day.isoformat()} #{minute}",
                "action": AuditAction.UPDATE,
                "origin": AuditOrigin.MANUAL,
                "origin_ref": None,
                "user_id": None,
                "actor_label": label,
                "reason": "prueba de integridad",
            }
            for minute in range(count)
        ],
    )
    session.commit()


def _seed_days(session: Session, *, days: int, rows_per_day: int = 3) -> list[date]:
    """Audit rows on the ``days`` closed days that end the day before ``TODAY``."""
    calendar = [TODAY - timedelta(days=offset) for offset in range(days, 0, -1)]
    for day in calendar:
        _insert_audit_rows(session, day, rows_per_day)
    return calendar


@contextmanager
def _trigger_disabled(engine: Engine, name: str) -> Iterator[Connection]:
    """Drop an append-only trigger, hand over a connection and put the trigger back.

    This is exactly the attack the requirement describes: someone with database access
    disables the protection, changes the audit and leaves everything looking normal.
    """
    query = text("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = :name")
    with engine.begin() as connection:
        original = connection.execute(query, {"name": name}).scalar_one()
        connection.execute(text(f"DROP TRIGGER {name}"))
    try:
        with engine.begin() as connection:
            yield connection
    finally:
        with engine.begin() as connection:
            connection.execute(text(original))


def _first_audit_id(session: Session, day: date) -> uuid.UUID:
    return session.scalars(
        select(AuditLog.id)
        .where(AuditLog.occurred_at >= datetime(day.year, day.month, day.day, tzinfo=UTC))
        .order_by(AuditLog.occurred_at, AuditLog.id)
    ).first()  # type: ignore[return-value]


def test_thirty_untouched_days_match(session: Session) -> None:
    """Escenario «Auditoría intacta»: 30 días sin alteraciones, 30 resúmenes que coinciden."""
    calendar = _seed_days(session, days=30)
    result = seal_days(session, today=TODAY)
    session.commit()
    assert [digest.day for digest in result.sealed] == calendar
    assert result.ok

    report = verify_digests(session)
    assert (report.checked, report.matching) == (30, 30)
    assert report.findings == ()
    assert report.ok
    assert "Los 30 resúmenes coinciden" in report.render()
    assert DIGEST_ALGORITHM in report.render()


def test_each_day_chains_the_previous_one(session: Session) -> None:
    """El resumen de un día depende del anterior: no se puede recalcular un día aislado."""
    _seed_days(session, days=3)
    seal_days(session, today=TODAY)
    session.commit()

    digests = stored_digests(session)
    assert [digest.previous_day for digest in digests] == [
        None,
        digests[0].day,
        digests[1].day,
    ]
    assert [digest.previous_sha256 for digest in digests] == [
        None,
        digests[0].sha256,
        digests[1].sha256,
    ]
    rebuilt_alone = day_sha256(digests[2].day, digests[2].row_count, "0" * 64, None)
    assert rebuilt_alone != digests[2].sha256


def test_direct_alteration_is_reported_with_rows_and_both_digests(
    session: Session, engine: Engine
) -> None:
    """Escenario «Alteración directa en la base»: se desactiva el disparador y se edita una fila."""
    calendar = _seed_days(session, days=30)
    seal_days(session, today=TODAY)
    session.commit()
    altered_day = calendar[-10]
    altered_id = _first_audit_id(session, altered_day)
    expected = {digest.day: digest.sha256 for digest in stored_digests(session)}[altered_day]

    with _trigger_disabled(engine, "trg_audit_log_no_update") as connection:
        connection.execute(
            text("UPDATE audit_log SET new_value = :value WHERE id = :id"),
            {"value": '"Valor alterado"', "id": altered_id.hex},
        )
    session.expire_all()

    report = verify_digests(session)
    assert not report.ok
    assert len(report.findings) == 1
    finding = report.findings[0]
    assert finding.day == altered_day
    assert finding.status is DayStatus.ALTERED
    assert (finding.stored_row_count, finding.found_row_count) == (3, 3)
    assert finding.expected_sha256 == expected
    assert finding.actual_sha256 != expected
    assert (report.checked, report.matching) == (30, 29)

    rendered = report.render()
    assert altered_day.isoformat() in rendered
    assert "filas registradas 3, encontradas 3" in rendered
    assert f"resumen esperado {expected}, obtenido {finding.actual_sha256}" in rendered
    assert DayStatus.ALTERED.value in rendered
    # The protection is back in place: the alteration is evidence, not a permitted write.
    with pytest.raises(DatabaseError), engine.begin() as connection:
        connection.execute(text("UPDATE audit_log SET new_value = '\"x\"'"))


def test_direct_deletion_is_reported_with_the_missing_row(session: Session, engine: Engine) -> None:
    calendar = _seed_days(session, days=5)
    seal_days(session, today=TODAY)
    session.commit()
    target_day = calendar[2]
    deleted_id = _first_audit_id(session, target_day)

    with _trigger_disabled(engine, "trg_audit_log_no_delete") as connection:
        connection.execute(text("DELETE FROM audit_log WHERE id = :id"), {"id": deleted_id.hex})
    session.expire_all()

    finding = verify_digests(session).findings[0]
    assert (finding.day, finding.status) == (target_day, DayStatus.ALTERED)
    assert (finding.stored_row_count, finding.found_row_count) == (3, 2)
    assert "Cambió el número de filas" in finding.render()


def test_rows_added_to_a_sealed_day_are_reported(session: Session) -> None:
    """Filas agregadas fuera de orden en un día ya resumido (el INSERT no necesita el trigger)."""
    calendar = _seed_days(session, days=4)
    seal_days(session, today=TODAY)
    session.commit()
    _insert_audit_rows(session, calendar[1], 1, label="intruso")

    report = verify_digests(session)
    assert [(finding.day, finding.status) for finding in report.findings] == [
        (calendar[1], DayStatus.ALTERED)
    ]
    assert (report.findings[0].stored_row_count, report.findings[0].found_row_count) == (3, 4)


def test_rows_added_to_a_day_without_digest_are_reported(session: Session) -> None:
    """Un día sin resumen pero anterior al último resumido solo puede venir de la base."""
    gap = TODAY - timedelta(days=3)
    for day in (TODAY - timedelta(days=4), TODAY - timedelta(days=2)):
        _insert_audit_rows(session, day, 2)
    seal_days(session, today=TODAY)
    session.commit()
    _insert_audit_rows(session, gap, 2, label="intruso")

    report = verify_digests(session)
    assert [(finding.day, finding.status) for finding in report.findings] == [
        (gap, DayStatus.UNSEALED)
    ]
    assert report.findings[0].stored_row_count is None
    assert "fuera de orden" in report.findings[0].detail


def test_a_removed_digest_breaks_the_chain(session: Session, engine: Engine) -> None:
    calendar = _seed_days(session, days=4)
    seal_days(session, today=TODAY)
    session.commit()

    with _trigger_disabled(engine, "trg_audit_digest_no_delete") as connection:
        connection.execute(
            text("DELETE FROM audit_digest WHERE day = :day"), {"day": calendar[1].isoformat()}
        )
    session.expire_all()

    report = verify_digests(session)
    assert [(finding.day, finding.status) for finding in report.findings] == [
        (calendar[1], DayStatus.UNSEALED),  # the day lost its evidence
        (calendar[2], DayStatus.CHAIN_BROKEN),  # and the next day no longer chains it
    ]
    assert "falta un resumen diario" in report.findings[1].detail


def test_append_only_triggers_are_rendered_for_postgresql(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sin Docker la migración se verifica en SQLite; el SQL de PostgreSQL se revisa offline."""
    url = "postgresql+psycopg://matp:unused@localhost:5432/matp"
    monkeypatch.setenv("DATABASE_URL", url)
    command.upgrade(_alembic_config(url), "0008_locations_idempotency:0006_audit_digest", sql=True)
    sql = capsys.readouterr().out
    assert "CREATE TABLE audit_digest" in sql
    assert "CONSTRAINT uq_audit_digest_day UNIQUE (day)" in sql
    for statement in (
        "CREATE TRIGGER trg_audit_digest_append_only BEFORE UPDATE OR DELETE ON audit_digest",
        "CREATE TRIGGER trg_audit_digest_no_truncate BEFORE TRUNCATE ON audit_digest",
    ):
        assert statement in sql
    # The shared trigger function belongs to 0001 and must not be recreated here.
    assert "CREATE OR REPLACE FUNCTION" not in sql


def test_audit_digest_is_append_only_in_the_database(session: Session, engine: Engine) -> None:
    _seed_days(session, days=2)
    seal_days(session, today=TODAY)
    session.commit()
    for statement in (
        "UPDATE audit_digest SET sha256 = 'x'",
        "DELETE FROM audit_digest",
    ):
        with pytest.raises(DatabaseError), engine.begin() as connection:
            connection.execute(text(statement))
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM audit_digest")).scalar() == 2


def test_sealing_is_idempotent_and_skips_the_open_day(session: Session) -> None:
    _seed_days(session, days=2)
    _insert_audit_rows(session, TODAY, 2)  # the current day is still receiving rows
    first = seal_days(session, today=TODAY)
    session.commit()
    again = seal_days(session, today=TODAY)
    session.commit()

    assert len(first.sealed) == 2
    assert again.sealed == ()
    assert TODAY not in {digest.day for digest in stored_digests(session)}
    assert "No hay días cerrados pendientes de resumen" in again.render()


def test_sealing_a_single_day_and_refusing_an_open_one(session: Session) -> None:
    calendar = _seed_days(session, days=3)
    result = seal_days(session, today=TODAY, only_day=calendar[0])
    session.commit()
    assert [digest.day for digest in result.sealed] == [calendar[0]]
    with pytest.raises(ValueError, match="todavía no ha cerrado"):
        seal_days(session, today=TODAY, only_day=TODAY)


def test_verify_without_digests_explains_what_to_run(session: Session) -> None:
    _seed_days(session, days=1)
    report = verify_digests(session)
    assert report.checked == 0
    assert report.ok
    assert "No hay resúmenes diarios registrados" in report.render()


def test_cli_seals_then_verifies_and_fails_on_an_alteration(
    session: Session, engine: Engine, capsys: pytest.CaptureFixture[str]
) -> None:
    """``npm run audit:digest`` sella, ``npm run audit:verify`` devuelve 1 si algo cambió."""
    calendar = _seed_days(session, days=3)
    session.close()

    assert main([]) == 0
    assert "Resúmenes diarios de auditoría" in capsys.readouterr().out
    assert main(["--verify"]) == 0
    assert "Los 3 resúmenes coinciden" in capsys.readouterr().out
    assert main(["--verify", "--detailed"]) == 0
    assert capsys.readouterr().out.count("OK ") == 3

    altered_id = _first_audit_id(session, calendar[0])
    with _trigger_disabled(engine, "trg_audit_log_no_update") as connection:
        connection.execute(
            text("UPDATE audit_log SET reason = 'alterado' WHERE id = :id"),
            {"id": altered_id.hex},
        )

    assert main(["--verify"]) == 1
    output = capsys.readouterr().out
    assert DayStatus.ALTERED.value in output
    assert calendar[0].isoformat() in output
