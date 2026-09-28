## Why

El equipo entregó `docs/fuentes/endpoints-api-v1.yaml` (OpenAPI 3.0.3, 30 rutas y 45 operaciones, «44 endpoints» según su encabezado) como **especificación de las interfaces** del backend, organizada en tres fases de prioridad. El contrato borrador que produjo `contratos-api-borrador` se construyó antes de ese documento y difiere en rutas (`/audit` frente a `/audit-logs`, `/imports` frente a `/imports/upload`, `/pieces/{id}/movements` frente a `/pieces/{id}/move`), en verbos (`PATCH` frente a `PUT`), en nombres de esquema (`title` frente a `denomination`) y en paginación (cursor frente a `page`/`limit`). Mientras las dos versiones coexistan, la maqueta, el cliente tipado y las cinco células implementarían interfaces distintas.

Este change hace del documento del equipo la fuente de verdad de las interfaces y adecúa la API, el contrato exportado, el cliente tipado y la maqueta. El detalle operación por operación está en `docs/api/mapeo-endpoints-v1.md`.

## What Changes

- **Rutas y verbos** de las 45 operaciones del documento, con sus `operationId` y sus etiquetas por fase de prioridad; las rutas actuales que el documento renombra dejan de existir (no se mantienen alias).
- **Esquemas** del documento (`PieceCreate`, `PieceSummary`, `PieceDetail`, `CollectionItem`, `LocationNode`, `MovePieceRequest`, `ImportBatchSummary`, `PieceSearchResponse`) como entrada y salida, incluidos `denomination`, `code_i`, `category_id`, `conservation_state_id`, `epoch_original_text`, `epoch_start_year`, `epoch_end_year`, `is_active` y `unmapped_payload`.
- **Paginación** `page`/`limit` con respuesta `{total, page, limit, items}` en listados y búsqueda.
- **Enumerados en los valores del documento** (`Propiedad`, `Comodato`, `Préstamo Temporal`; `Frontal`, `Perfil`, `Posterior`, `Detalle`, `Abierto`, `Cerrado`) en la frontera de la API.
- **Rutas nuevas**: `/categories`, `/conservation-states`, `/locations/tree`, `/locations/{id}/pieces`, `/pieces/{id}/children`, `/media/upload`, `/media/bulk-download`, `/reports/export-excel`, `/reports/piece-card/{id}/pdf`, `/reports/dashboard-stats`, `/users/{id}/role`, `/audit-logs`, `/audit-logs/pieces/{id}`, `/ai/suggest-cataloging`, `/ai/validate-data`, `/ai/batch-enrich`, `/loans`, `/loans/{id}/status`.
- **Modelo de datos**: `piece.code_i` como campo propio único y inmutable, `category` y `conservation_state` como entidades, `is_active`, y la entidad `loan` del diagrama entidad-relación.
- Las operaciones que el documento asigna a las fases 2 y 3 se exponen con su forma definitiva y responden `501` con el change del backlog que las implementará, como ya hace el contrato actual.
- Las operaciones que hoy existen y el documento no incluye se conservan como **añadidos** documentados (RN-005, RN-009, RN-010, RF-030); su eliminación queda a decisión del equipo (pregunta I5).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: el requirement del contrato OpenAPI pasa a exigir conformidad con el documento del equipo, con una prueba que compara rutas, verbos y `operationId`.
- `catalogo-piezas`: los campos de la ficha en la API adoptan los nombres del documento y el código I pasa a ser un campo propio de la pieza.
- `busqueda-reportes`: paginación `page`/`limit` y las tres rutas de reportes del documento.
- `ubicacion-movimientos`: árbol jerárquico en `/locations/tree`, movimiento en `/pieces/{id}/move` e historial en `/pieces/{id}/location-history`.
- `importacion-datos`: `/imports/upload`, `/imports/{batch_id}/diffs`, `/imports/{batch_id}/confirm` y `/imports/{batch_id}/rollback`.
- `usuarios-roles`: `/users/{id}/role` y el perfil de `/auth/me` con el rol del usuario.
- `auditoria-trazabilidad`: `/audit-logs` y `/audit-logs/pieces/{id}`.
- `ia-asistiva`: `/ai/suggest-cataloging`, `/ai/validate-data` y `/ai/batch-enrich` como fachada de la IA asistiva montada en la API (ADR-008).

## Impact

- **IDs cubiertos** (numeración de `docs/requisitos/catalogo.md`, ver conflicto C1): RF-001, RF-002, RF-003, RF-005, RF-006, RF-007, RF-008, RF-009, RF-010, RF-011, RF-012, RF-013, RF-016, RF-017, RF-018, RF-021, RF-026, RF-027, RF-031, RF-032, RF-033, RF-035, RF-036, RF-039, RF-040, RNF-009, RN-001, RN-002, RN-003, RN-005.
- **Célula dueña**: Integradores, con revisión del Arquitecto (toca la frontera de todas las células).
- **Depende de**: `modelo-datos-nucleo` y `contratos-api-borrador` (aplicados, sin archivar).
- **Consumido por**: los 15 changes del backlog, que pasan a implementar las rutas de este contrato.
- **Afecta**: `apps/api/app/api/v1/*.py`, `apps/api/app/modules/*/schemas.py`, `apps/api/app/main.py` (etiquetas), migración Alembic (`piece.code_i`, `category`, `conservation_state`, `loan`, `is_active`), `apps/api/app/seed/`, `docs/api/openapi.json`, `apps/web/src/lib/api/`, `apps/web/src/lib/{data,fixtures}/`, `docs/api/mapeo-endpoints-v1.md`, `docs/modelo-datos.md`.
- **Bloqueos declarados**: los conflictos C1 (numeración de requisitos), C2 (`/public/catalog` sin autenticación frente a «solo uso interno») y C4 (modelo de datos) de `docs/api/mapeo-endpoints-v1.md` necesitan decisión del equipo antes de cerrar este change; `/public/catalog` no se implementa hasta que se resuelva C2.
- **Dependencias nuevas**: generación de PDF para `/reports/piece-card/{id}/pdf` (se consulta la versión estable vigente al instalar, guardrail 7).
