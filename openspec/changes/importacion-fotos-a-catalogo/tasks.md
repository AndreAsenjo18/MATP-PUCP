> Requiere `importacion-masiva-fotografias` con sus secciones 1–3 y 5.1–5.3 integradas (ya lo están). Las operaciones de bandeja pendientes de su tarea 4.2 se implementan aquí una sola vez con destino genérico (fila o pieza); al terminar la 4.1 de este change, marcar en aquel `tasks.md` qué parte de su 4.2 quedó cubierta.

## 1. Requisitos, preguntas y modelo

- [x] 1.1 Añadir RF-046 («Carga masiva de fotografías a piezas existentes», *Must*, importacion-datos) a `docs/requisitos/catalogo.md` (confirmar con André que el número está libre) y comprobar que AF1–AF6 estén en `docs/preguntas-contraparte.md` con su supuesto (entraron con la rama `docs/feedback-reunion-31-oct`); `openspec validate importacion-fotos-a-catalogo --strict` en verde (Req: todos)
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
- [ ] 3.4 Compilador de plantillas (`{TIPO}`, `{n}` unido a `{COLECCION}` o a la colección pista, `{*}`, separadores flexibles) con validación (`422 invalid_photo_template`); pruebas: `{n}-{*}` con `053-3269.jpg` y `059-3225 x.jpg`, dos códigos coincidentes, discrepantes, parcial, nombre que no encaja, tipo inexistente, `{n}` sin pista (Req: Forma de lectura de los nombres por carpeta; D4)
- [ ] 3.5 Motivo `discrepant_codes` en modo automático para nombres con dos códigos; pruebas con las formas F1, F2 y F3 sintéticas (`ABC 001 - PUCP 1234 (2).JPG`, `ABC 1 - INC 6100.jpg`, `I-3966 AB-407(2).jpg`) (Req: Forma de lectura… — escenarios «Dos códigos que coinciden…» y «Códigos discrepantes»)
- [ ] 3.6 Sugerencia de plantilla por forma de los nombres (≥ 80 %) y tabla de formas conocidas; pruebas: carpeta `999-9999`, carpeta `9`, carpeta mezclada sin sugerencia (Req: Forma de lectura… — escenario «Sugerencia de plantilla»)
- [ ] 3.7 Reglas por carpeta en `photo_reading` (gana la ruta más larga) y modo «nombres de cámara»; prueba de herencia a subcarpetas (Req: Forma de lectura…)
- [ ] 3.8 Propuesta de colección por nombre de la colección o del coleccionista, o por siglas (incluye `collection_acronym_alias` y la sigla delante de un rango), heredada a subcarpetas; pruebas: «Fotos Coleccion Juana Perez», una coincidencia, varias, ninguna, `12.JPG` con pista (Req: Colección de la carpeta como pista; D5)
- [ ] 3.9 Carpetas de rango (D11): detección, `range` en el árbol, exclusión de la vía «carpeta» y advertencia `out_of_range`; pruebas de los tres escenarios del requirement, incluida `ABC 001 - 100` que no debe proponer la pieza ABC 1 (Req: Carpetas de rango)
- [ ] 3.10 `match_batch_photos` según `kind`, sin tocar fotos manuales ni descartadas, y ejecución tras la verificación; prueba de reejecución idempotente en un lote `PHOTOS` (Req: Asignación manual… — escenario «Asignación que sobrevive a una nueva lectura»)

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

- [ ] 8.1 Fixture sintético en `data/fixtures/fotos_catalogo/` que reproduce la estructura del Drive con datos inventados: carpetas por sigla y por «coleccionista», subcarpetas de rango, las seis formas F1–F6 (incluida miniatura + `ALTAS/… copy.jpg` y un sufijo ` x`) y una lista de correspondencias; prueba de extremo a extremo del lote `PHOTOS` en SQLite (Req: todos; RNF-014)
- [ ] 8.2 Verificación en contenedores contra PostgreSQL y MinIO (`npm run dev`, `migrate`, `seed`, `npm run test:api:pg`): migración, subida real, aplicación y reversión de un lote de fotos; registrar en el PR el tiempo de emparejamiento contra 10 000 piezas sintéticas (requiere Docker)
- [ ] 8.3 OpenAPI: operaciones nuevas registradas como añadidas en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` y la prueba de conformidad en verde
- [ ] 8.4 Manual de usuario: sección «Importar el archivo fotográfico» en `docs/manual-usuario/` (descargar de Drive y descomprimir, formas de lectura, plantillas con ejemplos, lista de correspondencias, versiones de menor resolución)
- [ ] 8.5 `npm test`, `npm run lint` y `openspec validate importacion-fotos-a-catalogo --strict` en verde y, tras aprobar el PR, `openspec archive importacion-fotos-a-catalogo -y`
