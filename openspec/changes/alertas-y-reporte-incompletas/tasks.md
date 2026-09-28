## 1. Reglas y predicados

- [ ] 1.1 Migración de `completeness_rule` (valores iniciales `[SUPUESTO B1]`) y `completeness_snapshot`; `tests/test_migrations.py` en verde (Req: Reglas de completitud únicas y configurables; Req: Serie histórica de completitud)
- [ ] 1.2 Crear `quality/completeness.py` con `AlertDefinition` (predicado, aplica a, mensaje, acción sugerida, campo) para las 6 alertas; pruebas unitarias por alerta con piezas sintéticas construidas en la prueba, incluidos comodato, préstamo temporal, eliminadas y fusionadas (Req: Reglas de completitud únicas y configurables; RF-019, RN-003, RN-004)
- [ ] 1.3 Operación nueva `GET`/`PUT /api/v1/quality/completeness-rules` con lista blanca de campos y auditoría; pruebas: agregar recomendado, campo inexistente 422, sin permiso 403 (Req: Reglas de completitud únicas y configurables)

## 2. API

- [ ] 2.1 Implementar `GET /api/v1/pieces/{piece_id}/alerts`; pruebas de los tres escenarios (Req: Alertas de la pieza con explicación y acción sugerida)
- [ ] 2.2 Crear `quality/kpis.py` e implementar `GET /api/v1/quality/kpis` (global y `by_collection` con subcolecciones); pruebas: KPI de I sobre propiedad (250/100 → 60 %), colección solo comodato → `null`, catálogo vacío sin división por cero (Req: Indicadores con numerador y denominador explícitos; RF-035)
- [ ] 2.3 Implementar `GET /api/v1/quality/incomplete` paginado con filtros, enmascarado y `format=xlsx|csv`; prueba de coherencia: conteo del reporte = numerador del KPI para cada alerta con el seed (Req: Reglas de completitud únicas… — escenario "Misma cifra en todos los lugares")
- [ ] 2.4 Comando `python -m app.quality.snapshot` (script `npm run kpis:snapshot`) y operación nueva `GET /api/v1/quality/kpis/history`; pruebas: idempotencia diaria, rango inválido 422 (Req: Serie histórica de completitud)

## 3. Frontend

- [ ] 3.1 `lib/data/quality.ts` (mock/live); panel de alertas en la ficha con acción sugerida que lleva a la sección del editor; pruebas de componente (Req: Alertas de la pieza con explicación y acción sugerida; RNF-010)
- [ ] 3.2 Tablero `app/inicio` con KPI globales y por colección ("no aplica" cuando corresponde) y gráfico simple de evolución; pruebas de componente (Req: Indicadores…; Req: Serie histórica…)
- [ ] 3.3 Reporte de incompletas en `app/reportes` con filtros por alerta y colección y descarga; pruebas de componente (RF-035)

## 4. Cierre del change

- [ ] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); medición con 20 000 piezas sintéticas contra PostgreSQL en compose (`EXPLAIN ANALYZE` de KPI y reporte, índices parciales si hacen falta, tiempos en el PR) cuando Docker esté disponible
- [ ] 4.2 Actualizar OpenAPI: implementar los 3 stubs y añadir `completeness-rules` y `kpis/history`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/calidad-datos.md` (alertas, tablero, reporte de incompletas, evolución)
- [ ] 4.4 Registrar supuestos (campos obligatorios/recomendados) en `docs/preguntas-contraparte.md`, `openspec validate alertas-y-reporte-incompletas --strict` y, tras aprobar el PR, `openspec archive alertas-y-reporte-incompletas -y`
