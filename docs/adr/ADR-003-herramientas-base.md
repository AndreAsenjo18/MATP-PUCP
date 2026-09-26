# ADR-003 — Herramientas, librerías base e imágenes de contenedor

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-17
- **Change de origen**: `setup-monorepo-base` (ampliado en `modelo-datos-nucleo`: pwdlib, Pillow, openpyxl; ver ADR-004)

## Contexto

El guardrail 7 exige consultar la versión estable vigente de cada dependencia al instalarla. Versiones consultadas el 2026-09-17 con `npm view`, `pip index versions`, la API de Docker Hub/quay.io y la API de releases de GitHub. En el entorno de arranque hay Python 3.14.3 y Node 24; `uv` no está instalado y el daemon de Docker no responde.

## Decisión

### Python (api, ai)

| Uso | Librería | Versión mínima declarada |
|---|---|---|
| Framework web | fastapi | 0.141.1 |
| Servidor ASGI | uvicorn[standard] | 0.53.0 |
| Validación / configuración | pydantic · pydantic-settings | 2.13.5 · 2.15.0 |
| ORM | sqlalchemy (2.0.x) | 2.0.54 |
| Driver PostgreSQL | psycopg[binary] | 3.3.5 |
| Migraciones | alembic | 1.20.0 |
| Cliente S3 | boto3 | 1.43.96 |
| Pruebas | pytest · httpx2 (cliente de `TestClient`; Starlette depreca `httpx`) | 9.1.1 · 2.13.0 |
| Lint y formato | ruff | 0.16.8 |
| Hash de contraseñas (seed; auth futura) | pwdlib[argon2] | 0.3.1 |
| Imágenes placeholder del seed | Pillow | 12.3.0 |
| Excel sintético / importación futura | openpyxl | 3.1.5 |
| Formularios multipart (subida de Excel en la API) | python-multipart | 0.0.32 |

- **Gestor**: `pip` + `venv` con `pyproject.toml` PEP 621 y extra `dev` (`pip install -e ".[dev]"`), orquestado por `npm run setup` (`scripts/setup.mjs`). `uv` sigue siendo compatible (`uv pip install -e ".[dev]"`) y puede adoptarse después. **No se instaló `uv`** en el arranque para no introducir una herramienta que el resto del equipo tendría que instalar; la decisión uv vs pip-tools (y el lockfile) queda para el Arquitecto.
- Versiones declaradas como `>=estable_vigente,<siguiente_mayor`.
- Python **3.14** en local, CI y contenedores (`requires-python >=3.13` como contingencia si alguna dependencia no publicara wheels).

### Frontend (apps/web)

- Generado con `create-next-app@latest` (Next.js 16.3.5, React 19.2.8, Tailwind CSS 4, ESLint 9, TypeScript 5). Se respetan las versiones que elige el generador aunque npm publique mayores más nuevas (TypeScript 7, ESLint 10, React 19.3): `eslint-config-next` y Next aún fijan esas líneas. Revisar al actualizar Next.
- Pruebas unitarias: **Vitest** 5.0.1. `@types/node` ^24 (Node 24 LTS).
- Sin fuentes de Google (`next/font/google`) para que el build no dependa de internet (RNF-008).
- Cliente tipado (change `contratos-api-borrador`, ADR-005): `openapi-typescript` 7.13.0 (dev) y `openapi-fetch` 0.17.0.
- shadcn/ui, TanStack Query y React Hook Form + Zod se añaden en changes posteriores.

### Imágenes de contenedor

| Servicio | Imagen | Nota |
|---|---|---|
| db | `postgres:18-alpine` | PostgreSQL 18 guarda datos en `/var/lib/postgresql` |
| storage | `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z.hotfix.7aa24e772` | MinIO retiró `minio/minio` de Docker Hub y la edición comunitaria no publica nuevas imágenes; es la última etiqueta activa en quay.io |
| api (incluye la IA asistiva; ADR-008) | `python:3.14-slim` | |
| web | `node:24-alpine` | Node 24 = LTS vigente (Node 26 aún no es LTS) |

**Contingencia S3**: `rustfs/rustfs` (Apache 2.0, 1.0.0 publicado 2026-09-16) o `dxflrs/garage` (v2.4.1), cambiando solo `docker-compose.yml`/variables; en la nube, Cloudflare R2. El código solo usa la API S3 con direccionamiento por ruta.

### CI

GitHub Actions con `actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7` (últimas releases) y `@fission-ai/openspec@1.13.0` fijado a la versión usada en el arranque.

## Alternativas consideradas

- **uv** como gestor único: más rápido y con lockfile, pero no instalado en el entorno de referencia.
- **Poetry**: lockfile maduro, pero formato propio y más fricción en Windows.
- **Jest** en lugar de Vitest: configuración más pesada con ESM/TypeScript.
- **Bitnami MinIO**: la imagen tampoco está disponible en Docker Hub.

## Consecuencias

- Sin lockfile de Python, dos instalaciones en fechas distintas pueden resolver versiones menores distintas; aceptable en la fase de arranque.
- Al actualizar dependencias se debe repetir la consulta y actualizar esta tabla.
