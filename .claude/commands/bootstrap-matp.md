---
description: Ejecuta de forma desatendida todas las fases del arranque MATP (docs/PROMPT_BASE.md) usando subagentes, con verificación y commit por fase.
argument-hint: "[fase inicial opcional, ej. 3]"
---

# Orquestador desatendido — Arranque MATP

Eres el **orquestador**. El usuario está durmiendo: **nadie responderá preguntas**. No pidas confirmaciones; decide, documenta y continúa.

## Reglas del orquestador
- **No implementes tú mismo.** Delega cada bloque de fases a un subagente para que trabaje con contexto limpio. Tu contexto solo debe guardar los resúmenes.
- Ejecuta los bloques **en secuencia** (hay dependencias entre fases). Nunca en paralelo.
- Si se pasa un argumento (`$ARGUMENTS`), empieza desde el bloque que contenga esa fase y omite los anteriores.
- Nunca ejecutes `git push`, nunca borres ramas, nunca uses `sudo`.

## Preparación (una sola vez)
1. Verifica que existan `docs/PROMPT_BASE.md` y un repositorio git; si no hay repo, `git init` y crea la rama `chore/bootstrap`.
2. Crea `logs/` (debe estar en `.gitignore`) y `docs/estado-arranque.md` si no existen.
3. Escribe en `logs/resumen.md` la hora de inicio.

## Bloques
| # | Fases | Subagente ejecutor |
|---|---|---|
| 1 | 0, 1 y 2 (OpenSpec, config, specs base) | `ejecutor-fase` |
| 2 | 3 y 4 (monorepo, modelo de datos) | `ejecutor-fase` |
| 3 | 5 (contratos API, servicio IA mock) | `ejecutor-fase` |
| 4 | 6 (maqueta navegable) | `ejecutor-fase-ligero` |
| 5 | 7 y 8 (backlog de changes, documentación) | `ejecutor-fase` |

## Ciclo por bloque
1. **Ejecutar**: invoca el subagente indicado con esta instrucción (reemplaza `<FASES>`):
   > Ejecuta SOLO las Fases <FASES> de docs/PROMPT_BASE.md. Lee primero CLAUDE.md y docs/estado-arranque.md si existen. Modo desatendido: si algo te bloquea, regístralo como pendiente o [SUPUESTO] en docs/estado-arranque.md y continúa. Al terminar, actualiza docs/estado-arranque.md y devuélveme un resumen de máximo 15 líneas: hecho, pendiente, bloqueos.
2. **Verificar**: invoca `verificador-fase` indicando las fases del bloque. Te devolverá `OK`, `PARCIAL` o `FALLO` con la lista de problemas.
3. **Reintento único**: si es `FALLO`, vuelve a invocar al ejecutor **una sola vez** pasándole la lista de problemas. Luego verifica otra vez. Si sigue fallando, regístralo y **continúa con el siguiente bloque** igualmente (salvo que el bloque 2 falle al crear el repo base de forma que los siguientes sean imposibles; en ese caso intenta que los bloques 3–5 avancen en lo que no dependa de Docker, como specs, OpenAPI a mano, maqueta en modo mock y documentación).
4. **Commit**: `git add -A && git commit -m "chore(bootstrap): fases <FASES> (auto)"`.
5. **Registrar** en `logs/resumen.md`: bloque, hora, resultado del verificador, resumen del ejecutor.

## Cierre
Al terminar los 5 bloques:
1. Ejecuta `openspec list` y `openspec validate --strict` y anota el resultado en `logs/resumen.md`.
2. Añade al inicio de `docs/estado-arranque.md` una sección **"Para leer al despertar"** con: estado por bloque (OK/PARCIAL/FALLO), qué verificar manualmente, supuestos más riesgosos y las 5 preguntas más urgentes para la contraparte.
3. Commit final `chore(bootstrap): cierre de arranque (auto)`.
