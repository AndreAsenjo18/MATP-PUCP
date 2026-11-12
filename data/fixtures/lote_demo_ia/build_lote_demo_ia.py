# -*- coding: utf-8 -*-
"""Genera data/fixtures/lote_demo_ia/lote_demo_ia.xlsx: un lote pequeño y limpio, sintético,
para probar (1) el botón "Revertir lote" y (2) -una vez exista- la carga masiva con sugerencias
de IA. Cada fila de OBSERVACIONES se escribió a propósito para un escenario distinto de la IA
(ver hoja GUIA)."""
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

OUT_PATH = r"C:\Users\User\Desktop\Cato\2026-2\DP2\MATP-PUCP\MATP-PUCP\data\fixtures\lote_demo_ia\lote_demo_ia.xlsx"

HEADERS = [
    "N\u00ba",
    "C\u00d3DIGOS",
    "COLECCI\u00d3N",
    "DENOMINACI\u00d3N",
    "\u00c9POCA",
    "MATERIAL",
    "MEDIDAS",
    "PROCEDENCIA",
    "OBSERVACIONES",
]

ROWS = [
    [
        1,
        "I-9201 / M.M.Z. 601",
        "MMZ",
        "Arpa andina",
        "s. XX",
        "madera",
        "alto 95 cm x ancho 48 cm",
        "Puno",
        "Instrumento de cuerda pulsada con decoraci\u00f3n geom\u00e9trica quemada en la caja "
        "de resonancia. Mide 95 cm de alto y 48 cm de ancho. Buen estado de conservaci\u00f3n, "
        "sin da\u00f1os estructurales visibles.",
    ],
    [
        2,
        "I-9202",
        "RA",
        "Retablo de la Natividad",
        "1965",
        "madera, pasta de papa",
        None,
        "Ayacucho",
        "Pieza representativa del taller de Ayacucho. Mide 42 cm de alto y 28 cm de ancho, "
        "en buen estado de conservaci\u00f3n.",
    ],
    [
        3,
        "MBB 601",
        "MBB",
        "Mate burilado con escena de siembra",
        "s. XX",
        "calabaza",
        "di\u00e1m. 16 cm",
        "Jun\u00edn",
        "Pieza muy representativa de la colecci\u00f3n, con una historia interesante que "
        "vale la pena investigar m\u00e1s a fondo.",
    ],
    [
        4,
        "LRM 601",
        "LRM",
        "Quena de ca\u00f1a",
        "desconocida",
        "ca\u00f1a",
        "largo 38 cm",
        "Cusco",
        None,
    ],
    [
        5,
        "I-9205 / AJB 601",
        "AJB",
        "Virgen del Rosario",
        "s. XIX",
        "madera policromada",
        "alto 52 cm",
        "Cusco",
        "Pieza en comodato, con restricci\u00f3n de fotograf\u00eda: no publicar im\u00e1genes. "
        "Se encuentra en regular estado de conservaci\u00f3n, con p\u00e9rdida de policrom\u00eda "
        "en la base.",
    ],
    [
        6,
        "I-9206",
        "MMZ",
        "C\u00e1ntaro de chicha",
        "ca. 1950",
        "arcilla",
        "alto 34 cm x di\u00e1m. 20 cm",
        "Puno",
        "Pieza utilitaria de uso dom\u00e9stico. Presenta una grieta visible en el cuerpo; "
        "estado de conservaci\u00f3n malo.",
    ],
]

GUIA_HEADERS = ["Fila", "Denominaci\u00f3n", "Qu\u00e9 prueba", "Qu\u00e9 esperar de la IA (cuando exista la carga masiva)"]
GUIA_ROWS = [
    [
        2,
        "Arpa andina",
        "Caso normal, con MEDIDAS ya puesta en el Excel",
        "Si las OBSERVACIONES repiten exactamente lo que qued\u00f3 en MEDIDAS tras la carga, la IA "
        "deber\u00eda decir \u00abNo se not\u00f3 ning\u00fan cambio\u00bb (ya coincide con lo registrado).",
    ],
    [
        3,
        "Retablo de la Natividad",
        "MEDIDAS vac\u00eda en el Excel",
        "La IA deber\u00eda proponer medidas nuevas (95x48 no existe a\u00fan en la pieza), listas para editar y aprobar.",
    ],
    [
        4,
        "Mate burilado con escena de siembra",
        "Texto sin datos medibles",
        "La IA deber\u00eda responder \u00abNo se reconocieron datos estructurados en el texto\u00bb.",
    ],
    [
        5,
        "Quena de ca\u00f1a",
        "OBSERVACIONES vac\u00edo",
        "Campo de origen vac\u00edo: ni siquiera deber\u00eda llegar a llamar a la IA (como con cualquier pieza sin texto).",
    ],
    [
        6,
        "Virgen del Rosario",
        "Menci\u00f3n de comodato + estado nuevo distinto al que probablemente trae el seed",
        "Deber\u00eda proponer el estado de conservaci\u00f3n (regular/malo) como dato nuevo.",
    ],
    [
        7,
        "C\u00e1ntaro de chicha",
        "MEDIDAS puesta en el Excel + estado nuevo",
        "Caso mixto: las medidas ya coinciden (se filtran) pero el estado de conservaci\u00f3n "
        "deber\u00eda salir como dato nuevo \u2014 el mismo escenario que ya probamos con 'Arpa Andina'.",
    ],
]

NOTE = (
    "Lote sintetico (Ley 29733, RNF-014): ninguna pieza ni codigo viene del museo. Pensado para "
    "(1) probar 'Revertir lote' con una carga sin filas problematicas, y (2) quedar listo para "
    "probar la carga masiva con sugerencias de IA en cuanto ese change exista: la columna "
    "OBSERVACIONES no esta en ningun formato guardado todavia, hay que mapearla a mano a "
    "'Observaciones' en 'Ajustar columnas' del asistente."
)

HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="4A5A5E", end_color="4A5A5E", fill_type="solid")
BODY_FONT = Font(name="Arial")
WRAP = Alignment(wrap_text=True, vertical="top")

wb = openpyxl.Workbook()
lote = wb.active
lote.title = "LOTE"

for col_idx, title in enumerate(HEADERS, start=1):
    cell = lote.cell(row=1, column=col_idx, value=title)
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = Alignment(vertical="center")

for row_idx, row in enumerate(ROWS, start=2):
    for col_idx, value in enumerate(row, start=1):
        cell = lote.cell(row=row_idx, column=col_idx, value=value)
        cell.font = BODY_FONT
        if HEADERS[col_idx - 1] == "OBSERVACIONES":
            cell.alignment = WRAP

widths = [4, 20, 11, 30, 12, 20, 24, 14, 60]
for col_idx, width in enumerate(widths, start=1):
    lote.column_dimensions[get_column_letter(col_idx)].width = width
lote.freeze_panes = "A2"

guia = wb.create_sheet("GUIA")
guia.cell(row=1, column=1, value=NOTE).font = Font(name="Arial", italic=True, size=10)
guia.merge_cells(start_row=1, start_column=1, end_row=1, end_column=4)
guia.cell(row=1, column=1).alignment = Alignment(wrap_text=True, vertical="top")
guia.row_dimensions[1].height = 60

for col_idx, title in enumerate(GUIA_HEADERS, start=1):
    cell = guia.cell(row=2, column=col_idx, value=title)
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL

for row_offset, row in enumerate(GUIA_ROWS, start=3):
    for col_idx, value in enumerate(row, start=1):
        cell = guia.cell(row=row_offset, column=col_idx, value=value)
        cell.font = BODY_FONT
        if col_idx >= 3:
            cell.alignment = WRAP

guia_widths = [6, 26, 30, 55]
for col_idx, width in enumerate(guia_widths, start=1):
    guia.column_dimensions[get_column_letter(col_idx)].width = width

wb.save(OUT_PATH)
print("Guardado:", OUT_PATH)
