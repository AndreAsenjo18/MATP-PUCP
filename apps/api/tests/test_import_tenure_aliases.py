"""Spec importacion-datos — Régimen deducido de la forma de adquisición (RF-005, RN-010).

Change ajustes-lectura-importacion, task 1.2 (design D1): migration 0018 stores the
correspondences as the ``tenure_aliases`` normalization parameter, with the values of
``DEFAULT_TENURE_ALIASES``; the parameters read them, folded, or keep the defaults when the row
is missing or unreadable. Synthetic data only (RNF-014).
"""

import importlib.util
import json
from pathlib import Path

from alembic import command
from sqlalchemy import Engine, text

from app.modules.identification.models import TENURE_ALIASES_KEY
from app.modules.identification.normalization import DEFAULT_TENURE_ALIASES, fold_label
from app.modules.identification.params import params_from_rows
from tests.test_migrations import _config, migrated  # noqa: F401 — fixture

MIGRATION = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "0018_tenure_aliases.py"


def _migration_module():  # type: ignore[no-untyped-def]
    spec = importlib.util.spec_from_file_location("m0018", MIGRATION)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _migrate(engine: Engine, revision: str, *, down: bool = False) -> None:
    with engine.begin() as connection:
        config = _config(str(engine.url))
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


def _rows(engine: Engine) -> list[tuple[str, object, object]]:
    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT key, value, deleted_at FROM normalization_setting WHERE key = :key"),
            {"key": TENURE_ALIASES_KEY},
        ).all()
    return [
        (key, json.loads(value) if isinstance(value, str) else value, deleted_at)
        for key, value, deleted_at in rows
    ]


def test_the_migration_copies_the_defaults_of_the_code() -> None:
    assert dict(DEFAULT_TENURE_ALIASES) == _migration_module().TENURE_ALIASES
    assert all(fold_label(key) == key for key in DEFAULT_TENURE_ALIASES)


def test_upgrade_inserts_the_correspondences(migrated: Engine) -> None:  # noqa: F811
    [(key, value, deleted_at)] = _rows(migrated)
    assert key == TENURE_ALIASES_KEY and deleted_at is None
    assert value["cesion de uso"] == "LOAN_FOR_USE" and value["custodia"] == "LOAN_FOR_USE"
    assert value["donacion"] == "OWNED"


def test_downgrade_removes_only_its_row_and_upgrade_keeps_an_existing_one(
    migrated: Engine,  # noqa: F811
) -> None:
    _migrate(migrated, "0017_piece_version", down=True)
    assert _rows(migrated) == []

    with migrated.begin() as connection:  # an administrator's row, created before the upgrade
        connection.execute(
            text(
                "INSERT INTO normalization_setting (id, key, value, created_at, updated_at) "
                "VALUES ('00000000000000000000000000000001', :key, :value, "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {"key": TENURE_ALIASES_KEY, "value": json.dumps({"deposito": "LOAN_FOR_USE"})},
        )
    _migrate(migrated, "head")

    assert [value for _key, value, _d in _rows(migrated)] == [{"deposito": "LOAN_FOR_USE"}]
    _migrate(migrated, "0017_piece_version", down=True)
    assert [value for _key, value, _d in _rows(migrated)] == [{"deposito": "LOAN_FOR_USE"}]


def test_the_parameters_read_the_row_folded() -> None:
    params = params_from_rows({TENURE_ALIASES_KEY: {"Depósito ": "LOAN_FOR_USE"}})
    assert params.tenure_aliases == {"deposito": "LOAN_FOR_USE"}


def test_without_the_row_or_with_an_unreadable_one_the_defaults_apply() -> None:
    assert params_from_rows({}).tenure_aliases == DEFAULT_TENURE_ALIASES
    unreadable = params_from_rows({TENURE_ALIASES_KEY: ["cesion de uso"]})
    assert unreadable.tenure_aliases == DEFAULT_TENURE_ALIASES
