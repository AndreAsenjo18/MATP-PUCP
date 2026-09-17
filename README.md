# MATP · Sistema de Gestión y Digitalización de Colecciones Museográficas

Herramienta **interna** (fase 1) para el Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (Dirección de Cultura, PUCP). Proyecto del Grupo 4, 1INF47, PUCP 2026-2.

- Contexto para personas y agentes: [`CLAUDE.md`](CLAUDE.md)
- Specs (fuente de verdad): `openspec/specs/` · changes en curso: `openspec list`
- Decisiones: [`docs/adr/`](docs/adr/) · estado del arranque: [`docs/estado-arranque.md`](docs/estado-arranque.md)

## Arquitectura

| Servicio | Tecnología | Puerto local |
|---|---|---|
| `web` | Next.js + TypeScript (`apps/web`) | 3000 |
| `api` | FastAPI + SQLAlchemy (`apps/api`) | 8000 |
| `ai` | FastAPI, proveedor `mock` por defecto (`services/ai`) | 8100 |
| `db` | PostgreSQL 18 | 5432 |
| `storage` | MinIO (API S3) | 9000 (consola 9001) |

Estructura y motivos: [ADR-001](docs/adr/ADR-001-estructura-repo.md). Herramientas y versiones: [ADR-003](docs/adr/ADR-003-herramientas-base.md). Modelo de datos: [docs/modelo-datos.md](docs/modelo-datos.md) y [ADR-004](docs/adr/ADR-004-modelo-datos-auditoria.md). Contratos de API: [docs/api/](docs/api/README.md) y [ADR-005](docs/adr/ADR-005-contratos-api-identidad-provisional.md).

## Requisitos

- Git, Node.js 24 LTS, Python 3.14 (3.13 también sirve), Docker Desktop / Docker Engine con Compose v2.
- No se necesita `make` (ver [ADR-000](docs/adr/ADR-000-herramientas-y-comandos.md)).

## Inicio rápido

```bash
cp .env.example .env        # revise los valores; nunca suba .env
npm install                 # dependencias del frontend (npm workspaces)
npm run setup               # crea .venv de apps/api y services/ai e instala dependencias
npm run dev                 # docker compose up --build -d
npm run migrate             # crea el esquema (Alembic)
npm run seed                # ~300 piezas sintéticas con fotos placeholder
```

Luego abra http://localhost:3000 (estado de servicios), http://localhost:8000/health y http://localhost:8000/docs.
En PowerShell existen equivalentes: `scripts/setup.ps1`, `scripts/dev.ps1`, `scripts/test.ps1`.

## Comandos

| Propósito | Comando |
|---|---|
| Preparar entornos Python | `npm run setup` |
| Levantar / detener / logs | `npm run dev` · `npm run down` · `npm run logs` |
| Desarrollo sin contenedores de app | `npm run dev:api` · `npm run dev:ai` · `npm run dev:web` (con `docker compose up -d db storage`; exporte las variables de `.env` cambiando los hosts `db`/`storage`/`ai` por `localhost`) |
| Lint (ruff, eslint, tsc) | `npm run lint` |
| Pruebas (pytest, vitest) | `npm test` |
| Formatear Python | `npm run format` |
| Migraciones / datos semilla | `npm run migrate` · `npm run seed` |
| Contratos OpenAPI y cliente tipado | `npm run openapi` · `npm run openapi:client` · `npm run openapi:check` |
| Validar specs | `npm run validate:specs` |

## Flujo de trabajo

Spec primero: `openspec list` → `/opsx:apply <change>` en la rama `feat/<change>` → `npm run lint && npm test && npm run validate:specs` → PR. Detalle en `CLAUDE.md`.

## Datos

Solo datos **sintéticos** (Ley 29733, RNF-014). Nada de datos reales del museo en el repositorio.
