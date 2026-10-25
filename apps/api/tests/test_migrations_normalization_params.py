"""Spec identificacion-piezas — Parámetros de normalización administrables (RN-010, RF-023).

Change plantillas-mapeo-y-normalizacion, task 2.1 (design D5): migration 0013 creates
``normalization_setting`` and ``collection_acronym_alias`` with logical deletion and audit, and
inserts as initial values the constants of ``normalization.py`` (which task 2.2 will replace by
these rows). Runs the migration on SQLite, as ``test_migrations.py`` does; the PostgreSQL SQL
of every migration is checked there in offline mode. Synthetic data only (RNF-014).
"""

import base64
import json
import re
import string
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, func, insert, inspect, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.models_base import SoftDeleteMixin, new_uuid, utcnow
from app.models import AuditLog, Base, Collection, CollectionAcronymAlias, NormalizationSetting
from app.modules.audit.models import AuditAction
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.models import ABSENCE_MARKERS_KEY, CONCATENATION_SEPARATORS_KEY
from app.modules.identification.normalization import _SPLIT_RE, ABSENCE_MARKERS, split_compound
from tests.conftest import ActAs
from tests.test_migrations import _config, migrated  # noqa: F401 — fixture

TABLES = ("normalization_setting", "collection_acronym_alias")


def _settings(engine: Engine) -> dict[str, object]:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT key, value FROM normalization_setting")).all()
    return {key: json.loads(value) if isinstance(value, str) else value for key, value in rows}


def _migrate(engine: Engine, revision: str, *, down: bool = False) -> None:
    with engine.begin() as connection:
        config = _config(str(engine.url))
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


# --- upgrade, downgrade y modelos ------------------------------------------------------------


def test_upgrade_creates_both_tables_with_soft_delete_and_unique_active_indexes(
    migrated: Engine,  # noqa: F811
) -> None:
    inspector = inspect(migrated)
    for table in TABLES:
        columns = {column["name"] for column in inspector.get_columns(table)}
        assert {"id", "created_at", "updated_at", "deleted_at", "deleted_by_id"} <= columns
        assert "deletion_reason" in columns
    indexes = {
        table: {index["name"]: index for index in inspector.get_indexes(table)} for table in TABLES
    }
    assert indexes["normalization_setting"]["uq_normalization_setting_key_active"]["unique"]
    assert indexes["collection_acronym_alias"]["uq_collection_acronym_alias_active"]["unique"]
    foreign = {
        fk["referred_table"] for fk in inspector.get_foreign_keys("collection_acronym_alias")
    }
    assert foreign == {"collection", "app_user"}


def test_migration_matches_the_new_models(migrated: Engine) -> None:  # noqa: F811
    with migrated.connect() as connection:
        context = MigrationContext.configure(connection)
        differences = [
            diff
            for diff in compare_metadata(context, Base.metadata)
            if any(table in repr(diff) for table in TABLES)
        ]
    assert differences == []


def test_downgrade_drops_only_the_new_tables_and_upgrade_restores_them(
    migrated: Engine,  # noqa: F811
) -> None:
    # Later revisions are not under test: start from this one.
    _migrate(migrated, "0013_normalization_params", down=True)
    before = set(inspect(migrated).get_table_names())

    _migrate(migrated, "0012_completeness_rules", down=True)

    after_down = set(inspect(migrated).get_table_names())
    assert before - after_down == set(TABLES)
    _migrate(migrated, "0013_normalization_params")
    assert set(inspect(migrated).get_table_names()) == before
    assert set(_settings(migrated)) == {ABSENCE_MARKERS_KEY, CONCATENATION_SEPARATORS_KEY}
    _migrate(migrated, "head")


def test_the_new_models_have_logical_deletion_and_audit() -> None:
    for model in (NormalizationSetting, CollectionAcronymAlias):
        assert issubclass(model, SoftDeleteMixin)
        assert model.__audited__ is True
        assert not model.__append_only__


# --- valores iniciales = constantes del código -------------------------------------------------


def test_absence_markers_are_exactly_the_constant(migrated: Engine) -> None:  # noqa: F811
    markers = _settings(migrated)[ABSENCE_MARKERS_KEY]
    assert isinstance(markers, list)
    assert len(markers) == len(set(markers)) == len(ABSENCE_MARKERS)
    assert set(markers) == ABSENCE_MARKERS


def test_concatenation_separators_are_exactly_those_of_the_split_regex(
    migrated: Engine,  # noqa: F811
) -> None:
    value = _settings(migrated)[CONCATENATION_SEPARATORS_KEY]
    assert isinstance(value, dict)
    separators, unsplit = value["separators"], value["unsplit_markers"]
    # Every stored separator splits two codes...
    for separator in separators:
        assert split_compound(f"I-1{separator}I-2") == ["I-1", "I-2"], repr(separator)
    # ...and no other character does.
    others = (set(string.printable) | {"—", "·", "+"}) - set(separators)
    for character in sorted(others):
        assert len(_SPLIT_RE.split(f"A1{character}B2")) == 1, repr(character)
    # The markers with "/" are not split, although "/" is a separator.
    assert unsplit == ["S/N", "S/C"]
    for marker in unsplit:
        assert _SPLIT_RE.split(marker) == [marker]
        assert _SPLIT_RE.split(marker.lower()) == [marker.lower()]
    assert split_compound("I-1 / S/N") == ["I-1"]


def test_there_are_no_initial_aliases(migrated: Engine) -> None:  # noqa: F811
    with migrated.connect() as connection:
        count = connection.scalar(text("SELECT count(*) FROM collection_acronym_alias"))
    assert count == 0


# --- unicidad entre activos, borrado lógico y auditoría -----------------------------------------


def test_a_key_is_unique_among_active_settings_only(migrated: Engine) -> None:  # noqa: F811
    table = NormalizationSetting.__table__
    row = {"key": ABSENCE_MARKERS_KEY, "value": [], "created_at": utcnow(), "updated_at": utcnow()}
    with pytest.raises(IntegrityError), migrated.begin() as connection:
        connection.execute(insert(table).values(id=new_uuid(), **row))
    with migrated.begin() as connection:
        connection.execute(
            update(table).where(table.c.key == ABSENCE_MARKERS_KEY).values(deleted_at=utcnow())
        )
        connection.execute(insert(table).values(id=new_uuid(), **row))
        active = connection.scalar(
            select(func.count())
            .select_from(table)
            .where(table.c.key == ABSENCE_MARKERS_KEY, table.c.deleted_at.is_(None))
        )
    assert active == 1


def test_an_alias_is_unique_among_active_aliases_only(migrated: Engine) -> None:  # noqa: F811
    collection_id = new_uuid()
    alias = CollectionAcronymAlias.__table__
    now = utcnow()
    with migrated.begin() as connection:
        connection.execute(
            insert(Collection.__table__).values(
                id=collection_id,
                name="Colección sintética",
                acronym="LRM",
                acronym_normalized="LRM",
                default_tenure_regime=TenureRegime.OWNED.value,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
    row = {
        "alias": "R.E.P.",  # sigla sintética de prueba, no una sigla real del museo
        "alias_normalized": "REP",
        "collection_id": collection_id,
        "created_at": now,
        "updated_at": now,
    }
    with migrated.begin() as connection:
        connection.execute(insert(alias).values(id=new_uuid(), **row))
    with pytest.raises(IntegrityError), migrated.begin() as connection:
        connection.execute(insert(alias).values(id=new_uuid(), **row))
    with migrated.begin() as connection:
        connection.execute(update(alias).values(deleted_at=now))
        connection.execute(insert(alias).values(id=new_uuid(), **row))


def test_writes_are_audited_and_deletion_is_logical(session: Session, act_as: ActAs) -> None:
    """Uses the database built from the models (``conftest``): the audit hooks are generic."""
    collection = Collection(
        id=new_uuid(), name="Colección sintética", default_tenure_regime=TenureRegime.OWNED
    )
    with act_as("ADMIN"):
        session.add(collection)
        setting = NormalizationSetting(id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=["S/N"])
        alias = CollectionAcronymAlias(
            id=new_uuid(), alias="R.E.P.", alias_normalized="REP", collection_id=collection.id
        )
        session.add_all([setting, alias])
        session.flush()
        setting.value = ["S/N", "NO REGISTRA"]
        session.flush()
        soft_delete(session, alias, "Alias de prueba (sintético)")
        session.flush()

    entries = session.execute(
        select(AuditLog.entity_type, AuditLog.action).where(AuditLog.entity_type.in_(TABLES))
    ).all()
    actions = {(entity, action) for entity, action in entries}
    assert ("normalization_setting", AuditAction.CREATE) in actions
    assert ("normalization_setting", AuditAction.UPDATE) in actions
    assert ("collection_acronym_alias", AuditAction.CREATE) in actions
    assert ("collection_acronym_alias", AuditAction.SOFT_DELETE) in actions
    assert alias.deleted_at is not None and alias.deletion_reason == "Alias de prueba (sintético)"


def test_migration_file_belongs_to_the_change() -> None:
    migration = (
        Path(__file__).resolve().parents[1] / "alembic/versions/0013_normalization_params.py"
    )
    source = migration.read_text(encoding="utf-8")
    assert 'down_revision: str | None = "0012_completeness_rules"' in source
    assert "plantillas-mapeo-y-normalizacion" in source


def test_offline_postgresql_sql_inserts_the_same_values(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The base64 of the offline SQL decodes to the constants, with real line breaks."""
    url = "postgresql+psycopg://matp:unused@localhost:5432/matp"
    monkeypatch.setenv("DATABASE_URL", url)
    command.upgrade(_config(url), "0012_completeness_rules:head", sql=True)
    sql = capsys.readouterr().out
    values = {
        key: json.loads(base64.b64decode(encoded).decode())
        for key, encoded in re.findall(
            r"'(\w+)', convert_from\(decode\('([A-Za-z0-9+/=]+)', 'base64'\), 'UTF8'\)::jsonb", sql
        )
    }
    assert set(values[ABSENCE_MARKERS_KEY]) == ABSENCE_MARKERS
    assert values[CONCATENATION_SEPARATORS_KEY]["separators"] == ["/", ";", "|", ",", "\n", "\r"]
