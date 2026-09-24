# Contratos de API (borrador)

Generados por el change `contratos-api-borrador` (ADR-005). **No se editan a mano.**

| Archivo | Servicio | Cómo verlo en vivo |
|---|---|---|
| [`openapi.json`](openapi.json) | API de colecciones (`apps/api`) | http://localhost:8000/docs |
| [`endpoints-api-v1.yaml`](../fuentes/endpoints-api-v1.yaml) | **Fuente de verdad de las interfaces**, entregada por el equipo (45 operaciones en 3 fases). Alineación en curso: [`mapeo-endpoints-v1.md`](mapeo-endpoints-v1.md), change `alinear-api-endpoints-v1` | — |
| [`ai-openapi.json`](ai-openapi.json) | IA asistiva (`services/ai`), montada dentro de la API en `/ai` (ADR-008); sus rutas efectivas son `/ai/v1/...` | http://localhost:8000/ai/docs |

## Convenciones

- Rutas de negocio bajo `/api/v1`. `/health` y `/health/live` no exponen datos del catálogo.
- Cada operación tiene `x-status`:
  - `implemented`: funciona contra la base de datos.
  - `stub`: responde **501** con `{code: "not_implemented", message, change, example}`; `x-change` indica el change de OpenSpec del backlog que la implementa y `example` es un cuerpo sintético válido que la maqueta puede usar.
- Errores: `{code, message, details}`; `code` estable (inglés), `message` en español.
- Paginación: `?page=1&page_size=20` (máx. 100) → `{items, total, page, page_size}`.
- Identidad **provisional** de desarrollo: cabecera `X-MATP-User: catalogador@matp.local` (usuarios sintéticos del seed: `admin@`, `curadora@`, `catalogador@`, `conservacion@`, `deposito@`, `consulta@matp.local`). Rechazada con `APP_ENV=production`.
- Campos sensibles (RF-041, `[SUPUESTO]`): se devuelven en `null` y se listan en `masked_fields` cuando el rol no tiene el permiso `sensitive.*`.

## Implementado hoy

Colecciones (CRUD con eliminación lógica), vocabularios y términos (lectura, alta, edición, desactivación, eliminación lógica si no están en uso), tipos de identificador, ubicaciones (lectura), piezas (listado con filtros AND, ficha, identificadores, fotos, movimientos, datos de origen), búsqueda básica por cualquier código o denominación, vista previa del normalizador, `/auth/me`, roles y permisos, sugerencias de IA (lectura) y auditoría (lectura). El resto es stub; la tabla completa está en `openspec/changes/contratos-api-borrador/design.md` (D2).

## Regenerar

```bash
npm run openapi          # docs/api/openapi.json y docs/api/ai-openapi.json (sin Docker ni BD)
npm run openapi:client   # apps/web/src/lib/api/schema.d.ts
npm run openapi:check    # falla si los JSON están desactualizados
```

Las pruebas (`npm test`) también fallan si el contrato o el cliente tipado no se regeneraron.

## Reemplazar un stub (para las células)

1. En tu change, cambia `**stub(CHANGE_...)` por `**implemented()` en el router y escribe la lógica usando los servicios de dominio (nunca saltes `AuditContext`).
2. Mantén ruta, `operationId` y esquemas; añadir campos opcionales está permitido. Renombrar o quitar requiere un requirement `MODIFIED` y aviso a las células consumidoras.
3. `npm run openapi && npm run openapi:client`, pruebas y PR.

## Uso desde el frontend

```ts
import { createApiClient } from "@/lib/api/client";

const api = createApiClient({ baseUrl: "http://localhost:8000", devUser: "consulta@matp.local" });
const { data, error } = await api.GET("/api/v1/pieces", { params: { query: { q: "M.M.Z. 15" } } });
```
