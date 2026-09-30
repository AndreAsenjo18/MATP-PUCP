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
| 3 | `GET /pieces/{id}` · `getPieceById` | `RF-003` → RF-006 | `GET /pieces/{piece_id}` (implementado) | Hecho: `getPieceById` |
| 4 | `PUT /pieces/{id}` · `updatePiece` | `RF-004` → RF-006, RN-002 | `PATCH /pieces/{piece_id}` (stub) | Hecho: `PUT /pieces/{id}` (`updatePiece`) |
| 5 | `DELETE /pieces/{id}` · `softDeletePiece` | `RF-005` → RN-005, RNF-006 | `DELETE /pieces/{piece_id}` (stub) | Hecho: `softDeletePiece` |
| 6 | `GET /collections` · `listCollections` | `RF-006` → RF-010 | `GET /collections` (implementado) | Pendiente: arreglo plano `CollectionItem` (tarea 4.2) |
| 7 | `POST /collections` · `createCollection` | `RF-039` → RF-010 | `POST /collections` (implementado) | Hecho: `createCollection` |
| 8 | `GET /categories` · `listCategories` | `RF-007` → RF-011 | `GET /vocabularies/categoria/terms` | Hecho: `GET /categories` sobre el vocabulario CATEGORY |
| 9 | `POST /categories` · `createCategory` | `RF-040` → RF-011 | `POST /vocabularies/{code}/terms` | Hecho: `POST /categories` |
| 10 | `GET /conservation-states` · `listConservationStates` | `RF-008` → RF-012 | `GET /vocabularies/estado-conservacion/terms` | Hecho: `GET /conservation-states` |
| 11 | `GET /locations/tree` · `getLocationsTree` | `RF-016` → RF-016, RF-041 | `GET /locations` (plano, implementado) | Hecho: `GET /locations/tree` con `LocationNode` |
| 12 | `POST /pieces/{id}/move` · `movePiece` | `RF-017` → RF-017 | `POST /pieces/{piece_id}/movements` (stub) | Hecho: `POST /pieces/{id}/move` |
| 13 | `GET /pieces/{id}/location-history` · `getPieceLocationHistory` | `RF-018` → RF-017 | `GET /pieces/{piece_id}/movements` (implementado) | Hecho: `GET /pieces/{id}/location-history` |
| 14 | `POST /imports/upload` · `uploadImportBatch` | `RF-021/022` → RF-021 | `POST /imports` (stub) | Hecho: `POST /imports/upload` |
| 15 | `GET /imports/{batch_id}/diffs` · `getImportBatchDiffs` | `RF-023` → RF-026 | `GET /imports/{batch_id}/preview` (stub) | Hecho: `GET /imports/{batch_id}/diffs` |
| 16 | `POST /imports/{batch_id}/confirm` · `confirmImportBatch` | `RF-024` → RF-027 | `POST /imports/{batch_id}/approve` (stub) | Hecho: `POST /imports/{batch_id}/confirm` |
| 17 | `GET /search` · `searchPieces` | `RF-031` → RF-031, RF-032 | `GET /search` (implementado) | Parcial: `searchPieces` renombrado; faltan `collection_code`, `tenure_regime` y `page`/`limit` |
| 18 | `POST /media/upload` · `uploadMediaAsset` | `RF-032` → RF-013, RF-014, RN-008 | `POST /pieces/{piece_id}/media` + `.../media/upload-url` (stubs) | Hecho: `POST /media/upload` (stub) |
| 19 | `POST /auth/login` · `login` | `RF-041` → RNF-012 | `POST /auth/login` (stub) | Pendiente: cuerpo `username`/`password` (tarea 4.7) |
| 20 | `GET /auth/me` · `getMe` | `RF-042` → RF-039 | `GET /auth/me` (implementado) | Pendiente: cerrar la tarea 4.7. Se mantiene la matriz de roles (resolución C4-g) y `/auth/me` ya devuelve `roles` y `permissions`; no queda ningún «rol único» por implementar |

¹ El catálogo no tiene un requisito de listado de piezas. La paginación de listados y búsqueda está trazada a RF-031, RF-032 y RF-038 en la spec delta de `plataforma`, pero eso no identifica el requisito del listado.

## Fase 2 — Media

| # | Documento | Etiqueta del documento → catálogo | Hoy en la API | Acción |
|---|---|---|---|---|
| 21 | `POST /pieces/{id}/identifiers` · `addPieceIdentifier` | `RF-009` → RF-002 | igual (stub) | Hecho: ruta ya conforme |
| 22 | `DELETE /pieces/{id}/identifiers/{identifier_id}` · `deletePieceIdentifier` | `RF-010` → RF-002, RN-002, RN-005 | no existe (hay `.../correction`) | Hecho como baja lógica (stub) |
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
| 35 | `PUT /users/{id}/role` · `updateUserRole` | `RF-038` → RF-039 | `PATCH /users/{user_id}` (stub) | Hecho: `PUT /users/{id}/role` (stub) |
| 36 | `GET /audit-logs` · `getAuditLogs` | `RF-043` → RF-040 | `GET /audit` (implementado) | Hecho: `GET /audit-logs` |
| 37 | `POST /ai/suggest-cataloging` · `suggestCataloging` | `RF-028` → RIA-01, RN-009 | `POST /ai/suggestions` (stub) | Hecho: `POST /ai/suggest-cataloging` |
| 38 | `POST /ai/validate-data` · `validateDataQuality` | `RF-029` → RIA-02, RN-009 | `GET /quality/incomplete` + `/quality/kpis` (stubs) | Hecho: `POST /ai/validate-data` (stub) |

² Candidatos: RF-021 (pipeline con bitácora) o RF-028 (bitácora de carga). `docs/api/openapi.json` asocia RF-028 a `GET /imports/{batch_id}/log`, no al listado de lotes.

## Fase 3 — Baja / Post-MVP

| # | Documento | Etiqueta del documento → catálogo | Hoy en la API | Acción |
|---|---|---|---|---|
| 39 | `GET /loans` · `listLoans` | `RF-013` → RF-018 | no existe | Pendiente: requiere proponer el change de préstamos |
| 40 | `POST /loans` · `createLoan` | `RF-015` → RF-018 | no existe | Pendiente: requiere proponer el change de préstamos |
| 41 | `PUT /loans/{id}/status` · `updateLoanStatus` | `RF-028-B` → RF-018 | no existe | Pendiente: requiere proponer el change de préstamos |
| 42 | `POST /media/bulk-download` · `bulkDownloadMedia` | `RF-030-B` → Pendiente³ | no existe | Pendiente: requiere proponer el change de descargas masivas |
| 43 | `GET /public/catalog` · `getPublicCatalog` | `RF-044` → Pendiente⁴ | no existe | Bloqueado por el conflicto C2 |
| 44 | `GET /audit-logs/pieces/{id}` · `getPieceAuditTimeline` | `RF-043-B` → RF-040 | `GET /audit?entity_type=piece&entity_id=` (implementado) | Hecho: `GET /audit-logs/pieces/{id}` (stub) |
| 45 | `POST /ai/batch-enrich` · `batchAiEnrichment` | `RF-029-B` → Pendiente⁵ | no existe (hay lote en `ia-sugerencia-terminos`) | Pendiente: requiere proponer el change de enriquecimiento por lote |

³ El catálogo no tiene un requisito de descarga masiva de imágenes. Aplicarían RF-014 y RN-008 (restricciones de uso en comodato).

⁴ Sin equivalente: RF-044 del catálogo es la exportación completa de la base de datos, y un catálogo público choca con RF-042 (ver C2).

⁵ Aplica RN-009 (aprobación humana). Si corresponde a RIA-01 (extracción) o a RIA-03 (sugerencia de términos) se decide al proponer su change.

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
