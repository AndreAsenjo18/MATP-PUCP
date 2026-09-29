# data/fixtures — datos sintéticos

Solo datos **sintéticos** (Ley 29733, RNF-014). Nada de este directorio proviene del museo.

| Archivo | Contenido | Cómo se regenera |
|---|---|---|
| `sabana_sintetica_v1.xlsx` | Hoja `SABANA` con 40 filas que reproducen a propósito los problemas reales: códigos con puntos/espacios (`M.M.Z. 015`), ceros a la izquierda (`I-0236`), varios códigos en una celda (`I 2362 / RA 28`), marcadores de ausencia (`S/N`, `s/c`), comodato con código I (error), INC de 4 y 6 dígitos, código ilegible (`???`), duplicados probables, épocas en texto libre (`s. XX`, `ca. 1950`, `3000 años`) y 3 imágenes incrustadas (2 ancladas a filas y 1 sin fila). | `cd apps/api && .venv/Scripts/python -m app.seed --fixtures ../../data/fixtures` (en Linux/macOS `.venv/bin/python`) |

Las cabeceras son **ilustrativas** [SUPUESTO] hasta recibir una muestra anonimizada del Excel real
(pregunta A1 de `docs/preguntas-contraparte.md`). Las fotos del catálogo de demostración se generan al
ejecutar `npm run seed` y se suben al almacenamiento S3 (MinIO), nunca a la base de datos ni al repositorio.
