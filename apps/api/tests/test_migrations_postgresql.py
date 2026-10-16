"""Migrations verified against a real PostgreSQL engine (change ci-migraciones-postgresql).

The rest of the suite runs on SQLite in memory, so it can never catch a migration that only
fails on PostgreSQL: a partial index with invalid syntax, the ``pg_trgm`` extension, the
append-only triggers or the JSONB columns. These tests run that cycle on a real engine and are
skipped with a reason when ``TEST_POSTGRES_URL`` is not defined (spec «Sin PostgreSQL
disponible»).
"""

import io
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.exc import DatabaseError
from sqlalchemy.pool import NullPool

from app.models import Base

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]

# Trigram search indexes, created by `_create_search_extensions` in 0001 and renamed in 0002.
# They are the only expected difference between the migrated schema and the models: they exist
# solely on PostgreSQL (`pg_trgm`, `gin_trgm_ops`) and are deliberately not declared in the
# models, because the rest of the suite runs on SQLite. Dropping them from a migration would be
# a real regression, so `test_trigram_search_indexes_exist` covers them separately.
TRIGRAM_INDEXES = {
    "ix_piece_denomination_trgm",
    "ix_piece_identifier_normalized_trgm",
    "ix_piece_identifier_original_trgm",
}

# Unique indexes whose uniqueness only applies to the rows that are still active: removing their
# WHERE clause would allow a second current code I (RN-002) or a second active e-mail.
PARTIAL_UNIQUE_INDEXES: dict[str, tuple[str, str]] = {
    "uq_app_user_email_active": ("app_user", "deleted_at IS NULL"),
    "uq_collection_acronym_active": (
        "collection",
        "deleted_at IS NULL AND acronym_normalized IS NOT NULL",
    ),
    "uq_piece_identifier_current_inventory_code": (
        "piece_identifier",
        "identifier_type_code = 'I' AND is_current AND deleted_at IS NULL",
    ),
    "uq_role_permission_active": ("role_permission", "deleted_at IS NULL"),
    "uq_user_role_active": ("user_role", "deleted_at IS NULL"),
}

# SQLSTATE 42501 (insufficient_privilege) raised by matp_reject_append_only_change().
APPEND_ONLY_SQLSTATE = "42501"


def _config(url: str) -> Config:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.cmd_opts = None
    config.set_section_option("alembic", "sqlalchemy.url", url)
    return config


def _run(engine: Engine, revision: str, *, down: bool = False) -> None:
    with engine.begin() as connection:
        config = _config(str(engine.url))
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


def append_only_tables() -> list[str]:
    """Tables whose rows can only be inserted, taken from the models and never hardcoded (D3).

    A new append-only entity only has to declare ``__append_only__ = True`` for these tests to
    cover it; nobody has to edit a list here.
    """
    return sorted(
        mapper.local_table.name
        for mapper in Base.registry.mappers
        if getattr(mapper.class_, "__append_only__", False)
    )


@pytest.fixture
def migrated(postgres_url: str) -> Iterator[Engine]:
    engine = create_engine(postgres_url, poolclass=NullPool)
    # A no-op when the schema is already at head, and it re-applies the migrations when a previous
    # test left the database at base, so the order of the tests in this module does not matter.
    _run(engine, "head")
    yield engine
    engine.dispose()


def _unexpected_differences(differences: list[Any]) -> list[Any]:
    return [
        difference
        for difference in differences
        if not (
            difference[0] == "remove_index"
            and getattr(difference[1], "name", None) in TRIGRAM_INDEXES
        )
    ]


def test_schema_matches_the_models(migrated: Engine) -> None:
    """A column added to a model without its migration fails here (escenario «Modelo y migración
    desalineados»)."""
    with migrated.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        differences = compare_metadata(context, Base.metadata)
    unexpected = _unexpected_differences(differences)
    assert unexpected == [], (
        "El esquema migrado difiere del modelo de datos. "
        f"Esperadas y justificadas: {sorted(TRIGRAM_INDEXES)}. No esperadas: {unexpected}"
    )


def test_migration_creates_every_model_table(migrated: Engine) -> None:
    tables = set(inspect(migrated).get_table_names())
    assert set(Base.metadata.tables) <= tables
    assert "alembic_version" in tables


def test_search_extension_is_installed(migrated: Engine) -> None:
    """Similarity search and duplicate detection depend on pg_trgm (RF-030, RF-031)."""
    with migrated.connect() as connection:
        installed = {
            extension
            for (extension,) in connection.execute(text("SELECT extname FROM pg_extension"))
        }
    assert "pg_trgm" in installed, f"Extensiones instaladas: {sorted(installed)}"


def test_trigram_search_indexes_exist(migrated: Engine) -> None:
    with migrated.connect() as connection:
        indexes = {name for (name,) in connection.execute(text("SELECT indexname FROM pg_indexes"))}
    assert indexes >= TRIGRAM_INDEXES, (
        f"Faltan los índices de trigramas: {sorted(TRIGRAM_INDEXES - indexes)}"
    )


def _normalize(definition: str) -> str:
    """PostgreSQL renders a predicate with its own casts and parentheses.

    ``WHERE (((identifier_type_code)::text = 'I'::text) AND is_current AND (deleted_at IS NULL))``
    is the same predicate as ``identifier_type_code = 'I' AND is_current AND deleted_at IS NULL``.
    """
    return re.sub(r"[()\s]", "", definition.lower().replace("::text", ""))


def test_partial_unique_indexes_keep_their_predicate(migrated: Engine) -> None:
    """Los índices únicos parciales verificados en el motor: sin su WHERE, se duplicarían."""
    with migrated.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'"
            )
        ).all()
    defined = {name: (table, definition) for name, table, definition in rows}
    for name, (expected_table, predicate) in PARTIAL_UNIQUE_INDEXES.items():
        assert name in defined, f"Falta el índice único parcial {name}"
        table, definition = defined[name]
        assert table == expected_table
        assert "CREATE UNIQUE INDEX" in definition
        assert " WHERE " in definition, f"{name} perdió su cláusula WHERE: {definition}"
        assert _normalize(predicate) in _normalize(definition), (
            f"{name} cambió su predicado. Esperado: {predicate}. Definido: {definition}"
        )


def test_every_append_only_table_rejects_changes(migrated: Engine) -> None:
    """Cada tabla de solo inserción tiene su disparador activo en el motor (RN-005)."""
    tables = append_only_tables()
    assert tables, "No se derivó ninguna tabla de solo inserción desde los modelos"
    with migrated.connect() as connection:
        triggers = {name for (name,) in connection.execute(text("SELECT tgname FROM pg_trigger"))}
    for table in tables:
        assert f"trg_{table}_append_only" in triggers, (
            f"Falta el disparador de solo inserción de {table} (los hay: {sorted(triggers)})"
        )
        assert f"trg_{table}_no_truncate" in triggers


def test_append_only_trigger_blocks_update_and_delete(migrated: Engine) -> None:
    """Escenario «Protección de la auditoría ausente»: sin el disparador, la escritura pasa."""
    with migrated.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO audit_log (id, occurred_at, change_set_id, entity_type, entity_id, "
                "action, origin, actor_label) VALUES "
                "('00000000000000000000000000000001', '2026-09-30', "
                "'00000000000000000000000000000002', 'piece', "
                "'00000000000000000000000000000003', 'CREATE', 'SYSTEM', 'tests')"
            )
        )
    for statement in (
        "UPDATE audit_log SET actor_label = 'alterado'",
        "DELETE FROM audit_log",
    ):
        with pytest.raises(DatabaseError) as excinfo, migrated.begin() as connection:
            connection.execute(text(statement))
        assert getattr(excinfo.value.orig, "sqlstate", None) == APPEND_ONLY_SQLSTATE, (
            f"{statement} no fue rechazada por el disparador de solo inserción"
        )
    with migrated.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM audit_log")).scalar() == 1


def test_downgrade_to_base_and_upgrade_again(migrated: Engine) -> None:
    """Escenario «Reversión incompleta»: la base queda vacía y vuelve a construirse (RNF-011)."""
    _run(migrated, "base", down=True)
    assert set(inspect(migrated).get_table_names()) <= {"alembic_version"}

    _run(migrated, "head")
    assert set(Base.metadata.tables) <= set(inspect(migrated).get_table_names())
    with migrated.connect() as connection:
        installed = {
            extension
            for (extension,) in connection.execute(text("SELECT extname FROM pg_extension"))
        }
    assert "pg_trgm" in installed, "La nueva aplicación no recreó la extensión de búsqueda"


def test_term_hierarchy_round_trip_keeps_piece_classification(migrated: Engine) -> None:
    """0003 adds and removes ``term.parent_id`` without losing any classification (tarea 2.2)."""
    _run(migrated, "0002_loans_and_exhibitions", down=True)
    with migrated.begin() as connection:
        vocabulary_id = connection.execute(
            text(
                "INSERT INTO vocabulary (id, code, name, created_at, updated_at) "
                "VALUES (gen_random_uuid(), 'CATEGORY', 'Categorías', now(), now()) RETURNING id"
            )
        ).scalar_one()
        term_id = connection.execute(
            text(
                "INSERT INTO term (id, vocabulary_id, code, label, sort_order, is_active, "
                "created_at, updated_at) VALUES (gen_random_uuid(), :vocabulary, 'RETABLO', "
                "'Retablo', 0, true, now(), now()) RETURNING id"
            ),
            {"vocabulary": vocabulary_id},
        ).scalar_one()
        connection.execute(
            text(
                "INSERT INTO piece (id, denomination, tenure_regime, category_id, created_at, "
                "updated_at) VALUES (gen_random_uuid(), 'Retablo', 'OWNED', :term, now(), now())"
            ),
            {"term": term_id},
        )

    _run(migrated, "0003_term_hierarchy")
    with migrated.begin() as connection:
        child_id = connection.execute(
            text(
                "INSERT INTO term (id, vocabulary_id, parent_id, code, label, sort_order, "
                "is_active, created_at, updated_at) VALUES (gen_random_uuid(), :vocabulary, "
                ":parent, 'RETABLO_CAJON', 'Retablo de cajón', 0, true, now(), now()) RETURNING id"
            ),
            {"vocabulary": vocabulary_id, "parent": term_id},
        ).scalar_one()
        assert connection.execute(text("SELECT category_id FROM piece")).scalar_one() == term_id

    _run(migrated, "0002_loans_and_exhibitions", down=True)
    with migrated.connect() as connection:
        assert connection.execute(text("SELECT category_id FROM piece")).scalar_one() == term_id
        assert (
            connection.execute(
                text("SELECT count(*) FROM term WHERE id = :id"), {"id": child_id}
            ).scalar_one()
            == 1
        )
    _run(migrated, "head")
    with migrated.begin() as connection:  # the database is shared by the tests of this module
        connection.execute(text("DELETE FROM piece"))
        connection.execute(
            text("DELETE FROM term WHERE vocabulary_id = :id"), {"id": vocabulary_id}
        )
        connection.execute(text("DELETE FROM vocabulary WHERE id = :id"), {"id": vocabulary_id})
