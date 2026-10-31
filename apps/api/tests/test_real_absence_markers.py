"""Spec identificacion-piezas — Marcas de vacío y texto que no es un código (RF-023, RN-010).

Change formatos-reales-importacion, task 4.1 (design D5): «No presenta», «No registra», «Sin
código» and «Sin codigo» are absence markers by default, and migration 0020 adds them to the
administrable list without losing the markers an administrator changed. Synthetic data only.
"""

import json

import pytest
from sqlalchemy import Engine, text

from app.modules.identification.normalization import (
    DEFAULT_RULES,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    is_absence_marker,
    normalize,
)
from tests.test_migrations import migrated  # noqa: F401 — fixture
from tests.test_migrations_normalization_params import _migrate, _settings


@pytest.mark.parametrize(
    "marker", ["No presenta", "NO PRESENTA", "No registra", "Sin código", "Sin codigo"]
)
def test_the_markers_of_the_museum_files_are_absence(marker: str) -> None:
    assert is_absence_marker(marker)


def test_no_presenta_in_the_national_register_is_no_code() -> None:
    result = normalize(DEFAULT_RULES[TYPE_INC_RN], "No presenta")

    assert result.is_absent
    assert result.normalized is None


def test_no_presenta_in_the_inventory_column_is_no_code_i() -> None:
    assert normalize(DEFAULT_RULES[TYPE_INVENTORY], "No presenta").is_absent


def test_the_migration_adds_the_markers_and_keeps_the_administrators_list(
    migrated: Engine,  # noqa: F811
) -> None:
    _migrate(migrated, "0018_tenure_aliases", down=True)
    with migrated.begin() as connection:
        connection.execute(
            text("UPDATE normalization_setting SET value = :value WHERE key = 'absence_markers'"),
            {"value": json.dumps(["S/N", "S/R"])},
        )
    _migrate(migrated, "head")

    assert _settings(migrated)["absence_markers"] == ["S/N", "S/R", "NOPRESENTA", "NOREGISTRA"]

    _migrate(migrated, "0018_tenure_aliases", down=True)
    assert _settings(migrated)["absence_markers"] == ["S/N", "S/R"]
