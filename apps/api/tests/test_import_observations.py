"""Observations of the consultancy's error sheets (change formatos-reales-importacion, task 6.2;
design D8, [SUPUESTO L8]): source, text and how they are added to the notes of a piece."""

from app.modules.imports.mapping import MappedRow
from app.modules.imports.models import ImportBatch
from app.modules.imports.observations import (
    is_error_sheet,
    observation_line,
    observation_source,
    observation_text,
    with_observation,
)


def _batch(sheet: str | None, file_name: str = "BD inventario.xlsx") -> ImportBatch:
    return ImportBatch(source_name="Excel", file_name=file_name, sheet_name=sheet)


def test_error_sheets_are_recognized_with_or_without_accents_and_case() -> None:
    assert is_error_sheet("Errores pendientes")
    assert is_error_sheet("  ERRORES identificados")
    assert not is_error_sheet("Inventario")
    assert not is_error_sheet(None)


def test_an_error_sheet_comes_from_the_consultancy_any_other_from_its_file() -> None:
    assert observation_source(_batch("Errores pendientes")) == (
        "Consultoría 2024/25 — errores pendientes"
    )
    assert observation_source(_batch("Revisión 2026")) == "BD inventario.xlsx — Revisión 2026"
    assert observation_source(_batch(None, "errores.csv")) == "errores.csv"


def test_the_text_joins_the_notes_and_every_column_not_mapped_to_a_code() -> None:
    row = MappedRow(
        fields={"notes": "Revisar  ficha"},
        source_payload={"Error": "Código repetido", "Vacía": "  ", "Fila": 12},
    )

    assert observation_text(row) == "Revisar ficha; Error: Código repetido; Fila: 12"
    assert observation_text(MappedRow(source_payload={"Error": None})) is None
    assert observation_line(_batch("Errores pendientes"), row) == (
        "[Consultoría 2024/25 — errores pendientes] Revisar ficha; Error: Código repetido; Fila: 12"
    )


def test_an_observation_is_added_after_the_notes_and_never_replaces_them() -> None:
    assert with_observation(None, "[Fuente] Nota") == "[Fuente] Nota"
    assert with_observation("Previa\n", "[Fuente] Nota") == "Previa\n[Fuente] Nota"
