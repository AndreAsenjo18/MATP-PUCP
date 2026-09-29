## 1. Estados y worker

- [ ] 1.1 Crear `imports/state.py` (tabla de transiciones, `FOR UPDATE`, 409 `invalid_batch_transition`) y migración aditiva de `processing_started_at`, `heartbeat_at`, `sheet_name`, `header_row`; pruebas por transición permitida y no permitida (Req: Estados del lote con etapas reanudables; RF-021)
- [ ] 1.2 Crear `imports/worker.py` (ejecución en `BackgroundTasks`, latido, recuperación de lotes interrumpidos al arrancar); pruebas: etapa repetida sin duplicados, recuperación tras latido vencido (Req: Estados del lote con etapas reanudables)

## 2. Ingesta

- [ ] 2.1 Implementar `POST /api/v1/imports`, `GET /api/v1/imports` y `GET /api/v1/imports/{batch_id}` con almacenamiento del original y límites `IMPORT_MAX_BYTES`/`IMPORT_MAX_ROWS` (documentados en `.env.example`); pruebas: xlsx ok, formato no admitido y límite de filas → `FAILED_INGESTION` (Req: Ingesta de hojas de cálculo con límites)
- [ ] 2.2 Crear `imports/ingest.py` (hojas, fila de cabeceras, `data_only`, celdas combinadas, CSV con codificación y separador, filas vacías); pruebas con fixtures sintéticos nuevos en `data/fixtures/` (Latin-1 `;`, varias hojas, fórmulas) (Req: Ingesta de hojas de cálculo con límites)

## 3. Mapeo, validación y clasificación

- [ ] 3.1 Implementar `PUT /api/v1/imports/{batch_id}/mapping` sobre la interfaz `apply_mapping`/`validate_mapping` (implementación mínima provisional si `plantillas-mapeo-y-normalizacion` no está aplicado); pruebas: mapeo válido → `MAPPED`, sin denominación 422, re-mapeo desde `IN_PREVIEW` descarta la validación (Req: Estados del lote…; RF-022 vía change hermano)
- [ ] 3.2 Crear `imports/matching.py` (identificadores vigentes e históricos, agrupación por pieza, `via`); pruebas: `M.M.Z. 015` contra `MMZ 15`, código INC no vigente, contradicción entre piezas (RF-024)
- [ ] 3.3 Crear `imports/classify.py` con reglas ordenadas, conflicto intra-lote, interfaz `SimilarityScorer` con evaluador provisional y creación de `duplicate_candidate`; pruebas por regla (Req: Decisiones por fila y por campo con resolución de conflictos; RF-025, RN-003, RN-004)
- [ ] 3.4 Implementar `POST /api/v1/imports/{batch_id}/validate` (worker) y `GET /api/v1/imports/{batch_id}/preview` con diff, `default_action` y `classification_rules`; pruebas con la sábana sintética: conteos por clasificación esperados (RF-026)

## 4. Decisiones, aprobación y aplicación

- [ ] 4.1 Implementar `PATCH /api/v1/imports/{batch_id}/rows/{row_id}` (decisión de fila, decisiones por campo, resolución de conflictos, motivo obligatorio al rechazar); pruebas de los escenarios del requirement (Req: Decisiones por fila y por campo…)
- [ ] 4.2 Implementar `POST /api/v1/imports/{batch_id}/approve` con `summary_token` y `imports/apply.py` en una transacción con servicios de dominio, `piece_source_record` y `AuditContext(origin=IMPORT)`; pruebas: aplicación ok, resumen desactualizado 409, fila que viola RN-003 → rollback total y `FAILED_APPLY`, Catalogador 403 (Req: Aplicación atómica con datos de origen y reversión del lote; RF-027, RF-008)
- [ ] 4.3 Implementar `GET /api/v1/imports/{batch_id}/log` (JSON y descarga `.xlsx`); pruebas: lote aplicado con filas rechazadas, lote fallido en ingesta (Req: Bitácora descargable del lote; RF-028)

## 5. Imágenes y reversión

- [ ] 5.1 Extraer imágenes incrustadas en la ingesta (`imports/images.py`) con fila de anclaje y bandeja sin asignar; operación nueva `POST /api/v1/imports/{batch_id}/images/{image_id}/associate`; pruebas con `sabana_sintetica_v1.xlsx`: anclada, sin fila, asociación antes de aplicar 409 (Req: Revisión manual de imágenes extraídas de Excel; RF-029)
- [ ] 5.2 Implementar `POST /api/v1/imports/{batch_id}/revert` sobre el motor de reversión de `auditoria-y-soft-delete-transversal` (bloqueada hasta que ese change esté aplicado); pruebas: reversión limpia, reversión con edición posterior exige confirmación (Req: Aplicación atómica… — escenario "Reversión del lote"; RNF-007)

## 6. Frontend

- [ ] 6.1 `lib/data/imports.ts` (mock/live) y asistente `app/importacion` en modo `live`: subida, hoja y cabeceras, mapeo, progreso, previsualización con filtros por clasificación, diff, decisiones, resumen y confirmación en lenguaje claro; pruebas Vitest y de componente (Req: Decisiones por fila y por campo…; RNF-010)
- [ ] 6.2 Bitácora y bandeja de imágenes en la UI; pruebas de componente (Req: Bitácora descargable del lote; Req: Revisión manual de imágenes extraídas de Excel)

## 7. Cierre del change

- [ ] 7.1 Tests requeridos: secciones 1–6 en verde (`npm test`, `npm run lint`); prueba de volumen con una sábana sintética de 20 000 filas contra PostgreSQL en compose (tiempo de validación y de aplicación registrados en el PR) cuando Docker esté disponible
- [ ] 7.2 Actualizar OpenAPI: implementar los 10 stubs y añadir `images/{image_id}/associate`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 7.3 Actualizar el manual de usuario: `docs/manual-usuario/importacion.md` (preparar archivo, pasos del asistente, resolver conflictos, aprobar, bitácora, revertir)
- [ ] 7.4 Registrar supuestos (formatos, límites, celdas combinadas, política de vacíos) en `docs/preguntas-contraparte.md`, `openspec validate importacion-pipeline-reconciliacion --strict` y, tras aprobar el PR, `openspec archive importacion-pipeline-reconciliacion -y`
