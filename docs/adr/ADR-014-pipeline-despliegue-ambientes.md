# ADR-014 — Pipeline de despliegue entre ambientes (pruebas automático, producción manual por versión)

- **Estado**: Propuesto — se implementa en el change `pipeline-despliegue-ambientes`
- **Fecha**: 2026-09-30
- **Complementa**: [ADR-011](ADR-011-despliegue-proxy-respaldos.md) (despliegue en la VM) y [ADR-013](ADR-013-entorno-integracion-aws-academy.md) (entorno de integración en AWS Academy)
- **Versiones**: no fijadas en este ADR. Las acciones de GitHub se fijan a la versión mayor estable vigente al implementar (guardrail 4).

## Contexto

El equipo mantiene GitHub Flow con una sola rama permanente (`main`), sin `develop`. Lo que separa el ambiente de pruebas del de producción tiene que ser el pipeline de despliegue, no las ramas. Hay dos restricciones previas:

- **Pruebas** es el entorno de integración de ADR-013. Funciona por sesiones de unas 4 horas y sus credenciales de AWS caducan en cada sesión.
- **Producción** es la VM PUCP. D3 de `despliegue-vm-y-respaldos` prohíbe guardar sus secretos en GitHub, y la VM puede no ser accesible desde Internet.

Detalle completo en `openspec/changes/pipeline-despliegue-ambientes/design.md`.

## Decisión

1. **Dos ambientes con reglas de promoción distintas** (D1). Pruebas recibe automáticamente cada commit de `main` cuya integración continua terminó en verde. Producción solo recibe versiones `vX.Y.Z`, siempre por acción de una persona autorizada.
2. **Publicación con `workflow_run`** (D2). Cuando el workflow «CI» termina con éxito en un push a `main`, `publish-images.yml` publica en GHCR `matp-api` y `matp-web` con las etiquetas `sha-<commit>` y `main`. Depende de la conclusión del workflow completo, así que cualquier job que se añada a CI pasa a ser requisito sin tocar la publicación.
3. **Despliegue en pruebas por *pull*** (D3). Un temporizador `systemd` en la EC2 detecta una imagen `main` nueva y ejecuta `deploy.sh sha-<commit>`, fijado por commit. Al encenderse la instancia, despliega la última versión. El único secreto nuevo es un token de solo lectura de paquetes, guardado en la EC2 y nunca en GitHub.
4. **Producción por tag y despliegue manual** (D4). Un tag `vX.Y.Z` sobre un commit de `main` **reetiqueta sin reconstruir** las imágenes `sha-<commit>`, de modo que producción ejecuta el mismo digest que se probó, y crea el GitHub Release. Después, una persona autorizada ejecuta `deploy.sh vX.Y.Z` en la VM. La VM no tiene temporizador y ningún workflow tiene acceso a ella.
5. **Quién crea tags `v*`**: el Arquitecto, el Líder de Proyecto y los Implantadores (decisión ratificada por el Arquitecto de Software el 2026-09-30), mediante una regla de tags en GitHub.
6. **Versión identificable** (D5). Las imágenes llevan el commit (`GIT_SHA` → `APP_COMMIT`), `deploy.sh` fija la etiqueta desplegada (`APP_RELEASE`), y `GET /health` expone `commit` y `release` sin datos del catálogo.
7. **Reparto con `despliegue-vm-y-respaldos`** (D6). Este pipeline se queda con la publicación de imágenes y con el despliegue automático en pruebas. El script de despliegue, el Compose de producción, el proxy y los respaldos siguen en ese change.

## Alternativas consideradas

- **Push desde GitHub Actions por SSH o SSM**: obliga a guardar en GitHub credenciales de AWS Academy, que caducan en cada sesión, o una llave SSH, y a abrir el puerto 22. Además falla siempre que el laboratorio está apagado.
- **Un actualizador genérico de contenedores (Watchtower u otro)**: no ejecuta el respaldo previo, la migración ni la vuelta atrás de `deploy.sh`, y en producción sería el automatismo que se quiere evitar.
- **Un job `publish` dentro de `ci.yml` con `needs` explícito**: hay que acordarse de actualizar la lista cada vez que se añade un check. Olvidarlo publicaría imágenes sin pasar el check nuevo.
- **Reconstruir las imágenes al crear el tag**: produce otro digest, y producción ejecutaría algo que no se probó.
- **Job de despliegue a producción con el environment `produccion` y revisores obligatorios**: requiere secretos de la VM en GitHub y que GitHub llegue a una VM de red institucional.
- **Rama `develop` o `release/*` como fuente de producción**: contradice la decisión del equipo de mantener GitHub Flow con `main` único.

## Consecuencias

- Pruebas se actualiza con retraso: hasta 5 minutos, o hasta que se encienda la sesión del laboratorio. `/health` muestra qué versión está viva.
- `workflow_run` no se ejecuta dentro de un PR. La primera verificación real ocurre después del merge (tarea 2.3 del change).
- Con `cancel-in-progress` en CI, si dos merges llegan seguidos se cancela el CI del primero, y ese commit no tendrá imágenes ni podrá etiquetarse como versión.
- **Bloqueante externo del punto 5**: el repositorio está en una cuenta personal de GitHub, donde los colaboradores solo tienen permiso de escritura y el único administrador es el propietario. Una regla de tags no puede distinguir al Arquitecto, al Líder y a los Implantadores del resto de colaboradores. Cumplir la decisión exige mover el repositorio a una organización o aceptar que solo el propietario cree tags. Lo decide el Arquitecto con el propietario del repositorio (tarea 4.2 del change).
- Hay que ajustar `despliegue-vm-y-respaldos` (tareas 2.1 y 6.3) y `docs/plan-sprints.md` (CD 1 y CD 2) para que remitan a este pipeline (tarea 5.1 del change, coordinada con Plataforma).
