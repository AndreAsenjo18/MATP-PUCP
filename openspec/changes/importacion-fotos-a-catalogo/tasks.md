> Requiere `importacion-masiva-fotografias` con sus secciones 1–3 y 5.1–5.3 integradas (ya lo están). Las operaciones de bandeja pendientes de su tarea 4.2 se implementan aquí una sola vez con destino genérico (fila o pieza); al terminar la 4.1 de este change, marcar en aquel `tasks.md` qué parte de su 4.2 quedó cubierta.

## 1. Requisitos, preguntas y modelo

- [ ] 1.1 Añadir RF-046 («Carga masiva de fotografías a piezas existentes», *Must*, importacion-datos) a `docs/requisitos/catalogo.md` (confirmar con André que el número está libre) y las preguntas AF1–AF4 a `docs/preguntas-contraparte.md` con su supuesto; actualizar L1 con lo observado el 2026-10-31; `openspec validate importacion-fotos-a-catalogo --strict` en verde (Req: todos)
- [ ] 1.2 Migración aditiva: `import_batch.kind` (default `SPREADSHEET`) y `photo_reading`; en `import_photo`, `piece_id`, `candidate_piece_ids`, `match_reason`, `width_px`, `height_px`, `perceptual_hash`, `same_as_photo_id` y `CHECK` fila o pieza; valores `TEMPLATE` y `LIST` en `photo_match_source`; `photo_camera_patterns` en `normalization_setting`. Pruebas: `tests/test_migrations.py`, una sola cabeza y `test_cross_cutting_rules.py` en verde (Req: Lote de solo fotografías…; D1, D2)
- [ ] 1.3 Variable `IMPORT_PHOTO_SIMILARITY_BITS` en `Settings` y `.env.example`; prueba de documentación de variables en verde (Req: Detección de la misma foto…)

## 2. Lote de solo fotos

- [ ] 2.1 Transiciones por `kind` en `imports/state.py` (`PHOTOS`: `UPLOADED → IN_PREVIEW → APPROVED → APPLIED → REVERTED`, abandono y `FAILED_APPLY`) y `PHOTO_STATES` por tipo; pruebas de transiciones válidas e inválidas de ambos tipos (Req: Lote de solo fotografías…; D1)
- [ ] 2.2 `POST /imports/photo-batches` (permiso `imports.prepare`) y `409 batch_kind_mismatch` en las operaciones de Excel sobre un lote `PHOTOS`; pruebas: creación, mapeo rechazado, Consulta interna 403 (Req: Lote de solo fotografías…)
- [ ] 2.3 Paso a `IN_PREVIEW` cuando no quedan fotos pendientes de verificar y el emparejamiento terminó; prueba con tanda reanudada (Req: Lote de solo fotografías…)

## 3. Lectura y emparejamiento con el catálogo

- [ ] 3.1 Patrones de cámara `NNN-NNNN` y `NNLLNNNN` en `photo_matching` y lectura de `photo_camera_patterns` (validados con `re.compile`, máx. 200 caracteres); pruebas unitarias con `175-3554.jpg`, `82LF4169 copy.jpg`, patrón añadido y patrón inválido; pruebas del change hermano en verde (Req: Protección contra falsos positivos…)
- [ ] 3.2 Separar la resolución del índice en `photo_matching` (índice genérico `clave → {destino}`) sin cambiar el comportamiento de `match_photos`; pruebas existentes en verde (Req: Lote de solo fotografías…; D3)
- [ ] 3.3 Índice del catálogo (`piece_identifier` vigentes de piezas no retiradas + correlativo por colección) y `match_catalog_photos` con números sueltos limitados a la colección pista; pruebas: `I-3554` no se propone, `245.jpg` con y sin pista, otra colección (`other_collection`) (Req: Protección contra falsos positivos…; Req: Colección de la carpeta como pista)
- [ ] 3.4 Compilador de plantillas (`{TIPO}`, `{n}`, separadores flexibles) con validación (`422 invalid_photo_template`); pruebas: dos códigos coincidentes, discrepantes, parcial, nombre que no encaja, tipo inexistente (Req: Forma de lectura de los nombres por carpeta; D4)
- [ ] 3.5 Reglas por carpeta en `photo_reading` (gana la ruta más larga) y modo «nombres de cámara»; prueba de herencia a subcarpetas (Req: Forma de lectura…)
- [ ] 3.6 Propuesta de colección por nombre o siglas de la carpeta (incluye `collection_acronym_alias`); pruebas: una coincidencia, varias, ninguna (Req: Colección de la carpeta como pista; D5)
- [ ] 3.7 `match_batch_photos` según `kind`, sin tocar fotos manuales ni descartadas, y ejecución tras la verificación; prueba de reejecución idempotente en un lote `PHOTOS` (Req: Asignación manual… — escenario «Asignación que sobrevive a una nueva lectura»)

## 4. API de lectura, bandeja y lista

- [ ] 4.1 `PATCH /imports/{batch_id}/photos` con destino genérico: `assign` (fila o pieza), `unassign`, `discard`, `restore`, `confirm_duplicate`, `reorder`, con entrada en la bitácora del lote; pruebas: asignación múltiple a pieza, pieza retirada 422, fila en lote `PHOTOS` 422, restaurar descartada (Req: Asignación manual de fotos a piezas existentes)
- [ ] 4.2 Repetida en la pieza por SHA-256 al proponer o asignar; prueba del escenario «Foto que ya está en la pieza» (Req: Lote de solo fotografías…)
- [ ] 4.3 `GET /imports/{batch_id}/photos/folders`, filtros `folder` y `piece_id` en el listado y `match_reason` en la respuesta; pruebas de conteos por carpeta (Req: Asignación manual…; Req: Forma de lectura…)
- [ ] 4.4 `POST …/photos/reading-preview` (20 nombres, sin guardar) y `PUT …/photos/reading` (guarda y reempareja la carpeta); pruebas: vista previa no persiste, reemparejar respeta manuales (Req: Forma de lectura…)
- [ ] 4.5 `POST …/photos/correspondences` (CSV y XLSX, encabezados `archivo`, `codigo`, `tipo`), prioridad sobre el nombre, guardado en `photo_reading`; pruebas: asigna foto de cámara, líneas sin foto o sin pieza, nombre repetido en dos carpetas (Req: Lista de correspondencias…; D7)

## 5. Misma foto en distinta resolución

- [ ] 5.1 dHash de 64 bits con Pillow, `width_px` y `height_px` en `photo_verification`; prueba unitaria: misma imagen reescalada da distancia ≤ 4 y dos imágenes sintéticas distintas > 4 (Req: Detección de la misma foto…; D6)
- [ ] 5.2 Agrupación por lote con pre-filtro por buckets, conservación de la mayor resolución, `DISCARDED` con motivo y `same_as_photo_id`, traspaso de asignación manual; cálculo al vuelo para fotos sin hash; pruebas de los tres escenarios del requirement (Req: Detección de la misma foto…)

## 6. Aplicación y procedencia

- [ ] 6.1 `apply_batch` para `PHOTOS`: fotos por pieza en orden, verificación `HEAD`, mismo `change_set`; pruebas: aplicar y revertir sin tocar fotos anteriores, fotos sin asignar no se aplican, objeto faltante → `FAILED_APPLY` (Req: Lote de solo fotografías…; D9)
- [ ] 6.2 Aviso previo a aprobar (sin asignar, repetidas sin confirmar, colecciones pendientes de confirmar, `partial_codes`) en el resumen del lote; prueba de conteos (Req: Lote de solo fotografías… — escenario «Foto sin pieza al aprobar»)
- [ ] 6.3 `extra_metadata` con `import_batch_name` y `replaced_lower_resolution`; `provenance` de solo lectura en la galería; pruebas: foto de lote, foto subida a mano, `PATCH` que intenta cambiarla (Req: Procedencia visible de las fotografías importadas)

## 7. Frontend (`apps/web`)

- [ ] 7.1 Capa de datos (mock/live) para lotes de fotos: crear lote, carpetas, vista previa de lectura, guardar regla, lista de correspondencias, decisiones; pruebas Vitest (Req: todos)
- [ ] 7.2 Entrada «Importar fotografías al catálogo» y paso 1 «Subir carpeta» reutilizando `lib/data/importPhotos.ts`; prueba de componente (Req: Lote de solo fotografías…)
- [ ] 7.3 Paso 2 «Cómo se leen los nombres»: árbol de carpetas, forma de lectura, editor de plantilla con chips, colección pista y vista previa en vivo; pruebas de componente (Req: Forma de lectura…; Req: Colección de la carpeta…)
- [ ] 7.4 Paso 3 «Revisar y aprobar»: cuadrícula con filtros, selección múltiple (Mayús + clic, toda la carpeta), «Asignar a pieza…» con `/search`, panel lateral de comparación y aviso de aprobación; pruebas de componente y de teclado (Req: Asignación manual…; RNF-010)
- [ ] 7.5 Procedencia en la galería de la ficha; prueba de componente (Req: Procedencia visible…)

## 8. Cierre del change

- [ ] 8.1 Fixture sintético en `data/fixtures/fotos_catalogo/`: imágenes generadas con las tres formas de nombre (`ABC nn - PUCP nnnn (2).JPG`, `NNN-NNNN.jpg`, miniatura + `ALTAS/… copy.jpg`) y una lista de correspondencias; prueba de extremo a extremo del lote `PHOTOS` en SQLite (Req: todos; RNF-014)
- [ ] 8.2 Verificación en contenedores contra PostgreSQL y MinIO (`npm run dev`, `migrate`, `seed`, `npm run test:api:pg`): migración, subida real, aplicación y reversión de un lote de fotos; registrar en el PR el tiempo de emparejamiento contra 10 000 piezas sintéticas (requiere Docker)
- [ ] 8.3 OpenAPI: operaciones nuevas registradas como añadidas en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` y la prueba de conformidad en verde
- [ ] 8.4 Manual de usuario: sección «Importar el archivo fotográfico» en `docs/manual-usuario/` (descargar de Drive y descomprimir, formas de lectura, plantillas con ejemplos, lista de correspondencias, versiones de menor resolución)
- [ ] 8.5 `npm test`, `npm run lint` y `openspec validate importacion-fotos-a-catalogo --strict` en verde y, tras aprobar el PR, `openspec archive importacion-fotos-a-catalogo -y`
