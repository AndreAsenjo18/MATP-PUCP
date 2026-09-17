# ONBOARDING — Cómo empezar a trabajar en el MATP

Guía para cualquier integrante del Grupo 4 (1INF47, PUCP 2026-2) que se une al proyecto **Sistema de Gestión y Digitalización de Colecciones Museográficas** del Museo de Artes y Tradiciones Populares "Luis Repetto Málaga".

Lee antes: [`CLAUDE.md`](../CLAUDE.md) (dominio, reglas de negocio y convenciones) y [`docs/ownership.md`](ownership.md) (qué change le toca a tu célula).

> **No hay `make`.** Todos los comandos son scripts de `package.json` en la raíz (`npm run ...`) o scripts de PowerShell en `scripts/` (ver [ADR-000](adr/ADR-000-herramientas-y-comandos.md)).

---

## 1. Requisitos

- Git, **Node.js 24** (con npm), **Python 3.14** (3.13 también sirve).
- **Docker Desktop / Docker Engine con Compose v2** para levantar base de datos, almacenamiento y servicios.
- OpenSpec CLI: `npm install -g @fission-ai/openspec@latest` (el arranque usó 1.13.0; usa la sintaxis de tu versión instalada: `openspec --help`).
- Claude Code (opcional pero recomendado) con los comandos `/opsx:*` que ya vienen en `.claude/`.

## 2. Setup local en 5 comandos

Desde la raíz del repositorio clonado:

```bash
cp .env.example .env                 # 1. variables locales (nunca subas .env)
npm install                          # 2. dependencias del frontend (npm workspaces)
npm run setup                        # 3. entornos virtuales Python de apps/api y services/ai
npm run dev                          # 4. docker compose up --build -d (db, storage, api, ai, web)
npm run migrate && npm run seed      # 5. esquema (Alembic) + ~300 piezas sintéticas con fotos placeholder
```

Comprueba: http://localhost:3000 (web), http://localhost:8000/health y http://localhost:8000/docs (API), http://localhost:8100/health (IA simulada).

En PowerShell: `scripts/setup.ps1` (pasos 1–3), `scripts/dev.ps1` (paso 4; `-Down` para detener) y `scripts/test.ps1`.

### Sin Docker (lo que sí funciona)

El daemon de Docker no estaba disponible en la máquina del arranque, así que parte del sistema aún **no se ha verificado en contenedores** (ver [`estado-arranque.md`](estado-arranque.md)). Sin Docker puedes:

| Qué | Comando |
|---|---|
| Pruebas y lint (SQLite en memoria, sin servicios) | `npm test` · `npm run lint` |
| Maqueta navegable con datos simulados | `npm run dev:web` (con `NEXT_PUBLIC_API_MODE=mock`, valor por defecto) y abrir http://localhost:3000 |
| Exportar y verificar el contrato OpenAPI | `npm run openapi` · `npm run openapi:check` |
| Validar specs | `npm run validate:specs` |

Detener y ver logs con Docker: `npm run down` · `npm run logs` · `npm run ps`.

## 3. OpenSpec en 1 minuto

- **`openspec/specs/`** = la **verdad actual**: qué hace el sistema, por capacidad (12 capacidades, requirements con IDs RF/RNF/RIA/RN y escenarios WHEN/THEN).
- **`openspec/changes/`** = **propuestas** de cambio. Cada change tiene `proposal.md` (por qué y qué), `design.md` (cómo, con decisiones y diagramas), `specs/<capacidad>/spec.md` (deltas: requirements que se agregan) y `tasks.md` (checklist implementable).
- Al terminar y aprobar un change, se **archiva**: sus deltas se incorporan a `openspec/specs/` y el change pasa a `openspec/changes/archive/`.
- **Regla de oro**: ningún código de funcionalidad sin un change que lo respalde. Antes de implementar, `openspec list`.

Comandos útiles: `openspec list` · `openspec list --specs` · `openspec show <change>` · `openspec validate <change> --strict` · `openspec validate --all --strict` · `openspec archive <change> -y`.

## 4. Flujo diario

1. `git pull` en la rama principal y `openspec list`.
2. Toma el change asignado a tu célula en [`ownership.md`](ownership.md) y revisa sus dependencias (columna "Depende de").
3. Crea la rama: `git checkout -b feat/<change>`.
4. En Claude Code:
   - `/opsx:explore` si tienes dudas sobre el alcance o el diseño (no escribe código);
   - `/opsx:apply <change>` para implementar tarea por tarea, marcando `- [x]` cada una con su prueba.
5. Verifica en local: `npm run lint`, `npm test`, `npm run openapi:check` y `openspec validate <change> --strict`. Si tocaste la base de datos, verifica también con Docker (`npm run dev`, `npm run migrate`, `npm run seed`).
6. Abre el PR (título Conventional Commit, descripción con el change, IDs cubiertos y evidencia de pruebas). Revisa un Integrador; CI debe estar en verde.
7. **Tras el merge** (no antes): `/opsx:archive <change>` o `openspec archive <change> -y`, en un PR pequeño `chore(openspec): archive <change>`.

## 5. Proponer algo nuevo

- `/opsx:propose <nombre-en-kebab-case>` genera proposal, design, specs delta y tasks en un paso. Revísalos antes de aplicar.
- **Trazabilidad obligatoria**: todo requirement cita sus IDs (`RF-xxx`, `RNF-xxx`, `RIA-xx`, `RN-xxx`) de [`requisitos/catalogo.md`](requisitos/catalogo.md) e incluye al menos un escenario de error o caso límite; cada tarea de `tasks.md` referencia el requirement que cumple y cómo se verifica.
- **Nada de datos reales del museo**: lo que supongas sobre columnas, códigos, vocabularios o reglas va marcado `[SUPUESTO]` y se registra en [`preguntas-contraparte.md`](preguntas-contraparte.md).
- **Decisiones técnicas nuevas** (librerías, estructura, seguridad) → ADR en [`docs/adr/`](adr/) con estado `Propuesto`; las ratifica el Arquitecto.
- **Cambios de alcance** (algo que no está en el catálogo de requisitos o cambia una prioridad) se coordinan **primero con el Líder de Proyecto** antes de proponer el change.
- Prefiere deltas `ADDED`; si necesitas `MODIFIED` sobre una capacidad de otra célula, avisa a su líder (ver ADR-010).

## 6. Reglas que nunca se rompen

- **Código I inmutable**: solo se corrige con el procedimiento auditado del Administrador.
- **Comodato nunca recibe código I**; el préstamo temporal no entra al inventario permanente.
- **Nunca se borra información**: eliminación lógica con motivo + auditoría campo a campo (una prueba transversal lo vigila).
- **IA solo con aprobación humana**; proveedor simulado (`AI_PROVIDER=mock`) por defecto.
- **Solo datos sintéticos** en el repositorio y en las demos (Ley 29733).

## 7. Prompt corto recomendado para iniciar cualquier sesión de Claude Code

Reemplaza `<CHANGE>` y `<CÉLULA>`:

```text
Lee CLAUDE.md y docs/ONBOARDING.md. Ejecuta `openspec list` y `openspec show <CHANGE>`.
Trabaja SOLO en el change <CHANGE> (célula <CÉLULA>). Antes de codificar, revisa
proposal.md, design.md, specs delta y tasks.md; si detectas vacíos o contradicciones
con openspec/specs o con docs/requisitos/catalogo.md, dímelo antes de implementar.
Luego ejecuta /opsx:apply <CHANGE>, marcando cada tarea al completarla, con tests,
respetando las reglas de negocio (código I inmutable, comodato sin I, nunca borrar,
IA solo con aprobación humana). Al terminar: corre npm run lint, npm test y
openspec validate <CHANGE> --strict, resume los cambios y prepara el PR.
No archives hasta que el PR esté aprobado.
```

## 8. Dónde está cada cosa

| Necesito… | Ver |
|---|---|
| Reglas de dominio y comandos | [`CLAUDE.md`](../CLAUDE.md) |
| Arquitectura y enlaces | [`README.md`](../README.md) |
| Qué me toca | [`ownership.md`](ownership.md) |
| Requisitos y prioridades | [`requisitos/catalogo.md`](requisitos/catalogo.md) |
| Modelo de datos | [`modelo-datos.md`](modelo-datos.md) |
| Contrato de API | [`api/README.md`](api/README.md), `docs/api/openapi.json`, http://localhost:8000/docs |
| Decisiones técnicas | [`adr/`](adr/) |
| Dudas abiertas con el museo | [`preguntas-contraparte.md`](preguntas-contraparte.md) |
| Guion de demostración de la maqueta | [`maqueta/recorrido-demo.md`](maqueta/recorrido-demo.md) |
| Manual de usuario (se completa por change) | [`manual-usuario/`](manual-usuario/README.md) |
| Qué quedó hecho y pendiente del arranque | [`estado-arranque.md`](estado-arranque.md) |
