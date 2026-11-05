"""Spreadsheet and CSV files of a report (change reportes-inventario, task 1.2; RF-033, RF-036).

Both files start with the heading the spec asks for (title, generation date and time, user and
filters) above the detail, so what is printed or shared always says when, by whom and with which
filters it was generated. The subtotals and totals go on their own sheet in Excel and after a blank
line in the CSV: the same data as the preview (reportes-por-atributo D3).
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


def masked_notice(columns: list[str]) -> str:
    """What the role cannot see, in the same words as the preview (RF-041)."""
    if columns == ["Ubicación"]:
        return "Ubicación limitada a sede y espacio por tus permisos"
    return f"Columnas limitadas por tus permisos: {', '.join(columns)}"


def _heading(data: ReportData, generated_at: datetime, generated_by: str) -> list[str]:
    lines = [
        data.title,
        f"Generado el {generated_at:%Y-%m-%d %H:%M} UTC por {generated_by}",
        f"Filtros: {filters_text(data.filters)}",
    ]
    if data.masked_columns:
        lines.append(masked_notice(data.masked_columns))
    return lines


def report_file(
    data: ReportData, fmt: str, *, generated_at: datetime, generated_by: str
) -> tuple[bytes, str]:
    """``(content, content_type)`` of the report in ``xlsx`` or ``csv``."""
    if fmt == "csv":
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        for line in _heading(data, generated_at, generated_by):
            writer.writerow([line])
        writer.writerow([])
        writer.writerow(data.columns)
        writer.writerows(data.rows)
        writer.writerow([])
        writer.writerow(["Grupo", "Etiqueta", "Piezas"])
        for subtotal in data.subtotals:
            writer.writerow([subtotal.group, subtotal.label, subtotal.count])
        for label, value in data.totals.items():
            writer.writerow(["Total", label, value])
        return buffer.getvalue().encode("utf-8-sig"), CSV_CONTENT_TYPE

    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Reporte"
    for line in _heading(data, generated_at, generated_by):
        sheet.append([line])
    sheet["A1"].font = Font(bold=True, size=14)
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
