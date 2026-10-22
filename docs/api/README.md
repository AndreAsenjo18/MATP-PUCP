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
- Autenticación (ADR-009): sesión de servidor en la cookie `matp_session` (`HttpOnly`) que entrega `POST /auth/login`. Las escrituras con cookie exigen además la cabecera `X-CSRF-Token` (el valor de la cookie `matp_csrf`). La cabecera `X-MATP-User` (ADR-005) **solo existe con `APP_ENV=test`**; en desarrollo, demostración y producción responde `401 authentication_required`.
- Campos sensibles (RF-041, `[SUPUESTO]`): se devuelven en `null` y se listan en `masked_fields` cuando el rol no tiene el permiso `sensitive.*`.

## Implementado hoy

Colecciones (CRUD con eliminación lógica), vocabularios y términos (lectura, alta, edición, desactivación, eliminación lógica si no están en uso), tipos de identificador, ubicaciones (lectura), piezas (listado con filtros AND, ficha, identificadores, fotos, movimientos, datos de origen), búsqueda básica por cualquier código o denominación, vista previa del normalizador, `/auth/me`, roles y permisos, sugerencias de IA (lectura) y auditoría (lectura). El resto es stub; la tabla completa está en `openspec/changes/archive/2026-10-19-contratos-api-borrador/design.md` (D2).

## Autenticación en las pruebas (fixture `login_as`)

Desde el change `autenticacion-y-matriz-permisos` las pruebas de la API entran con una **sesión real**, la misma que tiene un navegador tras iniciar sesión, en lugar de la cabecera `X-MATP-User`. La cabecera sigue funcionando bajo `APP_ENV=test` (solo para probar la propia cabecera), pero **no la use en pruebas nuevas**.

```python
from tests.api.conftest import LoginAs, SeededApi

def test_viewer_cannot_create_collections(login_as: LoginAs) -> None:
    client = login_as("INTERNAL_VIEWER")            # código de rol (o un correo)
    assert client.post("/api/v1/collections", json={...}).status_code == 403
```

- `login_as(role_code)` devuelve un `TestClient` con la cookie de sesión y el token CSRF ya puestos (envía `X-CSRF-Token` en cada petición, como el cliente web). No pasa por Argon2: emite la sesión con el mismo código de producción (`issue_session`), así que expira, se revoca y autoriza igual.
- Códigos de rol del seed: `ADMIN`, `COLLECTIONS_MANAGER`, `CATALOGUER`, `CONSERVATION`, `STORAGE_STAFF`, `INTERNAL_VIEWER`. Si hay varios usuarios con el rol se toma el primero por correo.
- Dentro de un helper que ya recibe `seeded_api`: `seeded_api.login_as("ADMIN")`.
- Cada cliente tiene su propio almacén de cookies: para comparar dos roles en la misma prueba, pida un cliente por rol.
- Una prueba **anónima** necesita un cliente sin sesión: use `TestClient(app, base_url=...)` o el fixture `client` de la base compartida. Ojo: si sobrescribe `client` con uno autenticado, cree aparte uno anónimo (ver `test_duplicate_queue.py`).
- Con una aplicación propia (otra base o `api_settings(...)`): `login_client(app, engine, "CATALOGUER")`.
- Para probar el flujo de inicio de sesión (contraseña, bloqueo, cambio obligatorio) cree usuarios propios con `create_user(engine, correo, password=...)`: el contador de fallos y el bloqueo son estado, y la base sembrada se comparte entre todas las pruebas.
- Para escribir con un usuario del sistema desde una prueba (envejecer una sesión, desactivar un usuario): `seeded_api.system_session()`.

### Migrar una prueba existente

| Antes | Después |
|---|---|
| `H = as_user(CATALOGUER)` y `client.get(url, headers=H)` | `client = login_as("CATALOGUER")` y `client.get(url)` |
| `seeded_api.client.post(url, headers=as_user(VIEWER))` | `seeded_api.login_as("INTERNAL_VIEWER").post(url)` |
| `def test_x(client: TestClient)` con cabecera | `def test_x(login_as: LoginAs)` |
| fixture de módulo `client` con su propia app | `login_client(app, engine, rol)` dentro del fixture |
| prueba que espera `401` sin cabecera | cliente sin cookie (el fixture `client` compartido ya lo es) |

Equivalencias de correo a rol: `admin@` → `ADMIN`, `curadora@` → `COLLECTIONS_MANAGER`, `catalogador@` → `CATALOGUER`, `conservacion@` → `CONSERVATION`, `deposito@` → `STORAGE_STAFF`, `consulta@` → `INTERNAL_VIEWER` (`@matp.local`).

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
