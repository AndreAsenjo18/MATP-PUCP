"""Synthetic Excel fixture that reproduces the problems of the consultancy spreadsheets.

Columns are illustrative [SUPUESTO] (question A1) until a real anonymized sample arrives.
"""

import io
import random
from pathlib import Path

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
