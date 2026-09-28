## 1. Modelo y cliente del servicio IA

- [ ] 1.1 Migración aditiva en `ai_suggestion`: `source_fingerprint`, `was_edited`, `pending_application`, `source_field`; `tests/test_migrations.py` en verde (Req: Detección de sugerencias obsoletas por huella; Req: Revisión total, parcial o con edición…)
- [ ] 1.2 Crear `ai_suggestions/client.py` (llamada al servicio IA con `AI_INTERNAL_URL`, `AI_REQUEST_TIMEOUT_SECONDS` documentado en `.env.example`, mapeo de errores a 503 `ai_unavailable`); pruebas con transporte simulado: éxito, timeout, 503 del proveedor `llm` (Req: Solicitud de sugerencias con minimización de datos; RNF-008)
- [ ] 1.3 Crear `ai_suggestions/privacy.py` (lista blanca por función, exclusión de campos sensibles, reemplazo de patrones de datos personales si el proveedor no es `mock`); pruebas: comodato sin comodante, correo y DNI reemplazados (Req: Solicitud de sugerencias con minimización de datos; RNF-014)

## 2. Flujo de sugerencias

- [ ] 2.1 Implementar `POST /api/v1/ai/suggestions` (RIA-01; permiso `ai.request`, límite por usuario, sin datos → sin sugerencia, huella de origen); pruebas de los cuatro escenarios de solicitud y de "Texto sin datos" (Req: Solicitud de sugerencias…; Req: Destinos de los datos extraídos…)
- [ ] 2.2 Crear `ai_suggestions/apply.py` como único punto de escritura (verifica aprobación registrada) con destinos RIA-01 (medidas, evaluación de conservación, nota de revisión, exposición retenida); pruebas unitarias por destino y prueba de escritura sin aprobación que falla (Req: Revisión total, parcial o con edición…; Req: Destinos de los datos extraídos…; RN-009)
- [ ] 2.3 Implementar `POST /api/v1/ai/suggestions/{suggestion_id}/approve` (ítems, ediciones validadas, estados, `was_edited`, obsolescencia con `confirm_stale`, auditoría origen IA aprobada); pruebas: aprobación parcial con edición, valor inválido 422, obsoleta 409 y confirmada, doble revisión 409, Catalogador sin `ai.review` 403 (Req: Revisión total…; Req: Detección de sugerencias obsoletas por huella)
- [ ] 2.4 Implementar `POST /api/v1/ai/suggestions/{suggestion_id}/reject` con motivo obligatorio; pruebas (Req: Revisión total… — escenario "Rechazo sin motivo")
- [ ] 2.5 Ampliar casos deterministas de `MockProvider.extract_structured` (estado de conservación, marcas de revisión, exposiciones) y sus pruebas en `services/ai/tests/` (RIA-01, RNF-008)
- [ ] 2.6 Operación nueva `GET /api/v1/ai/metrics`; pruebas: conteos y porcentajes, periodo vacío (Req: Indicadores de aceptación de la IA)

## 3. Frontend

- [ ] 3.1 `lib/data/ai.ts` (mock/live); botón "Sugerir datos desde el texto" en la ficha con estados de carga, "no disponible" y "sin datos"; pruebas de componente (Req: Solicitud de sugerencias…; RNF-010)
- [ ] 3.2 Pantalla `app/ia/sugerencias` en modo `live`: fragmento de origen resaltado, aprobar por ítem, editar valor, elegir término de conservación, rechazar con motivo, aviso de obsolescencia con comparación, exposiciones pendientes de aplicar; pruebas de componente (Req: Revisión total…; Req: Detección de sugerencias obsoletas…)

## 4. Cierre del change

- [ ] 4.1 Tests requeridos: secciones 1–3 en verde (`npm test`, `npm run lint`); prueba de extremo a extremo API + servicio IA en compose con `AI_PROVIDER=mock` y con el servicio IA detenido (degradación) cuando Docker esté disponible
- [ ] 4.2 Actualizar OpenAPI: implementar los 3 stubs, añadir `ai/metrics` y documentar `items`, `was_edited` y `pending_application`; regenerar `docs/api/ai-openapi.json` si cambia el servicio; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 4.3 Actualizar el manual de usuario: `docs/manual-usuario/ia.md` (qué hace la IA, que nunca guarda sin aprobación, cómo revisar, editar y rechazar)
- [ ] 4.4 Registrar supuestos (política de datos hacia proveedores, exposiciones retenidas, quién revisa) en `docs/preguntas-contraparte.md`, `openspec validate ia-extraccion-texto-libre --strict` y, tras aprobar el PR, `openspec archive ia-extraccion-texto-libre -y`
