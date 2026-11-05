"""Synthetic demo batch: a 30-row spreadsheet with dirty codes and a folder of 80 photos.

Change importacion-masiva-fotografias, task 7.1 (and the demo of the import process). Everything
is fictitious (RNF-014). The rows reproduce the coding chaos on purpose and the photos cover the
three matching paths of design D3: the code in the file name (with the sequence and view suffixes
the matcher strips), the code in a folder of the relative path (nearest folder first), and no
code at all (manual tray), plus ambiguous names (a code two rows share) and repeated files.

Codes avoid the synthetic seed on purpose (I numbers above 9100 and collection numbers above
500), except rows 18 and 19, which update two seeded pieces (``MMZ 1`` and ``RA 2``) so the demo
shows a diff. ``EXPECTED`` documents what each file should end as, for the demo script.
"""

import io
from dataclasses import dataclass
from pathlib import Path

from openpyxl import Workbook

from app.seed.images import placeholder_photo

HEADERS = [
    "N°",
    "CÓDIGOS",
    "COLECCIÓN",
    "RÉGIMEN",
    "DENOMINACIÓN",
    "ÉPOCA",
    "MATERIAL",
    "MEDIDAS",
    "PROCEDENCIA",
    "OBS. CONSULTORÍA",
    "FOTO",
]

# codes, collection, denomination, period, material, measures, origin, observation
ROWS: list[tuple[str, str, str, str, str, str, str, str]] = [
    ("I-9101 / M.M.Z. 501", "MMZ", "Toro de Pucará", "s. XX", "arcilla", "alto 23 cm", "Puno", ""),
    ("I 9102", "MMZ", "Cántaro con asas", "ca. 1950", "arcilla", "", "Puno", ""),
    ("I.9103 / RA 501", "RA", "Retablo de San Marcos", "1960-1970", "madera, pasta de papa", "alto 40 cm", "Ayacucho", ""),
    ("S/N", "RA", "Retablo de Navidad", "s. XX", "madera", "", "Ayacucho", "Sin código I"),
    ("R.A. 502", "RA", "Retablo de la Huida a Egipto", "", "madera", "", "Ayacucho", ""),
    ("MBB 501", "MBB", "Mate burilado con escenas de cosecha", "s. XX", "calabaza", "diám. 14 cm", "Junín", ""),
    ("M B B 502", "MBB", "Mate burilado de feria", "", "calabaza", "", "Junín", ""),
    ("mbb-503", "MBB", "Mate burilado pequeño", "", "calabaza", "diám. 8 cm", "Junín", ""),
    ("I-9109 ; INC 4521", "LRM", "Charango de caparazón", "desconocida", "madera", "largo 62 cm", "Apurímac", "INC de 4 dígitos"),
    ("RN 009121", "LRM", "Quena de hueso", "", "hueso", "", "Cusco", "RN de 6 dígitos, sin código I"),
    ("LRM 501 | PUCP-501", "LRM", "Tabla de Sarhua", "década de 1940", "madera", "", "Ayacucho", ""),
    ("s/c", "", "Máscara de diablada", "", "yeso", "", "Puno", "Pieza suelta, sin código"),
    ("AJB 501", "AJB", "Niño Manuelito", "s. XIX", "madera policromada", "alto 35 cm", "Cusco", "Comodato: no publicar fotos"),
    ("I-9114 / AJB 502", "AJB", "Virgen de la Candelaria", "fines del s. XIX", "yeso", "", "Puno", "Error: comodato con código I"),
    ("I-9115", "MMZ", "Toro de Pucará", "s. XX", "arcilla", "", "Puno", "Posible duplicado de la fila 2"),
    ("I-9116", "MMZ", "Plato decorado", "", "arcilla", "", "Cusco", ""),
    ("I-9116", "MMZ", "Plato decorado (segundo registro)", "", "arcilla", "", "Cusco", "Mismo código I que la fila 17"),
    ("M.M.Z. 001", "MMZ", "Pieza del catálogo con procedencia corregida", "", "", "", "Puno (corregido)", "Actualiza una ficha existente"),
    ("RA 2", "RA", "Retablo del catálogo con procedencia corregida", "", "", "", "Huamanga (corregido)", "Actualiza una ficha existente"),
    ("I-9120 / MMZ 504", "MMZ", "Jarra antropomorfa", "s. XX", "arcilla", "", "Puno", ""),
    ("I-9121", "MMZ", "Silbato de cerámica", "", "arcilla", "", "Puno", ""),
    ("RA 505", "RA", "Retablo costumbrista", "ca. 1980", "madera", "", "Ayacucho", ""),
    ("MBB 506", "MBB", "Mate con tapa", "", "calabaza", "", "Junín", ""),
    ("I-9124", "LRM", "Tambor ceremonial", "", "cuero, madera", "", "Puno", ""),
    ("LRM 507", "LRM", "Arpa pequeña", "", "madera", "alto 80 cm", "Apurímac", ""),
    ("I-9126 / RA 508", "RA", "Caja de imaginero", "s. XX", "madera", "", "Ayacucho", ""),
    ("???", "LRM", "Tabla pintada", "", "madera", "", "Ayacucho", "Código ilegible"),
    ("I-9128", "MMZ", "Vasija con relieve", "", "arcilla", "", "Puno", ""),
    ("MMZ 509", "MMZ", "Cántaro de chicha", "", "arcilla", "", "Puno", ""),
    ("I-9130", "MBB", "Calabaza pirograbada", "", "calabaza", "", "Junín", ""),
]  # fmt: skip


@dataclass(frozen=True)
class DemoPhoto:
    path: str  # relative path inside the photo folder, as the browser would send it
    row: int | None  # spreadsheet row it belongs to (2 = first data row); None = no piece
    expected: str  # "nombre", "carpeta", "ambigua", "sin código", "repetida"
    same_as: str | None = None  # identical bytes to another file (repeated photo)


def _by_name(row: int, *names: str) -> list[DemoPhoto]:
    return [DemoPhoto(name, row, "nombre") for name in names]


def _by_folder(row: int, folder: str, count: int) -> list[DemoPhoto]:
    return [
        DemoPhoto(f"{folder}/IMG_{index:04d}.jpg", row, "carpeta") for index in range(1, count + 1)
    ]


PHOTOS: list[DemoPhoto] = [
    # 1. The code is in the file name (sequence and view suffixes are stripped).
    *_by_name(2, "I-9101.jpg", "I-9101 (2).jpg", "I-9101_frontal.jpg", "I-9101_2.jpg", "I-9101-a.jpg"),
    *_by_name(3, "I 9102.jpg", "I 9102 (2).jpg"),
    *_by_name(4, "RA 501.jpg", "RA 501-a.jpg", "RA 501-b.jpg"),
    *_by_name(6, "R.A. 502.jpg", "R.A. 502 copia.jpg"),
    *_by_name(7, "MBB 501.jpg", "MBB 501_frontal.jpg", "MBB 501 (2).jpg"),
    *_by_name(14, "AJB 501.jpg", "AJB 501 (2).jpg"),
    *_by_name(15, "I-9114.jpg"),
    *_by_name(16, "I-9115.jpg", "I-9115 (2).jpg"),
    *_by_name(19, "MMZ 001.jpg", "MMZ 001 (2).jpg"),
    *_by_name(20, "RA 2.jpg"),
    *_by_name(29, "i-9128.jpg", "I-9128 (2).jpg", "I-9128 (3).jpg"),
    *_by_name(30, "M.M.Z. 509.jpg", "M.M.Z. 509_2.jpg", "MMZ 509 (3).jpg"),
    *_by_name(31, "I-9130.jpg", "I-9130 copia.jpg", "I-9130_2.jpg"),
    # 2. The code is in a folder of the path (the nearest folder wins).
    *_by_folder(8, "MBB 502", 3),
    *_by_folder(9, "mbb-503", 2),
    *_by_folder(10, "I-9109", 4),
    *_by_folder(11, "RN 009121", 2),
    *_by_folder(12, "LRM 501", 3),
    *_by_folder(21, "Depósito 2/MMZ 504", 3),
    *_by_folder(22, "I-9121", 2),
    *_by_folder(23, "RA 505", 3),
    *_by_folder(24, "MBB 506", 2),
    *_by_folder(25, "I-9124", 3),
    *_by_folder(26, "LRM 507", 2),
    *_by_folder(27, "I-9126", 3),
    # 3. Ambiguous: rows 17 and 18 share the code I-9116.
    DemoPhoto("I-9116.jpg", None, "ambigua"),
    DemoPhoto("I-9116 (2).jpg", None, "ambigua"),
    DemoPhoto("I-9116_frontal.jpg", None, "ambigua"),
    # 4. No code at all: they go to the manual tray.
    DemoPhoto("sin_codigo/DSC_0912.jpg", None, "sin código"),
    DemoPhoto("sin_codigo/DSC_0913.jpg", None, "sin código"),
    DemoPhoto("sin_codigo/DSC_0914.jpg", None, "sin código"),
    DemoPhoto("WhatsApp Image 2024-05-03 at 10.15.22.jpeg", None, "sin código"),
    DemoPhoto("foto (1).jpg", None, "sin código"),
    DemoPhoto("Retablo de Navidad.jpg", None, "sin código"),
    DemoPhoto("Mascara de diablada.jpg", None, "sin código"),
    DemoPhoto("Mascara de diablada (2).jpg", None, "sin código"),
    DemoPhoto("Tabla pintada.jpg", None, "sin código"),
    DemoPhoto("IMG_20240101.jpg", None, "sin código"),
    DemoPhoto("escaneo.png", None, "sin código"),
    # 5. Repeated files: the same bytes as another photo of the folder.
    DemoPhoto("I-9101 copia (2).jpg", 2, "repetida", same_as="I-9101.jpg"),
    DemoPhoto("sin_codigo/DSC_0912 (1).jpg", None, "repetida", same_as="sin_codigo/DSC_0912.jpg"),
]  # fmt: skip

PHOTO_FOLDER = "fotos"


def regime(collection: str) -> str:
    """AJB is the illustrative loan-for-use collection [SUPUESTO]; the rest are owned (RN-006)."""
    return "Comodato" if collection == "AJB" else "Propiedad"


SHEET_NAME = "lote_demo_sabana.xlsx"


def _image_bytes(photo: DemoPhoto, by_path: dict[str, DemoPhoto]) -> bytes:
    source = by_path[photo.same_as] if photo.same_as else photo
    stem = Path(source.path).stem
    denomination = ROWS[source.row - 2][2] if source.row else "Foto sin pieza"
    generated = placeholder_photo(f"{denomination} - {stem}", source.path, width=320, height=240)
    if not source.path.lower().endswith(".png"):
        return generated.data
    from PIL import Image

    buffer = io.BytesIO()
    Image.open(io.BytesIO(generated.data)).save(buffer, format="PNG")
    return buffer.getvalue()


def write_demo_batch(directory: Path) -> list[Path]:
    """Write ``lote_demo_sabana.xlsx`` and the ``fotos/`` folder into ``directory``."""
    directory.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "LOTE"
    sheet.append(HEADERS)
    first_photo: dict[int, str] = {}
    for photo in PHOTOS:
        if photo.row is not None and photo.expected == "nombre":
            first_photo.setdefault(photo.row, Path(photo.path).name)
    for number, (codes, collection, *rest) in enumerate(ROWS, start=1):
        sheet.append(
            [number, codes, collection, regime(collection), *rest, first_photo.get(number + 1, "")]
        )
    sheet_path = directory / SHEET_NAME
    workbook.save(sheet_path)

    written = [sheet_path]
    by_path = {photo.path: photo for photo in PHOTOS}
    folder = directory / PHOTO_FOLDER
    for photo in PHOTOS:
        target = folder / photo.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(_image_bytes(photo, by_path))
        written.append(target)
    return written
