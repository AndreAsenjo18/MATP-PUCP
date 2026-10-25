# data/fixtures — datos sintéticos

Solo datos **sintéticos** (Ley 29733, RNF-014). Nada de este directorio proviene del museo.

| Archivo | Contenido | Cómo se regenera |
|---|---|---|
| `sabana_sintetica_v1.xlsx` | Hoja `SABANA` con 40 filas que reproducen a propósito los problemas reales: códigos con puntos/espacios (`M.M.Z. 015`), ceros a la izquierda (`I-0236`), varios códigos en una celda (`I 2362 / RA 28`), marcadores de ausencia (`S/N`, `s/c`), comodato con código I (error), INC de 4 y 6 dígitos, código ilegible (`???`), duplicados probables, épocas en texto libre (`s. XX`, `ca. 1950`, `3000 años`) y 3 imágenes incrustadas (2 ancladas a filas y 1 sin fila). | `cd apps/api && .venv/Scripts/python -m app.seed --fixtures ../../data/fixtures` (en Linux/macOS `.venv/bin/python`) |
| `ingesta_varias_hojas.xlsx` | Hojas `Resumen` e `Inventario`. En `Inventario`: título combinado en la fila 1, cabeceras en la fila 3, colección combinada verticalmente (filas 4–5), una fila vacía entre datos y la columna `CÓDIGOS` con fórmulas que concatenan dos columnas (con su valor calculado guardado). Prueba de la ingesta (`importacion-pipeline-reconciliacion` 2.2). | Mismo comando |
| `ingesta_latin1_puntoycoma.csv` | CSV como lo guarda Excel en Windows en español: Latin-1, separador `;`, tildes, un `;` dentro de una celda entre comillas y una fila vacía. Prueba de la ingesta. | Mismo comando |
| `lote_demo/` | **Lote de demostración** de la importación: `lote_demo_sabana.xlsx` (30 filas con códigos sucios y columna RÉGIMEN) y `fotos/` (80 imágenes sintéticas por nombre, por carpeta, ambiguas, sin código y repetidas). Qué debería pasar con cada archivo: `lote_demo/LEEME.md`. (`importacion-masiva-fotografias` 7.1) | Mismo comando (`app/seed/demo_batch.py`) |

Las cabeceras son **ilustrativas** [SUPUESTO] hasta recibir una muestra anonimizada del Excel real
(pregunta A1 de `docs/preguntas-contraparte.md`). Las fotos del catálogo de demostración se generan al
ejecutar `npm run seed` y se suben al almacenamiento S3 (MinIO), nunca a la base de datos ni al repositorio.
