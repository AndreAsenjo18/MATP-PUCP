## Why

El equipo mantiene GitHub Flow con una sola rama permanente (`main`), sin `develop`. Por eso lo que separa lo que se está probando de lo que usa el museo tiene que ser el **pipeline de despliegue**, no las ramas. Hoy no existe ese pipeline: `ci.yml` solo valida, `despliegue-vm-y-respaldos` publica imágenes únicamente al crear un tag y el entorno de integración de ADR-013 se levanta a mano en cada sesión. El plan de sprints necesita desplegar en el entorno de integración después de cada merge desde el sprint 1 (CD 1) y el sprint 2 (CD 2), y el MVP `v0.1.0` se congela al cierre del sprint 3. Hace falta fijar ya cómo llega el código a cada ambiente y qué impide que llegue a producción sin una decisión humana.

## What Changes

- **Dos ambientes con reglas de promoción distintas**:
  - **Pruebas**: el entorno de integración de ADR-013 (AWS Academy), solo con datos sintéticos. Recibe cada merge a `main` automáticamente, una vez que la integración continua de ese commit terminó en verde.
  - **Producción**: la VM PUCP. Solo recibe una versión etiquetada `vX.Y.Z`, y siempre por acción de una persona autorizada. Nunca se despliega en producción de forma automática.
- **Publicación de imágenes tras cada merge**: cuando el workflow de CI termina con éxito en un push a `main`, se construyen las imágenes de la API (incluye la IA asistiva, ADR-008) y de la web. Se publican en GitHub Container Registry con las etiquetas `sha-<commit>` y `main`. Si CI falla, no se publica nada.
- **Despliegue por *pull* en pruebas**: un temporizador en la EC2 detecta una imagen `main` nueva y ejecuta el script de despliegue de `despliegue-vm-y-respaldos`. No se guardan credenciales de AWS ni llaves SSH en GitHub. Si la instancia está apagada, despliega la última versión de `main` al volver a encenderse.
- **Versiones para producción por tag**: un tag `vX.Y.Z` sobre un commit de `main` **reetiqueta la misma imagen** que ya pasó por pruebas, sin reconstruirla, y crea el GitHub Release con los digests. El tag se rechaza si el commit no está en `main` o si su CI no publicó imágenes. Solo pueden crear tags `v*` los roles autorizados.
- **Versión identificable en cada ambiente**: las imágenes llevan el commit con el que se construyeron. `/health` lo expone sin datos del catálogo, y cada host registra qué versión desplegó y cuándo.
- **ADR-014** (Propuesto): pipeline de despliegue entre ambientes, que complementa ADR-011 y ADR-013.

**Fuera del alcance de este change** (explícito):
- **No se toca el flujo de ramas ni la guía de GitHub Flow** (`docs/capacitacion/entrenamiento-sdd-github-flow.pdf`). Sigue habiendo un solo `main`, sin `develop`, con las mismas reglas de PR, revisión y protección.
- No cambian los checks de integración continua ni su obligatoriedad para integrar. Los define `setup-monorepo-base`, y `ci-migraciones-postgresql` añade el de migraciones.
- No cambian el script de despliegue, el Compose de producción, el proxy HTTPS, los respaldos ni el simulacro de restauración: siguen en `despliegue-vm-y-respaldos`.
- No hay despliegue automático a producción, ni un agente que actualice la VM PUCP.
- No se crean más ambientes (por PR, efímeros o *preview*) ni se hace despliegue *blue/green*.
- No se automatiza la creación de la infraestructura de AWS Academy (EC2, RDS, S3), que se opera por sesiones según ADR-013.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añaden los requirements «Despliegue automático al ambiente de pruebas tras integrar en main», «Producción solo por versión etiquetada y acción humana» y «Versión desplegada identificable en cada ambiente». Complementan, sin modificarlos, «Integración continua obligatoria» (`setup-monorepo-base`) y «Despliegue reproducible con contenedores endurecidos» (`despliegue-vm-y-respaldos`).

## Impact

- **IDs cubiertos**:
  - RNF-004: el despliegue es reproducible y documentado, y la versión de cada ambiente se puede consultar.
  - RNF-002 y RNF-008: el mismo artefacto sirve en el entorno académico y en la VM, sin servicios productivos obligatorios.
  - RNF-014: en pruebas solo hay datos sintéticos y no se copia nada de producción.
- **Célula dueña**: Plataforma. Implementa Manuel Barrantes (CD 1 y CD 2 del plan de sprints) y revisa Sergio Chumbimuni (Arquitecto), porque toca `.github/workflows/` y la frontera de todas las células.
- **Depende de**:
  - `despliegue-vm-y-respaldos`: Dockerfiles sin root (tarea 1.1), `scripts/deploy.sh` con respaldo previo y vuelta atrás (tarea 2.2) y Compose de producción (tarea 1.2).
  - `setup-monorepo-base`: workflow `ci.yml` y protección de `main`.
  - Coordina con `ci-migraciones-postgresql`, cuyo job nuevo pasa a formar parte del CI que habilita la publicación. No es bloqueante.
- **Absorbe de `despliegue-vm-y-respaldos`**: la publicación de imágenes (su tarea 2.1, que hoy publica solo por tag) y la automatización del despliegue en el entorno de integración (la parte automática de su tarea 6.3). El ajuste de ese change y de `docs/plan-sprints.md` se hace como tarea de este change, coordinada con Plataforma, con `/opsx:update`.
- **Afecta**:
  - Workflows nuevos: `.github/workflows/publish-images.yml` y `.github/workflows/release.yml`.
  - Nuevo `deploy/staging/pull-deploy/`: script y unidades `systemd` del temporizador.
  - `apps/api` y `apps/web`: versión en el build y en `/health`.
  - `docs/api/openapi.json` y cliente tipado: campo de versión en `/health`.
  - Documentación: `docs/adr/ADR-014-pipeline-despliegue-ambientes.md` y `docs/despliegue/pipeline.md`.
  - Configuración de GitHub: permisos de paquetes y regla de tags `v*`.
- **Dependencias nuevas**: ninguna de ejecución. Las acciones de GitHub para construir y publicar imágenes (`docker/build-push-action` y afines) se fijan a la versión estable vigente al implementar (guardrail 4).
