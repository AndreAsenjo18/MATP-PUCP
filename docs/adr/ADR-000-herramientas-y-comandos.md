# ADR-000 — Herramientas de desarrollo y ejecución de comandos

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-17
- **Contexto de origen**: Fase 0 del arranque (`docs/PROMPT_BASE.md`)

## Contexto

El prompt base propone un `Makefile` (`make dev`, `make test`, `make lint`, `make seed`, `make openapi`, `make down`). El entorno de referencia del arranque es Windows 11 con Git Bash/PowerShell, donde `make` **no está disponible**; varios integrantes trabajan en Windows. Verificación de Fase 0:

| Herramienta | Resultado |
|---|---|
| git | 2.54.0 |
| node / npm | v24.14.0 / 11.14.1 |
| python / pip | 3.14.3 / 25.3 |
| uv | no disponible |
| docker / docker compose | CLI 29.5.2 / Compose v5.1.3; **daemon no responde** |
| pandoc | no disponible (no hay `.docx` que convertir) |
| OpenSpec CLI | actualizado a 1.13.0 (`@fission-ai/openspec@latest`) |
| make | no disponible |

## Decisión

1. Los comandos del proyecto se exponen como **scripts de `package.json` en la raíz** (`npm run dev|down|lint|seed|openapi`, `npm test`), invocables igual en Windows, macOS y Linux. Si un paso requiere lógica específica de Windows, se añade `scripts/<nombre>.ps1` (CRLF) y, si aplica, su par `scripts/<nombre>.sh`.
2. **No se crea Makefile** en la fase de arranque. Quien quiera `make` en Linux/macOS puede añadir uno que delegue en `npm run` sin duplicar lógica.
3. OpenSpec se usa con la **versión instalada** (1.13.0, perfil `core`: comandos `/opsx:propose`, `/opsx:explore`, `/opsx:apply`, `/opsx:archive`, `/opsx:sync`, `/opsx:update`) y `openspec init --tools claude --language es`.
4. Para Python se usa `pip` + `venv` mientras `uv` no esté instalado; la elección definitiva (uv vs pip) se decide en `setup-monorepo-base`.

## Alternativas consideradas

- **Makefile + instalar make (choco/scoop)**: añade una dependencia más para Windows; descartada para no bloquear a integrantes.
- **just / task (go-task)**: multiplataforma, pero requiere instalar un binario adicional; posible evolución futura.
- **Solo scripts .ps1**: excluye a quien trabaje en Linux/macOS o en CI Linux.

## Consecuencias

- `CLAUDE.md` y `docs/ONBOARDING.md` documentan `npm run ...` en lugar de `make ...`.
- CI (GitHub Actions, Linux) invoca los mismos scripts de npm.
- Docker no operativo en la máquina del arranque: lo que dependa de contenedores queda pendiente (ver `docs/estado-arranque.md`).
