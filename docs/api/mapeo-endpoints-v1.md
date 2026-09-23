# Mapeo del contrato del equipo (`endpoints-api-v1.yaml`) contra la API actual

- **Fuente de verdad de las interfaces**: [`docs/fuentes/endpoints-api-v1.yaml`](../fuentes/endpoints-api-v1.yaml) (OpenAPI 3.0.3, 30 rutas / 45 operaciones, «44 endpoints» según su encabezado), entregado por el equipo el 2026-09-22.
- **Estado actual**: [`docs/api/openapi.json`](openapi.json), generado por la API (78 operaciones: 28 implementadas y 50 stubs `501`), del change `contratos-api-borrador`.
- **Change que ejecuta esta alineación**: `alinear-api-endpoints-v1`.

Rutas relativas al prefijo `/api/v1`.

## Fase 1 — Alta / MVP

| # | Documento | Hoy en la API | Acción |
|---|---|---|---|
| 1 | `POST /pieces` · `createPiece` | `POST /pieces` (stub) | Renombrar `operationId`; cambiar el cuerpo a `PieceCreate` (`denomination`, `code_i`, `category_id`, `conservation_state_id`, `epoch_*`, `unmapped_payload`) |
| 2 | `GET /pieces` · `listPieces` (`page`, `limit`) | `GET /pieces` (implementado, cursor + filtros) | Cambiar la paginación a `page`/`limit` y la respuesta a `PieceSearchResponse` |
| 3 | `GET /pieces/{id}` · `getPieceById` | `GET /pieces/{piece_id}` (implementado) | Renombrar el parámetro a `id`; ajustar `PieceDetail` |
| 4 | `PUT /pieces/{id}` · `updatePiece` | `PATCH /pieces/{piece_id}` (stub) | Cambiar el verbo a `PUT` con cuerpo completo |
| 5 | `DELETE /pieces/{id}` · `softDeletePiece` | `DELETE /pieces/{piece_id}` (stub) | Alinear la respuesta (200) y el campo `is_active` |
| 6 | `GET /collections` · `listCollections` | `GET /collections` (implementado) | Devolver arreglo plano de `CollectionItem` |
| 7 | `POST /collections` · `createCollection` | `POST /collections` (implementado) | Alinear esquema y respuesta 201 |
| 8 | `GET /categories` · `listCategories` | `GET /vocabularies/categoria/terms` | **Ruta nueva**: `/categories` |
| 9 | `POST /categories` · `createCategory` | `POST /vocabularies/{code}/terms` | **Ruta nueva**: `/categories` |
| 10 | `GET /conservation-states` · `listConservationStates` | `GET /vocabularies/estado-conservacion/terms` | **Ruta nueva**: `/conservation-states` |
| 11 | `GET /locations/tree` · `getLocationsTree` | `GET /locations` (plano, implementado) | **Ruta nueva**: árbol anidado `LocationNode` |
| 12 | `POST /pieces/{id}/move` · `movePiece` | `POST /pieces/{piece_id}/movements` (stub) | Renombrar ruta y cuerpo (`destination_location_id`, `reason`) |
| 13 | `GET /pieces/{id}/location-history` · `getPieceLocationHistory` | `GET /pieces/{piece_id}/movements` (implementado) | Renombrar ruta |
| 14 | `POST /imports/upload` · `uploadImportBatch` | `POST /imports` (stub) | Renombrar ruta; respuesta 202 `ImportBatchSummary` |
| 15 | `GET /imports/{batch_id}/diffs` · `getImportBatchDiffs` | `GET /imports/{batch_id}/preview` (stub) | Renombrar ruta |
| 16 | `POST /imports/{batch_id}/confirm` · `confirmImportBatch` | `POST /imports/{batch_id}/approve` (stub) | Renombrar ruta |
| 17 | `GET /search` · `searchPieces` | `GET /search` (implementado) | Parámetros `q`, `collection_code`, `tenure_regime` (valores en español), `page`, `limit` |
| 18 | `POST /media/upload` · `uploadMediaAsset` | `POST /pieces/{piece_id}/media` + `.../media/upload-url` (stubs) | **Ruta nueva**: `/media/upload` con `multipart/form-data` |
| 19 | `POST /auth/login` · `login` | `POST /auth/login` (stub) | Cuerpo `username`/`password`, respuesta con JWT |
| 20 | `GET /auth/me` · `getMe` | `GET /auth/me` (implementado) | Alinear la respuesta al rol único del documento |

## Fase 2 — Media

| # | Documento | Hoy en la API | Acción |
|---|---|---|---|
| 21 | `POST /pieces/{id}/identifiers` · `addPieceIdentifier` | igual (stub) | Alinear nombres |
| 22 | `DELETE /pieces/{id}/identifiers/{identifier_id}` · `deletePieceIdentifier` | no existe (hay `.../correction`) | **Conflicto C3** (ver abajo) |
| 23 | `GET /pieces/{id}/children` · `getPieceChildren` | no existe (se resuelve con filtro) | **Ruta nueva** |
| 24 | `POST /pieces/{id}/children` · `addPieceChild` | no existe | **Ruta nueva** |
| 25 | `POST /locations` · `createLocation` | igual (stub) | Alinear nombres |
| 26 | `PUT /locations/{id}` · `updateLocation` | `PATCH /locations/{location_id}` (stub) | Cambiar el verbo a `PUT` |
| 27 | `GET /locations/{id}/pieces` · `getPiecesInLocation` | no existe (filtro en `/pieces`) | **Ruta nueva** |
| 28 | `GET /imports` · `listImportBatches` | igual (stub) | Alinear nombres |
| 29 | `POST /imports/{batch_id}/rollback` · `rollbackImportBatch` | `POST /imports/{batch_id}/revert` (stub) | Renombrar ruta |
| 30 | `POST /reports/export-excel` · `exportExcelReport` | `POST /search/export` (stub) | **Ruta nueva** |
| 31 | `GET /reports/piece-card/{id}/pdf` · `exportPiecePdf` | no existe | **Ruta nueva** (genera PDF) |
| 32 | `GET /reports/dashboard-stats` · `getDashboardStats` | `GET /quality/kpis` (stub) | **Ruta nueva** |
| 33 | `GET /users` · `listUsers` | igual (stub) | Alinear nombres |
| 34 | `POST /users` · `createUser` | igual (stub) | Alinear nombres |
| 35 | `PUT /users/{id}/role` · `updateUserRole` | `PATCH /users/{user_id}` (stub) | **Ruta nueva** |
| 36 | `GET /audit-logs` · `getAuditLogs` | `GET /audit` (implementado) | Renombrar ruta |
| 37 | `POST /ai/suggest-cataloging` · `suggestCataloging` | `POST /ai/suggestions` (stub) | Renombrar ruta |
| 38 | `POST /ai/validate-data` · `validateDataQuality` | `GET /quality/incomplete` + `/quality/kpis` (stubs) | **Ruta nueva** |

## Fase 3 — Baja / Post-MVP

| # | Documento | Hoy en la API | Acción |
|---|---|---|---|
| 39 | `GET /loans` · `listLoans` | no existe | **Ruta y tabla nuevas** (`LOANS` del diagrama ER) |
| 40 | `POST /loans` · `createLoan` | no existe | **Ruta nueva** |
| 41 | `PUT /loans/{id}/status` · `updateLoanStatus` | no existe | **Ruta nueva** |
| 42 | `POST /media/bulk-download` · `bulkDownloadMedia` | no existe | **Ruta nueva** (ZIP) |
| 43 | `GET /public/catalog` · `getPublicCatalog` | no existe | **Conflicto C2** (ver abajo) |
| 44 | `GET /audit-logs/pieces/{id}` · `getPieceAuditTimeline` | `GET /audit?entity_type=piece&entity_id=` (implementado) | **Ruta nueva** |
| 45 | `POST /ai/batch-enrich` · `batchAiEnrichment` | no existe (hay lote en `ia-sugerencia-terminos`) | **Ruta nueva** |

## Operaciones que hoy existen y el documento no incluye

No se eliminan por ahora: sostienen reglas que `CLAUDE.md` marca como no negociables o requisitos ya especificados. Quedan marcadas como **añadidos** al contrato del equipo, pendientes de su visto bueno (pregunta I5).

| Operación actual | Por qué existe |
|---|---|
| `POST /ai/suggestions/{id}/approve` · `/reject`, `GET /ai/suggestions` | RN-009: ninguna salida de IA se guarda sin aprobación humana registrada |
| `GET /quality/duplicates`, `POST /quality/duplicates/{id}/resolve` | RF-030: cola de revisión de duplicados |
| `GET /vocabularies*`, `POST /vocabularies/{code}/terms`, … | RN-010: vocabularios parametrizables (materiales, técnicas, tipos de vista) |
| `GET /identifier-types`, `POST /identifiers/normalize` | RF-023, RN-010: tipos de identificador y normalizador como datos |
| `POST /pieces/{id}/restore`, `POST /pieces/validate` | RN-005 (restaurar en lugar de borrar) y RF-043 (validación en tiempo real) |
| `POST /pieces/{id}/identifiers/{id}/correction` | RN-002: corrección auditada del código I, en lugar de borrarlo |
| `PUT /imports/{batch_id}/mapping`, `GET /import-templates` | RF-022: plantillas de mapeo reutilizables |
| `GET /exports/full` | RF-044 del catálogo: exportación completa en formato abierto |
| `GET /health`, `GET /health/live` | RNF-004: verificación de salud del entorno |

## Conflictos que necesitan decisión del equipo

- **C1 — Numeración de requisitos.** El documento usa su propia numeración RF, distinta de `docs/requisitos/catalogo.md`, con la que están trazadas las 12 specs y los 15 changes del backlog. Ejemplos: en el documento `RF-041` es el login y en el catálogo es «restricción de campos sensibles por rol»; `RF-013` es préstamos en el documento y «múltiples fotos por pieza» en el catálogo; `RF-018` es historial de ubicaciones frente a «préstamos y exposiciones». Hace falta elegir una numeración única y remapear la otra.
- **C2 — `GET /public/catalog` sin autenticación.** Choca con RF-042 del catálogo y con `CLAUDE.md` («Fase 1 = herramienta de control interno. Nada público»). Además expondría datos que RNF-014 (Ley 29733) y las restricciones de comodato (RN-008) limitan.
- **C3 — `DELETE /pieces/{id}/identifiers/{identifier_id}`.** RN-005 prohíbe borrar información. Se propone implementarlo como baja lógica del identificador (queda en el historial y en la auditoría), conservando la ruta y el verbo del documento.
- **C4 — Modelo de datos.** El contrato asume el diagrama ER: `code_i` como campo de la pieza, `category_id` y `conservation_state_id` como tablas propias, `is_active`, `unmapped_payload` y un rol único por usuario. Lo implementado usa identificadores 1:N, vocabularios genéricos y matriz de permisos. Decisión pendiente en la sección H de `docs/preguntas-contraparte.md`.
- **C5 — Valores de enumerados en español** (`Propiedad`, `Comodato`, `Préstamo Temporal`; `Frontal`, `Perfil`, …) frente a los actuales en inglés (`OWNED`, `LOAN_FOR_USE`, `TEMPORARY_LOAN`). El documento manda en la API; hay que decidir si también cambian en la base de datos o solo en la traducción de entrada y salida.
- **C6 — Almacenamiento e infraestructura.** El documento menciona AWS S3 y un servidor de staging en AWS Academy; ADR-007 y ADR-011 asumen MinIO en local, Cloudflare R2 como contingencia y la VM de la PUCP. Compatible (S3 es compatible por API), pero hay que fijar cuál se usa en staging.
