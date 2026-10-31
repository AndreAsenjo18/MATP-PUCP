"""Synthetic photo archive for «Importar fotografías al catálogo» (change
importacion-fotos-a-catalogo, task 8.1; RNF-014).

Reproduces the structure of the museum Drive with invented data: one folder per collection named
by its acronym, a range subfolder, a folder of correlative + camera counter, camera names in two
resolutions (``ALTAS/``), a generic folder and a correspondences list. It points to pieces of the
synthetic seed (``npm run seed``): collection codes ``MMZ 1…6``, ``MBB 1…3`` and ``LRM 1…5``. No
name, code or photo comes from the museum.

The forms of the proposal (F1–F6):

- F1 ``MMZ 001 - PUCP 9101 (1).JPG``: acronym + correlative and a PUCP code (not in the seed: the
  collection code alone finds the piece);
- F2 ``MMZ 2 - INC 0000.jpg``: with an INC code that does not exist;
- F3 ``I-0000 MMZ-3(1).jpg``: an inventory code and the collection code;
- F4 ``Fotos Coleccion LRM/1.JPG``: a number alone in the folder of the collection;
- F5 ``FOTOS 001-100/004-3269.jpg`` and ``005-3270 x.jpg``: correlative + camera counter, read with
  the template ``{n}-{*}`` and the collection MMZ chosen by the user;
- F6 ``82LF4169.jpg`` (small) and ``ALTAS/82LF4169 copy.jpg`` (large): a camera name, assigned
  by the correspondences list to ``MMZ 6``.
"""

import io
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

FOLDER = "fotos"
LIST_NAME = "correspondencias.csv"


@dataclass(frozen=True)
class ArchivePhoto:
    path: str
    seed: int  # same seed = same picture (another resolution)
    size: tuple[int, int]
    expected: str | None  # collection code of the piece it should reach, or None
    how: str  # what the walkthrough of the README says about it


PHOTOS: tuple[ArchivePhoto, ...] = (
    # F1 and F2: read alone in automatic mode.
    ArchivePhoto("Fotos MMZ/MMZ 001 - PUCP 9101 (1).JPG", 1, (320, 240), "MMZ 1", "automática"),
    ArchivePhoto("Fotos MMZ/MMZ 001 - PUCP 9101 (2).JPG", 2, (320, 240), "MMZ 1", "automática"),
    ArchivePhoto("Fotos MMZ/MMZ 2 - INC 0000.jpg", 3, (320, 240), "MMZ 2", "automática"),
    # F3
    ArchivePhoto("Fotos MMZ/I-0000 MMZ-3(1).jpg", 4, (320, 240), "MMZ 3", "automática"),
    # Range folder with acronym: its name is never a code.
    ArchivePhoto(
        "Fotos MBB/MBB 001 - 100/MBB 2 - PUCP 9202.jpg", 5, (320, 240), "MBB 2", "automática"
    ),
    ArchivePhoto("Fotos MBB/MBB 001 - 100/IMG_0001.jpg", 6, (320, 240), None, "nombre de cámara"),
    # F4: a number alone, with the collection of the folder.
    ArchivePhoto("Fotos Coleccion LRM/1.JPG", 7, (320, 240), "LRM 1", "colección de la carpeta"),
    ArchivePhoto("Fotos Coleccion LRM/2.JPG", 8, (320, 240), "LRM 2", "colección de la carpeta"),
    # F5: needs the template and the collection.
    ArchivePhoto("FOTOS 001-100/004-3269.jpg", 9, (320, 240), "MMZ 4", "plantilla {n}-{*}"),
    ArchivePhoto("FOTOS 001-100/005-3270 x.jpg", 10, (320, 240), "MMZ 5", "plantilla {n}-{*}"),
    # F6: the same camera photo in two resolutions, assigned by the list.
    ArchivePhoto("82LF4169.jpg", 11, (160, 120), None, "menor resolución: se descarta"),
    ArchivePhoto("ALTAS/82LF4169 copy.jpg", 11, (960, 720), "MMZ 6", "lista de correspondencias"),
    # A generic folder: no collection, no code.
    ArchivePhoto("CARPETA 1/DSC_0001.jpg", 12, (320, 240), None, "sin código: asignación manual"),
)

#: ``archivo,codigo`` lines of the correspondences list; the second one names no photo.
CORRESPONDENCES = (("ALTAS/82LF4169 copy.jpg", "MMZ 6"), ("no-esta-en-el-lote.jpg", "MMZ 1"))


def picture(seed: int, size: tuple[int, int]) -> bytes:
    """A synthetic picture: random blocks from ``seed``, scaled; the same seed in another size
    has the same perceptual hash."""
    rng = random.Random(seed)
    small = Image.new("RGB", (9, 8))
    small.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256)) for _ in range(72)])
    output = io.BytesIO()
    small.resize(size, Image.Resampling.BILINEAR).save(output, format="JPEG", quality=80)
    return output.getvalue()


def correspondences_csv() -> bytes:
    lines = ["archivo,codigo", *(f"{file},{code}" for file, code in CORRESPONDENCES)]
    return ("\n".join(lines) + "\n").encode()


def write_catalog_photos(directory: Path) -> list[Path]:
    """Write the ``fotos/`` folder and the correspondences list into ``directory``."""
    written = []
    for photo in PHOTOS:
        target = directory / FOLDER / photo.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(picture(photo.seed, photo.size))
        written.append(target)
    target = directory / LIST_NAME
    target.write_bytes(correspondences_csv())
    written.append(target)
    return written
