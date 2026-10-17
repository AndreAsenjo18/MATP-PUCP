"""Synthetic Excel fixture that reproduces the problems of the consultancy spreadsheets.

Columns are illustrative [SUPUESTO] (question A1) until a real anonymized sample arrives.
"""

import csv
import io
import random
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage

from app.seed.images import placeholder_photo

HEADERS = [
    "N°",
    "CÓDIGOS",
    "COLECCIÓN",
    "DENOMINACIÓN",
    "ÉPOCA",
    "MATERIAL",
    "MEDIDAS",
    "PROCEDENCIA",
    "UBICACIÓN",
    "OBS. CONSULTORÍA",
    "FOTO",
]

ROWS = [
    ("I-0236 / M.M.Z. 015", "MMZ", "Toro de Pucará", "s. XX", "arcilla", "alto 23 cm x diám. 15 cm", "Puno", "Depósito 1 / Rack A / N2", ""),
    ("I 236", "M.M.Z.", "Toro de pucara", "S. XX", "Arcilla", "23 x 15", "Puno", "", "Posible duplicado de la fila 2"),
    ("I 2362 / RA 28", "RA", "Retablo ayacuchano", "ca. 1950", "madera, pasta de papa", "alto 40 cm", "Ayacucho", "Sala 2", ""),
    ("S/N", "RAB", "Cajón San Marcos", "1960-1970", "madera", "", "Ayacucho", "", "Sin código I"),
    ("AJB 12", "AJB", "Niño Manuelito", "s. XIX", "madera policromada", "alto 35 cm", "Cusco", "Depósito 2", "Comodato: no publicar fotos"),
    ("I-0999 / AJB 13", "AJB", "Virgen de la Puerta", "fines del s. XIX", "yeso", "", "La Libertad", "", "Error: comodato con código I"),
    ("MBB 40", "MBB", "Juego de mates burilados", "3000 años", "calabaza", "", "Junín", "Depósito 1", "Conjunto"),
    ("MBB 40.1", "MBB", "Mate burilado (componente 1)", "", "calabaza", "diám. 12 cm", "Junín", "", ""),
    ("INC 1234 ; RN 004521", "LRM", "Charango", "desconocida", "madera", "largo 60 cm", "Apurímac", "", "INC 4 y 6 dígitos"),
    ("s/c", "", "Máscara de chuncho", "", "yeso", "", "", "", "Pieza suelta"),
    ("???", "LRM", "Tabla pintada de Sarhua", "década de 1940", "madera", "", "Ayacucho", "", "Código ilegible"),
    ("mmz 15", "mmz", "Toro de Pucará (3 cuernos)", "ca 1950", "arcilla", "", "Puno", "", ""),
]  # fmt: skip


def write_synthetic_workbook(directory: Path, *, random_seed: int = 20260917) -> Path:
    rng = random.Random(random_seed)
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "SABANA"
    sheet.append(HEADERS)
    for index, row in enumerate(ROWS, start=1):
        sheet.append([index, *row, ""])
    # Extra random rows with the same kinds of problems.
    for index in range(len(ROWS) + 1, 41):
        number = rng.randint(100, 9000)
        acronym = rng.choice(["MMZ", "RA", "MBB", "LRM"])
        code = rng.choice([f"I-{number:04d}", f"{'.'.join(acronym)}. {number % 90:03d}", "S/N", ""])
        sheet.append(
            [index, code, acronym, rng.choice(["Cántaro decorado", "Manta tejida", "Quena"]),
             rng.choice(["s. XX", "ca. 1950", ""]), "", "", rng.choice(["Cusco", "Lima", ""]), "", "", ""]
        )  # fmt: skip
    # Photos anchored to rows (RF-029): rows 2 and 4, plus one image not anchored to data.
    for anchor, label in (
        ("L2", "Toro de Pucará"),
        ("L4", "Retablo ayacuchano"),
        ("N50", "Sin fila"),
    ):
        generated = placeholder_photo(label, "FRONTAL", width=160, height=120)
        image = XlImage(io.BytesIO(generated.data))
        sheet.add_image(image, anchor)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "sabana_sintetica_v1.xlsx"
    workbook.save(path)
    return path


# --- Ingestion fixtures (importacion-pipeline-reconciliacion 2.2) ------------------------------
MULTI_SHEET_HEADERS = [
    "N°",
    "CÓDIGO I",
    "COLECCIÓN",
    "N° COLECCIÓN",
    "CÓDIGOS",
    "DENOMINACIÓN",
    "PROCEDENCIA",
]
MULTI_SHEET_ROWS = [
    (1, "I-0101", "MMZ", 15, "Toro de Pucará", "Puno"),
    (2, "I-0102", "MMZ", 16, "Cántaro decorado", "Puno"),
    (3, "", "RA", 28, "Retablo ayacuchano", "Ayacucho"),
    (4, "I-0104", "LRM", 7, "Máscara de chuncho", "Junín"),
]  # fmt: skip


def write_multi_sheet_workbook(directory: Path) -> Path:
    """Excel with a summary sheet and an inventory sheet whose headers are on row 3.

    The inventory sheet has a title merged over row 1, a vertically merged collection
    (rows 4–5), an empty row between data rows and a ``CÓDIGOS`` column whose cells are formulas
    that concatenate two columns. The calculated values are stored in the file, as Excel or
    LibreOffice would, because ``openpyxl`` cannot calculate formulas.
    """
    workbook = Workbook()
    summary = workbook.active
    assert summary is not None
    summary.title = "Resumen"
    summary.append(["Inventario sintético de prueba"])
    summary.append(["Piezas", len(MULTI_SHEET_ROWS)])

    sheet = workbook.create_sheet("Inventario")
    sheet["A1"] = "Inventario sintético — Colecciones del museo"
    sheet.merge_cells("A1:G1")
    for col, header in enumerate(MULTI_SHEET_HEADERS, start=1):
        sheet.cell(row=3, column=col, value=header)
    cached: dict[str, str] = {}
    row = 4
    for index, (number, code_i, acronym, coll_number, name, origin) in enumerate(MULTI_SHEET_ROWS):
        if index == 2:
            row += 1  # empty row between data rows
        sheet.cell(row=row, column=1, value=number)
        sheet.cell(row=row, column=2, value=code_i or None)
        if index != 1:  # row 5 is covered by the merged collection of row 4
            sheet.cell(row=row, column=3, value=acronym)
        sheet.cell(row=row, column=4, value=coll_number)
        sheet.cell(row=row, column=5, value=f'=C{row}&" "&D{row}')
        cached[f"E{row}"] = f"{acronym} {coll_number}"
        sheet.cell(row=row, column=6, value=name)
        sheet.cell(row=row, column=7, value=origin)
        row += 1
    sheet.merge_cells("C4:C5")

    buffer = io.BytesIO()
    workbook.save(buffer)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "ingesta_varias_hojas.xlsx"
    path.write_bytes(_store_formula_values(buffer.getvalue(), "xl/worksheets/sheet2.xml", cached))
    return path


def _store_formula_values(content: bytes, sheet_path: str, values: dict[str, str]) -> bytes:
    """Write the calculated value of string formulas into the sheet XML (``<v>``)."""
    source = zipfile.ZipFile(io.BytesIO(content))
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename == sheet_path:
                xml = data.decode("utf-8")
                for ref, value in values.items():
                    xml, replaced = re.subn(
                        rf'<c r="{ref}"><f>(.*?)</f><v ?/>(?:</v>)?</c>',
                        lambda m, v=value, r=ref: (
                            f'<c r="{r}" t="str"><f>{m.group(1)}</f><v>{escape(v)}</v></c>'
                        ),
                        xml,
                    )
                    assert replaced == 1, ref
                data = xml.encode("utf-8")
            target.writestr(item, data)
    return output.getvalue()


CSV_LATIN1_ROWS = [
    ("CÓDIGOS", "COLECCIÓN", "DENOMINACIÓN", "ÉPOCA", "PROCEDENCIA"),
    ("I-0236 / M.M.Z. 015", "MMZ", "Toro de Pucará", "s. XX", "Puno"),
    ("RA 28", "RA", "Retablo ayacuchano; con puertas", "ca. 1950", "Ayacucho"),
    ("", "", "", "", ""),
    ("S/N", "LRM", "Máscara de chuncho", "", "Junín"),
    ("AJB 12", "AJB", "Niño Manuelito", "s. XIX", "Cusco"),
]


def write_latin1_csv(directory: Path) -> Path:
    """CSV as saved by Excel on Windows in Spanish: Latin-1, ``;`` separator, quoted cells."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerows(CSV_LATIN1_ROWS)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "ingesta_latin1_puntoycoma.csv"
    path.write_bytes(buffer.getvalue().encode("latin-1"))
    return path


def write_all_fixtures(directory: Path, *, random_seed: int = 20260917) -> list[Path]:
    return [
        write_synthetic_workbook(directory, random_seed=random_seed),
        write_multi_sheet_workbook(directory),
        write_latin1_csv(directory),
    ]
