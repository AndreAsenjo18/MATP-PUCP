"""Migración 0006: sesiones de servidor, bitácoras de autenticación y acceso sensible.

Change de OpenSpec: autenticacion-y-matriz-permisos (tarea 1.1; ADR-009, decisiones D1, D3, D6).
Como el resto del repositorio, se ejecuta en SQLite y se renderiza como SQL de PostgreSQL en
modo offline (PostgreSQL no está disponible sin Docker).
"""

from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import DatabaseError

from tests.test_migrations import _config, _migrate, _sqlite_engine

PREVIOUS = "0007_import_decisions_and_images"
REVISION = "0006_auth_sessions_and_events"
NEW_TABLES = {"user_session", "auth_event", "sensitive_access_log"}
POSTGRES_URL = "postgresql+psycopg://matp:unused@localhost:5432/matp"
NOW = "'2026-10-20', '2026-10-20'"
USER_ID = "00000000000000000000000000000009"


@pytest.fixture
def seeded(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    """Base en la revisión anterior, con un usuario ya registrado."""
    engine = _sqlite_engine(tmp_path / "matp.db")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'matp.db').as_posix()}")
    _migrate(engine, PREVIOUS)
    with engine.begin() as connection:
        connection.execute(
            text(
                f"INSERT INTO app_user (id, email, full_name, is_active, is_synthetic, "
                f"failed_login_count, created_at, updated_at) VALUES "
                f"('{USER_ID}', 'admin@matp.local', 'Administradora', 1, 1, 0, {NOW})"
            )
        )
    yield engine
    engine.dispose()


def test_upgrade_adds_the_auth_tables_and_keeps_existing_users(seeded) -> None:  # type: ignore[no-untyped-def]
    _migrate(seeded, REVISION)
    assert set(inspect(seeded).get_table_names()) >= NEW_TABLES
    with seeded.connect() as connection:
        # El usuario sembrado antes del change no queda obligado a cambiar su contraseña.
        assert connection.execute(text("SELECT must_change_password FROM app_user")).scalar() == 0
        assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    indexes = {index["name"] for index in inspect(seeded).get_indexes("user_session")}
    assert {"ix_user_session_user_id", "ix_user_session_user_id_revoked_at"} <= indexes


def test_session_tokens_are_unique_and_sessions_are_revoked_not_deleted(seeded) -> None:  # type: ignore[no-untyped-def]
    """Solo se guarda la huella del token (ADR-009 D1) y una sesión se revoca, no se borra."""
    _migrate(seeded, REVISION)
    insert = (
        "INSERT INTO user_session (id, user_id, token_hash, last_seen_at, expires_at, "
        f"created_at, updated_at) VALUES ('{{id}}', '{USER_ID}', '{{digest}}', {NOW}, {NOW})"
    )
    with seeded.begin() as connection:
        connection.execute(
            text(insert.format(id="00000000000000000000000000000101", digest="a" * 64))
        )
    with pytest.raises(DatabaseError), seeded.begin() as connection:  # token_hash único
        connection.execute(
            text(insert.format(id="00000000000000000000000000000102", digest="a" * 64))
        )
    with seeded.begin() as connection:  # revocación y eliminación lógica disponibles
        connection.execute(
            text("UPDATE user_session SET revoked_at = '2026-10-20', revoked_reason = 'LOGOUT'")
        )
    with seeded.connect() as connection:
        assert connection.execute(
            text("SELECT revoked_reason FROM user_session WHERE deleted_at IS NULL")
        ).scalar() == ("LOGOUT")


@pytest.mark.parametrize(
    ("table", "insert"),
    [
        (
            "auth_event",
            "INSERT INTO auth_event (id, occurred_at, event, user_id, detail) VALUES "
            f"('00000000000000000000000000000201', '2026-10-20', 'LOGIN_FAILED', '{USER_ID}', "
            "'bad_password')",
        ),
        (
            "sensitive_access_log",
            "INSERT INTO sensitive_access_log (id, occurred_at, user_id, route, entity_type, "
            f"entity_ids, fields) VALUES ('00000000000000000000000000000301', '2026-10-20', "
            f"'{USER_ID}', '/api/v1/pieces/{{piece_id}}', 'piece', '[]', "
            "'[\"lender_name\"]')",
        ),
    ],
)
def test_auth_ledgers_are_append_only_in_the_database(seeded, table: str, insert: str) -> None:  # type: ignore[no-untyped-def]
    """Ninguna bitácora de seguridad se puede modificar ni borrar (RN-005, RNF-014)."""
    _migrate(seeded, REVISION)
    with seeded.begin() as connection:
        connection.execute(text(insert))
    for statement in (f"UPDATE {table} SET occurred_at = '2026-01-01'", f"DELETE FROM {table}"):
        with pytest.raises(DatabaseError), seeded.begin() as connection:
            connection.execute(text(statement))
    with seeded.connect() as connection:
        assert connection.execute(text(f"SELECT count(*) FROM {table}")).scalar() == 1


def test_downgrade_removes_everything_and_keeps_the_user(seeded) -> None:  # type: ignore[no-untyped-def]
    _migrate(seeded, REVISION)
    _migrate(seeded, PREVIOUS, down=True)
    inspector = inspect(seeded)
    assert not NEW_TABLES & set(inspector.get_table_names())
    columns = {column["name"] for column in inspector.get_columns("app_user")}
    assert "must_change_password" not in columns
    with seeded.connect() as connection:
        assert connection.execute(text("SELECT email FROM app_user")).scalar() == (
            "admin@matp.local"
        )
        # El índice parcial por correo no se puede reflejar en SQLite: se comprueba en el SQL.
        names = connection.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index'")
        ).scalars()
        assert "uq_app_user_email_active" in set(names)


def test_auth_sessions_on_postgresql(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """En PostgreSQL las tablas se crean con JSONB, disparadores y sin reconstruir `app_user`."""
    monkeypatch.setenv("DATABASE_URL", POSTGRES_URL)
    command.upgrade(_config(POSTGRES_URL), f"{PREVIOUS}:{REVISION}", sql=True)
    sql = capsys.readouterr().out
    for statement in (
        "CREATE TABLE user_session",
        "CREATE TABLE auth_event",
        "CREATE TABLE sensitive_access_log",
        "CONSTRAINT uq_user_session_token_hash UNIQUE (token_hash)",
        "entity_ids JSONB NOT NULL",
        "ALTER TABLE app_user ADD COLUMN must_change_password BOOLEAN DEFAULT false NOT NULL",
    ):
        assert statement in sql
    for table in ("auth_event", "sensitive_access_log"):
        assert (f"CREATE TRIGGER trg_{table}_append_only BEFORE UPDATE OR DELETE ON {table}") in sql
        assert f"CREATE TRIGGER trg_{table}_no_truncate BEFORE TRUNCATE ON {table}" in sql
    # La función de rechazo es la de 0001: esta migración la reutiliza, no la redefine.
    assert "CREATE OR REPLACE FUNCTION matp_reject_append_only_change" not in sql
    assert "DROP TABLE" not in sql  # `app_user` no se reconstruye
