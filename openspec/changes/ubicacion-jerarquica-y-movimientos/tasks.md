## 1. Modelo

- [x] 1.1 Migración aditiva: `location.space_kind`, `piece_movement.corrects_movement_id`, tabla `idempotency_key` (clave, usuario, hash de petición, respuesta, expiración); `tests/test_migrations.py` en verde (Req: Registro de movimientos…; Req: Movimiento en lote…; Req: Coherencia de la disponibilidad…)
- [x] 1.2 Crear `app/modules/locations/hierarchy.py` con la tabla de padres permitidos, detección de ciclos y `full_path`; pruebas unitarias por nivel y ciclo (Req: Administración del catálogo de ubicaciones; RF-016)

## 2. API de ubicaciones

- [x] 2.1 Implementar `POST /api/v1/locations` (nivel, código normalizado único, auditoría); pruebas: rack en depósito ok, padre no permitido 422, código repetido 409, sin permiso 403 (Req: Administración del catálogo de ubicaciones)
- [x] 2.2 Implementar `PUT /api/v1/locations/{location_id}` (edición, desactivación rechazada con piezas, reubicación con `confirm_affected_count` y movimientos por pieza); pruebas de los escenarios de desactivación y reubicación (Req: Administración del catálogo…; Req: Reubicación de un nodo con piezas)

## 3. API de movimientos

- [x] 3.1 Implementar `POST /api/v1/pieces/{piece_id}/move` (MOVE, VERIFICATION, CORRECTION) con `SELECT ... FOR UPDATE`, `expected_from` y actualización de `current_location_id`; pruebas de los cinco escenarios del requirement (Req: Registro de movimientos con ubicación actual derivada; RF-017)
- [x] 3.2 Prueba de propiedad: tras una secuencia aleatoria de movimientos, `piece.current_location_id` coincide con el destino del último MOVE/CORRECTION (Req: Registro de movimientos…)
- [x] 3.3 Implementar `POST /api/v1/movements/batch` todo-o-nada con `Idempotency-Key` y límite de 200; pruebas: lote ok, una pieza fallida, reintento idempotente, límite excedido 422 (Req: Movimiento en lote desde el depósito)
- [x] 3.4 Propuesta y validación de disponibilidad por `space_kind` (mapeo configurable a términos de `AVAILABILITY`); pruebas de los dos escenarios (Req: Coherencia de la disponibilidad con el tipo de espacio; RF-020)
- [x] 3.5 Enmascarado de ubicación exacta en historial y respuestas de lote; prueba con rol Consulta interna (Req: Registro de movimientos… — escenario "Historial sin permiso de ubicación exacta"; RF-041)

## 4. Frontend

- [x] 4.1 `lib/data/locations.ts` (mock/live) y administración de ubicaciones en árbol en `app/administracion`; pruebas Vitest (Req: Administración del catálogo de ubicaciones)
- [x] 4.2 Vista móvil `app/deposito` en modo `live`: buscar por código, verificar, mover una pieza, acumular piezas para lote, reintento con la misma clave de idempotencia y mensajes claros de conflicto; pruebas de componente a 375 px (Req: Movimiento en lote desde el depósito; RNF-001, RNF-010)

## 5. Cierre del change

- [x] 5.1 Tests requeridos: secciones 1–4 en verde (`npm test`, `npm run lint`); repetido contra PostgreSQL en compose con `npm run test:api:pg` (10/10 en verde contra `matp_test`, sin tocar `matp`). Esa corrida detectó que el id de la migración 0008 (40 caracteres) excedía `alembic_version.version_num` (`VARCHAR(32)`) — invisible en SQLite, que no aplica el límite de longitud; se acortó a `0008_locations_idempotency` (26 caracteres)
- [x] 5.2 Actualizar OpenAPI: implementar los 3 stubs y añadir `movements/batch`; `npm run openapi && npm run openapi:client`, `npm run openapi:check` en verde
- [x] 5.3 Actualizar el manual de usuario: `docs/manual-usuario/deposito.md` (vista móvil, mover, verificar, lotes) y `docs/manual-usuario/administracion.md` (ubicaciones)
- [x] 5.4 Registrar supuestos (niveles, tipo de espacio; referenciar D4 para cajas en el piso) en `docs/preguntas-contraparte.md`, ADR Propuesto sobre idempotencia, `openspec validate ubicacion-jerarquica-y-movimientos --strict` y, tras aprobar el PR, `openspec archive ubicacion-jerarquica-y-movimientos -y`
