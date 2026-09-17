## 1. Infraestructura común de la API

- [x] 1.1 Crear `app/api/errors.py` (`ErrorResponse`, `NotImplementedResponse`, mapeo de `DomainError`, validación de petición e `IntegrityError` a HTTP) y registrarlo en `create_app`; verificar con `tests/api/test_api_contract.py` (errores de validación y ruta inexistente) y `tests/api/test_api_collections_vocabularies.py` (sigla duplicada) (Req: Contrato OpenAPI versionado, exportable y con cliente tipado — escenarios "Error de negocio" y "Recurso inexistente o eliminado"; RNF-009)
- [x] 1.2 Crear `app/api/stubs.py` (`stub(change)`, `NotImplementedEndpoint`) y `app/api/pagination.py` (`Page[T]`); verificar con prueba que recorre OpenAPI: toda operación `/api/v1` tiene `x-status` y cada stub responde 501 con su change (Req: Contrato OpenAPI… — escenario "Operación stub"; RNF-009)
- [x] 1.3 Crear `app/api/deps.py` (sesión por petición, `get_current_user` con `X-MATP-User`, `require_permission`, sesión de escritura con `AuditContext`) y permitir inyectar `engine` en `create_app`; verificar con `tests/api/test_api_identity.py` petición anónima, usuario no sintético o inactivo, producción y permiso insuficiente (Req: Identidad provisional de desarrollo sin exposición pública; RF-042, RNF-012)

## 2. Esquemas y routers de todos los módulos

- [x] 2.1 Esquemas Pydantic con ejemplos por capacidad (`app/modules/*/schemas.py`) para piezas, identificadores, multimedia, ubicaciones/movimientos, colecciones/vocabularios, importación, calidad, búsqueda/reportes, IA, usuarios/roles y auditoría (RF-006, RF-013, RF-016, RF-021..RF-030, RF-033..RF-036, RF-039, RF-040, RF-044, RIA-01..05)
- [x] 2.2 Implementar colecciones (listar, detalle, crear, editar con movimiento sin ciclos, eliminación lógica con motivo y rechazo si tiene piezas) y vocabularios/términos (listar, crear, editar, desactivar, eliminación lógica rechazada si el término está en uso); verificar con `tests/api/test_api_collections_vocabularies.py` (Req: Colecciones y subcolecciones jerárquicas; Req: Vocabularios y tipos de identificador parametrizables; RF-010, RF-011, RF-012, RN-005, RN-010)
- [x] 2.3 Implementar lectura de piezas con filtros AND y paginación, ficha con enmascarado de campos sensibles, identificadores con historial, fotos (metadatos), movimientos, datos de origen, búsqueda básica y vista previa del normalizador; verificar con `tests/api/test_api_pieces_search.py` usando el seed sintético (Req: Búsqueda por cualquier código y atributo; Req: Filtros combinados; Req: Identidad provisional… — escenario "Campos sensibles enmascarados"; RF-031, RF-032, RF-041, RF-023)
- [x] 2.4 Implementar lectura de tipos de identificador, ubicaciones (con enmascarado de ubicación exacta), roles/permisos, `/auth/me`, sugerencias de IA y auditoría con filtros; verificar en `tests/api/test_api_reads.py` (RF-016, RF-039, RF-040, RN-009)
- [x] 2.5 Declarar como stubs (con `x-change` y ejemplo) las operaciones restantes de piezas, identificadores, multimedia, movimientos, ubicaciones, importación, plantillas, calidad, búsqueda, reportes, exportación, IA, autenticación, usuarios, roles y auditoría según la tabla D2 del design; verificar con la prueba de 1.2 (RNF-009)

## 3. Contrato exportado y cliente tipado

- [x] 3.1 Crear `app/openapi_export.py` en API y servicio IA (`--check`), scripts `npm run openapi` y `npm run openapi:check`, y exportar `docs/api/openapi.json` y `docs/api/ai-openapi.json`; verificar con `apps/api/tests/api/test_api_contract.py` y `services/ai/tests/test_ai_endpoints.py` (Req: Contrato OpenAPI… — escenarios "Exportación reproducible" y "Contrato desactualizado"; RNF-009)
- [x] 3.2 Instalar `openapi-typescript` y `openapi-fetch` (versiones estables vigentes), script `npm run openapi:client`, generar `apps/web/src/lib/api/schema.d.ts` y `client.ts`; verificar con `src/lib/api/client.test.ts` (cabecera de identidad, error uniforme, tipos) y `npm run lint:web` (RNF-009, RNF-004)
- [x] 3.3 Escribir `docs/api/README.md` (cómo consultar, regenerar, marcar stubs y reemplazarlos) y registrar ADR-005 (identidad provisional y convenciones de API); actualizar CLAUDE.md, README y CI (RNF-004)

## 4. Servicio de IA

- [x] 4.1 Crear `app/providers/` (`AIProvider`, `MockProvider` determinista, `LLMProvider` stub, fábrica por `AI_PROVIDER`) y endpoints `/v1/extract-structured`, `/v1/suggest-terms`, `/v1/describe`; verificar con `tests/test_providers.py` y `tests/test_ai_endpoints.py`: determinismo, texto sin datos, entrada vacía 422, proveedor llm 503 (Req: Contrato del proveedor de IA; Req: Proveedor de IA desacoplado con modo simulado; RIA-01, RIA-03, RIA-04, RN-009)

## 5. Verificación y cierre

- [x] 5.1 Ejecutar `npm run lint`, `npm test`, `npm run openapi:check` y `openspec validate --all --strict` en verde
- [x] 5.2 Smoke test sin contenedores: API con SQLite + seed, `GET /api/v1/pieces` con `X-MATP-User` y `/docs` accesible
- [ ] 5.3 Ejecutar la API en compose contra PostgreSQL con el seed y repetir el smoke test de 5.2 (requiere Docker) — **PENDIENTE (2026-09-17)**: daemon de Docker no disponible en la máquina del arranque
- [x] 5.4 Registrar supuestos y preguntas nuevas en `docs/preguntas-contraparte.md` y actualizar `docs/estado-arranque.md`
