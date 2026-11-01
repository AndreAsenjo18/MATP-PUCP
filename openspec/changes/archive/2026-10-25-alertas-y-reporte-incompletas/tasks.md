## 1. Reglas y predicados

- [x] 1.1 Migración de `completeness_rule` (valores iniciales `[SUPUESTO B1]`) y `completeness_snapshot`; `tests/test_migrations.py` en verde (Req: Reglas de completitud únicas y configurables; Req: Serie histórica de completitud)
- [x] 1.2 Crear `quality/completeness.py` con `AlertDefinition` (predicado, aplica a, mensaje, acción sugerida, campo) para las 6 alertas; pruebas unitarias por alerta con piezas sintéticas construidas en la prueba, incluidos comodato, préstamo temporal, eliminadas y fusionadas (Req: Reglas de completitud únicas y configurables; RF-019, RN-003, RN-004)
- [x] 1.3 Operación nueva `GET`/`PUT /api/v1/quality/completeness-rules` con lista blanca de campos y auditoría; pruebas: agregar recomendado, campo inexistente 422, sin permiso 403 (Req: Reglas de completitud únicas y configurables)

## 2. API

- [x] 2.1 Implementar `GET /api/v1/pieces/{piece_id}/alerts`; pruebas de los tres escenarios (Req: Alertas de la pieza con explicación y acción sugerida)
- [x] 2.2 Crear `quality/kpis.py` e implementar `GET /api/v1/reports/dashboard-stats` (global y `by_collection` con subcolecciones); pruebas: KPI de I sobre propiedad (250/100 → 60 %), colección solo comodato → `null`, catálogo vacío sin división por cero (Req: Indicadores con numerador y denominador explícitos; RF-035)
- [x] 2.3 Implementar `GET /api/v1/quality/incomplete` paginado con filtros, enmascarado y `format=xlsx|csv`; prueba de coherencia: conteo del reporte = numerador del KPI para cada alerta con el seed (Req: Reglas de completitud únicas… — escenario "Misma cifra en todos los lugares")
- [x] 2.4 Comando `python -m app.quality.snapshot` (script `npm run kpis:snapshot`) y operación nueva `GET /api/v1/reports/dashboard-stats/history`; pruebas: idempotencia diaria, rango inválido 422 (Req: Serie histórica de completitud)

## 3. Frontend

- [x] 3.1 `lib/data/quality.ts` (mock/live); panel de alertas en la ficha con acción sugerida que lleva a la sección del editor; pruebas de componente (Req: Alertas de la pieza con explicación y acción sugerida; RNF-010)
- [x] 3.2 Tablero `app/inicio` con KPI globales y por colección ("no aplica" cuando corresponde) y gráfico simple de evolución; pruebas de componente (Req: Indicadores…; Req: Serie histórica…)
- [x] 3.3 Reporte de incompletas en `app/reportes` con filtros por alerta y colección y descarga; pruebas de componente (RF-035)

## 4. Cierre del change

- [x] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); medición con 20 000 piezas sintéticas contra PostgreSQL en compose (`EXPLAIN ANALYZE` de KPI y reporte, índices parciales si hacen falta, tiempos en el PR) cuando Docker esté disponible — hecho el 2026-10-25 con 20 298 piezas, 24 433 fotos y 10 253 piezas ubicadas en PostgreSQL 18 (`postgres:18-alpine`), mediana de 5 corridas. La exportación del reporte calculaba las alertas pieza por pieza (121 461 consultas, 242 s): ahora `active_alerts_for_pieces` las calcula por lotes de 1 000 (24 consultas). `EXPLAIN ANALYZE` mostró que el resto del tiempo era compilación JIT (1 598 de 1 666 ms en el reporte, 471 de 685 ms en los KPI): la API conecta con `jit=off` (ADR-018). Resultado: KPI 728 → 275 ms, KPI por colección 1 236 → 616 ms, página del reporte 3 249 → 95 ms, exportación completa 242 s → 1,9 s. Los índices existentes (`ix_piece_identifier_piece_id`, `ix_media_asset_piece_id`) se usan; los parciales de D6 no hacen falta
- [x] 4.2 Actualizar OpenAPI: implementar los 3 stubs y añadir `completeness-rules` y `kpis/history`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [x] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/calidad-datos.md` (alertas, tablero, reporte de incompletas, evolución)
- [x] 4.4 Registrar supuestos (campos obligatorios/recomendados) en `docs/preguntas-contraparte.md`, `openspec validate alertas-y-reporte-incompletas --strict` y, tras aprobar el PR, `openspec archive alertas-y-reporte-incompletas -y` — supuestos B1 y G9 registrados y `validate --strict` en verde el 2026-10-25; archivado tras integrar el PR #107
