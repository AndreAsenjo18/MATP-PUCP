## 1. Contrato del equipo como fuente de verdad

- [x] 1.1 Versionar `docs/fuentes/endpoints-api-v1.yaml` y escribir `docs/api/mapeo-endpoints-v1.md` con las 45 operaciones, su estado actual, los añadidos y los conflictos C1 a C6 (Req: Conformidad con el contrato de interfaces del equipo; RNF-009)
- [x] 1.2 Registrar los conflictos como preguntas I1 a I6 en `docs/preguntas-contraparte.md` y enlazarlos desde `docs/api/README.md` y `CLAUDE.md` (Req: Conformidad con el contrato de interfaces del equipo)
- [x] 1.3 Crear `apps/api/tests/api/test_contract_conformance.py` según D2 (rutas, verbos, `operationId`, campos requeridos y lista explícita de añadidos); debe fallar hoy y pasar al terminar la tarea 4 (Req: Conformidad con el contrato de interfaces del equipo; RNF-009)

## 2. Modelo de datos del contrato

- [x] 2.1 Migración Alembic: renombrado de `title` a `denomination` (con su índice), de `period_text`/`period_from`/`period_to`/`period_type` a `epoch_original_text`/`epoch_start_year`/`epoch_end_year`/`epoch_type` (con la restricción `epoch_range`) y de `category_term_id`/`conservation_status_term_id` a `category_id`/`conservation_state_id`; **sin** columna `piece.code_i` (se deriva según D4); verificar con `tests/test_migrations.py` (upgrade, downgrade y `compare_metadata` sin diferencias) (Req: Campos de la ficha con los nombres del contrato; RF-001, RF-003, RN-001, RN-002)
- [x] 2.2 Categorías y estados de conservación como fachada sobre `vocabulary`/`term` (D3, D7-C4d): `term.parent_id` para la jerarquía de categorías, `GET/POST /categories` y `GET /conservation-states` devolviendo `term.id` como identificador; pruebas de jerarquía y de que ninguna pieza pierde su clasificación (Req: Catálogos de categorías y estados de conservación; RF-011, RF-012)
- [x] 2.3 Proponer el change `prestamos-y-exposiciones` para modelar `loan` y `loan_item` con borrado lógico y auditoría; la implementación y las pruebas de RF-018, RN-004 y RN-008 se ejecutan exclusivamente en ese change (Req: Registro de préstamos y exposiciones; RF-018, RN-004, RN-008)
- [ ] 2.4 Actualizar el seed y `data/fixtures` a los nombres y catálogos nuevos; prueba de que el seed sigue generando 300 piezas, 54 % sin código I y 10 pares duplicados (Req: Campos de la ficha con los nombres del contrato)

## 3. Traducción de enumerados en la frontera

- [x] 3.1 Crear `app/api/enums.py` con la tabla única de equivalencias (régimen de tenencia, tipo de vista, estado de lote e importación) y pruebas de ida y vuelta para cada valor (Req: Valores de enumerado del contrato en la API; RF-005, RF-013)
- [x] 3.2 Aplicar la traducción en todos los esquemas de entrada y salida; prueba de que ninguna respuesta de la API contiene los códigos internos en inglés (Req: Valores de enumerado del contrato en la API)

## 4. Operaciones de la fase 1 del documento (1 a 20)

- [x] 4.0 Primera tanda de alineación de rutas, verbos e `operationId` (39 de 45 operaciones conformes): `operationId` en camelCase desde el nombre del handler; `/audit-logs`, `/imports/upload`, `/imports/{batch_id}/diffs`, `/imports/{batch_id}/confirm`, `/imports/{batch_id}/rollback`, `/pieces/{id}/move`, `/pieces/{id}/location-history`, `PUT /pieces/{id}`, `PUT /locations/{id}`, `/reports/export-excel`, `/reports/dashboard-stats`, `/ai/suggest-cataloging`; nuevas `/locations/tree`, `/locations/{id}/pieces`, `/categories`, `/conservation-states`, `/pieces/{id}/children`, `/media/upload`, `/reports/piece-card/{id}/pdf`, `/users/{id}/role`, `/audit-logs/pieces/{id}`, `/ai/validate-data` y `DELETE /pieces/{id}/identifiers/{identifier_id}` (Req: Conformidad con el contrato de interfaces del equipo)

- [ ] 4.1 Piezas: `POST /pieces`, `GET /pieces` (`page`/`limit`), `GET /pieces/{id}`, `PUT /pieces/{id}`, `DELETE /pieces/{id}` con los esquemas `PieceCreate`, `PieceSummary`, `PieceDetail` y `PieceSearchResponse`; `code_i` derivado del identificador vigente de tipo I (D4) y `category_id`/`conservation_state_id` opcionales `[SUPUESTO]` B1; pruebas por operación, incluidas la de comodato con código I (409), la de cambio de `code_i` en `PUT` (409, RN-002) y la del número de consultas SQL de `GET /pieces` (constante para cualquier `limit`) (Req: Campos de la ficha con los nombres del contrato; RF-006, RN-002, RN-003)
- [x] 4.2 Colecciones, `GET /categories`, `POST /categories` y `GET /conservation-states` con `CollectionItem`; pruebas de listado y alta (Req: Catálogos de categorías y estados de conservación; RF-010, RF-011, RF-012)
- [ ] 4.3 Ubicaciones: `GET /locations/tree` (árbol anidado `LocationNode`), `POST /pieces/{id}/move` y `GET /pieces/{id}/location-history`; pruebas del árbol con cinco niveles y del movimiento que genera historial (Req: Árbol de ubicaciones y movimiento en las rutas del contrato; RF-016, RF-017)
- [ ] 4.4 Importación: `POST /imports/upload` (202), `GET /imports/{batch_id}/diffs` y `POST /imports/{batch_id}/confirm` con `ImportBatchSummary`; pruebas de la forma de la respuesta (Req: Pipeline de importación en las rutas del contrato; RF-021, RF-026, RF-027)
- [ ] 4.5 Búsqueda `GET /search` con `q`, `collection_code`, `tenure_regime`, `page` y `limit`; pruebas de filtros combinados y de paginación (Req: Búsqueda y paginación del contrato; RF-031, RF-032)
- [ ] 4.6 Multimedia `POST /media/upload` (`multipart/form-data` con `piece_id`, `view_type`, `file`); pruebas de alta y de restricción de uso en comodato (Req: Carga de multimedia en la ruta del contrato; RF-013, RF-014, RN-008)
- [ ] 4.7 Autenticación: `POST /auth/login` (stub hasta `autenticacion-y-matriz-permisos`) y `GET /auth/me` con el rol del usuario; pruebas de ambas (Req: Perfil y rol en las rutas del contrato; RF-039, RNF-012; secundario: RF-041, porque `/auth/me` expone los permisos sobre campos sensibles, pero no es el requisito principal de esta tarea)

## 5. Operaciones de las fases 2 y 3 del documento (21 a 45)

- [x] 5.1 Renombrar y exponer con su forma definitiva las operaciones de la fase 2 (identificadores, conjuntos, espacios, lotes, reportes, usuarios, auditoría e IA), manteniendo `501` con su `x-change`; prueba de que cada stub cita un change existente del backlog (Req: Conformidad con el contrato de interfaces del equipo)
- [x] 5.2 Proponer los changes que faltan para la fase 3 (préstamos y exposiciones; descargas masivas y enriquecimiento por lote) y luego exponer sus operaciones (`/loans`, `/loans/{id}/status`, `/media/bulk-download`, `/audit-logs/pieces/{id}`, `/ai/batch-enrich`) como stubs con su esquema; **sin** `/public/catalog` hasta resolver C2 (Req: Conformidad con el contrato de interfaces del equipo)
- [x] 5.3 Baja lógica del identificador en `DELETE /pieces/{id}/identifiers/{identifier_id}` según D1, con pruebas: identificador secundario dado de baja queda en el historial; identificador de tipo I responde 409 (Req: Conformidad con el contrato de interfaces del equipo; RN-002, RN-005)

## 6. Cliente tipado, maqueta y documentación

- [ ] 6.1 Regenerar `docs/api/openapi.json` y el cliente tipado (`npm run openapi && npm run openapi:client`) y actualizar `apps/web/src/lib/{data,fixtures}` a los nombres nuevos; `npm run test:web` en verde (Req: Conformidad con el contrato de interfaces del equipo)
- [ ] 6.2 Actualizar `docs/modelo-datos.md`, `docs/api/README.md`, `docs/api/mapeo-endpoints-v1.md` (columna «Acción» a «hecho») y `docs/estado-arranque.md` (Req: Conformidad con el contrato de interfaces del equipo)
- [ ] 6.3 Actualizar los 15 changes del backlog cuyas tareas citan rutas renombradas, para que apunten a las del contrato (Req: Conformidad con el contrato de interfaces del equipo)

## 7. Cierre

- [ ] 7.1 `npm run lint`, `npm test`, `npm run openapi:check`, `npm run build:web` y `openspec validate --all --strict` en verde
- [ ] 7.2 Verificar en contenedores (`npm run dev`, `npm run migrate`, `npm run seed`) que la fase 1 responde contra PostgreSQL real — requiere Docker
- [ ] 7.3 Sección del manual de usuario si alguna pantalla cambia de ruta, y `openspec archive alinear-api-endpoints-v1` tras aprobar el PR
