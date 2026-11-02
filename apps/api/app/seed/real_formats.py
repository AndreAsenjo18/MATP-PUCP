"""Workbooks with the real headers of the museum files and invented values (change
formatos-reales-importacion, task 1.2; RNF-014, ADR-019).

The real files have personal data of owners and live outside git (``data/real/``). These
fixtures copy only their **structure**: the column names of each family and variant, the
two-row header of the catalogue sheets (merged and not merged), a repeated header, the sheet
«Errores pendientes», and the code forms that matter (5-digit RN, «No presenta», ``ELA 12 CEL``,
``AMM-IN-V-0001``, numbers without acronym, notes in the code I column). Every value is invented.
Collections are those of the synthetic seed (``MMZ``, ``LRM``).
"""

import io
from pathlib import Path
from typing import Any

from openpyxl import Workbook

from app.seed.import_templates import BD_ESTANDARIZADA, FICHA_RN

FOLDER = "formatos_reales"

BD44 = BD_ESTANDARIZADA.headers
BD46 = [
    *(header for header in BD44 if header != "Autor / Atribuido / Firmado"),
    "Autor / Atribuido",
    "Firmado",
    "Estilo / Escuela",
]
BD27 = [
    "N°",
    "N° Inventario MATP (I)",
    "Código de la colección",
    "N° Inscripción Registro Nacional",
    "Nombre de la Colección",
    "Fecha de ingreso a la colección",
    "Autor / Atribuido / Firmado",
    "Procedencia (Ciudad, País, Continente)",
    "Época / Año",
    "Tipo de bien",
    "Título / Denominación",
    "Material",
    "Alto (cm)",
    "Ancho (cm)",
    "Espesor (cm)",
    "Diámetro (cm)",
    "Peso (gr)",
    "Técnica de manufactura",
    "Técnica de acabado/decoración",
    "Descripción",
    "Estado de conservación (bueno, regular, malo)",
    "Estado de integridad (completo, incompleto, fragmentado)",
    "Detalle de conservación (deterioros)",
    "Tratamiento de conservación",
    "Datos de registro anterior \n(nombre y fecha)",
    "Ubicación en inmueble",
    "Observaciones",
]
ERRORS28 = [*BD27[:4], "Código de propietario (RN*)", *BD27[4:]]
FICHA54 = FICHA_RN.headers
ADDITIONAL = {header for header in FICHA54 if "elemento adicional" in header.casefold()} | {
    "Elementos adicionales (marco, base, pedestal, tapa, etc.)"
}
FICHA40 = [
    "Decoración" if header == "Descripcion de decoración" else header
    for header in FICHA54
    if header not in ADDITIONAL and header not in {"Fecha de Fotografiado"}
]

#: Invented rows of the standardized database: (code I, collection code, RN, collection,
#: denomination, acquisition method). The code forms are those of the real files.
BD_ROWS: tuple[tuple[Any, ...], ...] = (
    ("I-09101", "MMZ 101", 31234, "MMZ", "Toro de Pucará sintético", "Donación"),
    ("No presenta", "MMZ 102", "No presenta", "MMZ", "Retablo sintético", "Compra"),
    ("AMM-IN-V-0001", "AMM-IN-V-0001", 41235, "MMZ", "Manta sintética", "Donación"),
    ("I-09104", 45, 51236, "MMZ", "Mate sintético", "Cesión de uso"),
    ("I-09105", "ELA 012 CEL", 61237, "LRM", "Tabla sintética", "Custodia"),
    (
        "número de inventario mal asignado, revisar",
        "LRM 106",
        71238,
        "LRM",
        "Máscara sintética",
        "Compra",
    ),
)


def _bd_values(headers: list[str], row: tuple[Any, ...], number: int) -> list[Any]:
    code_i, collection_code, rn, collection, denomination, acquisition = row
    known = {
        "N°": number,
        "N° Inventario MATP (I)": code_i,
        "Código de la colección": collection_code,
        "N° Inscripción Registro Nacional": rn,
        "Código de propietario (RN*)": f"PROP-{number:03d}",
        "Nombre de la Colección": collection,
        "Forma de Adquisición": acquisition,
        "Fecha de ingreso a la colección": "15/03/1998",
        "Título / Denominación": denomination,
        "Material": "Arcilla",
        "Alto (cm)": 12.5,
        "Ancho (cm)": "8,3",
        "Tipo de propietario": "Persona natural (sintética)",
        "Nombre de propietario": "Propietario sintético",
        "Dirección de propietario": "Calle Inventada 123",
        "Observaciones": "Fila sintética",
    }
    return [known.get(header) for header in headers]


def _save(book: Workbook) -> bytes:
    output = io.BytesIO()
    book.save(output)
    return output.getvalue()


def bd_workbook(headers: list[str], *, errors_sheet: bool = False) -> bytes:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.title = "Inventario"
    sheet.append(headers)
    for number, row in enumerate(BD_ROWS, start=1):
        sheet.append(_bd_values(headers, row, number))
    if errors_sheet:
        errors = book.create_sheet("Errores pendientes")
        errors.append(ERRORS28)
        errors.append([*_bd_values(ERRORS28, BD_ROWS[0], 1)[:-1], "Medida no coincide"])
    return _save(book)


def _ficha_header_rows(headers: list[str]) -> tuple[list[Any], list[Any], list[str]]:
    """Row 2 with the groups written once and row 3 with their sub-headers, as the real sheets."""
    row2: list[Any] = []
    row3: list[Any] = []
    merges = []
    subheaders = {
        "Procedencia": ["Departamento", "Provincia", "Distrito"],
        "Dimensiones": ["Alto (cm)", "Ancho (cm)", "Espesor (cm)", "Diámetro (cm)"],
    }
    for index, header in enumerate(headers, start=1):
        group, _, position = header.partition(" (")
        if group in subheaders and (not position or position.rstrip(")").isdigit()):
            k = int(position.rstrip(")")) if position else 1
            row2.append(group if k == 1 else None)
            row3.append(subheaders[group][k - 1])
            if k == 1:
                width = len(subheaders[group])
                merges.append((index, index + width - 1))
        else:
            row2.append(header)
            row3.append(None)
    from openpyxl.utils import get_column_letter

    ranges = [f"{get_column_letter(a)}2:{get_column_letter(b)}2" for a, b in merges]
    return row2, row3, ranges


def ficha_workbook(headers: list[str], *, merged: bool, repeat_header: bool = False) -> bytes:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.title = "COLECCIÓN AJB 9901 - 9905"
    row2, row3, ranges = _ficha_header_rows(headers)
    sheet.append(["FICHA DE CATALOGACIÓN (sintética)"])
    sheet.append(row2)
    sheet.append(row3)
    for number in range(1, 6):
        values = {
            "Nº": number,
            "Código  INC": 9900 + number if number != 3 else "3311/3312",
            "Otros códigos": f"AJB {9900 + number}",
            "Título/Denominación": f"Pieza sintética {number}",
            "Procedencia": "Ayacucho",
            "Procedencia (2)": "Huamanga",
            "Procedencia (3)": "Quinua",
            "Dimensiones": 10,
            "Dimensiones (2)": 5,
            "Colección": "AJB",
            "Propietario (persona natural o jurídica)": "Propietario sintético",
        }
        sheet.append([values.get(header) for header in headers])
        if repeat_header and number == 3:
            sheet.append(row2)  # a sheet that joins several cards repeats its header
    if merged:
        for cells in ranges:
            sheet.merge_cells(cells)
    return _save(book)


FILES = {
    "bd_estandarizada_44.xlsx": lambda: bd_workbook(BD44),
    "bd_estandarizada_46.xlsx": lambda: bd_workbook(BD46),
    "bd_estandarizada_27_con_errores.xlsx": lambda: bd_workbook(BD27, errors_sheet=True),
    "ficha_rn_combinada.xlsx": lambda: ficha_workbook(FICHA54, merged=True, repeat_header=True),
    "ficha_rn_sin_combinar_40.xlsx": lambda: ficha_workbook(FICHA40, merged=False),
}


def write_real_formats(directory: Path) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for name, build in FILES.items():
        target = directory / name
        target.write_bytes(build())
        written.append(target)
    return written
