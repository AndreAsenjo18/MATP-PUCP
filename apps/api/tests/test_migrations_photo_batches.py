"""Spec importacion-datos — Lote de solo fotografías para piezas existentes (RF-046).

Change importacion-fotos-a-catalogo, task 1.2 (design D1, D2, D3): migration 0019 adds the kind of
batch, the reading rules, the piece of a photo and the ``photo_camera_patterns`` setting. Runs on
SQLite, as ``test_migrations.py`` does; the PostgreSQL SQL of every migration is checked there in
offline mode. Synthetic data only (RNF-014).
"""

import json
import uuid

import pytest
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError

from tests.test_migrations import _config, migrated  # noqa: F401 — fixture
from tests.test_migrations_normalization_params import _migrate, _settings

NOW = "2026-10-31 10:00:00"


def _insert_batch(engine: Engine) -> str:
    batch_id = uuid.uuid4().hex
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO import_batch (id, source_name, file_name, status, created_at, "
                "updated_at) VALUES (:id, 'Sábana sintética', 'sabana.xlsx', 'UPLOADED', :now, "
                ":now)"
            ),
            {"id": batch_id, "now": NOW},
        )
    return batch_id


def test_existing_batches_become_spreadsheet_batches(migrated: Engine) -> None:  # noqa: F811
    _migrate(migrated, "0018_tenure_aliases", down=True)
    batch_id = _insert_batch(migrated)
    _migrate(migrated, "head")
    with migrated.connect() as connection:
        kind = connection.scalar(
            text("SELECT kind FROM import_batch WHERE id = :id"), {"id": batch_id}
        )
    assert kind == "SPREADSHEET"


def test_upgrade_adds_the_columns_and_the_camera_patterns_setting(
    migrated: Engine,  # noqa: F811
) -> None:
    inspector = inspect(migrated)
    assert {"kind", "photo_reading"} <= {c["name"] for c in inspector.get_columns("import_batch")}
    assert {
        "piece_id",
        "candidate_piece_ids",
        "match_reason",
        "width_px",
        "height_px",
        "perceptual_hash",
        "same_as_photo_id",
    } <= {c["name"] for c in inspector.get_columns("import_photo")}
    assert _settings(migrated)["photo_camera_patterns"] == []


def _insert_photo(engine: Engine, batch_id: str, **extra: str) -> None:
    columns = {
        "id": uuid.uuid4().hex,
        "batch_id": batch_id,
        "relative_path": "ALTAS/82LF4169 copy.jpg",
        "original_filename": "82LF4169 copy.jpg",
        "content_sha256": uuid.uuid4().hex * 2,
        "size_bytes": 1024,
        "content_type": "image/jpeg",
        "storage_prefix": "media/x/",
        "status": "VERIFIED",
        "duplicate_of_existing": False,
        "duplicate_confirmed": False,
        "created_at": NOW,
        "updated_at": NOW,
        **extra,
    }
    names = ", ".join(columns)
    values = ", ".join(f":{name}" for name in columns)
    with engine.begin() as connection:
        connection.execute(text(f"INSERT INTO import_photo ({names}) VALUES ({values})"), columns)


def _first(engine: Engine, table: str) -> str:
    with engine.connect() as connection:
        return connection.scalar(text(f"SELECT id FROM {table} LIMIT 1"))  # type: ignore[no-any-return]


def test_photo_goes_to_a_row_or_to_a_piece_never_both(migrated: Engine) -> None:  # noqa: F811
    batch_id = _insert_batch(migrated)
    with migrated.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO import_row (id, batch_id, source_row_number, raw_data, "
                "has_validation_errors, decision, created_at, updated_at) VALUES (:id, :batch, 2, "
                "'{}', 0, 'PENDING', :now, :now)"
            ),
            {"id": uuid.uuid4().hex, "batch": batch_id, "now": NOW},
        )
        connection.execute(
            text(
                "INSERT INTO piece (id, denomination, tenure_regime, version, created_at, "
                "updated_at) VALUES (:id, 'Pieza sintética', 'OWNED', 1, :now, :now)"
            ),
            {"id": uuid.uuid4().hex, "now": NOW},
        )
    row_id, piece_id = _first(migrated, "import_row"), _first(migrated, "piece")
    _insert_photo(migrated, batch_id, row_id=row_id)
    _insert_photo(migrated, batch_id, piece_id=piece_id, match_source="TEMPLATE")
    with pytest.raises(IntegrityError):
        _insert_photo(migrated, batch_id, row_id=row_id, piece_id=piece_id)
    with pytest.raises(IntegrityError):
        _insert_photo(migrated, batch_id, match_source="GUESS")


def test_downgrade_removes_only_what_the_migration_added(migrated: Engine) -> None:  # noqa: F811
    _migrate(migrated, "0018_tenure_aliases", down=True)
    inspector = inspect(migrated)
    assert "kind" not in {c["name"] for c in inspector.get_columns("import_batch")}
    assert "piece_id" not in {c["name"] for c in inspector.get_columns("import_photo")}
    settings = _settings(migrated)
    assert "photo_camera_patterns" not in settings
    assert "tenure_aliases" in settings
    _migrate(migrated, "head")
    assert json.dumps(_settings(migrated)["photo_camera_patterns"]) == "[]"
