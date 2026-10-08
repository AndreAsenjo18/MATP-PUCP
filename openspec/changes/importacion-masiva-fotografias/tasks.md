> Requiere integrados `fotografias-multiples-por-pieza` (secciones 1 y 2) e `importacion-pipeline-reconciliacion` (estados, previsualización y aplicación). Las secciones 1 y 3.1–3.2 pueden empezar antes con dobles de esos servicios.

## 1. Modelo y configuración

- [ ] 1.1 Añadir RF-045 («Carga masiva de fotografías asociada a la importación», *Must*, importacion-datos) a `docs/requisitos/catalogo.md` y actualizar las preguntas L1–L4 de `docs/preguntas-contraparte.md` con las respuestas que haya dado el museo; verificar con `openspec validate importacion-masiva-fotografias --strict` (Req: todos)
- [ ] 1.2 Modelo `ImportPhoto` y enums (`ImportPhotoStatus`, `PhotoMatchStatus`, `PhotoMatchSource`) en `app/modules/imports/models.py`, migración Alembic aditiva con índice único `(batch_id, content_sha256)` y término «sin especificar» en `PHOTO_VIEW_TYPE` del seed; `tests/test_migrations.py` y prueba de una sola cabeza en verde (Req: Fotografías del lote con subida reanudable)
- [ ] 1.3 Variables `IMPORT_MAX_PHOTOS`, `MEDIA_KEEP_ORIGINALS`, `IMPORT_PHOTO_RETENTION_DAYS` y `MEDIA_QUOTA_BYTES` en `Settings` y `.env.example`; prueba existente de documentación de variables en verde (Req: Conservación configurable del original en cargas masivas; RNF-004)

## 2. Subida reanudable y verificación

- [ ] 2.1 `POST /imports/{batch_id}/photos/upload-urls` (tandas de hasta 100, `already_registered` por huella, límite de fotos, 409 si el lote no admite fotos); pruebas: tanda nueva, reanudación sin duplicar, lote aprobado 409, Consulta interna 403 (Req: Fotografías del lote con subida reanudable)
- [ ] 2.2 `POST /imports/{batch_id}/photos/complete` y tarea del worker del lote: verificación de tipo real, tamaño y SHA-256 y generación de `thumb`/`display` reutilizando el servicio de derivados de `media`; pruebas: verificada, PDF disfrazado rechazado, huella distinta rechazada, reencolado al reiniciar con latido vencido (Req: Fotografías del lote con subida reanudable)
- [ ] 2.3 Comando `python -m app.imports.purge_photos` para fotos de lotes abandonados o descartadas tras `IMPORT_PHOTO_RETENTION_DAYS`; prueba de que no toca fotos aplicadas ni de lotes vigentes (Req: Fotografías del lote con subida reanudable; RN-005)

## 3. Emparejamiento

- [ ] 3.1 `app/modules/imports/photo_matching.py`: limpieza de sufijos, extracción de candidatos y normalización con `identification.normalization.normalize`; pruebas unitarias con nombres sintéticos (`I 1234 (2).JPG`, `MMZ045_frontal.jpg`, `1234.0.jpg`, `IMG_20190312.jpg`) (Req: Emparejamiento automático propuesto entre fotos y filas; RF-023)
- [ ] 3.2 Índice del lote y resolución en tres vías (archivo → carpeta → columna `photo_filename` del mapeo), orden natural y `ambiguous`/`unmatched`; pruebas de los cinco escenarios del requirement (Req: Emparejamiento automático propuesto…)
- [ ] 3.3 Ejecución del emparejamiento al terminar la validación y al llegar fotos nuevas, sin pisar asignaciones manuales; prueba de reejecución idempotente (Req: Emparejamiento automático propuesto…)
- [ ] 3.4 Campo `photo_filename` en `MappingSpec` (coordinar con la célula dueña de `plantillas-mapeo-y-normalizacion`); prueba de mapeo con la columna «Foto» (Req: Emparejamiento automático propuesto… — escenario «Columna de archivo definida en el mapeo»)

## 4. Bandeja y previsualización

- [ ] 4.1 `GET /imports/{batch_id}/photos` (filtros y paginación, miniaturas con URL firmada) y `GET /imports/{batch_id}/photos/summary`; pruebas de filtros y conteos (Req: Previsualización del lote con miniaturas y conteos de fotos)
- [ ] 4.2 `PATCH /imports/{batch_id}/photos` con `assign`, `unassign`, `discard`, `confirm_duplicate` y `reorder`, con entrada en la bitácora; pruebas: asignación múltiple, fila de otro lote 422, fila rechazada deja fotos sin aplicar (Req: Bandeja de revisión de fotografías del lote; RF-028)
- [ ] 4.3 Detección de repetidas en el lote y contra la pieza destino de filas de actualización; prueba de los escenarios de duplicado (Req: Previsualización del lote… — escenario «Foto repetida en una pieza existente»)

## 5. Aplicación, reversión y originales

- [ ] 5.1 `media.service.register_from_import()` reutilizando restricción efectiva y auditoría, sin volver a verificar ni copiar; principal por menor `sort_key` en piezas nuevas; pruebas: pieza nueva con 3 fotos, comodato con restricción heredada (Req: Aplicación y reversión conjunta de piezas y fotografías; RN-008)
- [ ] 5.2 Integrar el registro en la transacción de aplicación del lote con verificación `HEAD` previa; prueba: objeto faltante deja el lote en `FAILED_APPLY` y el catálogo sin cambios (Req: Aplicación y reversión conjunta… — escenario «Fallo al registrar una foto durante la aplicación»)
- [ ] 5.3 Incluir las fotos en el `change_set` del lote para la reversión; prueba: revertir un lote retira lógicamente sus fotos y conserva archivos (Req: Aplicación y reversión conjunta…; RN-005)
- [ ] 5.4 `MEDIA_KEEP_ORIGINALS=false`: `storage_key` en `display.webp`, datos del original en `extra_metadata.original`, borrado de `upload.<ext>` tras aplicar y rechazo si falta el derivado; pruebas de los escenarios del requirement de multimedia (Req: Conservación configurable del original en cargas masivas)
- [ ] 5.5 Extender `GET /media/storage-estimate` con `keeps_originals` y desglose por tipo de archivo; aviso de cuota en el resumen del lote cuando se supera `MEDIA_QUOTA_BYTES`; pruebas (Req: Conservación configurable… — escenario «Estimación con el parámetro vigente»; RNF-003)

## 6. Frontend (`apps/web`)

- [ ] 6.1 `lib/data/importPhotos.ts` (mock/live): listado de carpeta con ruta relativa, SHA-256 en Web Worker, tandas, concurrencia 4, reintento con espera exponencial y reanudación; pruebas Vitest (Req: Fotografías del lote con subida reanudable)
- [ ] 6.2 Paso «Fotografías» del asistente de importación (selector de carpeta, arrastrar carpetas, avance global y por archivo, reanudar), con el prototipo v3 como referencia de UX; prueba de componente (Req: Fotografías del lote con subida reanudable)
- [ ] 6.3 Miniaturas por fila en la previsualización y bandeja lateral con filtros, selección múltiple y «asignar a fila»; pruebas de componente (Req: Bandeja de revisión…; Req: Previsualización del lote…)

## 7. Cierre del change

- [ ] 7.1 Fixture sintético en `data/fixtures/`: sábana de 30 filas con códigos sucios y una carpeta de 80 imágenes generadas (nombres por código, por carpeta, sin código y ambiguos); prueba de extremo a extremo del lote con fotos en SQLite (Req: todos; RNF-014)
- [ ] 7.2 Verificación en contenedores contra PostgreSQL y MinIO (`npm run dev`, `migrate`, `seed`): subida real con CORS y URL prefirmada, aplicación y reversión de un lote con fotos; medir el tiempo de derivados para 1 000 fotos y registrarlo en el PR (requiere Docker)
- [ ] 7.3 OpenAPI: añadir las operaciones `/imports/{batch_id}/photos…` y registrarlas como operaciones añadidas en `docs/api/mapeo-endpoints-v1.md`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` y la prueba de conformidad en verde
- [ ] 7.4 Manual de usuario: sección «Importar fotografías con el Excel» en `docs/manual-usuario/` (cómo nombrar archivos o carpetas, reanudar, bandeja) y nota de cuota en `docs/despliegue/almacenamiento.md`
- [ ] 7.5 Con la célula Importación, `/opsx:update importacion-pipeline-reconciliacion` para marcar la D8 como caso secundario que alimenta `import_photo` con `match_source=embedded`; `openspec validate --all --strict` en verde
- [ ] 7.6 `npm test`, `npm run lint` y `openspec validate importacion-masiva-fotografias --strict` en verde y, tras aprobar el PR, `openspec archive importacion-masiva-fotografias -y`
