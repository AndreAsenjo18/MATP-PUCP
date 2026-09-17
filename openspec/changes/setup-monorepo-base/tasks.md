## 1. Estructura y decisiones

- [x] 1.1 Crear estructura de directorios (`apps/web`, `apps/api/app/{core,modules/*}`, `apps/api/{alembic,tests}`, `services/ai`, `data/fixtures`, `scripts`) y verificar su presencia con `ls` (Req: Entorno local reproducible con verificación de salud; RNF-004)
- [x] 1.2 Redactar `docs/adr/ADR-001-estructura-repo.md` y `docs/adr/ADR-003-herramientas-base.md` (estado Propuesto) y verificar que citan versiones consultadas (RNF-004)

## 2. Comandos multiplataforma

- [x] 2.1 Crear `package.json` raíz con workspaces y scripts `setup|dev|down|logs|lint|test|migrate|seed`, más `scripts/py.mjs` y `scripts/setup.mjs`; verificar que `npm run setup` crea los venv e instala dependencias (Req: Entorno local reproducible; RNF-002)
- [x] 2.2 Crear `scripts/dev.ps1`, `scripts/test.ps1` y `scripts/setup.ps1` como envoltorios de `npm run` y verificar su contenido (ADR-000)

## 3. API (FastAPI)

- [x] 3.1 Crear `apps/api/pyproject.toml` con dependencias base y configuración de ruff/pytest; verificar con `npm run lint:api` (RNF-004)
- [x] 3.2 Implementar `app/core/config.py` con fallo temprano por variable faltante y test que verifica el mensaje con la variable ausente (Req: Operación en free tier y portabilidad de despliegue; RNF-002)
- [x] 3.3 Implementar `app/core/db.py` y `app/core/storage.py` con comprobaciones de salud y creación opcional de bucket; verificar con tests usando dobles (RNF-002, RNF-008)
- [x] 3.4 Implementar `GET /health` y `GET /health/live` con tests para estado ok, degradado y ausencia de secretos (Req: Entorno local reproducible con verificación de salud)

## 4. Servicio de IA

- [x] 4.1 Crear `services/ai` con `pyproject.toml`, configuración `AI_PROVIDER` (mock por defecto, rechazo de valores desconocidos) y `GET /health`; verificar con tests (Req: Entorno local reproducible; RN-009)

## 5. Frontend

- [x] 5.1 Generar `apps/web` con `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/`) y verificar `npm run lint:web` (RNF-001)
- [x] 5.2 Implementar página inicial con estado de servicios y lógica de resumen probada con Vitest; verificar `npm run test:web` y `npm run build -w apps/web` (Req: Entorno local reproducible)

## 6. Contenedores y variables

- [x] 6.1 Crear `Dockerfile` de api, ai y web, `.dockerignore` y `docker-compose.yml` con healthchecks; verificar con `docker compose config` (Req: Entorno local reproducible; RNF-002)
- [x] 6.2 Crear `.env.example` con todas las variables documentadas y test que verifica que toda variable leída por `Settings` de api e ia aparece en `.env.example` (Req: Operación en free tier y portabilidad; RNF-002)

## 7. CI y documentación

- [x] 7.1 Crear `.github/workflows/ci.yml` con jobs api, ai, web y openspec; verificar sintaxis YAML con un parser (Req: Integración continua obligatoria)
- [x] 7.2 Crear `README.md` raíz con instalación rápida y actualizar la tabla de comandos de `CLAUDE.md`; verificar enlaces a ADR (RNF-004)

## 8. Verificación integrada

- [x] 8.1 Ejecutar `npm run lint`, `npm test` y `openspec validate --all --strict` en verde
- [ ] 8.2 Ejecutar `docker compose up` y comprobar `/health` de api e ia y carga de la web (PENDIENTE si el daemon de Docker no está disponible) — **PENDIENTE (2026-09-17)**: daemon de Docker no disponible en la máquina del arranque. Verificado sin contenedores: `docker compose config` válido; api, ai y web ejecutados localmente (`/health/live` 200, `/health` 503 degradado con storage caído, ia 200 con proveedor mock, página web mostrando ambos estados)
