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

### Supuestos registrados en Fases 0–2
- [SUPUESTO] Catálogo basado en el resumen del prompt base, no en los `.docx` (no disponibles). Si difieren, manda el Expediente y se ajusta vía change `MODIFIED`.
- [SUPUESTO] Métrica RF-038: p95 ≤ 2 s con 20 000 piezas y 10 usuarios.
- [SUPUESTO] Formatos de códigos, marcadores de ausencia, vocabularios, niveles de ubicación, campos sensibles y matriz de permisos: ver `docs/preguntas-contraparte.md`.

### Pendientes / bloqueos tras Fases 0–2
- BLOQUEO (entorno): daemon de Docker no responde → afecta Fases 3–4 (compose, migraciones, seed).
- PENDIENTE (entorno): instalar `uv` (opcional) y `pandoc` (solo si llegan los `.docx`).
- PENDIENTE: commit de Fases 0–2 (lo realiza el orquestador; no se hicieron commits en esta ejecución).
- PENDIENTE: ratificación de ADR-000 y ADR-002 por el Arquitecto; respuestas de la contraparte a `docs/preguntas-contraparte.md`.
- Siguiente: Fase 3 (`setup-monorepo-base`).
