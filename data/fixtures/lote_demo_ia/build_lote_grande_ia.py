# -*- coding: utf-8 -*-
"""Genera data/fixtures/lote_demo_ia/lote_grande_ia.xlsx: un lote sintetico mas grande (45 filas)
para probar, antes del PR de `carga-masiva-con-ia`, (1) el tamaño de página editable de la
revisión (10/25/50/100) con un lote que de verdad cruza varias páginas, y (2) las sugerencias de
IA por fila a escala, con una mezcla de piezas nuevas y de actualización.

Mismos encabezados que `lote_demo_ia.xlsx` (compatibles con la plantilla sembrada "Lote de
demostración v1"): la columna OBSERVACIONES no esta en ningun formato guardado, asi que al
subirlo hay que mapearla a mano a "Observaciones" en "Ajustar columnas" (igual que el lote chico).

Las primeras 8 filas reutilizan códigos I de piezas YA sembradas (sintéticas, del seed) para que
disparen "fila de actualización" de verdad contra la base con la que se prueba; las 37 restantes
son piezas nuevas, generadas por combinación de categorías/materiales/procedencias sintéticas.
"""
import random

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

OUT_PATH = r"C:\Users\User\Desktop\Cato\2026-2\DP2\MATP-PUCP\MATP-PUCP\data\fixtures\lote_demo_ia\lote_grande_ia.xlsx"

HEADERS = ["Nº", "CÓDIGOS", "COLECCIÓN", "DENOMINACIÓN", "ÉPOCA", "MATERIAL", "MEDIDAS", "PROCEDENCIA", "OBSERVACIONES"]

# Filas 1-8: actualización de piezas YA sembradas (seed sintético), con su código I real.
# dims=None en la pieza actual -> la IA debería proponer medidas nuevas; dims repetido en
# OBSERVACIONES -> "ya coincide"; estado nuevo -> debería salir como dato nuevo.
UPDATE_ROWS = [
    ("I-5854", "MMZ", "Arpa andina", "s. XX", "madera", None, "Piura",
     "Mide 30 cm de diámetro y 12 cm de alto. Buen estado de conservación."),
    ("I-8056", "RA", "Máscara de caporal", "s. XX", "madera y tela", None, "Cajamarca",
     "Pieza representativa de la danza del caporal, usada en festividades patronales."),
    ("I-7239", "MBB", "Charango", "ca. 1980", "madera y armadillo", None, "Lima",
     "Instrumento de cuerda con caja de resonancia en armadillo. Alto 55 cm."),
    ("I-5263", "AJB", "Poncho de lana", "s. XX", "lana de alpaca", "alto 85 cm x ancho 13 cm", "Cusco",
     "Mide 85 cm de alto y 13 cm de ancho, doblado para su almacenamiento."),
    ("I-5283", "LRM", "Mate burilado con fiesta patronal", "s. XX", "calabaza", "alto 43 cm x ancho 32 cm", "Cusco",
     "En regular estado de conservación, con fisuras visibles en la base."),
    ("I-134", "MMZ", "Iglesia de Quinua", "s. XIX", "madera policromada", "alto 73 cm x ancho 49 cm", "Ayacucho", None),
    ("I-594", "RA", "Caballito de madera", "s. XX", "madera", "alto 11 cm x ancho 17 cm", "Junín",
     "Pieza en comodato; no se puede fotografiar sin autorización."),
    ("I-3076", "MBB", "Olla ceremonial", "s. XX", "arcilla", "alto 31 cm x ancho 32 cm", "Puno",
     "Mide 35 cm de alto y 30 cm de diámetro, con grietas en el cuerpo; estado de conservación malo."),
]

CATEGORIES = [
    ("Charango", "madera y armadillo"),
    ("Quena de caña", "caña"),
    ("Bombo andino", "cuero y madera"),
    ("Zampoña", "caña"),
    ("Rondador", "caña"),
    ("Poncho de lana", "lana de alpaca"),
    ("Chalina bordada", "lana de oveja"),
    ("Manta ceremonial", "lana de alpaca"),
    ("Faja tejida", "lana de oveja"),
    ("Chullo de alpaca", "lana de alpaca"),
    ("Olla ceremonial", "arcilla"),
    ("Cántaro de chicha", "arcilla"),
    ("Vasija ritual", "arcilla"),
    ("Plato decorado", "arcilla"),
    ("Botella silbadora", "arcilla"),
    ("Retablo costumbrista", "madera y pasta de papa"),
    ("Retablo de la Natividad", "madera y pasta de papa"),
    ("Imagen de San Isidro", "madera policromada"),
    ("Cristo crucificado", "madera policromada"),
    ("Máscara de diablada", "madera y tela"),
    ("Máscara de danzante de tijeras", "cuero y tela"),
    ("Batán de piedra", "piedra"),
    ("Candelabro de hojalata", "hojalata"),
    ("Caballito de totora (miniatura)", "totora"),
    ("Mate burilado con escena agrícola", "calabaza"),
]

PROVENANCES = ["Puno", "Ayacucho", "Cusco", "Junín", "Arequipa", "Cajamarca", "Huancavelica", "Lima", "Piura", "Apurímac"]
COLLECTIONS = ["MMZ", "RA", "MBB", "AJB", "LRM"]
EPOCHS = ["s. XIX", "s. XX", "ca. 1950", "ca. 1970", "ca. 1990", "desconocida"]

OBS_TEMPLATES = [
    # 0: medida nueva (no hay MEDIDAS en el Excel) -> la IA debería proponer una
    lambda d, alto, ancho, prov: f"Pieza representativa de {prov}. Mide {alto} cm de alto y {ancho} cm de ancho, en buen estado de conservación.",
    # 1: sin datos estructurados reconocibles
    lambda d, alto, ancho, prov: f"Pieza de uso ritual y ceremonial, recolectada en la zona de {prov}. Sin más datos documentados por ahora.",
    # 2: estado de conservación como dato nuevo, sin medidas
    lambda d, alto, ancho, prov: "Presenta desgaste visible por uso; estado de conservación regular, pendiente de evaluación detallada.",
    # 3: observaciones vacías (empty)
    None,
    # 4: medida + estado juntos
    lambda d, alto, ancho, prov: f"Mide {alto} cm de alto y {ancho} cm de ancho. Buen estado de conservación, sin daños estructurales visibles.",
]

random.seed(20261111)


def build_new_rows(n: int):
    rows = []
    for i in range(n):
        name, material = CATEGORIES[i % len(CATEGORIES)]
        provenance = PROVENANCES[i % len(PROVENANCES)]
        collection = COLLECTIONS[i % len(COLLECTIONS)]
        epoch = EPOCHS[i % len(EPOCHS)]
        alto = random.randint(10, 95)
        ancho = random.randint(8, 60)
        obs_fn = OBS_TEMPLATES[i % len(OBS_TEMPLATES)]
        observaciones = obs_fn(name, alto, ancho, provenance) if obs_fn else None
        # Solo ~1 de cada 6 piezas nuevas ya trae I (igual que en la realidad: ~6000 sin I);
        # el resto solo con código de colección.
        codigo = f"I-{9300 + i} / {collection} {700 + i}" if i % 6 == 0 else f"{collection} {700 + i}"
        rows.append([i + 1, codigo, collection, name, epoch, material, None, provenance, observaciones])
    return rows


def main():
    rows = []
    for idx, (codigo, collection, name, epoch, material, medidas, provenance, obs) in enumerate(UPDATE_ROWS, start=1):
        rows.append([idx, codigo, collection, name, epoch, material, medidas, provenance, obs])
    rows.extend(build_new_rows(45 - len(UPDATE_ROWS)))
    for i, row in enumerate(rows, start=1):
        row[0] = i

    header_font = Font(name="Arial", bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4A5A5E", end_color="4A5A5E", fill_type="solid")
    body_font = Font(name="Arial")
    wrap = Alignment(wrap_text=True, vertical="top")

    wb = openpyxl.Workbook()
    lote = wb.active
    lote.title = "LOTE"

    for col_idx, title in enumerate(HEADERS, start=1):
        cell = lote.cell(row=1, column=col_idx, value=title)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(vertical="center")

    for row_idx, row in enumerate(rows, start=2):
        for col_idx, value in enumerate(row, start=1):
            cell = lote.cell(row=row_idx, column=col_idx, value=value)
            cell.font = body_font
            if HEADERS[col_idx - 1] == "OBSERVACIONES":
                cell.alignment = wrap

    widths = [4, 24, 11, 34, 12, 20, 24, 14, 60]
    for col_idx, width in enumerate(widths, start=1):
        lote.column_dimensions[get_column_letter(col_idx)].width = width
    lote.freeze_panes = "A2"

    nota = wb.create_sheet("GUIA")
    note_text = (
        "Lote sintetico mas grande (Ley 29733, RNF-014): ninguna pieza ni codigo viene del museo. "
        "Filas 1-8: actualizacion de piezas YA sembradas por el seed sintetico (mismo codigo I), "
        "pensadas para probar las sugerencias de IA por fila contra datos reales de la base de "
        "prueba. Filas 9-45: piezas nuevas generadas por combinacion de categorias sinteticas, "
        "pensadas sobre todo para probar el tamano de pagina editable (10/25/50/100) de la "
        "revision con un lote que cruza varias paginas. La columna OBSERVACIONES no esta en ningun "
        "formato guardado todavia: hay que mapearla a mano a 'Observaciones' en 'Ajustar columnas'."
    )
    nota.cell(row=1, column=1, value=note_text).font = Font(name="Arial", italic=True, size=10)
    nota.merge_cells(start_row=1, start_column=1, end_row=1, end_column=4)
    nota.cell(row=1, column=1).alignment = Alignment(wrap_text=True, vertical="top")
    nota.row_dimensions[1].height = 90
    nota.column_dimensions["A"].width = 60

    wb.save(OUT_PATH)
    print("Guardado:", OUT_PATH, "-", len(rows), "filas")


if __name__ == "__main__":
    main()
