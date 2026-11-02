"""Spec importacion-datos — Encabezados de grupo y filas que repiten el encabezado (RF-021, RF-028).

Change formatos-reales-importacion, tasks 2.1 and 2.2 (design D7): an empty header cell inside a
group takes the group name («Procedencia (2)»), with the group written above or with sub-headers
below (the catalogue sheets of the museum: «Dimensiones» over «Largo (cm)», «Ancho (cm)»…); the
sub-header row and rows that repeat the header are not data and are counted. Synthetic workbooks
with the real headers and invented values (RNF-014).
"""

import io
from typing import Any

from openpyxl import Workbook

from app.modules.imports.ingest import ingest
from app.modules.imports.log import _header_rows_text

HEADERS = ["Nº", "Código  INC", "Título/Denominación", "Procedencia", None, None, "Observaciones"]


def workbook(rows: list[list[Any]], merges: tuple[str, ...] = ()) -> bytes:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    for row in rows:
        sheet.append(row)
    for cells in merges:
        sheet.merge_cells(cells)
    output = io.BytesIO()
    book.save(output)
    return output.getvalue()


TITLE = ["FICHA DE CATALOGACIÓN (sintética)"] + [None] * 6
SUB = [None, None, None, "Departamento", "Provincia", "Distrito", None]
DATA = [1, "6001", "Mate sintético", "Ayacucho", "Huamanga", "Quinua", "—"]


def test_group_without_merged_cells_and_sub_headers_below() -> None:
    result = ingest(workbook([TITLE, HEADERS, SUB, DATA]), "ficha.xlsx")

    assert result.header_row == 2
    assert result.headers[3:6] == ["Procedencia", "Procedencia (2)", "Procedencia (3)"]
    assert result.skipped_header_rows == [3]  # the sub-header row is not a piece
    assert [row.row_number for row in result.rows] == [4]
    assert result.rows[0].raw_data["Procedencia (3)"] == "Quinua"


def test_merged_group_with_sub_headers_gives_the_same_names() -> None:
    merged = ingest(workbook([TITLE, HEADERS, SUB, DATA], merges=("D2:F2",)), "ficha.xlsx")

    assert merged.headers[3:6] == ["Procedencia", "Procedencia (2)", "Procedencia (3)"]
    assert merged.skipped_header_rows == [3]
    assert merged.row_count == 1


def test_group_named_in_the_row_above() -> None:
    above = [None, None, None, "Procedencia", None, None, None]
    header = ["Nº", "Código  INC", "Título/Denominación", "Procedencia", None, None, "Obs."]

    result = ingest(workbook([above, header, DATA]), "ficha.xlsx", header_row=2)

    assert result.headers[3:6] == ["Procedencia", "Procedencia (2)", "Procedencia (3)"]
    assert result.skipped_header_rows == []
    assert result.row_count == 1


def test_an_empty_header_without_group_keeps_its_generated_name() -> None:
    header = ["Nº", "Título/Denominación", None, "Observaciones"]

    result = ingest(workbook([header, [1, "Toro sintético", "x", "—"]]), "plano.xlsx")

    assert result.headers == ["Nº", "Título/Denominación", "Columna C", "Observaciones"]


def test_a_row_repeating_the_header_is_skipped_and_counted() -> None:
    header = ["Nº", "Código  INC", "Título/Denominación", "Procedencia", "Observaciones"]
    rows = [header] + [[n, str(6000 + n), f"Pieza {n}", "Lima", ""] for n in range(1, 104)]
    rows.append(["Nº", "Código  INC", "Título / Denominación", "Procedencia", "Observaciones"])
    rows.append([104, "6104", "Pieza 104", "Lima", ""])

    result = ingest(workbook(rows), "varias_fichas.xlsx")

    assert result.skipped_header_rows == [105]
    assert result.row_count == 104
    assert _header_rows_text(result.skipped_header_rows) == (
        "1 fila omitida por repetir el encabezado (fila 105)"
    )


def test_a_row_resembling_the_header_but_with_data_is_loaded() -> None:
    header = ["Nº", "Código  INC", "Título/Denominación", "Procedencia", "Observaciones"]
    similar = [7, "6007", "Mate", "Procedencia", "dice «Procedencia» en la etiqueta"]

    result = ingest(workbook([header, similar]), "fichas.xlsx")

    assert result.skipped_header_rows == []
    assert result.row_count == 1


def test_the_log_reports_the_skipped_rows() -> None:
    assert _header_rows_text([]) is None
    assert _header_rows_text([3, 105]) == (
        "2 filas omitidas por repetir el encabezado (filas 3, 105)"
    )
