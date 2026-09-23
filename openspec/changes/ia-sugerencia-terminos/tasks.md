## 1. Contrato del servicio IA

- [ ] 1.1 Ampliar `services/ai/matp_ai/schemas.py` y `/v1/suggest-terms` con `candidates` y `max_per_vocabulary` (compatible si faltan) y actualizar `AIProvider.suggest_terms`, `MockProvider` (coincidencia determinista por etiqueta/alt_labels sin tildes, etiquetas libres de ejemplo) y `LLMProvider` stub; pruebas en `services/ai/tests/`: determinismo, término existente, etiqueta libre, sin candidatos (Req: Sugerencia de términos restringida a candidatos activos; RNF-008)
- [ ] 1.2 Regenerar `docs/api/ai-openapi.json` con `npm run openapi` y verificar `npm run openapi:check` (RNF-009)

## 2. API

- [ ] 2.1 Migración `piece_technique` análoga a `piece_material` con soft-delete y auditoría; `tests/test_migrations.py` y prueba transversal en verde (Req: Aplicación de términos aprobados según el vocabulario)
- [ ] 2.2 Crear `ai_suggestions/terms.py`: construcción de candidatos activos (límite 2 000), llamada al servicio, validación y conversión a `new_term_proposal`; extender `POST /api/v1/ai/suggestions` para `RIA_03`; pruebas de los tres escenarios del requirement (Req: Sugerencia de términos restringida a candidatos activos)
- [ ] 2.3 Extender `apply.py` con destinos por cardinalidad (`replace=true` para valor único, agregar para múltiples) y huella de campos destino; pruebas: reemplazo sin confirmar 409, con confirmación ok, agregar material, obsolescencia (Req: Aplicación de términos aprobados según el vocabulario; RN-009)
- [ ] 2.4 Aprobación de `new_term_proposal` con `vocabularies.manage`, verificación de etiqueta normalizada contra activos e inactivos, creación y aplicación en una transacción; pruebas de los tres escenarios (Req: Aceptación controlada de términos nuevos)
- [ ] 2.5 Crear `ai_suggestions/batch.py` y operaciones nuevas `POST /api/v1/ai/suggestions/batch` y `GET /api/v1/ai/suggestions/batch/{batch_request_id}` (≤ 50 piezas, un lote activo por usuario, estado parcial ante caída); pruebas de los tres escenarios (Req: Solicitud de sugerencias de términos por lote acotado)

## 3. Frontend

- [ ] 3.1 Sugerencias de términos en la ficha y en `app/ia/sugerencias`: término existente con equivalencia externa visible, confirmación de reemplazo, propuesta de término nuevo con formulario (solo con permiso) o aviso "pendiente para Gestor"; pruebas de componente (Req: Aplicación de términos aprobados…; Req: Aceptación controlada de términos nuevos; RNF-010)
- [ ] 3.2 Acción "Sugerir términos para estas piezas" en `app/busqueda` (hasta 50 resultados seleccionados) con seguimiento del lote; prueba de componente del límite (Req: Solicitud de sugerencias de términos por lote acotado)

## 4. Cierre del change

- [ ] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); prueba de extremo a extremo API + servicio IA en compose con `AI_PROVIDER=mock`, incluido un lote de 50 piezas del seed, cuando Docker esté disponible
- [ ] 4.2 Actualizar OpenAPI: documentar `RIA_03` en `ai/suggestions` (ítems `term` y `new_term_proposal`, `replace`, `create`) y añadir `ai/suggestions/batch*`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/ia.md` (sección sugerencia de términos, términos nuevos y lotes)
- [ ] 4.4 Registrar supuestos (tamaño de vocabularios, reparto de revisión de términos nuevos, uso de tesauro externo) en `docs/preguntas-contraparte.md`, `openspec validate ia-sugerencia-terminos --strict` y, tras aprobar el PR, `openspec archive ia-sugerencia-terminos -y`
