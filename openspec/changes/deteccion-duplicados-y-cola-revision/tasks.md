## 1. Modelo y configuración

- [ ] 1.1 Migración aditiva: `quality_setting` (pesos, umbral), `quality_job` y `quality_job_item`, nuevo estado `SUPERSEDED` (`POSTPONED` ya existe) y columnas `postponed_until`, `blocking_conflict`, `change_set_id` en `duplicate_candidate`; `tests/test_migrations.py` en verde (Req: Detección explicable…; Req: Pares distintos estables…)

## 2. Detección

- [ ] 2.1 Crear `quality/scoring.py` (señales, pesos, huella) con pruebas unitarias por señal y por huella (Req: Detección explicable…; Req: Pares distintos estables…; RF-030)
- [ ] 2.2 Crear `quality/duplicates.py` con generación por bloques (identificador, trigramas por colección, autor+procedencia) e interfaz `SimilarityScorer` para importación; pruebas con los 10 pares del seed: todos detectados y sin pares triviales espurios por encima del umbral (Req: Detección explicable…)
- [ ] 2.3 Implementar operación nueva `POST /api/v1/quality/duplicates/scan` (job en segundo plano, 409 si hay uno en curso) y `GET /api/v1/quality/jobs/{job_id}`; pruebas (Req: Detección explicable… — escenario "Detección completa en curso")
- [ ] 2.4 Detección incremental tras alta/edición de pieza o identificador (`quality_job_item` + worker); prueba del escenario "Detección incremental al editar" (Req: Detección explicable…)

## 3. Cola y resolución

- [ ] 3.1 Implementar `GET /api/v1/quality/duplicates` con filtros (estado, colección, puntaje, origen) y reapertura de pospuestos vencidos en lectura; pruebas (Req: Pares distintos estables…)
- [ ] 3.2 Implementar `resolve` con acciones `distinct` y `postpone`; pruebas: distinto sin cambios no reaparece, reaparece con huella distinta, posponer > 180 días 422, Consulta interna 403 (Req: Pares distintos estables…)
- [ ] 3.3 Crear `quality/merge.py` y acción `merge` (validaciones, elección de campos, traslado de identificadores/fotos/movimientos/datos de origen/evaluaciones/sugerencias, pieza absorbida fusionada, candidatos reemplazados, `change_set_id`); pruebas de los cuatro escenarios y de identificador repetido conservado como no vigente (Req: Fusión con elección de valores y reasignación de datos relacionados; RN-002, RN-003, RN-005)
- [ ] 3.4 Exponer `merged_into` en la ficha de piezas fusionadas (lectura con `include_deleted` para la redirección); prueba (Req: Fusión… — escenario "Consulta de la pieza absorbida")

## 4. Frontend

- [ ] 4.1 Cola `app/duplicados` en modo `live` con filtros y comparación lado a lado resaltando señales; pruebas de componente (Req: Detección explicable…; RNF-010)
- [ ] 4.2 Asistente de fusión: elegir pieza conservada, elegir valores por campo, resumen de lo que se trasladará y confirmación; aviso de bloqueo por código I o régimen; pruebas de componente (Req: Fusión con elección de valores…)

## 5. Cierre del change

- [ ] 5.1 Tests requeridos: secciones 1–4 en verde (`npm test`, `npm run lint`); prueba de volumen con 20 000 piezas sintéticas contra PostgreSQL en compose (duración del scan y calibración de umbrales de trigramas) cuando Docker esté disponible
- [ ] 5.2 Actualizar OpenAPI: implementar los 2 stubs y añadir `duplicates/scan` y `quality/jobs/{job_id}`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/calidad-datos.md` (cola de duplicados, marcar distintos, posponer, fusionar)
- [ ] 5.4 Registrar supuestos (pesos, umbral, máximo de posposición, regímenes en fusión) en `docs/preguntas-contraparte.md`, `openspec validate deteccion-duplicados-y-cola-revision --strict` y, tras aprobar el PR, `openspec archive deteccion-duplicados-y-cola-revision -y`
