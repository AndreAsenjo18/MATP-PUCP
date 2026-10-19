"""Spec importacion-datos — Ingesta de hojas de cálculo con límites (RF-021, RF-028).

Change importacion-pipeline-reconciliacion, task 2.2. Fixtures are synthetic (RNF-014).
"""

import io
from datetime import date
from pathlib import Path

import pytest
from openpyxl import Workbook

from app.modules.imports.ingest import MERGED_KEY, IngestionFailed, file_format, ingest, list_sheets
from app.seed.fixtures import (
    CSV_LATIN1_ROWS,
    MULTI_SHEET_HEADERS,
    write_latin1_csv,
    write_multi_sheet_workbook,
)

FIXTURES = Path(__file__).resolve().parents[3] / "data" / "fixtures"


def _xlsx(*sheets: tuple[str, list[list]]) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for title, rows in sheets:
        sheet = workbook.create_sheet(title)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


# --- Scenario: Excel con varias hojas ----------------------------------------------------------
@pytest.fixture(scope="module")
def multi_sheet() -> bytes:
    return (FIXTURES / "ingesta_varias_hojas.xlsx").read_bytes()


def test_chosen_sheet_and_header_row(multi_sheet: bytes) -> None:
    result = ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario", header_row=3)

    assert result.file_format == "xlsx"
    assert result.sheet_names == ["Resumen", "Inventario"]
    assert result.sheet_name == "Inventario"
    assert result.header_row == 3
    assert result.headers == MULTI_SHEET_HEADERS
    assert [row.row_number for row in result.rows] == [4, 5, 7, 8]
    assert result.rows[0].raw_data["DENOMINACIÓN"] == "Toro de Pucará"


def test_header_row_is_detected_below_a_merged_title(multi_sheet: bytes) -> None:
    result = ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario")

    assert result.header_row == 3
    assert result.headers == MULTI_SHEET_HEADERS


def test_default_sheet_is_the_first_non_empty_one() -> None:
    content = _xlsx(("Vacía", []), ("Datos", [["CÓDIGO", "DENOMINACIÓN"], ["I-1", "Quena"]]))

    result = ingest(content, "libro.xlsx")

    assert result.sheet_name == "Datos"
    assert result.rows[0].raw_data == {"CÓDIGO": "I-1", "DENOMINACIÓN": "Quena"}


def test_list_sheets(multi_sheet: bytes) -> None:
    assert list_sheets(multi_sheet) == ["Resumen", "Inventario"]


# --- Scenario: Fórmulas en celdas ----------------------------------------------------------------
def test_formula_cells_use_the_stored_calculated_value(multi_sheet: bytes) -> None:
    result = ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario", header_row=3)

    assert [row.raw_data["CÓDIGOS"] for row in result.rows] == [
        "MMZ 15",
        "MMZ 16",
        "RA 28",
        "LRM 7",
    ]


# --- Celdas combinadas y filas vacías ----------------------------------------------------------
def test_merged_cells_propagate_and_are_marked(multi_sheet: bytes) -> None:
    result = ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario", header_row=3)
    first, second = result.rows[0].raw_data, result.rows[1].raw_data

    assert second["COLECCIÓN"] == "MMZ"
    assert second[MERGED_KEY] == ["COLECCIÓN"]
    assert MERGED_KEY not in first


def test_empty_rows_between_data_are_skipped_and_counted(multi_sheet: bytes) -> None:
    result = ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario", header_row=3)

    assert result.row_count == 4
    assert result.skipped_empty_rows == 1


def test_trailing_empty_rows_are_not_counted() -> None:
    content = _xlsx(
        ("Hoja", [["A", "B"], ["1", "x"], [None, None], ["2", "y"], [None, None], [None, None]])
    )

    result = ingest(content, "libro.xlsx")

    assert result.row_count == 2
    assert result.skipped_empty_rows == 1


# --- Cabeceras y valores -----------------------------------------------------------------------
def test_missing_duplicate_and_extra_headers_get_names() -> None:
    content = _xlsx(("Hoja", [["CÓDIGO", None, "CÓDIGO"], ["I-1", "MMZ 1", "RA 2", None, "nota"]]))

    result = ingest(content, "libro.xlsx", header_row=1)

    assert result.headers == ["CÓDIGO", "Columna B", "CÓDIGO (2)", "Columna D", "Columna E"]
    assert result.rows[0].raw_data["Columna E"] == "nota"


def test_values_are_json_friendly() -> None:
    content = _xlsx(("Hoja", [["FECHA", "N°", "TEXTO"], [date(1950, 1, 2), 15, "  "]]))

    raw = ingest(content, "libro.xlsx").rows[0].raw_data

    assert raw == {"FECHA": "1950-01-02T00:00:00", "N°": 15, "TEXTO": None}


# --- Scenario: CSV en Latin-1 con punto y coma ---------------------------------------------------
def test_latin1_semicolon_csv() -> None:
    result = ingest((FIXTURES / "ingesta_latin1_puntoycoma.csv").read_bytes(), "ingesta.csv")

    assert result.file_format == "csv"
    assert result.delimiter == ";"
    assert result.encoding in {"cp1252", "latin-1"}
    assert result.headers == list(CSV_LATIN1_ROWS[0])
    assert result.rows[0].raw_data["DENOMINACIÓN"] == "Toro de Pucará"
    assert result.rows[1].raw_data["DENOMINACIÓN"] == "Retablo ayacuchano; con puertas"
    assert result.rows[2].raw_data["PROCEDENCIA"] == "Junín"
    assert result.rows[2].raw_data["ÉPOCA"] is None
    assert result.row_count == 4
    assert result.skipped_empty_rows == 1


def test_utf8_bom_comma_csv() -> None:
    content = "﻿CÓDIGO,DENOMINACIÓN\nMMZ 15,Toro de Pucará\n".encode()

    result = ingest(content, "datos.CSV")

    assert result.encoding == "utf-8-sig"
    assert result.delimiter == ","
    assert result.rows[0].raw_data == {"CÓDIGO": "MMZ 15", "DENOMINACIÓN": "Toro de Pucará"}


# --- Scenario: Archivo que supera el límite de filas ----------------------------------------------
def test_row_limit_exceeded() -> None:
    content = _xlsx(("Hoja", [["CÓDIGO"], *[[f"I-{n}"] for n in range(6)]]))

    with pytest.raises(IngestionFailed) as error:
        ingest(content, "libro.xlsx", max_rows=5)

    assert error.value.code == "row_limit_exceeded"
    assert error.value.details == {"max_rows": 5}
    assert "5" in error.value.message


def test_row_limit_is_inclusive() -> None:
    content = _xlsx(("Hoja", [["CÓDIGO"], *[[f"I-{n}"] for n in range(5)]]))

    assert ingest(content, "libro.xlsx", max_rows=5).row_count == 5


# --- Errores de ingesta --------------------------------------------------------------------------
@pytest.mark.parametrize("name", ["base.xls", "base.mdb", "tabla.docx", "sin_extension"])
def test_unsupported_formats(name: str) -> None:
    with pytest.raises(IngestionFailed) as error:
        file_format(name)
    assert error.value.code == "unsupported_format"


def test_unreadable_xlsx() -> None:
    with pytest.raises(IngestionFailed) as error:
        ingest(b"esto no es un excel", "roto.xlsx")
    assert error.value.code == "unreadable_file"


def test_unknown_sheet(multi_sheet: bytes) -> None:
    with pytest.raises(IngestionFailed) as error:
        ingest(multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Hoja1")
    assert error.value.code == "sheet_not_found"
    assert error.value.details["sheet_names"] == ["Resumen", "Inventario"]


@pytest.mark.parametrize("header_row", [2, 40])
def test_header_row_empty_or_missing(multi_sheet: bytes, header_row: int) -> None:
    with pytest.raises(IngestionFailed) as error:
        ingest(
            multi_sheet, "ingesta_varias_hojas.xlsx", sheet_name="Inventario", header_row=header_row
        )
    assert error.value.code == "header_row_not_found"


@pytest.mark.parametrize(
    ("content", "name"), [(b"", "vacio.csv"), (_xlsx(("Hoja", [])), "vacio.xlsx")]
)
def test_empty_files(content: bytes, name: str) -> None:
    with pytest.raises(IngestionFailed) as error:
        ingest(content, name)
    assert error.value.code == "empty_file"


# --- Fixtures ------------------------------------------------------------------------------------
def test_existing_synthetic_sheet_is_ingested() -> None:
    result = ingest(
        (FIXTURES / "sabana_sintetica_v1.xlsx").read_bytes(), "sabana_sintetica_v1.xlsx"
    )

    assert result.sheet_name == "SABANA"
    assert result.header_row == 1
    assert result.row_count == 40
    assert result.rows[0].raw_data["CÓDIGOS"] == "I-0236 / M.M.Z. 015"


def test_fixture_generators_match_committed_files(tmp_path: Path) -> None:
    for writer in (write_multi_sheet_workbook, write_latin1_csv):
        generated = writer(tmp_path)
        committed = FIXTURES / generated.name
        assert committed.exists(), f"regenerate with: python -m app.seed --fixtures {FIXTURES}"
        options = {"sheet_name": "Inventario"} if generated.suffix == ".xlsx" else {}
        new = ingest(generated.read_bytes(), generated.name, **options)
        old = ingest(committed.read_bytes(), committed.name, **options)
        assert [r.raw_data for r in new.rows] == [r.raw_data for r in old.rows]
