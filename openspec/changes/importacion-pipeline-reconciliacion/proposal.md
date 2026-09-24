## Why

La mayor parte de las >10 000 piezas del MATP está en sábanas Excel, Access y Word con criterios distintos. Cargar esa información **sin duplicar ni pisar datos** es el núcleo de valor del sistema (RF-021..RF-029, todos *Must* salvo RF-029). Hoy existen el modelo (`import_batch`, `import_row`) y el contrato, pero las 10 operaciones de `/api/v1/imports` son stubs (`x-change: importacion-pipeline-reconciliacion`) y el asistente de importación de la maqueta solo simula los pasos.

## What Changes

- Ingesta de `.xlsx` y `.csv` (subida, almacenamiento del archivo original, elección de hoja y fila de cabeceras, límites de tamaño y filas) → `POST /imports`, `GET /imports`, `GET /imports/{batch_id}`.
- Máquina de estados del lote con etapas idempotentes y procesamiento en segundo plano dentro del proceso de la API: `UPLOADED → MAPPED → VALIDATED → IN_PREVIEW → APPROVED → APPLIED` (más `FAILED_INGESTION`, `FAILED_APPLY`, `ABANDONED`, `REVERTED`).
- Aplicación del mapeo al lote (`PUT /imports/{batch_id}/mapping`) usando el formato de mapeo y el motor de transformación definidos en `plantillas-mapeo-y-normalizacion`.
- Validación, matching multi-código contra identificadores vigentes e históricos y clasificación de filas (`POST /imports/{batch_id}/validate`).
- Previsualización con diff campo a campo y decisiones por fila y por campo (`GET /imports/{batch_id}/preview`, `PATCH /imports/{batch_id}/rows/{row_id}`), incluida la resolución manual de conflictos.
- Aprobación explícita por rol autorizado con resumen confirmado y aplicación atómica (`POST /imports/{batch_id}/approve`), que crea/actualiza piezas, identificadores y registros de datos de origen con auditoría origen "importación".
- Bitácora consultable y descargable (`GET /imports/{batch_id}/log`) y reversión del lote aplicado (`POST /imports/{batch_id}/revert`).
- Extracción de imágenes incrustadas en Excel con propuesta de asociación por fila y revisión manual (RF-029).
- Frontend: asistente de importación de 6 pasos en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de máquina de estados con etapas idempotentes, ingesta con límites, decisiones por fila y campo con resolución de conflictos, aplicación atómica con datos de origen y reversión, bitácora descargable y revisión de imágenes extraídas.

## Impact

- **IDs cubiertos**: RF-021, RF-024, RF-025, RF-026, RF-027, RF-028, RF-029, RF-008, RF-013 (asociación de imágenes), RN-003, RN-004, RN-005, RNF-007, RNF-010, RF-040.
- **Célula dueña**: Importación.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`; **`plantillas-mapeo-y-normalizacion`** (formato de mapeo, motor de transformación y normalización por columna — la interfaz se fija en su design.md para poder avanzar en paralelo con un mapeo manual mínimo); **`auditoria-y-soft-delete-transversal`** (motor de reversión por conjunto de cambios, usado por `revert`; la tarea de reversión se implementa al final); **`deteccion-duplicados-y-cola-revision`** (puntaje de similitud para "posible duplicado"; mientras no esté, se usa un evaluador provisional por denominación y colección detrás de la misma interfaz).
- **Afecta**: `apps/api/app/api/v1/imports.py`, `apps/api/app/modules/imports/{service,ingest,matching,classify,apply,images,worker}.py`, `apps/api/app/core/storage.py`, `docs/api/openapi.json`, `apps/web/src/app/importacion`, `data/fixtures/` (sábanas sintéticas adicionales).
- **Dependencias nuevas**: ninguna prevista (`openpyxl` y `python-multipart` ya están; CSV con la biblioteca estándar). Access (`.mdb/.accdb`) y Word tabulado quedan fuera: se convierten a `.xlsx`/`.csv` fuera del sistema [SUPUESTO A1].
- **Fuera de este change**: CRUD y sugerencia de plantillas, reglas de transformación (`plantillas-mapeo-y-normalizacion`); cola de revisión de duplicados y fusión (`deteccion-duplicados-y-cola-revision`); motor genérico de reversión (`auditoria-y-soft-delete-transversal`); importación de Access nativo; importación programada o por API externa; extracción de datos con IA (`ia-extraccion-texto-libre`).
