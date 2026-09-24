## 1. Modelo y reglas de dominio

- [ ] 1.1 Migración Alembic que añade `piece.version` (entero, default 1) y configurar `version_id_col`; verificar con `tests/test_migrations.py` (upgrade/downgrade y `compare_metadata` sin diferencias) (Req: Control de concurrencia en la edición)
- [ ] 1.2 Crear `app/modules/catalog/tenure.py` con la tabla de transiciones de régimen (D4) y pruebas unitarias por cada fila de la tabla, incluida la PUCP como única propietaria (Req: Transiciones controladas del régimen de tenencia; RF-005, RN-003, RN-004, RN-006)
- [ ] 1.3 Extraer `validate_piece_payload()` en `catalog/service.py` que devuelve `errors`/`warnings` (denominación obligatoria, rango de época, medidas estructuradas, código I duplicado, marcador de ausencia, padre sin ciclos); pruebas unitarias por regla (Req: Validación previa sin persistencia; RF-006, RF-007, RF-009, RF-043)

## 2. API de piezas

- [ ] 2.1 Implementar `POST /api/v1/pieces` (201, auditoría origen manual) y pruebas: alta válida, sin denominación 422, comodato con I 409, Consulta interna 403 (Req: Operaciones de escritura de la ficha con auditoría)
- [ ] 2.2 Implementar `PATCH /api/v1/pieces/{piece_id}` con JSON merge, `If-Match` y 409/428; pruebas: dos ediciones concurrentes, sin versión, guardado sin cambios sin auditoría (Req: Control de concurrencia en la edición)
- [ ] 2.3 Implementar `POST /api/v1/pieces/validate` en transacción siempre revertida; prueba que verifica cero filas nuevas en `piece` y `audit_log` (Req: Validación previa sin persistencia)
- [ ] 2.4 Implementar `DELETE /api/v1/pieces/{piece_id}` con motivo obligatorio y `POST .../restore` con verificación de código I; pruebas: sin motivo 422, restaurar ok, restaurar con I duplicado 409 (Req: Operaciones de escritura de la ficha con auditoría; RNF-006)
- [ ] 2.5 Aplicar transiciones de régimen en `PATCH`; pruebas de integración de los tres escenarios del requirement (Req: Transiciones controladas del régimen de tenencia)

## 3. API de identificadores

- [ ] 3.1 Implementar `POST /api/v1/pieces/{piece_id}/identifiers` con detección de concatenados (422 + `proposals`) y `confirmed_split`; pruebas de los cuatro escenarios (Req: Registro de identificadores con confirmación de códigos concatenados; RF-002, RF-023)
- [ ] 3.2 Implementar `POST .../identifiers/{identifier_id}/correction` (D6); pruebas: corrección ok con enlace `replaced_by_id`, sin permiso 403, sin motivo 422, valor usado por pieza eliminada 409, búsqueda por el valor anterior sigue encontrando la pieza (Req: Operación de corrección auditada del código I; RF-003, RN-002)

## 4. Frontend

- [ ] 4.1 Decidir y registrar ADR Propuesto sobre librería de formularios (`react-hook-form` + `zod` o `useReducer`), instalar versiones estables vigentes si se adoptan; verificar `npm run lint:web` (RNF-004)
- [ ] 4.2 Crear `app/piezas/nueva` (no existe en la maqueta) y conectar `app/piezas/[id]/editar` al modo `live` (`lib/data/pieces.ts`: `createPiece`, `updatePiece`, `validatePiece`) con debounce y `AbortController`; pruebas Vitest de la capa de datos (rama mock y rama live con `fetch` simulado) (Req: Validación previa sin persistencia; RF-043)
- [ ] 4.3 Mostrar errores y advertencias junto al campo, conflicto 409 con opción "ver cambios del otro usuario" y borrador en `sessionStorage`; prueba de componente del conflicto (Req: Control de concurrencia en la edición; RNF-010)
- [ ] 4.4 Diálogos de eliminación (motivo obligatorio), restauración, corrección de código I (solo con permiso) y confirmación de separación de códigos concatenados; pruebas de componente (Req: Operación de corrección auditada del código I)

## 5. Cierre del change

- [ ] 5.1 Tests requeridos: pruebas de las secciones 1–4 en verde con `npm test` y `npm run lint`; repetir 2.x y 3.x contra PostgreSQL en compose (`npm run dev`, `npm run migrate`, `npm run seed`) cuando Docker esté disponible
- [ ] 5.2 Actualizar OpenAPI: marcar las 7 operaciones como `x-status: implemented` (quitar `x-change`), `npm run openapi && npm run openapi:client` y verificar `npm run openapi:check`
- [ ] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/catalogo.md` (alta, edición, conflictos, eliminación y restauración, corrección de código I) con capturas de datos sintéticos
- [ ] 5.4 Registrar nuevos supuestos en `docs/preguntas-contraparte.md`, `openspec validate ficha-pieza-crud --strict` en verde y, tras aprobar el PR, `openspec archive ficha-pieza-crud -y` (o `/opsx:archive ficha-pieza-crud`)
