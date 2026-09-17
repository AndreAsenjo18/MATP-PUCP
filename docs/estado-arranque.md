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
