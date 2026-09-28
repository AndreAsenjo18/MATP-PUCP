# ADR-005 — Convenciones de la API REST, stubs explícitos e identidad provisional de desarrollo

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-17
- **Change de origen**: `contratos-api-borrador`

## Contexto

Diez integrantes implementarán en paralelo los módulos del backlog y la maqueta necesita tipar sus datos. RNF-009 exige una API documentada con OpenAPI que marque lo no implementado; RF-042 prohíbe cualquier acceso anónimo a datos del catálogo, pero la autenticación real llega en `autenticacion-y-matriz-permisos`. No hay Docker disponible en la máquina del arranque, por lo que el contrato debe poder exportarse sin base de datos.

## Decisión

1. **Versionado por prefijo** `/api/v1` para rutas de negocio; `/health` y `/health/live` en la raíz y sin datos.
2. **Contrato completo desde el día uno**: routers de todos los módulos con esquemas Pydantic y ejemplos sintéticos. Las operaciones no implementadas llevan `x-status: stub` y `x-change: <change>` en OpenAPI y responden **501** `{code: "not_implemented", message, change, example}`; las implementadas llevan `x-status: implemented`. Cada change del backlog reemplaza sus stubs sin renombrar rutas ni esquemas (añadir campos opcionales es compatible; renombrar/quitar exige change con `MODIFIED`).
3. **`operationId` = nombre de la función** del handler (únicos, verificados por prueba) para que el cliente generado sea estable.
4. **Errores uniformes** `{code, message, details}`: `code` estable en inglés, `message` en español. Mapeo: validación 422, no encontrado 404, permiso 403, regla de negocio 409, identidad 401, stub 501.
5. **Esquemas por capacidad** en `app/modules/<capacidad>/schemas.py`; routers delgados en `app/api/v1/` que delegan en servicios de dominio (auditoría y soft-delete siguen en la capa de servicio, ADR-004).
6. **Identidad provisional**: cabecera `X-MATP-User` con correo o UUID de un usuario **sintético y activo**; declarada como esquema de seguridad `DevUserHeader`; **rechazada con `APP_ENV=production`** (`production_auth_unavailable`). Las rutas comprueban permisos de la matriz sembrada (`require_permission`) y enmascaran campos sensibles (`masked_fields`) según la lista `[SUPUESTO]` de `app/modules/users/sensitive.py`.
7. **Contrato como artefacto commiteado**: `docs/api/openapi.json` y `docs/api/ai-openapi.json` se generan con `npm run openapi` importando la app con configuración ficticia (sin conexiones). Pruebas en API, IA y web fallan si el contrato o el cliente tipado están desactualizados.
8. **Cliente web**: tipos con `openapi-typescript` 7.13.0 (dev) y llamadas con `openapi-fetch` 0.17.0 (runtime liviano, sin generación de código). Versiones consultadas en npm el 2026-09-17. Nueva dependencia de API: `python-multipart` 0.0.32 (subida de Excel con `UploadFile`).

## Alternativas consideradas

- **Solo documentar rutas en Markdown**: sin tipos ni validación automática; descartada (RNF-009).
- **Stubs que devuelven 200 con datos falsos**: confundirían a la maqueta y a QA con funcionalidad inexistente; descartada.
- **Autenticación JWT mínima ya en este change**: invade `autenticacion-y-matriz-permisos` (bloqueo, expiración, SSO PUCP) y fijaría decisiones sin la célula de Plataforma.
- **Sin identidad hasta tener JWT**: viola RF-042 o impide probar la matriz de permisos y el enmascarado.
- **`orval` / `@hey-api/openapi-ts`**: generan mucho código y dependencias; contingencia si se necesitan hooks de TanStack Query generados.

## Consecuencias

- Las células trabajan contra rutas y tipos estables; la maqueta puede usar los ejemplos del contrato como fixtures.
- Todo cambio de esquema obliga a `npm run openapi && npm run openapi:client` (CI lo detecta).
- Riesgo: la cabecera de desarrollo usada fuera de desarrollo; mitigado por el rechazo en producción, la restricción a usuarios sintéticos y la prioridad del change de autenticación, que debe **eliminar** este mecanismo o limitarlo a `APP_ENV=test`.
- El contrato (~350 kB) crece con cada módulo; aceptable, y consultable en `/docs` de la API.
