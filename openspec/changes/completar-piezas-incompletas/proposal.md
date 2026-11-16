## Why

La pestaña «Piezas incompletas» de «Revisar pendientes» mostraba el reporte tal cual (revisión del
equipo, 2026-11-15): tres filas de filtros (seis casillas, la colección y dos botones de descarga), sin
un resumen de cuántas piezas tienen cada problema; cada fila repetía las mismas alertas genéricas
(«Campos recomendados incompletos» no dice qué falta) y no ayudaba a resolver: había que abrir la
ficha, editar y volver, pieza por pieza. Maqueta aprobada: `piezas incompletas` (GIF del 2026-11-15).

## What Changes

- **«¿Qué les falta?»**: seis tarjetas con el número de piezas por alerta, que son también el filtro
  (varias se combinan con «y», como el reporte). «Código no normalizable» pasa a «Código que no se
  entiende».
- **Barra compacta**: «Colección» como píldora (incluye subcolecciones) y «Descargar» (Excel o CSV)
  discreto.
- **Cada fila dice qué falta en concreto**: «Le falta: Código I · Foto · Ubicación · categoría,
  materiales».
- **Panel «Completar ficha»** desde la fila, con solo lo que falta y se puede completar ahí: ubicación
  (árbol de lugares, como movimiento), fotos y los campos simples (colección, categoría, estado de
  conservación, materiales, procedencia, época, medidas, descripción). «Guardar y siguiente» guarda y
  abre la pieza siguiente; «Saltar» pasa sin guardar. El código I no se completa ahí (RN-002): se
  explica y se enlaza a la ficha, igual que un código que no se entiende o los campos obligatorios.
- **API**: `IncompletePiece.missing_fields` con los campos obligatorios y recomendados vacíos, con la
  misma condición de «vacío» que las alertas.
- Reportes conserva su reporte (`IncompleteReportPanel`) sin cambios.

## Impact

- Capacidad: `calidad-datos` (requirement nuevo).
- API: campo añadido `missing_fields` en `IncompletePiece` (mapeo y `CAMPOS_ANADIDOS`),
  `missing_fields_for_pieces` en `quality/completeness.py`. Sin migración.
- Web: `IncompleteTriage.tsx` (nuevo), `app/pendientes/incompletas/page.tsx`; los datos de
  demostración calculan `missing_fields` y la alerta de campos recomendados con las reglas de la API.
- La ayuda con IA para completar la ficha queda en `ia-completar-ficha`.
