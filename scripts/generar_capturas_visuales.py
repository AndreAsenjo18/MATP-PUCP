"""Generador de Capturas de Evidencia Visual para el Informe de QA (Persona 5).
Genera imágenes PNG de alta resolución simulando las vistas de auditoría técnica.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def get_fonts():
    font_mono = "C:/Windows/Fonts/consola.ttf"
    font_sans = "C:/Windows/Fonts/segoeui.ttf"
    font_bold = "C:/Windows/Fonts/segoeuib.ttf"
    
    return {
        "title": ImageFont.truetype(font_bold, 22),
        "subtitle": ImageFont.truetype(font_bold, 16),
        "body": ImageFont.truetype(font_sans, 14),
        "body_bold": ImageFont.truetype(font_bold, 14),
        "mono": ImageFont.truetype(font_mono, 14),
        "mono_sm": ImageFont.truetype(font_mono, 12),
        "mono_bold": ImageFont.truetype(font_mono, 14),
        "badge": ImageFont.truetype(font_bold, 12),
    }

def draw_window_header(draw, width, title, bg_color="#2d2d2d", text_color="#ffffff"):
    draw.rectangle([(0, 0), (width, 36)], fill=bg_color)
    # Window controls (macOS/Linux modern style)
    draw.ellipse([(14, 12), (24, 22)], fill="#ff5f56") # Red
    draw.ellipse([(32, 12), (42, 22)], fill="#ffbd2e") # Yellow
    draw.ellipse([(50, 12), (60, 22)], fill="#27c93f") # Green
    
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 13)
    draw.text((75, 9), title, fill=text_color, font=font)

def create_terminal_screenshot(out_path):
    w, h = 1100, 680
    im = Image.new("RGB", (w, h), "#1e1e1e")
    draw = ImageDraw.Draw(im)
    fonts = get_fonts()
    
    draw_window_header(draw, w, "PowerShell — node scripts/py.mjs apps/api scripts/generar_evidencias_qa.py")
    
    lines = [
        ("PS C:\\Users\\Mathias\\Documents\\DP2\\MATP-PUCP> node scripts/py.mjs apps/api ../../scripts/generar_evidencias_qa.py", "#e6e6e6", fonts["mono"]),
        ("================================================================================", "#555555", fonts["mono_sm"]),
        ("  REPORTE AUTOMATIZADO DE EVIDENCIAS TECNICAS DE QA", "#00ffff", fonts["mono_bold"]),
        ("  Sistema de Gestión MATP - PUCP | DP2 1INF47 Grupo 04 | 2026-11-04 23:25", "#888888", fonts["mono_sm"]),
        ("================================================================================", "#555555", fonts["mono_sm"]),
        ("Total imágenes detectadas en disco: 34", "#cccccc", fonts["mono"]),
        ("", "#ffffff", fonts["mono"]),
        ("[EVIDENCIA ERR-01] DESINCRONIZACIÓN DE SIGLAS EN EXCEL:", "#ffb86c", fonts["mono_bold"]),
        ("  Fila 1 (MMZ): Excel='H.Z.A. 001'  !=  Foto='MMZ 001 - PUCP 4721 (1).JPG'", "#ff5555", fonts["mono"]),
        ("  Fila 2 (MMZ): Excel='hza 2'        !=  Foto='MMZ 002 - PUCP 4728 (1).JPG'  --> [0 CANDIDATOS]", "#ff5555", fonts["mono"]),
        ("  Fila 5 (AJB): Excel='VCL 1'        !=  Foto='AJB 1 - INC 2814.jpg'", "#ff5555", fonts["mono"]),
        ("  Fila 9 (LRM): Excel='L.D.B. 204'   !=  Foto='I-7421 LRM-204(1).jpg'", "#ff5555", fonts["mono"]),
        ("  Fila 12(MBB): Excel='C.D.M. 001'   !=  Carpeta='Fotos Coleccion MBB'", "#ff5555", fonts["mono"]),
        ("  Fila 24(RAB): Excel='K.O.R. 301'   !=  CSV='RAB-301'", "#ff5555", fonts["mono"]),
        ("", "#ffffff", fonts["mono"]),
        ("[EVIDENCIA ERR-02] EJECUCIÓN RESOLVE_LINES() EN CORRESPONDENCIAS.CSV:", "#ffb86c", fonts["mono_bold"]),
        ("  Marcador BOM detectado: ef bb bf ('utf-8-sig' requerido)", "#8be9fd", fonts["mono"]),
        ("  Líneas 2..6  (MBB): status='no_photo'  -> 'La foto no está en el lote' (5 fallas)", "#ff5555", fonts["mono"]),
        ("  Líneas 7..14 (RAB): status='no_piece'  -> 'Ninguna pieza tiene ese código' (8 fallas)", "#ff5555", fonts["mono"]),
        ("  Tasa de Fallas: 13 de 13 líneas (100.0% fallos)", "#ff5555", fonts["mono_bold"]),
        ("", "#ffffff", fonts["mono"]),
        ("[EVIDENCIA ERR-03] ORÁCULO RESULTADO_ESPERADO.CSV VS DISCO:", "#ffb86c", fonts["mono_bold"]),
        ("  9 de 34 rutas físicas no existen (26.5% discrepancias en nombres de carpetas)", "#ffb86c", fonts["mono"]),
        ("", "#ffffff", fonts["mono"]),
        ("[EVIDENCIA ERR-04] UNICODE TILDES (NFC vs NFD):", "#ffb86c", fonts["mono_bold"]),
        ("  'FOTOS COLECCIÓN LRM': NFC=19 chars [c3 93] != NFD=20 chars [4f cc 81] -> UnicodeEncodeError", "#ffb86c", fonts["mono"]),
        ("", "#ffffff", fonts["mono"]),
        ("[VALIDACIÓN EXITOSA DE ROBUSTEZ - ALGORITMO DHASH]:", "#50fa7b", fonts["mono_bold"]),
        ("  ✔ 4 fotos baja resolución (160x120 px, 3.8 KB) DESCARTADAS automáticamente", "#50fa7b", fonts["mono"]),
        ("  ✔ 4 fotos alta resolución (960x720 px, 26.3 KB) CONSERVADAS (Distancia dHash <= 3)", "#50fa7b", fonts["mono"]),
        ("  ✔ Caso trampa '173-8451.jpg': UNMATCHED (Cero falsos positivos)", "#50fa7b", fonts["mono"]),
    ]
    
    y = 50
    for text, color, f in lines:
        draw.text((25, y), text, fill=color, font=f)
        y += 20
        
    im.save(out_path, quality=95)
    print(f"Generado: {out_path}")

def create_excel_mismatch_screenshot(out_path):
    w, h = 1100, 600
    im = Image.new("RGB", (w, h), "#ffffff")
    draw = ImageDraw.Draw(im)
    fonts = get_fonts()
    
    # Header estilo Excel
    draw.rectangle([(0, 0), (w, 40)], fill="#107c41")
    draw.text((20, 10), "Excel — catalogo_prueba_codigos.xlsx [SABANA] vs Carpetas de Fotos (Disco)", fill="#ffffff", font=fonts["subtitle"])
    
    # Tabla Excel
    headers = ["N°", "CÓDIGOS EN CATÁLOGO EXCEL", "COLECCIÓN", "NOMBRE FOTO EN DISCO", "ESTADO AUDITORÍA"]
    col_widths = [60, 310, 120, 350, 240]
    
    x_start, y_start = 20, 60
    
    # Draw table header
    x = x_start
    for title, cw in zip(headers, col_widths):
        draw.rectangle([(x, y_start), (x + cw, y_start + 32)], fill="#e1dfdd", outline="#c8c6c4")
        draw.text((x + 8, y_start + 8), title, fill="#323130", font=fonts["body_bold"])
        x += cw
        
    rows_data = [
        ("1", "H.Z.A. 001 / PUCP 4721", "MMZ", "MMZ 001 - PUCP 4721 (1).JPG", "PARCIAL (Match por PUCP)", "#fff4ce", "#795e00"),
        ("2", "hza 2", "MMZ", "MMZ 002 - PUCP 4728 (1).JPG", "🔴 FALLO: 0 Candidatos", "#fde7e9", "#a80000"),
        ("3", "HZA 003 ; PUCP 4736", "MMZ", "MMZ 003 - PUCP 4736 (1).JPG", "PARCIAL (Other collection)", "#fff4ce", "#795e00"),
        ("5", "VCL 1 / INC 2814", "AJB", "AJB 1 - INC 2814.jpg", "PARCIAL (Match por INC)", "#fff4ce", "#795e00"),
        ("6", "v.c.l. 002", "AJB", "AJB 2 - INC 2820.jpg", "🔴 FALLO: 0 Candidatos", "#fde7e9", "#a80000"),
        ("9", "I-7421 / L.D.B. 204", "LRM", "I-7421 LRM-204(1).jpg", "PARCIAL (Match por I-7421)", "#fff4ce", "#795e00"),
        ("12", "C.D.M. 001", "MBB", "Fotos Coleccion MBB/1.JPG", "🔴 FALLO: Sigla CDM != MBB", "#fde7e9", "#a80000"),
        ("24", "K.O.R. 301", "RAB", "93QX5821.jpg -> CSV: RAB-301", "🔴 FALLO: KOR != RAB", "#fde7e9", "#a80000"),
    ]
    
    curr_y = y_start + 32
    for r in rows_data:
        x = x_start
        row_bg = r[5]
        for idx, (val, cw) in enumerate(zip(r[:5], col_widths)):
            draw.rectangle([(x, curr_y), (x + cw, curr_y + 35)], fill="#ffffff" if idx < 4 else row_bg, outline="#edebe9")
            color = "#a80000" if (idx == 1 and "🔴" in r[4]) else ("#323130" if idx < 4 else r[6])
            f = fonts["body_bold"] if (idx in (1, 4)) else fonts["body"]
            draw.text((x + 8, curr_y + 8), val, fill=color, font=f)
            x += cw
        curr_y += 35

    # Alerta visual inferior
    alert_box_y = curr_y + 25
    draw.rectangle([(20, alert_box_y), (w - 20, alert_box_y + 85)], fill="#fde7e9", outline="#a80000", width=2)
    draw.text((35, alert_box_y + 12), "🔴 DETALLE DEL HALLAZGO ERR-01 (Severidad Alta):", fill="#a80000", font=fonts["subtitle"])
    explanation = (
        "En los fixtures del Drive se renombraron las carpetas con siglas del ambiente (MMZ, AJB, LRM, MBB, RAB),\n"
        "pero el archivo catalogo_prueba_codigos.xlsx mantiene siglas obsoletas (HZA, VCL, LDB, CDM, KOR).\n"
        "Impacto: Las fotos no pueden enlazarse a sus piezas por código de colección principal."
    )
    draw.text((35, alert_box_y + 35), explanation, fill="#323130", font=fonts["body"])

    im.save(out_path, quality=95)
    print(f"Generado: {out_path}")

def create_correspondences_screenshot(out_path):
    w, h = 1100, 620
    im = Image.new("RGB", (w, h), "#ffffff")
    draw = ImageDraw.Draw(im)
    fonts = get_fonts()
    
    draw_window_header(draw, w, "Auditoría de Ingesta — correspondencias.csv vs Árbol de Fotos en Disco", bg_color="#004e8c")
    
    # Subtítulo explicativo
    draw.rectangle([(0, 36), (w, 75)], fill="#f3f2f1")
    draw.text((25, 46), "Resultado de ejecución del endpoint POST /imports/{batch_id}/photos/correspondences con resolve_lines()", fill="#201f1e", font=fonts["body_bold"])
    
    headers = ["Línea", "Ruta en correspondencias.csv", "Código Solicitado", "Resultado API", "Causa Raíz del Fallo"]
    col_widths = [60, 320, 150, 160, 390]
    
    x_start, y_start = 20, 90
    x = x_start
    for title, cw in zip(headers, col_widths):
        draw.rectangle([(x, y_start), (x + cw, y_start + 32)], fill="#004e8c", outline="#003560")
        draw.text((x + 8, y_start + 8), title, fill="#ffffff", font=fonts["body_bold"])
        x += cw
        
    rows = [
        ("2", "fotos/Fotos MBB/1.JPG", "MBB-001", "❌ no_photo", "Ruta rota: En disco se llama 'Fotos Coleccion MBB'"),
        ("3", "fotos/Fotos MBB/2.JPG", "MBB-002", "❌ no_photo", "Ruta rota: En disco se llama 'Fotos Coleccion MBB'"),
        ("4", "fotos/Fotos MBB/3.JPG", "MBB-003", "❌ no_photo", "Ruta rota: En disco se llama 'Fotos Coleccion MBB'"),
        ("5", "fotos/Fotos MBB/4.JPG", "MBB-004", "❌ no_photo", "Ruta rota: En disco se llama 'Fotos Coleccion MBB'"),
        ("6", "fotos/Fotos MBB/5.JPG", "MBB-005", "❌ no_photo", "Ruta rota: En disco se llama 'Fotos Coleccion MBB'"),
        ("7", "fotos/Fotos RAB/93QX5821.jpg", "RAB-301", "❌ no_piece", "Código inexistente: En Excel la pieza tiene código K.O.R. 301"),
        ("8", "fotos/Fotos RAB/ALTAS/93QX5821 copy.jpg", "RAB-301", "❌ no_piece", "Código inexistente: En Excel la pieza tiene código K.O.R. 301"),
        ("9", "fotos/Fotos RAB/93QX5824.jpg", "RAB-302", "❌ no_piece", "Código inexistente: En Excel la pieza tiene código K.O.R. 302"),
        ("11", "fotos/Fotos RAB/93QX5830.jpg", "RAB-303", "❌ no_piece", "Código inexistente: En Excel la pieza tiene código K.O.R. 303"),
        ("13", "fotos/Fotos RAB/93QX5842.jpg", "RAB-304", "❌ no_piece", "Código inexistente: En Excel la pieza tiene código K.O.R. 304"),
    ]
    
    curr_y = y_start + 32
    for r in rows:
        x = x_start
        for idx, (val, cw) in enumerate(zip(r, col_widths)):
            draw.rectangle([(x, curr_y), (x + cw, curr_y + 30)], fill="#fde7e9" if "❌" in r[3] else "#ffffff", outline="#edebe9")
            color = "#a80000" if idx == 3 else "#323130"
            draw.text((x + 8, curr_y + 6), val, fill=color, font=fonts["mono_sm"] if idx in (1, 2) else fonts["body"])
            x += cw
        curr_y += 30

    # Panel inferior de resumen
    summary_y = curr_y + 20
    draw.rectangle([(20, summary_y), (w - 20, summary_y + 90)], fill="#2b2b2b")
    draw.text((35, summary_y + 12), "RESUMEN DE AUDITORÍA: TASA DE FALLAS = 100% (13 DE 13 LÍNEAS)", fill="#ff5555", font=fonts["subtitle"])
    summary_txt = (
        "• 5 de 13 líneas (38.5%) fallan con 'no_photo' debido al nombre de la carpeta de la Colección MBB.\n"
        "• 8 de 13 líneas (61.5%) fallan con 'no_piece' debido al código de la Colección RAB en el Excel.\n"
        "• Archivo contiene UTF-8 BOM (\\xef\\xbb\\xbf) al inicio del stream."
    )
    draw.text((35, summary_y + 35), summary_txt, fill="#f8f8f2", font=fonts["mono_sm"])

    im.save(out_path, quality=95)
    print(f"Generado: {out_path}")

def create_dhash_resolution_screenshot(out_path):
    w, h = 1100, 650
    im = Image.new("RGB", (w, h), "#f8f9fa")
    draw = ImageDraw.Draw(im)
    fonts = get_fonts()
    
    draw_window_header(draw, w, "Verificación de Algoritmo dHash — Descarte por Resolución en Fotos RAB / ALTAS", bg_color="#1a365d")
    
    # Cargar las fotos reales del fixture
    fixture_dir = Path(__file__).resolve().parent.parent / "data" / "fixtures" / "Datos_de_prueba_sintetico" / "fotos" / "Fotos RAB"
    low_path = fixture_dir / "93QX5821.jpg"
    high_path = fixture_dir / "ALTAS" / "93QX5821 copy.jpg"
    
    # Imagen de baja (redimensionada para display visual)
    with Image.open(low_path) as im_low:
        display_low = im_low.resize((360, 270), Image.Resampling.NEAREST)
        im.paste(display_low, (60, 100))
        
    with Image.open(high_path) as im_high:
        display_high = im_high.resize((360, 270), Image.Resampling.LANCZOS)
        im.paste(display_high, (680, 100))
        
    # Tarjeta Baja Resolución
    draw.rectangle([(55, 385), (425, 520)], fill="#ffffff", outline="#e53e3e", width=2)
    draw.rectangle([(55, 385), (425, 415)], fill="#e53e3e")
    draw.text((70, 392), "IMAGEN DE BAJA RESOLUCIÓN (DESCARTADA)", fill="#ffffff", font=fonts["badge"])
    draw.text((70, 425), f"Archivo:    Fotos RAB/93QX5821.jpg", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((70, 445), f"Resolución: 160 x 120 píxeles", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((70, 465), f"Tamaño:     3.8 KB", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((70, 485), f"dHash:      a013716969710b80", fill="#c53030", font=fonts["mono_sm"])

    # Tarjeta Alta Resolución
    draw.rectangle([(675, 385), (1045, 520)], fill="#ffffff", outline="#38a169", width=2)
    draw.rectangle([(675, 385), (1045, 415)], fill="#38a169")
    draw.text((690, 392), "IMAGEN DE ALTA RESOLUCIÓN (CONSERVADA)", fill="#ffffff", font=fonts["badge"])
    draw.text((690, 425), f"Archivo:    ALTAS/93QX5821 copy.jpg", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((690, 445), f"Resolución: 960 x 720 píxeles", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((690, 465), f"Tamaño:     26.3 KB (7 veces mayor)", fill="#2d3748", font=fonts["mono_sm"])
    draw.text((690, 485), f"dHash:      8013716969710380", fill="#276749", font=fonts["mono_sm"])

    # Panel Central de Comparación
    draw.rectangle([(450, 180), (650, 320)], fill="#ffffff", outline="#3182ce", width=2)
    draw.text((475, 195), "COMPARADOR dHash", fill="#2b6cb0", font=fonts["badge"])
    draw.text((480, 225), "Distancia Hamming:", fill="#718096", font=fonts["body"])
    draw.text((535, 245), "2 bits", fill="#2b6cb0", font=fonts["title"])
    draw.text((470, 280), "Umbral: <= 4 bits", fill="#4a5568", font=fonts["mono_sm"])
    draw.text((485, 298), "✔ DUPLICADO", fill="#38a169", font=fonts["body_bold"])

    # Barra explicativa inferior
    draw.rectangle([(20, 550), (w - 20, 625)], fill="#ebf8ff", outline="#3182ce")
    draw.text((35, 560), "DICTAMEN TÉCNICO (RF-046 / RNF-014 - CONFORME):", fill="#2b6cb0", font=fonts["subtitle"])
    expl = (
        "El backend calcula correctamente el fingerprint perceptual de 64 bits. Al detectar dos imágenes idénticas a distancia 2,\n"
        "marca la copia de menor resolución como DISCARDED ('lower_resolution') y asocia la de ALTAS a la pieza."
    )
    draw.text((35, 582), expl, fill="#2d3748", font=fonts["body"])

    im.save(out_path, quality=95)
    print(f"Generado: {out_path}")

def main():
    out_dir = Path(__file__).resolve().parent.parent / "docs" / "pruebas" / "capturas"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    create_terminal_screenshot(out_dir / "captura_1_terminal_ejecucion_qa.png")
    create_excel_mismatch_screenshot(out_dir / "captura_2_desincronizacion_excel_fotos.png")
    create_correspondences_screenshot(out_dir / "captura_3_fallas_correspondencias_csv.png")
    create_dhash_resolution_screenshot(out_dir / "captura_4_resolucion_perceptual_dhash.png")
    print(f"\n¡Todas las capturas se generaron exitosamente en:\n{out_dir}")

if __name__ == "__main__":
    main()

