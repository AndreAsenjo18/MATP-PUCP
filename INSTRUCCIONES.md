# Kit Claude Code — Arranque desatendido MATP

## Contenido
```
.claude/
  commands/bootstrap-matp.md     # /bootstrap-matp: orquestador de las 5 etapas
  agents/ejecutor-fase.md        # subagente Opus (specs, backend, backlog, docs)
  agents/ejecutor-fase-ligero.md # subagente Sonnet (maqueta)
  agents/verificador-fase.md     # subagente Sonnet de solo lectura (verifica cada bloque)
  settings.json                  # permisos para correr sin aprobaciones manuales
docs/PROMPT_BASE.md              # el prompt base completo
```

## Instalación (5 min)
1. Descomprime en la raíz del repo (respeta la carpeta `.claude/`).
2. Copia los .docx fuente a `docs/fuentes/` (opcional pero recomendado).
3. Añade `logs/` y `.env` a `.gitignore`.
4. Abre `claude` en la raíz y revisa que carguen: `/agents` (deben verse los 3) y `/` (debe aparecer `/bootstrap-matp`).
5. Pon un límite de gasto en la consola de Anthropic.

## Prueba corta (despierto)
```
/bootstrap-matp 0
```
Déjalo avanzar 5–10 minutos. Si pide permisos para algún comando que no esté en `settings.json`, agrégalo a `allow`. Luego interrumpe con Esc, o déjalo seguir.

## Dejarlo corriendo
- Laptop enchufada, Docker abierto, sin suspensión (`caffeinate -i claude` en macOS; `systemd-inhibit claude` en Linux; en Windows desactiva la suspensión).
- Modo de permisos: el `settings.json` evita la mayoría de prompts. Para cero interrupciones, dentro de un contenedor/VM aislado puedes lanzar `claude --dangerously-skip-permissions`. Si tu versión trae auto mode, también sirve (cámbialo con Shift+Tab).
- Ejecuta: `/bootstrap-matp`
- Para retomar desde un bloque concreto: `/bootstrap-matp 5` (empieza en el bloque que contiene la Fase 5).

## Al despertar
1. `docs/estado-arranque.md` → sección "Para leer al despertar".
2. `logs/resumen.md`, `git log --oneline`, `openspec list`.
3. `docker compose up` + `make seed` y recorre la maqueta.
4. Gasto en la consola o `/cost`.
