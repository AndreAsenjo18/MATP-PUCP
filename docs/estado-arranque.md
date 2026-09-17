# Para leer al despertar

> Arranque desatendido del 2026-09-17, de 03:00 a ~06:30. Rama `chore/bootstrap`, sin push.
> **El daemon de Docker no respondió en toda la noche**: no se ejecutó nada en contenedores. Todo lo demás se verificó en local.

## Estado por bloque
| Bloque | Fases | Verificador | Nota |
|---|---|---|---|
| 1 | 0, 1, 2 — OpenSpec, config, specs base | **OK** | 12 capacidades, 69 requisitos, 205 escenarios; `establecer-specs-base` archivado |
| 2 | 3, 4 — monorepo, modelo de datos | **OK**\* | Tests y lint en verde; migración probada en SQLite; sin archivar (Docker) |
| 3 | 5 — contratos API, IA mock | **OK**\* | 76 operaciones (28 implementadas, 48 stubs 501); OpenAPI y cliente tipado al día |
| 4 | 6 — maqueta navegable | **OK**\* | 11 pantallas en modo mock; `next start` responde 200 en todas |
| 5 | 7, 8 — backlog, documentación | **OK** | 15 changes propuestos (ninguno aplicado); ONBOARDING, ownership, ADR-007 a ADR-011 |

\* OK con pendientes documentados que dependen de Docker. Validación global: `openspec validate --all --strict` pasa 31 de 31; `npm test` pasa 280 tests (API 237, IA 20, web 23).

## Qué verificar manualmente
1. Arranca Docker Desktop y ejecuta `cp .env.example .env` y `npm run dev`. Comprueba que `/health` responde en la API y en la IA, y que la web carga.
2. Ejecuta `npm run migrate` contra PostgreSQL real. Revisa el índice parcial del código I, la extensión `pg_trgm` y los triggers de solo inserción de `audit_log`.
3. Ejecuta `npm run seed`: deben quedar 300 piezas y sus fotos en MinIO. Después prueba `GET /api/v1/pieces` con la cabecera `X-MATP-User`.
4. Si todo pasa, marca las tareas pendientes: 8.2 de `setup-monorepo-base`, 4.2 y 5.3 de `modelo-datos-nucleo` y 5.3 de `contratos-api-borrador`. Luego archiva en este orden: `setup-monorepo-base` → `modelo-datos-nucleo` → `contratos-api-borrador` → `maqueta-ui-navegable`.
5. Recorre la maqueta con `docs/maqueta/recorrido-demo.md` y revisa `git log --oneline` y `logs/resumen.md`.
6. Ratifica los ADR-000 a ADR-011 (todos están en estado «Propuesto») y `docs/ownership.md`.

## Supuestos más riesgosos
- **Fuente de requisitos**: no había `.docx` en `docs/fuentes/`. El catálogo y las specs se basan solo en el resumen de `PROMPT_BASE.md`.
- **Normalizador de códigos** (I, INC/RN y sus variantes): las reglas son [SUPUESTO], sin una muestra real. De él dependen la unicidad del código I y la detección de duplicados.
- **Identidad provisional con la cabecera `X-MATP-User`** (ADR-005): no es segura fuera de desarrollo, aunque ya se rechaza con `APP_ENV=production`. El change `autenticacion-y-matriz-permisos` debe eliminarla.
- **Campos sensibles y matriz de permisos** (`apps/api/app/modules/users/sensitive.py`): son supuestos.
- **Imágenes Docker sin probar**: puede que Python 3.14 no tenga wheels para Linux. MinIO dejó de publicar en Docker Hub, así que la imagen está fijada en quay.io; las alternativas son RustFS o Garage (ADR-003). `uv` no está instalado y se usa pip con venv.

## Las 5 preguntas más urgentes para la contraparte
1. (A1, G6) Muestra anonimizada de la sábana de la consultoría (cabeceras reales, 20–50 filas), su tamaño y qué otras fuentes hay.
2. (A2, A4, D1, D2) Formato exacto del código I y del código INC/RN: prefijos, ceros y separadores.
3. (A3, G7) Lista oficial de colecciones, con siglas, variantes históricas y cuáles están en comodato.
4. (B6, B7, E2) Campos sensibles y matriz de permisos por rol: quién aprueba cargas y quién ve los comodantes y la ubicación exacta.
5. (G14) Datos de la VM PUCP y política de respaldos, necesarios para el avance integrado S12.

El detalle completo está en `docs/preguntas-contraparte.md`.

---

# Estado del arranque MATP

## Entorno detectado (preparación, 2026-09-17 03:00)
- SO: Windows 11, shell Git Bash / PowerShell. Claude Desktop (Code), modo desatendido.
- `make`: **no disponible** → usar scripts de `package.json` o `scripts/*.ps1` en lugar de Makefile.
- node/npm: disponibles. `openspec` CLI: disponible (npm global).
- Docker: CLI instalada pero **el daemon no responde** (`docker info` falla) → todo lo que dependa de contenedores queda PENDIENTE.
- Git: repo inicializado en rama `chore/bootstrap`; `.gitattributes` fuerza LF (salvo `*.ps1` en CRLF); `core.autocrlf=false`.

## Decisiones / supuestos del orquestador
- [SUPUESTO] Sin `make`: comandos equivalentes en `package.json` y `scripts/*.ps1`.
- [SUPUESTO] Docker no disponible: se avanza en specs, código, OpenAPI y maqueta en modo mock; migraciones/seed/compose sin ejecutar.

## Registro por fase

### Fase 0 — Preparación y verificación (2026-09-17) — COMPLETADA con observaciones
- Herramientas: git 2.54.0 · node v24.14.0 / npm 11.14.1 · python 3.14.3 / pip 25.3 · Docker CLI 29.5.2 + Compose v5.1.3 (**daemon caído**) · `uv` **no instalado** · `pandoc` **no instalado** (no necesario: no hay `docs/fuentes/`) · `make` no disponible.
- OpenSpec actualizado con `npm install -g @fission-ai/openspec@latest` → **1.13.0** (antes 1.3.1). Nota: `npm view` reportó 1.13.1, pero el registro instaló 1.13.0; se usa la instalada.
- `openspec init --tools claude --language es --no-animation`: creó `openspec/specs/`, `openspec/changes/archive/`, `openspec/config.yaml` y en `.claude/` 6 skills + 6 comandos del perfil `core` (`/opsx:propose|explore|apply|archive|sync|update`). Workflows extra (new, continue, ff, bulk-archive, verify, onboard) no activados.
- Sintaxis verificada de la versión instalada: `openspec validate [item] --strict | --all | --specs`, `openspec list [--specs]`, `openspec show <item> [--type change|spec]`, `openspec archive <change> -y`, `openspec new change <nombre>`, `openspec status --change`, `openspec instructions <artefacto> --change`.
- Sin `docs/fuentes/`: se usa el resumen de `docs/PROMPT_BASE.md` §1 como fuente.
- ADR: `docs/adr/ADR-000-herramientas-y-comandos.md` (Propuesto): npm scripts + `scripts/*.ps1` en lugar de Makefile; pip+venv mientras no haya `uv`.

### Fase 1 — Configuración de OpenSpec y contexto persistente — COMPLETADA
- `openspec/config.yaml`: contexto del proyecto + reglas por artefacto del prompt base, conservando la directiva de idioma `es` generada por `init` (encabezados estructurales y SHALL/MUST en inglés). Añadida regla `[SUPUESTO]` en specs.
- `CLAUDE.md`: dominio, reglas de negocio, guardrails, stack, estructura objetivo, comandos (`npm run ...` previstos, marcados como pendientes hasta `setup-monorepo-base`), flujo OpenSpec, convenciones de ramas/commits/PRs.
- `docs/requisitos/catalogo.md`: tablas completas RF/RNF/RIA/RN con columna "Capacidad".
- ADR: `docs/adr/ADR-002-idioma.md` (Propuesto). ADR-001 queda reservado para la estructura del repo (Fase 3).

### Fase 2 — Specs base — COMPLETADA
- Change `establecer-specs-base` (proposal, design con Mermaid, 12 specs delta, tasks) validado con `--strict` y **archivado** como `openspec/changes/archive/2026-09-17-establecer-specs-base/`.
- `openspec/specs/`: 12 capacidades, **69 requirements, 205 escenarios**; `openspec validate --all --strict` → 12 passed, 0 failed. Cada `Purpose` indica "Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte".
- Cobertura verificada por script: 0 IDs faltantes (RF-001..044, RNF-001..015, RIA-01..05, RN-001..010). Todos los requirements incluyen escenario de error o caso límite.
- 36 marcas `[SUPUESTO]` en specs, consolidadas en `docs/preguntas-contraparte.md` (8 prioridad A, 12 B, 9 C).
- Decisiones de reparto: regla de alertas RF-019 en `calidad-datos` (ubicación solo define "sin ubicación"); RF-023 en `identificacion-piezas`; RIA-02 como puntaje auxiliar en `ia-asistiva` con cola en `calidad-datos`; RNF-010 asignado a `plataforma` (no estaba en la tabla del prompt base) [SUPUESTO].

### Fase 3 — Change `setup-monorepo-base` — IMPLEMENTADA, verificación con contenedores PENDIENTE (no archivado)
- Change propuesto (proposal, design con Mermaid, delta `plataforma` con 2 requirements ADDED, tasks) y aplicado: 15/16 tareas `[x]`; `openspec validate setup-monorepo-base --strict` OK.
- Monorepo: `apps/web` (create-next-app: Next 16.3.5, React 19.2.8, Tailwind 4, ESLint 9, TS 5; Vitest 5.0.1; `output: standalone`; sin Google Fonts), `apps/api` (FastAPI 0.141.1, config pydantic-settings con fallo temprano en español, `/health` 200/503 sin secretos, `/health/live`, S3 vía boto3), `services/ai` (FastAPI, `AI_PROVIDER=mock` por defecto, rechaza proveedores desconocidos), 11 paquetes por capacidad en `apps/api/app/modules/`.
- Comandos (sin Makefile, ADR-000): `package.json` raíz con npm workspaces y scripts `setup|dev|down|logs|ps|dev:api|dev:ai|dev:web|lint(:api|:ai|:web)|format|test(:api|:ai|:web)|build:web|migrate|seed|validate:specs`; `scripts/py.mjs` (runner multiplataforma del venv) y `scripts/setup.mjs`; envoltorios `scripts/setup.ps1`, `dev.ps1`, `test.ps1` (CRLF, ASCII).
- Python: **pip + venv** (no se instaló `uv`, ver ADR-003); Python 3.14 en local, CI e imágenes. Cliente de pruebas `httpx2` (Starlette depreca `httpx`).
- `docker-compose.yml` (db `postgres:18-alpine`, storage `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z.hotfix.7aa24e772`, api, ai, web con healthchecks), Dockerfiles, `.env.example` completo (test que verifica que toda variable de `Settings` está documentada), `.github/workflows/ci.yml` (jobs api, ai, web, openspec con `actions/*@v7` y OpenSpec 1.13.0).
- ADR-001 (estructura) y ADR-003 (herramientas/versiones/imágenes) en estado Propuesto. README raíz y tabla de comandos de CLAUDE.md actualizados.
- Verificado sin Docker: `npm install`, `npm run setup`, `npm run lint` (ruff + eslint + tsc) y `npm test` en verde; `npm run build:web` OK; `docker compose config` válido; smoke test local sin contenedores: api `/health/live` 200, `/health` 503 degradado con storage caído, ia `/health` 200 proveedor mock, página web mostrando ambos estados; arranque sin `DATABASE_URL` falla con mensaje claro.
- [SUPUESTO] MinIO retiró `minio/minio` de Docker Hub y la edición comunitaria no publica imágenes nuevas: se fija la última etiqueta de quay.io; contingencia RustFS/Garage (ADR-003).

### Fase 4 — Change `modelo-datos-nucleo` — IMPLEMENTADA, migración/seed contra PostgreSQL PENDIENTES (no archivado)
- Change propuesto (proposal, design con ER y secuencia en Mermaid, deltas `auditoria-trazabilidad` y `plataforma` con 1 requirement ADDED cada uno, tasks) y aplicado: 12/14 tareas `[x]`; validación estricta OK.
- 23 tablas (SQLAlchemy 2): piece, piece_identifier, identifier_type, collection, vocabulary, term, piece_material, piece_source_record, conservation_assessment, location, piece_movement, media_asset, import_mapping_template, import_batch, import_row, duplicate_candidate, ai_suggestion, app_user, role, permission, role_permission, user_role, audit_log. UUIDv7, enums VARCHAR+CHECK, JSONB.
- Reglas: índice único parcial del código I vigente; guardas `before_flush` (borrado físico prohibido, tablas de solo inserción, I bloqueado salvo corrección auditada por Administrador, comodato/préstamo temporal sin I, cambio de tenencia con I); auditoría campo a campo automática con `AuditContext` obligatorio; filtro global de eliminados; CHECK de RN-009 en `ai_suggestion`; triggers de solo inserción (PostgreSQL y SQLite).
- Normalizador `apps/api/app/modules/identification/normalization.py` (reglas N1–N7 [SUPUESTO]) con ~100 casos de prueba.
- Alembic: `0001_core_data_model` (+ `pg_trgm`, índices GIN de trigramas, triggers). Verificado: upgrade/downgrade en SQLite, `compare_metadata` sin diferencias, SQL de PostgreSQL generado offline con índice parcial/JSONB/triggers, UPDATE/DELETE directo de `audit_log` rechazado por trigger.
- Seed `python -m app.seed` (`npm run seed`): 300 piezas sintéticas (54 % sin I, 47 en comodato, 5 préstamos temporales, 33 sueltas, 202 ubicadas), 6 colecciones ficticias (MMZ, RA, RAB, MBB, AJB comodato, LRM), 433 fotos placeholder a S3, 10 pares de duplicados, lote de importación en previsualización, 3 sugerencias IA pendientes, corrección de I y 2 eliminaciones lógicas; ~20 000 filas de auditoría; determinista; se niega sobre catálogo con datos. Excel sintético `data/fixtures/sabana_sintetica_v1.xlsx` con imágenes incrustadas.
- Pruebas API: 194 en verde (normalizador, identificadores, auditoría/soft-delete, ficha/colecciones/ubicaciones, migraciones, seed); IA 4; web 4.
- Docs: `docs/modelo-datos.md` (ER + tablas generadas desde los modelos), ADR-004 (Propuesto), ADR-003 ampliado (pwdlib[argon2] 0.3.1, Pillow 12.3.0, openpyxl 3.1.5), supuestos D1–D7 en `docs/preguntas-contraparte.md`.

### Fase 5 — Change `contratos-api-borrador` — IMPLEMENTADO, verificación en compose PENDIENTE (no archivado)
- Change propuesto (proposal, design con Mermaid y tabla de rutas D2, deltas ADDED en `plataforma`, `usuarios-roles` e `ia-asistiva`, tasks) y aplicado: 15/16 tareas `[x]`; `openspec validate --all --strict` → 15 passed.
- API `/api/v1`: 57 rutas / 76 operaciones de todos los módulos (piezas, identificadores, multimedia, movimientos, colecciones, vocabularios, tipos de identificador, ubicaciones, importación, plantillas, calidad, búsqueda, reportes, exportación, IA, auth, usuarios, roles, auditoría) con esquemas Pydantic y ejemplos sintéticos.
  - **Implementadas (28)**: CRUD de colecciones (eliminación lógica, rechazo si no está vacía), vocabularios/términos (alta, edición, desactivación, eliminación lógica si no están en uso), tipos de identificador, ubicaciones, piezas (filtros AND, paginación, ficha con enmascarado RF-041), identificadores, fotos (metadatos), movimientos, datos de origen, búsqueda básica por cualquier código (normalizador N1–N7) o denominación, `/identifiers/normalize`, `/auth/me`, roles/permisos, sugerencias IA (lectura), auditoría (lectura).
  - **Stubs (48)**: 501 `not_implemented` + `x-status: stub` + `x-change` (change del backlog) + ejemplo validado contra el esquema.
- Errores uniformes `{code, message, details}` en español; `operationId` = nombre del handler.
- Identidad **provisional** `X-MATP-User` (usuario sintético activo), rechazada con `APP_ENV=production`; permisos de la matriz sembrada; ADR-005 (Propuesto).
- Contratos exportados sin Docker importando la app: `docs/api/openapi.json` y `docs/api/ai-openapi.json` (`npm run openapi`, `npm run openapi:check`); `docs/api/README.md`. CI verifica que estén actualizados.
- Cliente web: `openapi-typescript` 7.13.0 + `openapi-fetch` 0.17.0 (versiones consultadas en npm); `apps/web/src/lib/api/schema.d.ts` (con hash del contrato) y `client.ts` (`npm run openapi:client`). Nueva dependencia API: `python-multipart` 0.0.32 (instalada en el venv; `npm run setup` la instala en otros equipos).
- Servicio IA: `AIProvider` (`extract_structured`, `suggest_terms`, `describe`), `MockProvider` determinista, `LLMProvider` stub (503 `ai_provider_unavailable`), endpoints `/v1/extract-structured|suggest-terms|describe` con `status: PENDING_REVIEW` y `PieceContext` que rechaza campos sensibles.
- Verificado: `npm run lint` y `npm test` en verde (API 237, IA 20, web 8), `npm run build:web` OK, smoke test local con uvicorn + SQLite sembrada (401 anónimo, listado filtrado, búsqueda `mmz 15` por identificador, `/docs` 200, stub 501).
- Supuestos nuevos E1–E6 en `docs/preguntas-contraparte.md` (campos sensibles por rol, ubicación exacta, baja de términos y colecciones, integraciones, orden de medidas).
- [SUPUESTO] FastAPI 0.141 incluye routers de forma diferida (`app.routes` no expone `APIRoute`); las pruebas leen las rutas desde cada módulo `app/api/v1/*`.

### Fase 6 — Change `maqueta-ui-navegable` — IMPLEMENTADO (no archivado)
- Change propuesto (proposal, design con Mermaid y tabla de pantallas D2, delta ADDED en `plataforma`, tasks) y aplicado: 22/22 tareas `[x]`; `openspec validate --all --strict` → 16 passed (incluye este change).
- **Las 11 pantallas navegables en modo mock**, todas verificadas manualmente en el navegador (login → inicio → búsqueda → ficha → editor → importación → duplicados → sugerencias IA → reportes → administración → depósito móvil a 375 px): Login con selector de rol simulado (roles/permisos copiados de `apps/api/app/seed/reference.py`), Inicio/tablero (KPIs + pendientes), **Búsqueda** (filtros AND + código sucio), **Ficha de pieza** (7 pestañas, candado del código I, corrección auditada, enmascarado por rol), Editor de pieza (validación en tiempo real), **Asistente de importación** (6 pasos con diff/clasificación), **Cola de duplicados** (fusionar/marcar distinto), **Revisión de sugerencias IA** (aprobar/editar/rechazar), Reportes (4 tipos + exportación simulada), Administración (usuarios/roles/vocabularios/tipos de identificador/ubicaciones), Vista móvil de depósito (buscar, verificar, mover). Las 5 en **negrita** eran la prioridad si faltaba tiempo; se completaron todas.
- Datos sintéticos (`apps/web/src/lib/fixtures/`): 14 piezas tipadas contra `ApiSchemas` (mismo "caos de codificación" que `apps/api/app/seed`: códigos concatenados/sucios, sin I, comodato con I corregido por RN-003, préstamo temporal, conjunto/componente, código ilegible), 6 colecciones con las mismas siglas del seed real (MMZ, RA, RAB, MBB, AJB comodato, LRM), vocabularios/tipos de identificador/roles/permisos **copiados literalmente** de `apps/api/app/seed/reference.py`, fotos placeholder generadas como SVG `data:` URI (sin red), lote de importación, candidatos a duplicado, sugerencias de IA y bitácora de auditoría inicial.
- Estado de la demo: `SessionProvider` (sesión simulada en `localStorage`, leída con `useSyncExternalStore`) + `MockStoreProvider` (`useReducer` en memoria: aprobar/rechazar IA, fusionar/marcar distinto, decidir fila/lote, registrar movimiento, corregir código I, editar pieza — cada acción agrega una entrada de auditoría, nunca modifica ni borra el historial). Nada persiste entre recargas (documentado como decisión deliberada).
- `lib/data/masking.ts` reproduce en el cliente el enmascarado de campos sensibles de RF-041 (ubicación exacta, comodante, convenio de comodato) según el permiso del rol activo.
- **Modo `live` preparado pero no cableado a ninguna pantalla**: `lib/data/pieces.ts` (`fetchPieces`, `fetchPieceDetail`) tipa correctamente contra el contrato real (`tsc --noEmit` sin errores) para las únicas lecturas de piezas que `contratos-api-borrador` implementó de verdad; `app/busqueda` y `app/piezas/[id]` siguen leyendo `lib/fixtures` en este change. Conectarlas y probarlas contra PostgreSQL queda PENDIENTE (ver abajo). `NEXT_PUBLIC_API_MODE`/`NEXT_PUBLIC_API_URL` documentadas en `.env.example` y como build args de `apps/web/Dockerfile`/`docker-compose.yml` (no verificado: requiere Docker).
- `docs/maqueta/recorrido-demo.md`: guion de ~10 minutos con preguntas por pantalla, referenciando `docs/preguntas-contraparte.md` sin duplicarlas. Nuevos supuestos F1–F5 (flujo de importación masiva, fusión de duplicados, "posponer", alcance del editor, incidencias desde el depósito) en la sección F de ese archivo.
- ADR-006 (Propuesto): arquitectura de la maqueta (por qué no se usó TanStack Query/React Hook Form/Zod/shadcn todavía, `useReducer` en memoria en vez de Zustand/Redux, y la corrección de una carrera real de hidratación entre `useSyncExternalStore` y el efecto de redirección de `RequireSession`, que hacía que navegar directo a una pantalla protegida rebotara al login — corregida leyendo `localStorage` de forma directa y síncrona en el efecto).
- Pruebas nuevas: `lib/fixtures/pieces.test.ts` (7), `lib/data/masking.test.ts` (4), `lib/data/pieces.test.ts` (3, rama mock) — `npm run test:web` 23/23; `npm test` completo 237 (api) + 20 (ai) + 23 (web) = 280 en verde. `npm run lint` (api+ai+web) y `npm run build:web` en verde.
- Ajuste de UI hecho durante la verificación: la barra de navegación de `AppShell` pasó de `flex-wrap` a desplazamiento horizontal (`overflow-x-auto`) por debajo de `sm:`, porque con 8 enlaces ocupaba demasiado alto en la vista móvil de depósito (RNF-001).
- Smoke test sin contenedores: `next build` + `next start` local, `curl` 200 en las 11 rutas + `/estado`, recorrido manual completo con el navegador de Claude Code (incluida la vista móvil a 375 px); servidor detenido al terminar.
- [SUPUESTO] El buscador del modo mock (`lib/fixtures/index.ts`) es una aproximación simple (minúsculas + quitar puntos/espacios), no el normalizador real N1–N7 de la API; documentado en el propio código para no confundirlo con el contrato.

### Decisión de proceso (Fases 3–4)
- **Los changes `setup-monorepo-base` y `modelo-datos-nucleo` NO se archivaron**: cada uno conserva tareas de verificación con contenedores sin marcar (8.2; 4.2 y 5.3) y CLAUDE.md indica no archivar antes de la aprobación del PR. Archivar tras verificar con Docker: `openspec archive setup-monorepo-base -y && openspec archive modelo-datos-nucleo -y` (en ese orden; ambos añaden requirements a `plataforma`).

### Supuestos registrados en Fases 0–2
- [SUPUESTO] Catálogo basado en el resumen del prompt base, no en los `.docx` (no disponibles). Si difieren, manda el Expediente y se ajusta vía change `MODIFIED`.
- [SUPUESTO] Métrica RF-038: p95 ≤ 2 s con 20 000 piezas y 10 usuarios.
- [SUPUESTO] Formatos de códigos, marcadores de ausencia, vocabularios, niveles de ubicación, campos sensibles y matriz de permisos: ver `docs/preguntas-contraparte.md`.

### Pendientes / bloqueos tras Fases 0–6
- BLOQUEO (entorno): daemon de Docker no responde → PENDIENTE ejecutar y verificar: `cp .env.example .env && npm run dev` (5 servicios healthy, http://localhost:3000, `:8000/health`, `:8100/health`), `npm run migrate` (revisar en `psql` índice parcial, `pg_trgm` y triggers), `npm run seed` (fotos en MinIO), y luego marcar tareas 8.2 / 4.2 / 5.3 y archivar ambos changes.
- PENDIENTE: construir las imágenes Docker (no probado; posible ajuste si alguna dependencia no tiene wheel para Python 3.14 en Linux; contingencia 3.13).
- PENDIENTE: primer run de GitHub Actions (el workflow solo se validó como YAML).
- PENDIENTE (entorno, opcional): `uv` (decisión uv vs pip-tools y lockfile de Python en ADR-003), `pandoc` solo si llegan los `.docx`.
- PENDIENTE: commit de Fases 3–4 (lo realiza el orquestador; no se hicieron commits en esta ejecución).
- PENDIENTE: ratificación de ADR-000..ADR-004 por el Arquitecto; respuestas de la contraparte (secciones A–D de `docs/preguntas-contraparte.md`).
- Riesgo: supuestos de normalización (A2, A4, A8, D1–D3) y matriz de permisos (B7) sin validar; las pruebas los fijan explícitamente para que un cambio sea visible.
- PENDIENTE (Docker): tarea 5.3 de `contratos-api-borrador` (API en compose contra PostgreSQL con seed; validar consultas `ilike`/`exists` y conteos paginados en PostgreSQL). No archivar hasta verificar y aprobar el PR; archivar después de los dos changes anteriores (los tres añaden requirements a `plataforma`).
- PENDIENTE: commit de Fase 5 (lo realiza el orquestador).
- Riesgo: la identidad provisional `X-MATP-User` debe eliminarse o limitarse a `APP_ENV=test` en `autenticacion-y-matriz-permisos` (ADR-005).
- PENDIENTE: commit de Fase 6 (lo realiza el orquestador).
- PENDIENTE (Docker): conectar `app/busqueda` y `app/piezas/[id]` a `lib/data/pieces.ts` (modo `live`) y probarlas contra `apps/api` con PostgreSQL real; hoy solo se verificó que el módulo tipa correctamente contra el contrato (`tsc`) y su rama mock (`lib/data/pieces.test.ts`). Verificar también el build de `apps/web/Dockerfile` con los nuevos build args `NEXT_PUBLIC_API_MODE`/`NEXT_PUBLIC_API_URL`.
- PENDIENTE: ratificación de ADR-006 por el Arquitecto; respuestas de la contraparte a las preguntas F1–F5 (`docs/preguntas-contraparte.md`) tras el recorrido de demostración (`docs/maqueta/recorrido-demo.md`).
- Riesgo (bajo): el manejo de estado de la maqueta (`useReducer` en memoria) no persiste entre recargas por diseño; si la contraparte pide que sí persista para poder repetir una demo sin re-hacer las decisiones, es un cambio de alcance a discutir, no una corrección de bug.
- Fases 7 y 8 ejecutadas el 2026-09-17 (ver secciones siguientes).

### Fase 7 — Backlog como changes de OpenSpec — COMPLETADA (solo propuestos, ninguno aplicado)
- 15 changes creados con `openspec new change` y artefactos escritos siguiendo `openspec instructions` (proposal, design con Mermaid, specs delta, tasks): `ficha-pieza-crud`, `colecciones-y-vocabularios-admin`, `fotografias-multiples-por-pieza`, `ubicacion-jerarquica-y-movimientos`, `importacion-pipeline-reconciliacion`, `plantillas-mapeo-y-normalizacion`, `deteccion-duplicados-y-cola-revision`, `alertas-y-reporte-incompletas`, `busqueda-avanzada-y-exportacion`, `reportes-inventario`, `autenticacion-y-matriz-permisos`, `auditoria-y-soft-delete-transversal`, `despliegue-vm-y-respaldos`, `ia-extraccion-texto-libre`, `ia-sugerencia-terminos`.
- Validación: `openspec validate <change> --strict` uno por uno y `openspec validate --all --strict` → **31 passed, 0 failed** (12 specs + 4 changes de arranque + 15 del backlog). `openspec list` muestra los 15 con 0/N tareas (228 tareas en total).
- Cada change modifica una capacidad principal; solo `ficha-pieza-crud` y `plantillas-mapeo-y-normalizacion` tocan además `identificacion-piezas` (declarado en el proposal). Specs delta **solo `ADDED`**, con nombres de requirement únicos por capacidad (verificado por script contra specs vigentes y entre changes) para poder archivarlos en cualquier orden.
- Cada proposal indica IDs, célula dueña, dependencias y qué queda fuera; cada design justifica dependencias nuevas con contingencia; cada requirement tiene escenario de error o caso límite; cada tarea referencia su requirement y su verificación. Todos los `tasks.md` terminan con: tests requeridos (incluida verificación en PostgreSQL con Docker), actualización de OpenAPI y cliente tipado, sección de `docs/manual-usuario/` y `openspec archive`.
- Los proposals se alinearon con los stubs reales del contrato (`x-change` de `docs/api/openapi.json`): las 48 operaciones stub tienen change responsable.
- Trazabilidad verificada por script: todos los IDs RF-001..044, RNF-001..015, RIA-01..05 y RN-001..010 aparecen en al menos un change del backlog. **Sin change implementador** (solo citados como fuera de alcance): RF-015 documentos asociados (*Could*), RF-018 préstamos y exposiciones (*Should*), RIA-02 puntaje semántico de IA, RIA-04 y RIA-05 (por validar) → changes futuros sugeridos `documentos-asociados`, `prestamos-y-exposiciones`, `ia-descripcion-preliminar`.
- `docs/ownership.md`: **propuesta a validar por el Líder y el Arquitecto** de 5 células (Catálogo, Importación, Consulta y control, Plataforma, IA) con líder, implementadores, revisor de specs y revisor de PR; tabla de changes con dependencias y orden sugerido; reglas de coordinación (deltas ADDED, migraciones, interfaces con dueño).
- Dependencias bloqueantes dentro del backlog: `ia-sugerencia-terminos` → `ia-extraccion-texto-libre`; la tarea de reversión de `importacion-pipeline-reconciliacion` → `auditoria-y-soft-delete-transversal`. Las demás son interfaces con implementación provisional (ADR-010).
- Coherencia con el código y supuestos previos revisada al proponer: ubicaciones respetan D4 (una caja no cuelga de un espacio); se usan los nombres reales (`AuditOrigin.AI`, `NormalizationStatus.UNPARSEABLE`, tipos de identificador `I`/`COLECCION`, `DuplicateStatus.POSTPONED` ya existente, sin relación de técnicas por pieza).
- [SUPUESTO] Modo desatendido sin commits: los hace el orquestador.

### Fase 8 — Documentación de cierre — COMPLETADA
- `docs/ONBOARDING.md`: setup en 5 comandos con scripts reales (`cp .env.example .env`, `npm install`, `npm run setup`, `npm run dev`, `npm run migrate && npm run seed`), alternativa sin Docker, OpenSpec en 1 minuto, flujo diario, cómo proponer y manejar cambios de alcance, reglas de negocio y el prompt corto de la sección 5 **adaptado** (`npm run lint`, `npm test` y `openspec validate <CHANGE> --strict` en lugar de `make test`).
- ADRs nuevos (todos **Propuesto**): ADR-007 almacenamiento S3-compatible y URL prefirmadas; ADR-008 IA desacoplada con proveedor simulado y aprobación humana; ADR-009 autenticación con sesiones opacas y CSRF; ADR-010 organización del backlog paralelo; ADR-011 despliegue con Caddy, restic y systemd (**sin versiones fijadas**: se consultan al implementar). Con ADR-000..006 quedan cubiertas estructura, librerías, auth, storage, IA mock e idioma.
- `docs/preguntas-contraparte.md`: sección G con 15 supuestos nuevos del backlog (G1–G15) y lista de **las 5 preguntas más urgentes**.
- `README.md`: visión, diagrama Mermaid de contenedores, enlaces a ONBOARDING, ownership, ADR-006..011, estado y backlog. `CLAUDE.md`: sección de backlog por célula.
- `docs/manual-usuario/README.md`: índice de las secciones que escribe cada change y convenciones de redacción (las secciones se crean al aplicar cada change).
- Verificado: `openspec validate --all --strict` 31/31; sin `make` como comando en la documentación nueva. No se modificó código, por lo que no se re-ejecutaron `npm test`/`npm run lint` (último resultado verde: Fase 6).

## Definición de terminado (sección 4 del prompt base) — estado al cierre
- [x] `openspec list` muestra los changes del backlog; `openspec validate --all --strict` pasa en todo (31/31).
- [x] `openspec/specs/` con las 12 capacidades y todos los IDs Must cubiertos.
- [ ] Compose + seed navegable con datos sintéticos — **BLOQUEADO por entorno** (daemon de Docker no responde). Equivalente con scripts: `npm run dev`, `npm run migrate`, `npm run seed` (no hay `make seed`).
- [x] Tests del normalizador y reglas de dominio en verde (Fases 4–6: 237 api + 20 ai + 23 web).
- [x] Maqueta con las 11 pantallas navegable en modo mock.
- [x] `docs/api/openapi.json` generado.
- [x] CI configurado (primer run en GitHub pendiente).
- [x] ONBOARDING, ADRs, preguntas a contraparte, ownership y estado de arranque escritos.
- [ ] Todo commiteado en `chore/bootstrap` — lo realiza el orquestador (Fases 7–8 sin commit en esta ejecución).

## Pendientes, bloqueos y riesgos consolidados (al cierre de Fase 8)
- **BLOQUEO (entorno)**: daemon de Docker no disponible. Pendiente con Docker: `cp .env.example .env && npm run dev` (5 servicios healthy), `npm run migrate`, `npm run seed`; tareas 8.2 (`setup-monorepo-base`), 4.2 y 5.3 (`modelo-datos-nucleo`), 5.3 (`contratos-api-borrador`); conexión `live` de búsqueda y ficha; build de imágenes. Luego, tras aprobar el PR, archivar en orden: `openspec archive setup-monorepo-base -y`, `openspec archive modelo-datos-nucleo -y`, `openspec archive contratos-api-borrador -y`, `openspec archive maqueta-ui-navegable -y`.
- **PENDIENTE**: commit de Fases 7 y 8 (orquestador) y PR de `chore/bootstrap`.
- **PENDIENTE (decisión humana)**: ratificar ADR-000..011; validar `docs/ownership.md` (Líder + Arquitecto); respuestas de la contraparte (A–G), empezando por las 5 urgentes.
- **PENDIENTE (externo)**: datos de la VM PUCP y destino de respaldos (G14) para `despliegue-vm-y-respaldos`.
- **Riesgos**: supuestos de normalización (A2, A4, A8, D1–D3) y de matriz de permisos (B7) sin validar; columnas reales de las sábanas (A1/G6) desconocidas, por lo que pesos/umbrales de duplicados y plantillas se calibrarán tarde; varios changes introducen trabajos en segundo plano (mitigado con un único `app/core/jobs.py`, ADR-010); rendimiento (RF-038) y SQL específico de PostgreSQL (`unaccent`, CTE recursivas, `FOR UPDATE`, `REPEATABLE READ`) solo verificables con Docker.

## Próximos pasos recomendados por célula
- **Plataforma** (Álvaro Vargas, Manuel Barrantes): 1) Docker operativo, cerrar verificaciones del arranque y archivar los 4 changes; 2) `auditoria-y-soft-delete-transversal` empezando por la prueba transversal (protege a todas las células); 3) `autenticacion-y-matriz-permisos` en paralelo; 4) pedir a la DTI los datos de la VM (G14) y luego `despliegue-vm-y-respaldos` antes de S12.
- **Catálogo** (Camilo Gomez, Yessica Ochante): `ficha-pieza-crud` y `colecciones-y-vocabularios-admin` en paralelo; después `fotografias-multiples-por-pieza`. Llevar a la contraparte A2, A3, A5, B1, B3 y G1.
- **Importación** (Franz Vilcapoma, Germán Asenjo): `plantillas-mapeo-y-normalizacion` (fijar primero `MappingSpec`) y `deteccion-duplicados-y-cola-revision` en paralelo; luego `importacion-pipeline-reconciliacion`. Priorizar conseguir la muestra A1/G6.
- **Consulta y control** (Josué Moreno, Mathias Medina, Sergio Huamán): `ubicacion-jerarquica-y-movimientos` y `alertas-y-reporte-incompletas` en paralelo; luego `busqueda-avanzada-y-exportacion` (dueña de `app/core/xlsx.py` y `export_job`) y por último `reportes-inventario`.
- **IA** (José Ávalos, Sergio Chumbimuni): `ia-extraccion-texto-libre` (flujo genérico de aprobación) y después `ia-sugerencia-terminos`; mantener `AI_PROVIDER=mock` hasta resolver B12/G15.
- **Líder y Arquitecto**: validar ownership y ADRs en la primera planificación; usar `docs/maqueta/recorrido-demo.md` en la reunión con la contraparte y registrar respuestas en `docs/preguntas-contraparte.md`; decidir si se proponen `prestamos-y-exposiciones`, `documentos-asociados` e `ia-descripcion-preliminar`.
