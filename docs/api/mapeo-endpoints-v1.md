# Mapeo del contrato del equipo (`endpoints-api-v1.yaml`) contra la API actual

- **Fuente de verdad de las interfaces**: [`docs/fuentes/endpoints-api-v1.yaml`](../fuentes/endpoints-api-v1.yaml) (OpenAPI 3.0.3, 30 rutas / 45 operaciones, «44 endpoints» según su encabezado), entregado por el equipo el 2026-09-22.
- **Estado actual**: [`docs/api/openapi.json`](openapi.json), generado por la API (78 operaciones: 28 implementadas y 50 stubs `501`), del change `contratos-api-borrador`.
- **Change que ejecuta esta alineación**: `alinear-api-endpoints-v1`.

Rutas relativas al prefijo `/api/v1`. **Estado al 2026-09-22 (tras la primera tanda de alineación): 39 de las 45 operaciones del documento ya coinciden en ruta, verbo e `operationId`**; la columna «Acción» dice qué falta en cada una. La columna «Etiqueta del documento → catálogo» relaciona la etiqueta `[RF-xxx]` de cada operación del documento con los IDs de `docs/requisitos/catalogo.md`, que es la numeración oficial (resolución de C1). La equivalencia se hace por el significado de la operación: primero se toman los IDs del catálogo que ya citan `docs/api/openapi.json` o las tareas del change, y si no hay, el requisito del catálogo que describe esa operación. Cuando ninguno corresponde claramente, la fila dice «Pendiente» y una nota explica por qué. La prueba `apps/api/tests/api/test_contract_conformance.py` lo verifica en cada ejecución.

## Fase 1 — Alta / MVP

| # | Documento | Etiqueta del documento → catálogo | Hoy en la API | Acción |
|---|---|---|---|---|
| 1 | `POST /pieces` · `createPiece` | `RF-001/002` → RF-006, RN-003 | `POST /pieces` (stub) | Pendiente: esquema `PieceCreate` (tarea 4.1) |
| 2 | `GET /pieces` · `listPieces` (`page`, `limit`) | `RF-014` → Pendiente¹ | `GET /pieces` (implementado, cursor + filtros) | Pendiente: paginación `page`/`limit` (tarea 4.1) |
| 3 | `GET /pieces/{id}` · `getPieceById` | `RF-003` → RF-006 | `GET /pieces/{piece_id}` (implementado) | Hecho: `getPieceById`. Campo añadido `version` (concurrencia optimista, `ficha-pieza-crud` D2) |
| 4 | `PUT /pieces/{id}` · `updatePiece` | `RF-004` → RF-006, RN-002 | `PATCH /pieces/{piece_id}` (stub) | Hecho: `PUT /pieces/{id}` (`updatePiece`). Cabecera `If-Match` con la `version` (`ficha-pieza-crud` D2). Campos añadidos al cuerpo `tenure_change_reason` y `supporting_document_ref`: el motivo y el documento de respaldo del cambio de régimen, que quedan en la auditoría y no en la ficha (`ficha-pieza-crud` D4) |
| 5 | `DELETE /pieces/{id}` · `softDeletePiece` | `RF-005` → RN-005, RNF-006 | `DELETE /pieces/{piece_id}` (stub) | Hecho: `softDeletePiece` |
| 6 | `GET /collections` · `listCollections` | `RF-006` → RF-010 | `GET /collections` (implementado) | Hecho: `CollectionOut` contiene `CollectionItem` (`code` = sigla normalizada); `TermOut` añade `name` en `/categories` y `/conservation-states` (tarea 4.2) |
| 7 | `POST /collections` · `createCollection` | `RF-039` → RF-010 | `POST /collections` (implementado) | Hecho: `createCollection`; acepta el cuerpo `CollectionItem` (`code` equivale a `acronym`) |
| 8 | `GET /categories` · `listCategories` | `RF-007` → RF-011 | `GET /vocabularies/categoria/terms` | Hecho: `GET /categories` sobre el vocabulario CATEGORY |
| 9 | `POST /categories` · `createCategory` | `RF-040` → RF-011 | `POST /vocabularies/{code}/terms` | Hecho: `POST /categories` |
| 10 | `GET /conservation-states` · `listConservationStates` | `RF-008` → RF-012 | `GET /vocabularies/estado-conservacion/terms` | Hecho: `GET /conservation-states` |
| 11 | `GET /locations/tree` · `getLocationsTree` | `RF-016` → RF-016, RF-041 | `GET /locations` (plano, implementado) | Hecho: `GET /locations/tree` con `LocationNode` |
| 12 | `POST /pieces/{id}/move` · `movePiece` | `RF-017` → RF-017 | `POST /pieces/{piece_id}/movements` (stub) | Hecho: `POST /pieces/{id}/move` |
| 13 | `GET /pieces/{id}/location-history` · `getPieceLocationHistory` | `RF-018` → RF-017 | `GET /pieces/{piece_id}/movements` (implementado) | Hecho: `GET /pieces/{id}/location-history` |
| 14 | `POST /imports/upload` · `uploadImportBatch` | `RF-021/022` → RF-021 | `POST /imports` (stub) | Hecho: `POST /imports/upload` |
| 15 | `GET /imports/{batch_id}/diffs` · `getImportBatchDiffs` | `RF-023` → RF-026 | `GET /imports/{batch_id}/preview` (stub) | Hecho: `GET /imports/{batch_id}/diffs` |
| 16 | `POST /imports/{batch_id}/confirm` · `confirmImportBatch` | `RF-024` → RF-027 | `POST /imports/{batch_id}/approve` (stub) | Hecho: `POST /imports/{batch_id}/confirm` |
| 17 | `GET /search` · `searchPieces` | `RF-031` → RF-031, RF-032 | `GET /search` (implementado) | Hecho: `collection_code`, `tenure_regime` y `page`/`limit` (tarea 4.5). Respuesta propia `SearchResultPage` (no la `Page[T]` compartida, que sigue usando `page_size`) para exponer `limit` tal como pide el documento |
| 18 | `POST /media/upload` · `uploadMediaAsset` | `RF-032` → RF-013, RF-014, RN-008 | `POST /pieces/{piece_id}/media` + `.../media/upload-url` (stubs) | Hecho: `POST /media/upload` (stub) |
| 19 | `POST /auth/login` · `login` | `RF-041` → RNF-012 | `POST /auth/login` (implementado, ADR-009) | Hecho: cuerpo `username`/`password` (el nombre de usuario es el correo). Responde `200` con el usuario, `csrf_token` y `session_expires_at`; la sesión viaja en la cookie `HttpOnly` `matp_session`, no en un token JWT como dice la descripción del documento (ADR-009). Todo fallo es el mismo `401 invalid_credentials`; `429` por exceso de intentos desde una dirección |
| 20 | `GET /auth/me` · `getMe` | `RF-042` → RF-039 | `GET /auth/me` (implementado) | Hecho: lee la sesión real y añade `must_change_password`. Se mantiene la matriz de roles (resolución C4-g) y `/auth/me` ya devuelve `roles` y `permissions`; no queda ningún «rol único» por implementar |

¹ El catálogo no tiene un requisito de listado de piezas. La paginación de listados y búsqueda está trazada a RF-031, RF-032 y RF-038 en la spec delta de `plataforma`, pero eso no identifica el requisito del listado.

## Fase 2 — Media

| # | Documento | Etiqueta del documento → catálogo | Hoy en la API | Acción |
|---|---|---|---|---|
| 21 | `POST /pieces/{id}/identifiers` · `addPieceIdentifier` | `RF-009` → RF-002 | igual (stub) | Hecho: ruta ya conforme. Campos añadidos al cuerpo `confirmed_split` y `split_from`: la confirmación de la separación de un valor concatenado y ese valor original, que queda en la auditoría (`ficha-pieza-crud` D5) |
| 22 | `DELETE /pieces/{id}/identifiers/{identifier_id}` · `deletePieceIdentifier` | `RF-010` → RF-002, RN-002, RN-005 | no existe (hay `.../correction`) | Hecho: baja lógica con motivo; queda en el historial (`include_history`) y en la auditoría; el código I responde 409 (tarea 5.3) |
| 23 | `GET /pieces/{id}/children` · `getPieceChildren` | `RF-011` → RF-009 | no existe (se resuelve con filtro) | Hecho: `GET /pieces/{id}/children` |
| 24 | `POST /pieces/{id}/children` · `addPieceChild` | `RF-012` → RF-009 | no existe | Hecho: `POST /pieces/{id}/children` (stub) |
| 25 | `POST /locations` · `createLocation` | `RF-019` → RF-016 | igual (stub) | Hecho: ruta ya conforme |
| 26 | `PUT /locations/{id}` · `updateLocation` | `RF-020` → RF-016 | `PATCH /locations/{location_id}` (stub) | Hecho: `PUT /locations/{id}` |
| 27 | `GET /locations/{id}/pieces` · `getPiecesInLocation` | `RF-025` → RF-034, RF-016 | no existe (filtro en `/pieces`) | Hecho: `GET /locations/{id}/pieces` (stub) |
| 28 | `GET /imports` · `listImportBatches` | `RF-026` → Pendiente² | igual (stub) | Hecho: `listImportBatches` |
| 29 | `POST /imports/{batch_id}/rollback` · `rollbackImportBatch` | `RF-027` → RNF-007 | `POST /imports/{batch_id}/revert` (stub) | Hecho: `POST /imports/{batch_id}/rollback` |
| 30 | `POST /reports/export-excel` · `exportExcelReport` | `RF-033` → RF-036 | `POST /search/export` (stub) | Hecho: `POST /reports/export-excel` |
| 31 | `GET /reports/piece-card/{id}/pdf` · `exportPiecePdf` | `RF-034` → RF-006 | no existe | Hecho: `GET /reports/piece-card/{id}/pdf` (stub) |
| 32 | `GET /reports/dashboard-stats` · `getDashboardStats` | `RF-035` → RF-035 | `GET /quality/kpis` (stub) | Hecho: `GET /reports/dashboard-stats` |
| 33 | `GET /users` · `listUsers` | `RF-036` → RF-039 | igual (stub) | Hecho: ruta ya conforme |
| 34 | `POST /users` · `createUser` | `RF-037` → RF-039 | igual (stub) | Hecho: ruta ya conforme |
| 35 | `PUT /users/{id}/role` · `updateUserRole` | `RF-038` → RF-039 | `PATCH /users/{user_id}` (stub) | Hecho: `PUT /users/{id}/role` (stub) con `UserRoleUpdate`, que reemplaza el conjunto de roles (D3, tarea 5.1) |
| 36 | `GET /audit-logs` · `getAuditLogs` | `RF-043` → RF-040 | `GET /audit` (implementado) | Hecho: `GET /audit-logs` |
| 37 | `POST /ai/suggest-cataloging` · `suggestCataloging` | `RF-028` → RIA-01, RN-009 | `POST /ai/suggestions` (stub) | Hecho: `POST /ai/suggest-cataloging` (stub) con `CatalogingSuggestionRequest` y `piece_id` obligatorio como en el documento (tarea 5.1) |
| 38 | `POST /ai/validate-data` · `validateDataQuality` | `RF-029` → RIA-02, RN-009 | `GET /quality/incomplete` + `/quality/kpis` (stubs) | Hecho: `POST /ai/validate-data` (stub) |

² Candidatos: RF-021 (pipeline con bitácora) o RF-028 (bitácora de carga). `docs/api/openapi.json` asocia RF-028 a `GET /imports/{batch_id}/log`, no al listado de lotes.

## Fase 3 — Baja / Post-MVP

| # | Documento | Etiqueta del documento → catálogo | Hoy en la API | Acción |
|---|---|---|---|---|
| 39 | `GET /loans` · `listLoans` | `RF-013` → RF-018 | `GET /loans` (stub) | Hecho: responde 501 y declara `x-change: prestamos-y-exposiciones` hasta cerrar K1 |
| 40 | `POST /loans` · `createLoan` | `RF-015` → RF-018 | `POST /loans` (stub) | Hecho: responde 501 y declara `x-change: prestamos-y-exposiciones` hasta cerrar K1 |
| 41 | `PUT /loans/{id}/status` | `RF-028-B` → RF-018 | `PUT /loans/{id}/status` (stub) | Hecho: responde 501 y declara `x-change: prestamos-y-exposiciones` hasta cerrar K1 |
| 42 | `POST /media/bulk-download` · `bulkDownloadMedia` | `RF-030-B` → Pendiente³ | no existe | Hecho: stub `501` con `BulkDownloadRequest`/`BulkDownloadJob`; lo implementa `descargas-masivas-y-enriquecimiento-lote` (tarea 5.2) |
| 43 | `GET /public/catalog` · `getPublicCatalog` | `RF-044` → Pendiente⁴ | no existe | Bloqueado por el conflicto C2 |
| 44 | `GET /audit-logs/pieces/{id}` · `getPieceAuditTimeline` | `RF-043-B` → RF-040 | `GET /audit?entity_type=piece&entity_id=` (implementado) | Hecho: `GET /audit-logs/pieces/{id}` (implementado sobre la misma consulta que `GET /audit-logs`) |
| 45 | `POST /ai/batch-enrich` · `batchAiEnrichment` | `RF-029-B` → Pendiente⁵ | no existe (hay lote en `ia-sugerencia-terminos`) | Hecho: stub `501` con `BatchEnrichRequest`/`AiBatchOut`; lo implementa `descargas-masivas-y-enriquecimiento-lote` como RIA-04 (tarea 5.2) |

³ El catálogo no tiene un requisito de descarga masiva de imágenes. Aplicarían RF-014 y RN-008 (restricciones de uso en comodato).

⁴ Sin equivalente: RF-044 del catálogo es la exportación completa de la base de datos, y un catálogo público choca con RF-042 (ver C2).

⁵ Aplica RN-009 (aprobación humana). Resuelto al proponer `descargas-masivas-y-enriquecimiento-lote`: corresponde a RIA-04 (descripción preliminar desde metadatos).

## Operaciones que hoy existen y el documento no incluye

No se eliminan por ahora: sostienen reglas que `CLAUDE.md` marca como no negociables o requisitos ya especificados. Quedan marcadas como **añadidos** al contrato del equipo, pendientes de su visto bueno (pregunta I5).

| Operación actual | Por qué existe |
|---|---|
| `POST /ai/suggestions/{id}/approve` · `/reject`, `GET /ai/suggestions` | RN-009: ninguna salida de IA se guarda sin aprobación humana registrada |
| `GET /quality/duplicates`, `POST /quality/duplicates/{id}/resolve`, `POST /quality/duplicates/scan`, `GET /quality/jobs/{job_id}` | RF-030: cola de revisión de duplicados, detección completa en segundo plano y su avance (`deteccion-duplicados-y-cola-revision`, tarea 2.3) |
| `GET /vocabularies*`, `POST /vocabularies/{code}/terms`, … | RN-010: vocabularios parametrizables (materiales, técnicas, tipos de vista) |
| `GET /identifier-types`, `POST /identifiers/normalize` | RF-023, RN-010: tipos de identificador y normalizador como datos |
| `POST /identifier-types`, `PATCH /identifier-types/{code}`, `POST /identifier-types/{code}/normalization-preview` | RN-010, RF-023, RN-002: alta y edición de tipos de identificador, con los tipos del sistema protegidos y el cambio de regla de normalización ligado a una vista previa del impacto (`colecciones-y-vocabularios-admin`, tareas 2.2 a 2.4, diseño D1 y D2) |
| `GET`/`POST /pieces/{id}/conservation-assessments` | RF-012, RN-005: historial de evaluaciones de conservación de solo inserción; el estado actual es el de la evaluación más reciente por fecha (`colecciones-y-vocabularios-admin`, tarea 3.1, diseño D3) |
| `POST /pieces/{id}/restore`, `POST /pieces/validate` | RN-005 (restaurar en lugar de borrar) y RF-043 (validación en tiempo real) |
| `POST /pieces/{id}/identifiers/{id}/correction` | RN-002: corrección auditada del código I, en lugar de borrarlo |
| `PUT /imports/{batch_id}/mapping`, `GET`/`POST /import-templates` | RF-022: plantillas de mapeo reutilizables; el mapeo de un lote acepta una plantilla guardada, transformaciones por columna y correspondencias con términos (`plantillas-mapeo-y-normalizacion`, tareas 3.1 y 3.5, diseño D1) |
| `GET`/`PATCH`/`DELETE /import-templates/{template_id}` | RF-022 y RN-005: consultar, editar y eliminar lógicamente (con motivo, a la papelera) una plantilla; los lotes conservan su referencia y su mapeo. `GET /import-templates` ya no recibe `header_signature`: la sugerencia va por `POST /import-templates/suggest` (`plantillas-mapeo-y-normalizacion`, tarea 3.1, diseño D3) |
| `POST /import-templates/suggest` | RF-022: sugerir hasta 3 plantillas activas para las cabeceras de un archivo, con su puntaje, las columnas faltantes y las nuevas; es la única vía de sugerencia (`plantillas-mapeo-y-normalizacion`, tarea 3.2, diseño D3) |
| `POST /import-templates/{template_id}/dry-run` | RF-023, RF-022 y RNF-010: vista previa de normalización por columna de una plantilla guardada sobre las primeras 200 filas [SUPUESTO T3] de un lote subido o mapeado, con los conteos `NORMALIZED`, `UNPARSEABLE`, `ABSENT` y `SPLIT_PROPOSED`, los 20 valores sin término más frecuentes [SUPUESTO T4] y ejemplos con su traza; no escribe nada (`plantillas-mapeo-y-normalizacion`, tarea 3.3, diseño D4) |
| `GET`/`PUT /normalization-settings/{key}` | RN-010, RF-023 y RF-004: consultar y cambiar los marcadores de ausencia (`absence_markers`), los separadores de códigos concatenados (`concatenation_separators`) y, desde `ajustes-lectura-importacion` (tarea 1.4), las correspondencias forma de adquisición → régimen (`tenure_aliases`, con las etiquetas del contrato: Propiedad, Comodato, Préstamo Temporal) como datos auditados; sin valor guardado rige el del código. Permiso `vocabularies.manage` [SUPUESTO T8]. Un cambio que alteraría identificadores ya registrados responde 409 `normalization_change_requires_preview` con cuántos y ejemplos, sin guardar nada [SUPUESTO T10] (`plantillas-mapeo-y-normalizacion`, tarea 2.3, diseño D5) |
| `GET`/`POST /collection-acronym-aliases`, `DELETE /collection-acronym-aliases/{alias_id}` | RF-023 y RN-010: siglas históricas de colección (alias normalizado → colección), únicas entre los alias activos y distintas de la sigla actual de toda colección; borrado lógico con motivo (RN-005). Mismo permiso y misma regla de impacto que los parámetros (`plantillas-mapeo-y-normalizacion`, tarea 2.3, diseño D5) |
| `POST /imports/{batch_id}/images/{image_id}/associate` | RF-029: una imagen extraída del Excel se asocia a la pieza solo por acción explícita de una persona, después de aplicar el lote (`importacion-pipeline-reconciliacion`, tarea 5.1) |
| `POST /imports/{batch_id}/photos/upload-urls` | RF-045: las fotos del lote se suben por tandas de hasta 100, directo al almacenamiento con URL prefirmada; una huella que ya está en el lote vuelve como `already_registered`, así que volver a soltar la carpeta reanuda la subida (`importacion-masiva-fotografias`, tarea 2.1, diseño D2) |
| `POST /imports/{batch_id}/photos/complete` | RF-045: el navegador avisa qué archivos terminó de subir; en segundo plano se verifican el tipo real, el tamaño y la huella, se generan la miniatura y la copia de visualización y se propone la fila de cada foto, sin tocar el catálogo hasta aprobar el lote (`importacion-masiva-fotografias`, tarea 2.2, diseño D2) |
| `GET /imports/{batch_id}/photos`, `GET /imports/{batch_id}/photos/summary` | RF-045, RF-026: bandeja de las fotos del lote con su fila propuesta o asignada, filtros por estado, propuesta y fila, miniaturas firmadas de las verificadas y conteos por estado y propuesta para la previsualización (`importacion-masiva-fotografias`, tarea 4.1, diseño D4) |
| `PATCH /imports/{batch_id}/photos` | RF-045, RN-009 (por analogía): una persona asigna a una fila las fotos ambiguas o sin emparejar (`assign`); el emparejamiento automático ya no las cambia y nada llega al catálogo hasta aprobar el lote. `unassign`, `discard`, `confirm_duplicate` y `reorder` quedan para después (`importacion-masiva-fotografias`, tarea 4.2, diseño D4) |
| `POST /imports/photo-batches` | RF-046: lote de solo fotografías para piezas ya registradas, sin Excel; reutiliza la subida, la bandeja, la aprobación y la reversión de `/imports/{batch_id}/…`. Las operaciones de Excel (mapeo, validación, previsualización de filas, decisión sobre una fila, asociación de una imagen incrustada) responden 409 `batch_kind_mismatch` en este lote; `ImportBatchOut` suma `kind` (`importacion-fotos-a-catalogo`, tarea 2.2, diseño D1) |
| `GET /exports/full` | RF-044 del catálogo: exportación completa en formato abierto |
| `GET /trash`, `POST /trash/{entity_type}/{entity_id}/restore` | RN-005, RNF-006: nunca se borra información, así que lo eliminado lógicamente se consulta y se restaura verificando dependencias (`auditoria-y-soft-delete-transversal`, diseño D2) |
| `GET /audit/change-sets/{id}`, `POST /audit/change-sets/{id}/revert-preview` | RNF-007: resumen del conjunto de cambios y vista previa de la reversión, que el contrato no contempla y sin la cual no se puede confirmar una reversión (change `auditoria-y-soft-delete-transversal`) |
| `GET /trash`, `POST /trash/{entity_type}/{entity_id}/restore` | RN-005 y RNF-006: papelera y restauración con verificación de dependencias (mismo change) |
| `GET /audit/sensitive-access` | RNF-014, RF-041: registro de los accesos a datos sensibles sin enmascarar (usuario, ruta, entidades y campos, nunca valores), consultable con `audit.read` (`autenticacion-y-matriz-permisos`, tarea 3.3) |
| `POST /auth/logout` | RNF-012: cierre de sesión que revoca la sesión de servidor (ADR-009); el documento solo trae el inicio de sesión |
| `POST /auth/change-password` | RNF-012, RNF-013: cambio de contraseña propio, obligatorio con una contraseña temporal; revoca todas las sesiones y abre una nueva (`autenticacion-y-matriz-permisos`, tarea 2.3) |
| `GET /health`, `GET /health/live` | RNF-004: verificación de salud del entorno |
| `POST /movements/batch` | RF-017, RNF-001, RNF-005: mover o verificar varias piezas escaneadas hacia un mismo destino en una sola operación todo o nada, con `Idempotency-Key` para reintentos en conexión lenta desde la vista móvil de depósito (`ubicacion-jerarquica-y-movimientos`, tarea 3.3) |

## Conflictos resueltos por el equipo (2026-09-29)

Decisiones registradas en `openspec/changes/alinear-api-endpoints-v1/design.md`, sección D7, que es la fuente de verdad. Están pendientes del visto bueno del Arquitecto en el PR, porque el change toca el contrato compartido. Las que dependen de una regla del museo quedan como `[SUPUESTO]`, y su pregunta está en `docs/preguntas-contraparte.md` (secciones B e I).

- **C1 — Numeración de requisitos.** El documento usa su propia numeración RF, distinta de `docs/requisitos/catalogo.md`, con la que están trazadas las 12 specs y los 15 changes del backlog. Ejemplos: en el documento `RF-041` es el login y en el catálogo es «restricción de campos sensibles por rol»; `RF-013` es préstamos en el documento y «múltiples fotos por pieza» en el catálogo; `RF-018` es historial de ubicaciones frente a «préstamos y exposiciones».
  - **Resolución:** `docs/requisitos/catalogo.md` es la numeración oficial. No se renumera nada. El mapeo añade una columna con la equivalencia entre la etiqueta `[RF-xxx]` de cada operación del documento y los IDs del catálogo.
  - **Justificación:** las 12 specs y los 15 changes ya están trazados con el catálogo. Adoptar la numeración del documento obligaría a renumerarlo todo y rompería la trazabilidad. Las etiquetas del documento son descriptivas, no normativas.
  - **Supuesto / pregunta:** I1 (interna), resuelta.
- **C2 — `GET /public/catalog` sin autenticación.** Choca con RF-042 del catálogo y con `CLAUDE.md` («Fase 1 = herramienta de control interno. Nada público»). Además expondría datos que RNF-014 (Ley 29733) y las restricciones de comodato (RN-008) limitan.
  - **Resolución:** no se implementa ni se expone, ni siquiera como stub. Sigue en `BLOQUEADAS` en la prueba de conformidad.
  - **Justificación:** RF-042 (*Must*, «solo uso interno en fase 1»), `CLAUDE.md`, RN-008 (restricciones de comodato) y RNF-014 (Ley 29733). Publicar datos es decisión del museo, no del equipo.
  - **Supuesto / pregunta:** `[SUPUESTO]` no hay catálogo público en fase 1. Pregunta I2 al museo.
- **C3 — `DELETE /pieces/{id}/identifiers/{identifier_id}`.** RN-005 prohíbe borrar información.
  - **Resolución:** baja lógica según D1: el identificador queda en el historial y en la auditoría. Si es de tipo I, responde 409 citando RN-002. Se exige motivo.
  - **Justificación:** RN-005 es no negociable: no hay otra alternativa compatible. Se conservan la ruta y el verbo del documento (D1).
  - **Supuesto / pregunta:** `[SUPUESTO]` puede dar de baja un código secundario quien tiene permiso de edición de identificadores, con motivo obligatorio. Pregunta I3 al museo.
- **C4 — Modelo de datos.** El contrato asume el diagrama ER: `code_i` como campo de la pieza, `category_id` y `conservation_state_id` como tablas propias, `is_active`, `unmapped_payload` y un rol único por usuario. Lo implementado usa identificadores 1:N, vocabularios genéricos y matriz de permisos.
  - **Resolución:**
    - (a) `code_i` se deriva del identificador vigente de tipo I, sin columna propia (D4).
    - (b) `title` → `denomination` y `period_*` → `epoch_*` en la base, el modelo y la API.
    - (c) `period_type` → `epoch_type`, conservado como campo opcional añadido.
    - (d) Categorías y estados de conservación como fachada sobre `vocabulary`/`term`, con `term.parent_id` para la jerarquía.
    - (e) `category_id` y `conservation_state_id` opcionales en `PieceCreate`.
    - (f) `is_active` derivado de `deleted_at`.
    - (g) Matriz de roles y permisos, expuesta en `/auth/me` y en `PUT /users/{id}/role`.
  - **Justificación:**
    - (a) Una sola fuente del código I y el historial completo (RN-001, RN-002), sin disparador.
    - (b) Un único nombre en todas las capas. Son palabras en inglés, compatible con ADR-002.
    - (c) La interpretación de la época (B9) no tiene equivalente en el documento y no se descarta información.
    - (d) RN-010 es uniforme para todos los vocabularios y ya existen las rutas fachada; evita migrar términos.
    - (e) Supuesto B1: las piezas históricas llegan sin clasificar.
    - (f) Conserva quién borró y por qué (RN-005).
    - (g) RF-041 necesita permisos por campo sensible. El documento no define el esquema de rol.
  - **Supuesto / pregunta:** resuelve H1 (código I en `piece_identifier`), H2 (matriz) y H3 (vocabularios). `[SUPUESTO]` B1 (obligatorios) sigue abierta al museo.
- **C5 — Valores de enumerados en español** (`Propiedad`, `Comodato`, `Préstamo Temporal`; `Frontal`, `Perfil`, …) frente a los actuales en inglés (`OWNED`, `LOAN_FOR_USE`, `TEMPORARY_LOAN`).
  - **Resolución:** la traducción se hace solo en la frontera de la API (`app/api/enums.py`, tarea 3.1). La base conserva los códigos en inglés. El régimen de tenencia no pasa a vocabulario.
  - **Justificación:** ADR-002: código en inglés. El régimen de tenencia sostiene reglas fijas (RN-003, RN-004) y no debe ser editable. Un único punto de traducción cumple el requirement «Valores de enumerado del contrato en la API».
  - **Supuesto / pregunta:** I4 (interna), resuelta. Los nombres de los tipos de vista siguen abiertos al museo (C2 de la sección C).
- **C6 — Almacenamiento e infraestructura.** El documento menciona AWS S3 y un servidor de staging en AWS Academy; ADR-007 y ADR-011 asumen MinIO en local, Cloudflare R2 como contingencia y la VM de la PUCP.
  - **Resolución:** AWS Academy como entorno de integración (staging), con RDS y S3 gestionados. Local con MinIO; producción en la VM de la PUCP; R2 como contingencia.
  - **Justificación:** ya decidido en **ADR-013** (Aceptado, 2026-09-26). S3, MinIO y R2 comparten API (ADR-007).
  - **Supuesto / pregunta:** I6 (interna), resuelta.

## Desviaciones declaradas de la importación (tarea 4.4, 2026-10-18)

La tarea 4.4 alinea solo la forma y la firma de las operaciones 14 a 16 (design D8). Desde el 2026-10-19 `importacion-pipeline-reconciliacion` implementa `upload` y `diffs` (tareas 2.1 y 3.4) y desde el 2026-10-21 `confirm` (tarea 4.2) y desde el 2026-10-25 `rollback` (tarea 5.2). La prueba `apps/api/tests/api/test_import_upload_contract.py` verifica el OpenAPI generado.

| Operación | Contrato | API tras la tarea 4.4 | Motivo / pregunta |
|---|---|---|---|
| `POST /imports/upload` | `202` con `ImportBatchSummary`; formulario con `file` | Igual. Se quitó el campo `source_name` del formulario | Conforme al contrato. De dónde sale el nombre de la fuente del lote lo decide `importacion-pipeline-reconciliacion` |
| `ImportBatchSummary.summary` | `new_records`, `updates`, `conflicts` | Igual | Cómo se agrupan `NEW`, `UPDATE`, `POSSIBLE_DUPLICATE` y `CONFLICT` en los tres contadores sigue abierto (I7) |
| `ImportBatchSummary.status` | `string` sin valores definidos | `string` opcional, `null` en el ejemplo | Los valores en español del estado del lote siguen abiertos (I8); no se añaden a `app/api/enums.py` hasta resolverlos |
| `GET /imports/{batch_id}/diffs` | `200` sin esquema | `ImportDiffsPage`: `Page[ImportRowOut]` con el diff campo a campo y `classification_rules` (RF-025, RF-026) | Añadido justificado: el contrato no define el esquema |
| `POST /imports/{batch_id}/confirm` | Sin cuerpo; `200` sin esquema | Cuerpo `ApprovalRequest` con `summary_token` obligatorio (huella del resumen de `ImportBatchOut.approval_summary`, RF-027, RNF-010) y respuesta `ImportBatchOut` en estado `APPROVED`; la aplicación sigue en segundo plano | El cuerpo definitivo sigue abierto (I9, supuesto provisional M7) |
