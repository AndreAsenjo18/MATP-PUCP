## Context

`import_row.raw_data` guarda cada fila tal como se leyó; la validación (`validate_stage`) mapea,
clasifica y valida todas las filas a partir de ese dato y solo arranca desde «mapeado». La máquina de
estados permite volver de «en previsualización» a «mapeado». `import_row` está auditada.

## Decisions

### D1. Las reglas no se relajan
Una errata no se adivina: «I.-1814» sigue siendo un código no reconocido. La persona la corrige y el
valor corregido pasa por las mismas reglas.

### D2. Se corrige la fila guardada, no el archivo
`correct_cell` escribe el valor en `raw_data[columna]` y guarda en `raw_data["__corrections"]` el
valor original (el del archivo, aunque se corrija varias veces), el usuario y la fecha. El archivo
del lote no cambia. Solo en lotes mapeados o en previsualización que no estén procesando; la columna
debe ser una de las cabeceras del archivo.

### D3. Se valida el lote completo
El lote vuelve a «mapeado» y la web lanza la validación de siempre. Validar una sola fila daría una
clasificación incompleta: los conflictos dentro del lote dependen de las demás filas. Como validar de
nuevo descarta las decisiones tomadas, la web lo avisa antes de guardar (`decisionsLostNotice`).

### D4. Claves internas fuera de los datos
Toda clave que empieza con `__` es del lector o de la revisión: `mapping.py` la excluye del registro
de origen (`source_payload`) y del texto libre que se envía a la IA (`free_text_values`).

## Risks / Trade-offs

- Corregir después de tomar decisiones las descarta; el aviso lo dice antes de guardar.
