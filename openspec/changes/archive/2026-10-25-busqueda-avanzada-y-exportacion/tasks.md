## 1. Filtro único y búsqueda

- [x] 1.1 Crear `search/filters.py` con `PieceFilter` (`to_where`, `describe`), épocas con conteo de excluidas, colección y ubicación con descendientes, y rechazo de filtros sensibles; pruebas unitarias por filtro (Req: Filtro de piezas único para búsqueda, exportación y reportes; RF-032, RF-041)
- [x] 1.2 Migrar `GET /api/v1/pieces` y `GET /api/v1/search` a `PieceFilter` sin romper las pruebas existentes de `tests/api/test_api_pieces_search.py` (Req: Filtro de piezas único…)
- [x] 1.3 Migración: extensión `unaccent`, función `immutable_unaccent` e índices funcionales GIN trigram en `title`, `author`, `provenance` (con detección de permisos y mensaje claro); función equivalente registrada en SQLite; `tests/test_migrations.py` en verde (Req: Búsqueda sin tildes con explicación de la coincidencia)
- [x] 1.4 Crear `search/ranking.py` (código vigente > histórico > texto; `match_reason`; sugerencias sin resultados); pruebas de los tres escenarios (Req: Búsqueda sin tildes con explicación de la coincidencia; RF-031)
- [x] 1.5 Integrar el filtro por alertas con los predicados de `alertas-y-reporte-incompletas` (501 explícito si no está aplicado); prueba de ambas ramas (RF-032)

## 2. Exportaciones

- [x] 2.1 Crear `app/core/xlsx.py` (`write_only`, hoja de filtros) y pruebas de memoria acotada con 50 000 filas generadas (Req: Trabajos de exportación con caducidad y auditoría; RF-036)
- [x] 2.2 Migración `export_job`, acción `EXPORT` en `AuditAction` y worker de exportación (latido, recuperación); pruebas del worker (Req: Trabajos de exportación…)
- [x] 2.3 Implementar `POST /api/v1/reports/export-excel` (síncrono bajo umbral, 202 sobre umbral) y operaciones nuevas `GET /api/v1/exports/jobs[/{job_id}[/download-url]]`; pruebas: exportación idéntica a la búsqueda, columnas sensibles omitidas, 12 000 filas en segundo plano, descarga por otro usuario 403, caducada, auditoría registrada (Req: Filtro de piezas único…; Req: Trabajos de exportación…; RNF-014)
- [x] 2.4 Crear `exports/full.py` e implementar `GET /api/v1/exports/full` (trabajo único, ZIP con CSV, Excel, diccionario y manifiesto); pruebas: huellas y conteos del manifiesto, eliminadas incluidas, sin `password_hash`, trabajo en curso devuelto, Gestor 403 (Req: Paquete de exportación completa verificable; RF-044)

## 3. Rendimiento

- [x] 3.1 Crear `scripts/perf/generate_catalog.py` y `scripts/perf/search_load.py` (decidir `locust` o `asyncio`+`httpx` con ADR Propuesto) y script `npm run perf:search`; smoke de 30 s con 1 000 piezas en SQLite en pruebas (Req: Prueba de rendimiento reproducible de la búsqueda; RF-038)

## 4. Frontend

- [x] 4.1 `app/busqueda` en modo `live`: todos los filtros, chips de filtros activos con quitar, `match_reason` visible, sugerencias sin resultados, foto principal en miniatura; pruebas de componente (Req: Búsqueda sin tildes…; RNF-010) — `components/domain/SearchLive.tsx` y `lib/data/search.ts`; para cumplirla, `GET /search` acepta todo el filtro único de `GET /pieces` con `q` opcional (antes solo `q`, `collection_code` y `tenure_regime`), devuelve `thumbnail_url` y `excluded_uninterpreted_period`, y el filtro por alertas usa los predicados de `quality/completeness.py` (2026-10-25)
- [x] 4.2 Exportar resultados (selección de columnas) y panel "Mis exportaciones" con estado y descarga; exportación completa en Administración; pruebas de componente (Req: Trabajos de exportación…; Req: Paquete de exportación completa verificable) — la exportación respeta `columns` (catálogo compartido en `exports/results.py`, 422 `unknown_export_column`), `ExportJob` informa `kind` y `created_at`, y el 410 de un archivo caducado responde `gone`; pestaña «Exportación completa» en Administración (2026-10-25)

## 5. Cierre del change

- [x] 5.1 Tests requeridos: secciones 1–4 en verde (`npm test`, `npm run lint`); prueba de rendimiento completa (20 000 piezas, 10 usuarios) contra PostgreSQL en compose con resultado registrado en `docs/rendimiento.md` cuando Docker esté disponible
- [x] 5.2 Actualizar OpenAPI: implementar los 2 stubs, añadir `exports/jobs*`, documentar `match_reason`, `suggestions` y `excluded_uninterpreted_period`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [x] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/busqueda.md` (buscar por código y texto, filtros, exportar, mis exportaciones) y `docs/manual-usuario/administracion.md` (exportación completa y cómo verificar el paquete)
- [x] 5.4 Registrar supuestos (umbral de exportación, caducidad, quién exporta todo) en `docs/preguntas-contraparte.md`, `openspec validate busqueda-avanzada-y-exportacion --strict` y, tras aprobar el PR, `openspec archive busqueda-avanzada-y-exportacion -y`
