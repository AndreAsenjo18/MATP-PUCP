"""Streaming Excel writer with bounded memory consumption (RF-036, design D3).

Uses openpyxl in `write_only=True` mode to guarantee constant memory usage even when
exporting tens of thousands of rows. Produces a primary results sheet and a secondary
sheet documenting active filters, timestamp, requesting user and permission-masked columns.
"""

from __future__ import annotations

import datetime
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any, BinaryIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
META_HEADER_FILL = PatternFill(start_color="2F5597", end_color="2F5597", fill_type="solid")


def _format_cell_value(val: Any) -> Any:
    """Format dates, UUIDs, enums and None values cleanly for openpyxl cells."""
    if val is None:
        return ""
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.isoformat()
    if hasattr(val, "value"):  # Enums
        return str(val.value)
    return val


def write_table(
    target: str | Path | BinaryIO,
    rows_iter: Iterable[Sequence[Any]],
    columns: Sequence[str],
    *,
    sheet_title: str = "Resultados",
    active_filters: Sequence[Any] | None = None,
    generated_at: datetime.datetime | None = None,
    user_label: str | None = None,
    omitted_columns: Sequence[str] | None = None,
) -> None:
    """Write tabular data to an Excel workbook in streaming write_only mode."""
    wb = Workbook(write_only=True)

    # 1. Primary Sheet: Tabular data
    ws = wb.create_sheet(title=sheet_title)
    ws.append(list(columns))

    for row in rows_iter:
        ws.append([_format_cell_value(cell) for cell in row])

    # 2. Secondary Sheet: "Filtros" (Audit & metadata traceability)
    ws_meta = wb.create_sheet(title="Filtros")
    ws_meta.append(["Metadato", "Valor"])

    gen_time = generated_at or datetime.datetime.now(datetime.UTC)
    ws_meta.append(["Fecha de generacin (UTC)", gen_time.isoformat()])

    if user_label:
        ws_meta.append(["Usuario solicitante", user_label])

    if omitted_columns:
        ws_meta.append(["Columnas omitidas por permisos (RF-041)", ", ".join(omitted_columns)])

    ws_meta.append([])
    ws_meta.append(["Filtro", "Valor aplicado"])

    if active_filters:
        for f in active_filters:
            label = getattr(f, "label", None) or getattr(f, "key", "Filtro")
            val = getattr(f, "value_display", None) or str(f)
            ws_meta.append([label, val])
    else:
        ws_meta.append(["(Ninguno)", "Catlogo completo sin filtros adicionales"])

    wb.save(target)
