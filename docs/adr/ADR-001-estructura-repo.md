# ADR-001 — Estructura del repositorio (monorepo)

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software)
- **Fecha**: 2026-09-17
- **Change de origen**: `setup-monorepo-base`

## Contexto

Once integrantes trabajarán en paralelo sobre 12 capacidades especificadas en OpenSpec, con un frontend Next.js, una API FastAPI, un servicio de IA desacoplado, PostgreSQL y almacenamiento S3-compatible (decisiones del equipo, no se reabren). Se necesita una estructura que minimice conflictos entre células, comparta specs y CI, y funcione en Windows sin `make` (ADR-000).

## Decisión

Monorepo único con esta estructura:

```
/
├── CLAUDE.md · README.md · package.json (npm workspaces + comandos) · package-lock.json
├── docker-compose.yml · .env.example · .dockerignore
├── .github/workflows/ci.yml
├── openspec/                    specs (verdad actual) y changes
├── docs/                        adr/, requisitos/, api/, ONBOARDING.md, estado-arranque.md, ...
├── apps/
│   ├── web/                     Next.js (App Router) + TypeScript + Tailwind  → workspace npm
│   └── api/                     FastAPI
│       ├── app/core/            config, db, storage, health (transversal)
│       ├── app/modules/<cap>/   identification, catalog, collections, media, locations,
│       │                        imports, quality, search, users, audit, ai_suggestions
│       ├── alembic/ · tests/ · pyproject.toml · Dockerfile
├── services/ai/                 FastAPI independiente (proveedor mock por defecto)
├── data/fixtures/               datos sintéticos (Excel, fotos)
└── scripts/                     py.mjs, setup.mjs (multiplataforma) y *.ps1 (envoltorios)
```

- **Un paquete de Python por capacidad** en `app/modules/`, con nombres en inglés (ADR-002). Correspondencia con specs: `identification`↔`identificacion-piezas`, `catalog`↔`catalogo-piezas`, `collections`↔`colecciones-vocabularios`, `media`↔`multimedia`, `locations`↔`ubicacion-movimientos`, `imports`↔`importacion-datos`, `quality`↔`calidad-datos`, `search`↔`busqueda-reportes`, `users`↔`usuarios-roles`, `audit`↔`auditoria-trazabilidad`, `ai_suggestions`↔`ia-asistiva`. `plataforma` vive en `app/core/`, CI y compose.
- **npm workspaces** solo para `apps/web`; los proyectos Python tienen su `pyproject.toml` y `venv` propio. Los comandos se exponen en `package.json` raíz y llaman a `scripts/py.mjs` para Python.
- **Servicios independientes**: `api` y `ai` no comparten código; se comunican por HTTP.
- Contexto de build de `apps/web` = raíz del repo (necesita el `package-lock.json` de workspaces).

## Alternativas consideradas

- **Repositorios separados** por servicio: más aislamiento, pero duplica CI, specs y coordinación de versiones entre 11 personas en un curso de un semestre.
- **Turborepo/Nx**: caché y grafo de tareas útiles con muchos paquetes JS; aquí solo hay un proyecto JS, sobredimensionado.
- **Paquete común Python** (`packages/shared`) entre api y ai: acopla despliegues; se reevaluará si aparece código realmente compartido.
- **Módulos por capa técnica** (`models/`, `routers/`, `services/`): mezcla capacidades y multiplica conflictos entre células.

## Consecuencias

- Cada célula trabaja preferentemente en `app/modules/<su capacidad>` y en su spec.
- Cambios en `app/core/`, `docker-compose.yml`, `package.json` o CI requieren revisión de Integradores/Implantadores.
- `apps/web/AGENTS.md` (generado por `create-next-app`) se conserva: advierte a los agentes que lean la documentación de la versión instalada de Next.js.
