## Why

Las células de Catálogo, Importación, Consulta y control, IA y la maqueta necesitan trabajar en paralelo sobre un contrato común y estable. Hoy la API solo expone `/health` y el servicio de IA no define su interfaz de proveedor: sin contratos OpenAPI borrador, cada célula inventaría rutas, esquemas y errores distintos, y la maqueta no podría tipar sus datos simulados. Este change fija el contrato de **todos** los módulos, implementa de verdad solo lo trivial y marca explícitamente el resto como stub (RNF-009).

## What Changes

- API REST versionada bajo `/api/v1` con routers para **todos** los módulos: piezas, identificadores, multimedia, movimientos, colecciones, vocabularios, tipos de identificador, ubicaciones, importaciones, plantillas de mapeo, calidad (incompletas, KPI, duplicados), búsqueda, reportes, exportaciones, sugerencias de IA, autenticación, usuarios, roles/permisos y auditoría.
- Esquemas Pydantic v2 completos con ejemplos en OpenAPI y formato de error uniforme en español (`code`, `message`, `details`).
- **Implementado de verdad** (lo trivial): listado/detalle/alta/edición/eliminación lógica/movimiento de colecciones; lectura de vocabularios y términos, alta/edición/eliminación lógica de términos; lectura de tipos de identificador y ubicaciones; lectura de piezas con filtros combinados AND y paginación, detalle, identificadores, fotos (metadatos) y movimientos; búsqueda básica por cualquier código o denominación; lectura de roles/permisos, sugerencias de IA y auditoría.
- **Stub** (resto): responde `501` con cuerpo `not_implemented`, el change del backlog responsable y un ejemplo de respuesta; la operación queda marcada en OpenAPI con `x-status: stub` y `x-change`.
- Identidad provisional de desarrollo (cabecera `X-MATP-User`) mientras llega `autenticacion-y-matriz-permisos`: toda ruta `/api/v1` exige identidad (RF-042), se rechaza en `APP_ENV=production`, y las rutas implementadas comprueban el permiso de la matriz sembrada y enmascaran campos sensibles (RF-041).
- Exportación reproducible de `docs/api/openapi.json` (API) y `docs/api/ai-openapi.json` (servicio IA) con `npm run openapi`, y prueba que falla si el archivo commiteado está desactualizado.
- Cliente TypeScript tipado para `apps/web` generado con `openapi-typescript` (`npm run openapi:client`) y envoltorio `openapi-fetch`.
- Servicio IA: interfaz `AIProvider` (`extract_structured`, `suggest_terms`, `describe`), `MockProvider` determinista y `LLMProvider` stub seleccionable por `AI_PROVIDER`; endpoints `/v1/extract-structured`, `/v1/suggest-terms`, `/v1/describe` que devuelven propuestas marcadas como pendientes de aprobación humana (RN-009).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añade el requirement "Contrato OpenAPI versionado, exportable y con cliente tipado" (RNF-009, RNF-004).
- `usuarios-roles`: se añade el requirement "Identidad provisional de desarrollo sin exposición pública" (RF-042, RF-041, RNF-012).
- `ia-asistiva`: se añade el requirement "Contrato del proveedor de IA" (RIA-01, RIA-03, RIA-04, RN-009, RNF-008).

## Impact

- **IDs cubiertos**: RNF-009 (principal), RNF-004, RNF-008; contrato de RF-006, RF-013, RF-014, RF-016, RF-017, RF-021..RF-030, RF-031..RF-036, RF-039..RF-042, RF-044, RIA-01..RIA-05, RN-001..RN-005, RN-009; implementación trivial de RF-010, RF-011, RF-012, RF-031 (básica), RF-032, RF-040 (lectura), RF-041 (enmascarado en lecturas implementadas), RN-010.
- **Célula dueña**: Backend núcleo / Arquitectura (Arquitecto de Software) con revisión de un Integrador por célula consumidora (Catálogo, Importación, Consulta y control, IA, maqueta).
- **Depende de**: `setup-monorepo-base`, `modelo-datos-nucleo`. **Habilita**: `maqueta-ui-navegable` (tipos y fixtures) y todos los changes del backlog, que reemplazan sus stubs por implementación.
- **Afecta**: `apps/api/app/api/`, `apps/api/app/core/` (errores HTTP, identidad provisional), `apps/api/app/modules/*/schemas.py` y routers, `apps/api/app/openapi_export.py`, `services/ai/app/providers/`, `services/ai/app/main.py`, `docs/api/`, `apps/web/src/lib/api/`, `package.json` (scripts `openapi`, `openapi:client`), CI, ADR-005.
- **Dependencias nuevas**: `openapi-typescript` (dev, generación de tipos) y `openapi-fetch` (cliente liviano en runtime); versiones estables consultadas al instalar. Contingencia: tipos generados sin cliente (fetch nativo) u `orval`.
- **Fuera de este change**: autenticación real (JWT, login, bloqueo) y administración de usuarios; escritura de piezas, identificadores, fotos y movimientos; pipeline de importación; detección de duplicados y cálculo de alertas/KPI; reportes y exportaciones Excel/CSV; solicitud real de sugerencias de IA desde la API, su aprobación y aplicación al catálogo; URL prefirmadas; búsqueda por similitud y rendimiento (RF-038); préstamos y exposiciones (RF-018).
- **Riesgo de entorno**: sin daemon de Docker, el contrato se exporta importando la aplicación y las pruebas usan SQLite; la verificación contra PostgreSQL en compose queda pendiente.
