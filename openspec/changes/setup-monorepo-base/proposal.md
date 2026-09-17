## Why

Las 12 capacidades base ya están especificadas, pero no existe código ni un entorno común: sin un esqueleto de monorepo con servicios contenerizados, variables de entorno documentadas y CI, cada célula montaría su propio entorno y los changes del backlog no podrían integrarse ni verificarse de la misma forma. Este change crea la base técnica mínima, sin funcionalidad de negocio, sobre la que se implementarán `modelo-datos-nucleo`, `contratos-api-borrador` y la maqueta.

## What Changes

- Estructura de monorepo: `apps/web` (Next.js + TypeScript, App Router), `apps/api` (FastAPI, paquete por capacidad en `app/modules/`), `services/ai` (FastAPI independiente con proveedor simulado por defecto), `data/fixtures/`, `scripts/`.
- `docker-compose.yml` con los servicios `db` (PostgreSQL), `storage` (MinIO, API S3), `api`, `ai` y `web`, con healthchecks y todo parametrizado por variables de entorno.
- Endpoint `GET /health` en `api` y en `ai`; página inicial de `web` que muestra el estado de los servicios.
- Configuración tipada que **falla al arrancar** si falta una variable obligatoria, indicando cuál (RNF-002).
- `.env.example` que documenta todas las variables (BD, S3, JWT, `AI_PROVIDER`, URLs entre servicios).
- Comandos del proyecto como scripts de `package.json` en la raíz (`npm run setup|dev|down|logs|lint|test|migrate|seed`) y `scripts/*.ps1` de conveniencia; **sin Makefile** (ADR-000).
- Workflow de GitHub Actions `ci.yml`: lint y tests de backend, servicio de IA y frontend, y `openspec validate --all --strict` en cada PR.
- ADR-001 (estructura del repo) y ADR-003 (herramientas y librerías base: pip+venv, ruff, pytest, MinIO/alternativas S3, versiones de imágenes).
- `README.md` raíz con instalación rápida.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añade el requirement "Entorno local reproducible con verificación de salud" (RNF-002, RNF-004, RNF-008) y el requirement "Integración continua obligatoria" (RNF-004, RNF-009), que concretan cómo se levanta, verifica y valida el sistema.

## Impact

- **IDs cubiertos**: RNF-002, RNF-004, RNF-008 (base), RNF-009 (solo infraestructura de documentación de API vía FastAPI), RN-009 (solo por defecto `AI_PROVIDER=mock`).
- **Célula dueña**: Implantadores (Álvaro Vargas, Manuel Barrantes) con Integradores (Josué Moreno, José Ávalos) para CI; ratifica el Arquitecto de Software.
- **Depende de**: `establecer-specs-base` (archivado). **Habilita**: `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable`.
- **Afecta**: raíz del repo (`package.json`, `docker-compose.yml`, `.env.example`, `.github/`), nuevos directorios `apps/`, `services/`, `data/`, `scripts/`, `docs/adr/`.
- **Dependencias nuevas**: Next.js, React, Tailwind CSS, Vitest (web); FastAPI, Uvicorn, Pydantic Settings, pytest, ruff, httpx (api/ai); imágenes `postgres`, MinIO (`quay.io/minio/minio`), `python`, `node`. Versiones consultadas al instalar (ver ADR-003).
- **Fuera de este change**: modelo de datos y migraciones (`modelo-datos-nucleo`), seed de datos, routers de negocio y exportación de OpenAPI (`contratos-api-borrador`), autenticación JWT real (solo variables previstas), interfaz `AIProvider` completa, shadcn/ui, TanStack Query y maqueta de pantallas, despliegue en VM PUCP o free tier, respaldos.
- **Riesgo de entorno**: en la máquina del arranque el daemon de Docker no responde; la verificación de `docker compose up` queda pendiente y se valida lo posible sin contenedores.
