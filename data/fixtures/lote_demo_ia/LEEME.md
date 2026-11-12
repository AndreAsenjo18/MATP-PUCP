# Lote de prueba: reversión + sugerencias de IA

Datos **sintéticos** (Ley 29733, RNF-014): ninguna pieza ni código viene del museo.

- `lote_demo_ia.xlsx`: hoja `LOTE` con 6 filas limpias (sin duplicados, sin conflictos de código)
  y una hoja `GUIA` que explica qué esperar de cada fila. Lote **simple**, para una prueba rápida.
- `lote_grande_ia.xlsx` (generado con `build_lote_grande_ia.py`): 45 filas. Las primeras 8
  reutilizan el código I de piezas **ya sembradas** por el seed sintético (actualización real
  contra la base de prueba); las 37 restantes son piezas nuevas. Lote **grande**, pensado para
  probar el tamaño de página editable de la revisión (10/25/50/100) con un lote que de verdad
  cruza varias páginas, y las sugerencias de IA por fila a escala.

## Para qué sirve

1. **Probar «Revertir lote»** (botón ya implementado en el asistente de importación, permiso
   `imports.revert`, solo Administrador): cargar este Excel, aprobarlo, y después revertirlo. No
   tiene filas con errores ni conflictos, así que debería aplicarse limpio y revertirse limpio.
2. **Quedar listo para la carga masiva con sugerencias de IA**, en cuanto ese change exista: la
   columna `OBSERVACIONES` de cada fila se escribió a propósito para disparar un escenario
   distinto de la IA (campo vacío, texto sin datos reconocibles, dato nuevo, o ya coincide con lo
   registrado) — el detalle fila por fila está en la hoja `GUIA`.

## Cómo usarlo hoy

La columna `OBSERVACIONES` **no está en ningún formato de mapeo guardado todavía** (es un Excel
nuevo, no la sábana de consultoría ni el lote de demo del 29 de octubre). Al subirlo, el
asistente probablemente no la reconozca sola: en **Ajustar columnas**, mapéenla a mano al campo
**Observaciones**. Las demás columnas (`DENOMINACIÓN`, `CÓDIGOS`, `COLECCIÓN`, `ÉPOCA`,
`MATERIAL`, `MEDIDAS`, `PROCEDENCIA`) siguen la misma convención que `lote_demo_sabana.xlsx`, así
que el asistente debería sugerirlas solo.

Mientras no exista la carga masiva con IA, para probar las sugerencias de cada fila hay que
pedirlas una por una desde la ficha de cada pieza (`/ia/sugerencias` o el panel de la ficha),
usando el texto que quedó en Observaciones.

Generado con `data/fixtures/lote_demo_ia/build_lote_demo_ia.py` (no forma parte del seed
automático: es un archivo aparte para esta prueba puntual).
