## 1. Modelo

- [ ] 1.1 Migración que añade `identifier_type.is_system` y marca los tipos `I` y `COLECCION` en el seed de referencia; verificar con `tests/test_migrations.py` y prueba del seed (Req: Protección de los tipos de identificador del sistema)

## 2. API de vocabularios y tipos de identificador

- [ ] 2.1 Implementar `POST /api/v1/vocabularies` (código estable único, auditoría); pruebas: alta 201, código repetido 409, Catalogador 403 (Req: Administración de vocabularios y tipos de identificador por API; RN-010)
- [ ] 2.2 Implementar `POST /api/v1/identifier-types` y `PATCH /api/v1/identifier-types/{type_code}` con validación de la regla contra `NormalizationRule`; pruebas: alta 201, regla inexistente 422, cambio de bandera en tipo de sistema 409, cambio de etiqueta ok (Req: Administración de vocabularios…; Req: Protección de los tipos de identificador del sistema)
- [ ] 2.3 Implementar `POST /api/v1/identifier-types/{type_code}/normalization-preview` (sin escritura) con conteo de cambios, colisiones de I vigentes y no normalizables, y `confirm_token` = hash del informe; pruebas unitarias con el seed sintético (Req: Cambio controlado de la regla de normalización)
- [ ] 2.4 Exigir `confirm_token` en `PATCH` cuando el tipo está en uso y recalcular valores normalizados en una transacción (por lotes sobre el umbral) con auditoría origen sistema; pruebas: sin vista previa 409, confirmación ok, colisión rechazada, token caducado por datos nuevos (Req: Cambio controlado de la regla de normalización; RF-023, RN-002)

## 3. Conservación

- [ ] 3.1 Implementar `GET`/`POST /api/v1/pieces/{piece_id}/conservation-assessments` (permiso `conservation.assess`, estado actual por `assessed_at`); pruebas de los tres escenarios (Req: Historial de evaluaciones de conservación por API; RF-012)

## 4. Precarga de vocabularios

- [ ] 4.1 Crear `app/seed/vocabularies/__main__.py` (`--dry-run` por defecto, `--apply`), CSV sintético de ejemplo marcado `[SUPUESTO]` y script `npm run vocabularies:load`; pruebas: informe sin escritura, idempotencia, término ausente conservado, columnas incorrectas (Req: Precarga idempotente de vocabularios desde archivo; RF-011)

## 5. Frontend

- [ ] 5.1 Crear `lib/data/admin.ts` (mock/live) y conectar `app/administracion` (colecciones, vocabularios, términos, tipos de identificador con candado de sistema); pruebas Vitest de la capa de datos (Req: Administración de vocabularios y tipos de identificador por API; RF-010)
- [ ] 5.2 Flujo de cambio de regla de normalización con pantalla de vista previa y confirmación en lenguaje claro; prueba de componente (Req: Cambio controlado de la regla de normalización; RNF-010)
- [ ] 5.3 Pestaña de conservación de la ficha con historial y formulario de nueva evaluación en modo `live`; prueba de componente (Req: Historial de evaluaciones de conservación por API)

## 6. Cierre del change

- [ ] 6.1 Tests requeridos: pruebas de las secciones 1–5 en verde (`npm test`, `npm run lint`); repetir 2.4 y 3.1 contra PostgreSQL en compose cuando Docker esté disponible
- [ ] 6.2 Actualizar OpenAPI: implementar los 3 stubs, añadir `normalization-preview` y `conservation-assessments` con ejemplos, `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [ ] 6.3 Actualizar el manual de usuario: `docs/manual-usuario/administracion.md` (colecciones, vocabularios, tipos de identificador, precarga de listas) y `docs/manual-usuario/catalogo.md` (sección conservación)
- [ ] 6.4 Registrar supuestos nuevos en `docs/preguntas-contraparte.md`, `openspec validate colecciones-y-vocabularios-admin --strict` en verde y, tras aprobar el PR, `openspec archive colecciones-y-vocabularios-admin -y`
