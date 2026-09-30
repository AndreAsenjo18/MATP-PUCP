"""Alembic migrations match the models; PostgreSQL SQL is generated offline; append-only triggers.

PostgreSQL itself is not available in the bootstrap environment (no Docker daemon), so the
migration is executed on SQLite and rendered as PostgreSQL SQL in offline mode.
"""

import io
import warnings
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import DatabaseError

from app.models import Base

API_DIR = Path(__file__).resolve().parents[1]


def _config(url: str, *, stdout: io.StringIO | None = None) -> Config:
    config = Config(str(API_DIR / "alembic.ini"), stdout=stdout or io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.cmd_opts = None
    config.set_section_option("alembic", "sqlalchemy.url", url)
    return config


def _sqlite_engine(path: Path):  # type: ignore[no-untyped-def]
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    return engine


@pytest.fixture
def migrated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    engine = _sqlite_engine(tmp_path / "matp.db")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'matp.db').as_posix()}")
    with engine.begin() as connection:
        config = _config(str(engine.url))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    yield engine
    engine.dispose()


def test_upgrade_creates_every_model_table(migrated) -> None:  # type: ignore[no-untyped-def]
    tables = set(inspect(migrated).get_table_names())
    assert set(Base.metadata.tables) <= tables
    assert "alembic_version" in tables


def test_migration_matches_models(migrated) -> None:  # type: ignore[no-untyped-def]
    with migrated.connect() as connection, warnings.catch_warnings():
        warnings.simplefilter("ignore")  # expression indexes cannot be reflected on SQLite
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        differences = compare_metadata(context, Base.metadata)
    assert differences == []


def test_audit_log_is_append_only_in_the_database(migrated) -> None:  # type: ignore[no-untyped-def]
    insert = text(
        "INSERT INTO audit_log (id, occurred_at, change_set_id, entity_type, entity_id, action, "
        "origin, actor_label) VALUES ('00000000000000000000000000000001', '2026-09-17', "
        "'00000000000000000000000000000002', 'piece', '00000000000000000000000000000003', "
        "'CREATE', 'SYSTEM', 'tests')"
    )
    with migrated.begin() as connection:
        connection.execute(insert)
    for statement in ("UPDATE audit_log SET actor_label = 'x'", "DELETE FROM audit_log"):
        with pytest.raises(DatabaseError), migrated.begin() as connection:
            connection.execute(text(statement))
    with migrated.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM audit_log")).scalar() == 1


def test_downgrade_to_base(migrated, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    with migrated.begin() as connection:
        config = _config(str(migrated.url))
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
    assert set(inspect(migrated).get_table_names()) <= {"alembic_version"}


def test_postgresql_sql_is_generated_offline(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://matp:unused@localhost:5432/matp")
    config = _config("postgresql+psycopg://matp:unused@localhost:5432/matp")
    command.upgrade(config, "head", sql=True)
    sql = capsys.readouterr().out
    assert sql.count("CREATE TABLE") == len(Base.metadata.tables) + 1  # + alembic_version
    assert "CREATE EXTENSION IF NOT EXISTS pg_trgm" in sql
    assert (
        "CREATE UNIQUE INDEX uq_piece_identifier_current_inventory_code ON piece_identifier "
        "(normalized_value) WHERE identifier_type_code = 'I' AND is_current AND deleted_at IS NULL"
    ) in sql
    assert "CREATE UNIQUE INDEX uq_app_user_email_active ON app_user (lower(email))" in sql
    assert "JSONB" in sql
    for table in ("audit_log", "piece_movement", "piece_source_record", "conservation_assessment"):
        assert f"CREATE TRIGGER trg_{table}_append_only BEFORE UPDATE OR DELETE ON {table}" in sql


def _migrate(engine, revision: str, *, down: bool = False) -> None:  # type: ignore[no-untyped-def]
    with engine.begin() as connection:
        config = _config(str(engine.url))
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


def test_piece_contract_names_keep_the_data(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """0002 renames the piece columns to the contract names without losing rows (tarea 2.1)."""
    engine = _sqlite_engine(tmp_path / "matp.db")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'matp.db').as_posix()}")
    _migrate(engine, "0001_core_data_model")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO piece (id, title, tenure_regime, period_text, period_type, "
                "period_from, period_to, created_at, updated_at) VALUES "
                "('00000000000000000000000000000001', 'Retablo', 'OWNED', 's. XX', 'CENTURY', "
                "1901, 2000, '2026-09-29', '2026-09-29')"
            )
        )

    _migrate(engine, "0002_piece_contract_names")
    columns = {column["name"] for column in inspect(engine).get_columns("piece")}
    assert {
        "denomination",
        "epoch_original_text",
        "epoch_type",
        "epoch_start_year",
        "epoch_end_year",
        "category_id",
        "conservation_state_id",
    } <= columns
    assert not columns & {"title", "period_text", "category_term_id", "code_i"}
    indexes = {index["name"] for index in inspect(engine).get_indexes("piece")}
    assert {"ix_piece_denomination", "ix_piece_category_id"} <= indexes
    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT denomination, epoch_original_text, epoch_type, epoch_start_year, "
                "epoch_end_year FROM piece"
            )
        ).one()
    assert tuple(row) == ("Retablo", "s. XX", "CENTURY", 1901, 2000)
    with pytest.raises(DatabaseError), engine.begin() as connection:
        connection.execute(text("UPDATE piece SET epoch_start_year = 2001"))  # epoch_range

    _migrate(engine, "0001_core_data_model", down=True)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT title, period_to FROM piece")).one() == (
            "Retablo",
            2000,
        )
    engine.dispose()


def test_piece_contract_names_on_postgresql(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """On PostgreSQL the renames keep indexes and constraints aligned with the model names."""
    url = "postgresql+psycopg://matp:unused@localhost:5432/matp"
    monkeypatch.setenv("DATABASE_URL", url)
    command.upgrade(_config(url), "0001_core_data_model:0002_piece_contract_names", sql=True)
    sql = capsys.readouterr().out
    for statement in (
        "ALTER TABLE piece RENAME COLUMN title TO denomination",
        "ALTER TABLE piece RENAME COLUMN period_text TO epoch_original_text",
        "ALTER TABLE piece RENAME COLUMN category_term_id TO category_id",
        "ALTER TABLE piece RENAME COLUMN conservation_status_term_id TO conservation_state_id",
        "ALTER INDEX ix_piece_title RENAME TO ix_piece_denomination",
        "ALTER INDEX IF EXISTS ix_piece_title_trgm RENAME TO ix_piece_denomination_trgm",
        "ALTER TABLE piece RENAME CONSTRAINT ck_piece_period_range TO ck_piece_epoch_range",
        "ALTER TABLE piece RENAME CONSTRAINT fk_piece_category_term_id_term "
        "TO fk_piece_category_id_term",
    ):
        assert statement in sql
    assert "code_i" not in sql
