"""Spreadsheet and CSV files of a report (change reportes-inventario, task 1.2; RF-033, RF-036).

The Excel file starts with the heading the spec asks for (title, generation date and time, user
and filters) above the detail, and carries the subtotals and totals on their own sheet, so what
is printed or shared always says when, by whom and with which filters it was generated.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from app.modules.reports.builders import ReportData

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_CONTENT_TYPE = "text/csv"
DESCRIPTION_COLUMN = "Descripción"
DESCRIPTION_WIDTH = 60


def _cell(value: Any) -> Any:
    return value if isinstance(value, int | float | Decimal) or value is None else str(value)


def filters_text(filters: dict[str, Any]) -> str:
    if not filters:
        return "Sin filtros"
    return "; ".join(f"{key}: {value}" for key, value in filters.items())


def report_file(
    data: ReportData, fmt: str, *, generated_at: datetime, generated_by: str
) -> tuple[bytes, str]:
    """``(content, content_type)`` of the report in ``xlsx`` or ``csv``."""
    if fmt == "csv":
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerow(data.columns)
        writer.writerows(data.rows)
        return buffer.getvalue().encode("utf-8-sig"), CSV_CONTENT_TYPE

    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Reporte"
    sheet.append([data.title])
    sheet["A1"].font = Font(bold=True, size=14)
    sheet.append([f"Generado el {generated_at:%Y-%m-%d %H:%M} UTC por {generated_by}"])
    sheet.append([f"Filtros: {filters_text(data.filters)}"])
    if data.masked_columns:
        sheet.append([f"Columnas limitadas por su rol: {', '.join(data.masked_columns)} (RF-041)"])
    sheet.append([])
    sheet.append(data.columns)
    for cell in sheet[sheet.max_row]:
        cell.font = Font(bold=True)
    first_row = sheet.max_row + 1
    for row in data.rows:
        sheet.append([_cell(value) for value in row])
    if DESCRIPTION_COLUMN in data.columns:
        # The whole text fits in its column, in several lines (reportes-por-atributo D2).
        column = data.columns.index(DESCRIPTION_COLUMN) + 1
        sheet.column_dimensions[get_column_letter(column)].width = DESCRIPTION_WIDTH
        for cells in sheet.iter_rows(min_row=first_row, min_col=column, max_col=column):
            cells[0].alignment = Alignment(wrap_text=True, vertical="top")

    summary = workbook.create_sheet("Subtotales")
    summary.append(["Grupo", "Etiqueta", "Piezas"])
    for subtotal in data.subtotals:
        summary.append([subtotal.group, "  " * subtotal.level + subtotal.label, subtotal.count])
    summary.append([])
    for label, value in data.totals.items():
        summary.append(["Total", label, value])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue(), XLSX_CONTENT_TYPE
