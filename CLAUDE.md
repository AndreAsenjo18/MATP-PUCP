# CLAUDE.md — MATP · Sistema de Gestión y Digitalización de Colecciones Museográficas

Contexto persistente para cualquier sesión de Claude Code de cualquier integrante del Grupo 4 (1INF47, PUCP 2026-2).
Cliente: Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (MATP, Dirección de Cultura PUCP).
Fase 1 = **herramienta de control interno**. Nada público.

## Regla de oro

> **Antes de implementar, ejecuta `openspec list` y trabaja solo dentro del change asignado.**
> Ningún código de funcionalidad sin un change de OpenSpec que lo respalde (spec primero).

## Dominio en 1 minuto (el "caos de codificación")

- >10 000 piezas registradas históricamente en libros, Word, Access y Excel ("sábanas" de la consultoría 2024/25) con criterios distintos.
- Cada pieza tiene un **ID interno (UUID)**; los códigos del museo son **identificadores externos 1:N** (tipo, valor original, valor normalizado, vigencia, fuente). Ningún código externo es PK.
- **Código I (inventario general)**: columna vertebral; una vez asignado **no cambia** (está marcado físicamente). ~6 000 piezas **no tienen** I.
- **Código de colección**: correlativo con siglas (ilustrativas: `MMZ`, `RA`/`RAB`, `MBB`, `AJB`, `LRM`). Formatos sucios: `M.M.Z.`, `M M Z`, ceros a la izquierda, varios códigos concatenados en una celda.
- **INC / Ministerio de Cultura / RN** (formato cambió de 4 a 6 dígitos), **PUCP**, del propietario y otros históricos. **Todo código histórico se conserva.**
- **Comodato** (p. ej. AJB): número interno de colección pero **nunca I**; puede tener restricciones de fotografía/publicación.
- **Préstamo temporal**: no recibe código ni entra al inventario permanente.
- La **PUCP es la única propietaria legal**. Hay 11–12 colecciones y piezas sueltas.
- Piezas 3D: **varias fotos por pieza** con tipo de vista. Ubicación jerárquica (sede → espacio → mueble → nivel → contenedor).
- Archivo documental (Access) fuera del alcance principal, pero el modelo queda preparado.

## Reglas de negocio (no negociables)

| ID | Regla |
|---|---|
| RN-001 | Ningún código externo es PK |
| RN-002 | Código I inmutable (corrección solo por Administrador con procedimiento auditado) |
| RN-003 | Comodato nunca recibe código I |
| RN-004 | Préstamo temporal no entra al inventario permanente |
| RN-005 | **Nunca se borra información**: soft-delete + auditoría |
| RN-006 | PUCP única propietaria legal |
| RN-007 | Piezas inscritas no se venden ni desagregan de su colección |
| RN-008 | Restricciones contractuales en comodato |
| RN-009 | **Ninguna salida de IA se guarda sin aprobación humana** |
| RN-010 | Vocabularios y tipos de identificador parametrizables |

Además: importación de Excel = **pipeline de reconciliación** (ingesta → mapeo → normalización → validación/matching → previsualización con diff → aprobación → bitácora). IA desacoplada con `AI_PROVIDER=mock` por defecto.

Catálogo completo de IDs: `docs/requisitos/catalogo.md` (RF-001..044, RNF-001..015, RIA-01..05, RN-001..010).

## Guardrails para agentes

1. Spec primero; trazabilidad con IDs en cada requirement y en cada tarea.
2. **No inventes datos del museo.** Todo supuesto va como `[SUPUESTO]` y se registra en `docs/preguntas-contraparte.md`.
3. **Solo datos sintéticos** (Ley 29733, RNF-014). Los fixtures reproducen a propósito los problemas reales.
4. Consulta la versión estable vigente de cada dependencia al instalarla; no fijes versiones de memoria.
5. Decisiones no documentadas (librerías, estructura, auth) → ADR en `docs/adr/` con estado `Propuesto`.
6. Idioma: specs, UI y docs en **español**; código, identificadores y commits en **inglés** (ver ADR-002). En specs se mantienen en inglés los encabezados estructurales de OpenSpec y las palabras SHALL/MUST/WHEN/THEN.

## Stack (Alternativa 2, decidido)

Next.js + TypeScript (frontend) · FastAPI + Python (backend) · PostgreSQL · object storage S3-compatible (MinIO local / Cloudflare R2) · servicio de IA independiente · Docker Compose · GitHub Actions · GitHub Projects.
Despliegue en VM Linux PUCP; contingencia free tier (Vercel, Render, Neon, R2). Todo parametrizado por variables de entorno.

## Estructura del repo (ver ADR-001)

```
openspec/            specs (verdad actual) y changes (propuestas)
docs/                requisitos/, adr/, api/, maqueta/, ONBOARDING.md, estado-arranque.md,
                     preguntas-contraparte.md, ownership.md
apps/web/            Next.js (App Router)
apps/api/            FastAPI (app/core, app/modules/<capacidad>, alembic, tests)
services/ai/         servicio de IA (interfaz AIProvider + MockProvider)
data/fixtures/       Excel y fotos sintéticas
scripts/             scripts PowerShell equivalentes a los comandos
```

> Estructura creada por el change `setup-monorepo-base` (ver `docs/adr/ADR-001-estructura-repo.md`).

## Comandos

No hay `make` en el entorno de referencia (Windows). Los comandos se exponen como **scripts de `package.json` en la raíz** y, cuando haga falta, `scripts/*.ps1` (ver `docs/adr/ADR-000-herramientas-y-comandos.md`).

| Propósito | Comando | Estado |
|---|---|---|
| Preparar entornos Python (venv + pip) | `npm install` y `npm run setup` | disponible |
| Levantar entorno | `npm run dev` (= `docker compose up --build -d`) | disponible (requiere Docker) |
| Detener / logs | `npm run down` · `npm run logs` | disponible (requiere Docker) |
| Servicios sin contenedor | `npm run dev:api` · `npm run dev:ai` · `npm run dev:web` | disponible |
| Tests | `npm test` (`test:api`, `test:ai`, `test:web`) | disponible |
| Lint | `npm run lint` (`lint:api`, `lint:ai`, `lint:web`) | disponible |
| Migraciones | `npm run migrate` (= `docker compose exec api alembic upgrade head`) | disponible (requiere Docker) |
| Datos semilla | `npm run seed` (= `docker compose exec api python -m app.seed`) | disponible (requiere Docker) |
| Exportar OpenAPI (sin Docker) | `npm run openapi` · `npm run openapi:check` | disponible (`docs/api/`) |
| Regenerar cliente tipado web | `npm run openapi:client` | disponible |
| Ver changes | `openspec list` / `openspec list --specs` | disponible |
| Ver un change/spec | `openspec show <nombre>` | disponible |
| Validar | `openspec validate --all --strict` (= `npm run validate:specs`) | disponible |
| Archivar | `openspec archive <change> -y` | disponible |

PowerShell: `scripts/setup.ps1`, `scripts/dev.ps1 [-Down]`, `scripts/test.ps1`.

## Flujo OpenSpec obligatorio

1. `openspec list` → identificar el change asignado a tu célula (`docs/ownership.md`).
2. `openspec show <change>`; leer `proposal.md`, `design.md`, specs delta y `tasks.md`.
3. Rama `feat/<change-name>` desde la rama principal.
4. En Claude Code: `/opsx:explore` si hay dudas → `/opsx:apply <change>`, marcando cada tarea `- [x]` con su test.
5. `npm test` + `openspec validate --strict` en verde → PR.
6. Tras aprobación y merge: `/opsx:archive <change>` (o `openspec archive <change> -y`). **No archives antes de que el PR esté aprobado.**
7. Algo nuevo: `/opsx:propose <nombre>`; cambios de alcance se coordinan con el Líder de Proyecto.

## Convenciones

- **Ramas**: `feat/<change-name>`, `fix/<descripcion>`, `chore/<descripcion>`, `docs/<descripcion>`.
- **Commits**: Conventional Commits en inglés, pequeños, uno o varios por change (`feat(import): add row classification`). Scope = módulo/capacidad.
- **PRs**: título Conventional Commit; descripción con change de OpenSpec, IDs cubiertos, evidencia de tests; revisión de al menos un Integrador; CI verde (lint, tests, `openspec validate --strict`).
- **Soft-delete y auditoría** en la capa de servicio, nunca dependiendo de cada endpoint.
- **Nada de binarios en la BD**: archivos en object storage.
- Final de línea LF (forzado por `.gitattributes`, salvo `*.ps1`).
