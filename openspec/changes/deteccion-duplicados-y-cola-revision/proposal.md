## Why

Las mismas piezas aparecen registradas varias veces en libros, Access y sábanas con códigos y denominaciones distintas ("Retablo ayacuchano" / "Retablo Ayacuchano (3 pisos)"). Sin detección de duplicados con revisión humana, la importación multiplicaría el caos y los KPI de completitud serían falsos. Hoy la tabla `duplicate_candidate` existe y el seed incluye 10 pares, pero la cola y su resolución son stubs (`x-change: deteccion-duplicados-y-cola-revision`) y la maqueta simula la fusión.

## What Changes

- Motor de detección por reglas explicables: coincidencia de identificadores normalizados (vigentes e históricos) y similitud de denominación, colección, autor, procedencia y época, con puntaje y campos que motivan la sospecha.
- Ejecución completa bajo demanda (operación nueva `POST /api/v1/quality/duplicates/scan`) e incremental al crear o editar piezas, y la interfaz `SimilarityScorer` que usa el pipeline de importación.
- Cola de revisión (`GET /api/v1/quality/duplicates`) con filtros por estado, colección, puntaje y origen (catálogo o importación).
- Resolución (`POST /api/v1/quality/duplicates/{candidate_id}/resolve`): marcar como distintos (sin volver a proponerse mientras los datos comparados no cambien), posponer con fecha y fusionar.
- Procedimiento de fusión auditado: se elige la pieza que se conserva y, por campo, qué valor queda; identificadores, fotos, movimientos y datos de origen se reasignan; la otra pieza queda marcada como fusionada, consultable y con redirección; fusión rechazada si hay códigos I vigentes distintos o regímenes incompatibles.
- Frontend: cola de duplicados y comparación lado a lado en modo `live`.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `calidad-datos`: se añaden requirements de detección explicable por reglas con ejecución completa e incremental, huella de comparación para pares distintos, fusión con elección de valores por campo y reasignación de datos relacionados, y posposición con vencimiento.

## Impact

- **IDs cubiertos**: RF-030, RIA-02 (espacio para puntaje de IA, sin integrarlo), RN-005, RN-002, RN-003, RF-040, RNF-007, RNF-015 (rendimiento con 20 000 piezas).
- **Célula dueña**: Importación.
- **Depende de**: `modelo-datos-nucleo`, `contratos-api-borrador`. Sin dependencias bloqueantes con otros changes del backlog.
- **Consumido por**: `importacion-pipeline-reconciliacion` (clasificación "posible duplicado" vía `SimilarityScorer`), `alertas-y-reporte-incompletas` (conteo de duplicados pendientes en el tablero), `auditoria-y-soft-delete-transversal` (revertir una fusión usa el conjunto de cambios de la fusión).
- **Afecta**: `apps/api/app/modules/quality/{duplicates,scoring,merge}.py`, `apps/api/app/api/v1/quality_reports.py`, migración Alembic, `docs/api/openapi.json`, `apps/web/src/app/duplicados`.
- **Dependencias nuevas**: ninguna. En PostgreSQL se usa `pg_trgm` (ya habilitado con índices GIN); en SQLite de pruebas, `difflib` como aproximación.
- **Fuera de este change**: puntaje semántico con IA (RIA-02, change posterior sobre `ia-asistiva`); detección de fotos duplicadas entre piezas distintas por imagen (visión por computadora fuera de alcance); deshacer una fusión desde la UI (lo aporta `auditoria-y-soft-delete-transversal`).
