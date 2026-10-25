"""Spec colecciones-vocabularios — Protección de los tipos de identificador del sistema.

Change colecciones-y-vocabularios-admin, task 1.1 (design D1): migration 0014 adds
``identifier_type.is_system`` and marks the existing ``I`` and ``COLECCION`` types. Runs on
SQLite like ``test_migrations.py``; synthetic data only (RNF-014).
"""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect, text

from app.core.models_base import new_uuid
from app.models import Base
from tests.test_migrations import migrated  # noqa: F401 — fixture
from tests.test_migrations_normalization_params import _migrate


def _insert_type(engine: Engine, code: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO identifier_type (id, code, label, normalization_rule, "
                "is_unique_when_current, locks_on_assignment, owned_pieces_only, "
                "allowed_for_temporary_loan, sort_order, is_active, created_at, updated_at) "
                "VALUES (:id, :code, :label, 'GENERIC', 0, 0, 0, 1, 0, 1, "
                "'2026-10-25 00:00:00', '2026-10-25 00:00:00')"
            ),
            {"id": new_uuid().hex, "code": code, "label": f"Tipo {code} (sintético)"},
        )


def test_the_column_matches_the_model(migrated: Engine) -> None:  # noqa: F811
    columns = {
        column["name"]: column for column in inspect(migrated).get_columns("identifier_type")
    }
    assert "is_system" in columns and columns["is_system"]["nullable"] is False
    with migrated.connect() as connection:
        context = MigrationContext.configure(connection)
        differences = [
            diff for diff in compare_metadata(context, Base.metadata) if "is_system" in repr(diff)
        ]
    assert differences == []


def test_upgrade_marks_the_existing_inventory_and_collection_types(
    migrated: Engine,  # noqa: F811
) -> None:
    _migrate(migrated, "0013_normalization_params", down=True)
    for code in ("I", "COLECCION", "PUCP"):
        _insert_type(migrated, code)

    _migrate(migrated, "head")

    with migrated.connect() as connection:
        rows = dict(connection.execute(text("SELECT code, is_system FROM identifier_type")).all())
    assert {code: bool(flag) for code, flag in rows.items()} == {
        "I": True,
        "COLECCION": True,
        "PUCP": False,
    }


def test_downgrade_drops_only_the_column(migrated: Engine) -> None:  # noqa: F811
    _migrate(migrated, "0013_normalization_params", down=True)

    columns = {column["name"] for column in inspect(migrated).get_columns("identifier_type")}
    assert "is_system" not in columns and "normalization_rule" in columns
