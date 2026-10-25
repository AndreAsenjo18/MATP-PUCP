# Pipeline de despliegue entre ambientes

Change `pipeline-despliegue-ambientes`. La decisión está en [ADR-014](../adr/ADR-014-pipeline-despliegue-ambientes.md).

| Ambiente | Qué recibe | Cómo llega |
|---|---|---|
| **Pruebas** (entorno de integración, AWS Academy, ADR-013) | Cada commit de `main` cuya integración continua terminó en verde | Automático: la EC2 detecta la imagen nueva (sección «Pruebas», pendiente) |
| **Producción** (VM PUCP) | Solo versiones `vX.Y.Z` | Manual: una persona autorizada ejecuta `scripts/deploy.sh vX.Y.Z` (sección «Producción», pendiente) |

El flujo de ramas no cambia: GitHub Flow con `main` único, PR obligatorio, CI en verde y una aprobación.

## Publicación

### Qué se publica y cuándo

El workflow [`publish-images.yml`](../../.github/workflows/publish-images.yml) se ejecuta cuando termina el workflow **CI** de un push a `main`:

- **CI terminó con éxito**: construye las dos imágenes desde ese commit y las publica en GitHub Container Registry.
- **CI falló o se canceló**: el job aparece como omitido (*skipped*) y no se publica nada de ese commit.

| Imagen | Contenido |
|---|---|
| `ghcr.io/<propietario>/matp-api` | API con la IA asistiva montada en el mismo proceso (ADR-008) |
| `ghcr.io/<propietario>/matp-web` | Frontend Next.js, el mismo artefacto para todos los ambientes |

`<propietario>` es el dueño del repositorio **en minúsculas** (GHCR no admite mayúsculas). Hoy es `andreasenjo18`.

Cada imagen recibe dos etiquetas:

- `sha-<commit>`, con el hash **completo** del commit (40 caracteres). No cambia nunca y es la que se despliega.
- `main`, que se mueve a la última publicación. Solo sirve para detectar que hay algo nuevo; nunca se despliega por esa etiqueta.

El commit también queda dentro de la imagen, en la variable `APP_COMMIT`, y la API lo devuelve en `GET /health` (campo `commit`). Una ejecución local sin build responde `"commit": "dev"`.

### Cómo encontrar la imagen de un commit

1. Obtén el hash completo del commit:

   ```bash
   git rev-parse <commit>
   ```

2. Comprueba que el CI de ese commit publicó imágenes (la ejecución de «Publicar imágenes» debe estar en verde, no omitida):

   ```bash
   gh run list --workflow publish-images.yml --commit <hash-completo>
   ```

3. Consulta el digest publicado (requiere Docker con Buildx):

   ```bash
   docker buildx imagetools inspect ghcr.io/andreasenjo18/matp-api:sha-<hash-completo>
   ```

Si el paso 2 no devuelve ninguna ejecución en verde, ese commit no tiene imágenes. Nunca llegará a pruebas ni podrá etiquetarse como versión. Suele pasar cuando dos merges llegan seguidos: CI cancela la ejecución del primero (`cancel-in-progress`) y solo se publica el segundo.

### Verificación con ejecuciones reales (2026-10-25)

Los dos casos del spec, observados en `main` (tarea 2.3), y los tres pasos de arriba ejecutados tal como están escritos (tarea 2.4):

| Caso | Commit | CI | «Publicar imágenes» | Imágenes en GHCR |
|---|---|---|---|---|
| CI en verde | `4898bd2f954b419dd2b79f9bdc9d58a4c0c2d5b1` (PR #105) | verde | [publicó las dos imágenes](https://github.com/AndreAsenjo18/MATP-PUCP/actions/runs/40213848850) | `sha-4898bd2…` y `main` con el mismo digest: `matp-api` `sha256:de28b2a14342569a5d5af673cbb5a55272c5fc93eff8c80e19f4b8a82207c924`, `matp-web` `sha256:881928ebc813b223d71b5ee2c308798fc52c166b2b09fd060845fed208004424` |
| CI fallido | `3ff065c400fb3244618ba469a527ae44fce8d8c9` (PR #64) | [falló](https://github.com/AndreAsenjo18/MATP-PUCP/actions/runs/39329657315) | [omitido (*skipped*)](https://github.com/AndreAsenjo18/MATP-PUCP/actions/runs/39329897132) | ninguna: `imagetools inspect …:sha-3ff065c…` responde `not found` |

El paso 2 distingue los dos casos en su segunda columna de estado: `success` cuando publicó y `skipped` cuando no. A nivel de la lista general del workflow, una ejecución omitida también puede figurar como completada, por eso conviene consultarla siempre con `--commit`. Las imágenes de GHCR del proyecto son públicas: `imagetools inspect` no necesita iniciar sesión.

### Por qué `workflow_run` y no un job dentro de `ci.yml`

La publicación depende de la **conclusión del workflow CI completo**, no de una lista de jobs. Cuando un change añade un check a `ci.yml` (por ejemplo, el de migraciones de `ci-migraciones-postgresql`), ese check pasa a ser requisito para publicar sin tocar este workflow. Un job `publish` con `needs: [api, ai, web, openspec]` obligaría a actualizar la lista a mano, y olvidarlo publicaría imágenes sin pasar el check nuevo.

La contrapartida: GitHub solo ejecuta `workflow_run` desde la versión del archivo que está en `main`. Un cambio en `publish-images.yml` no se puede probar dentro de su PR. Se valida con `actionlint` en el PR y se observa la primera ejecución después del merge.

### Permisos

El workflow usa solo `GITHUB_TOKEN`, con permiso `packages: write`. No hay credenciales de nube ni llaves de servidores en el repositorio.

## Pruebas

El ambiente de pruebas (EC2 de AWS Academy, ADR-013) se actualiza solo: un temporizador de systemd revisa cada 5 minutos si `matp-api:main` cambió de digest y, si cambió, despliega `sha-<commit>` con `scripts/deploy.sh`. Nada en GitHub se conecta a la EC2: es la EC2 la que consulta GHCR (*pull*).

Archivos: [`deploy/staging/pull-deploy/`](../../deploy/staging/pull-deploy/) (`pull-deploy.sh`, `matp-pull-deploy.service`, `matp-pull-deploy.timer`, `env.example`).

### Instalar el temporizador

En la EC2, con el repositorio clonado en `/opt/matp/MATP-PUCP` (la ruta que usa el servicio):

```bash
# Solo la primera vez: si /opt/matp/.env.pruebas ya existe, esto lo reemplazaría.
test -e /opt/matp/.env.pruebas || sudo install -m 600 -o ec2-user -g ec2-user deploy/staging/pull-deploy/env.example /opt/matp/.env.pruebas
# Edite /opt/matp/.env.pruebas: solo valores del servidor, nunca se copian a GitHub.
sudo cp deploy/staging/pull-deploy/matp-pull-deploy.service deploy/staging/pull-deploy/matp-pull-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now matp-pull-deploy.timer
systemctl list-timers matp-pull-deploy.timer   # próxima ejecución
journalctl -u matp-pull-deploy.service -n 50   # salida de las últimas revisiones
```

El temporizador corre 2 minutos después de encender la instancia (`OnBootSec=2min`): si hubo merges mientras estaba apagada, despliega la última versión de `main` al encender. Una ejecución que encuentra otra en curso se omite (candado con `flock`).

### Token de lectura de GHCR

Hoy **no hace falta**: las imágenes del proyecto en GHCR son públicas y se leen sin iniciar sesión (comprobado el 2026-10-25). `GHCR_USERNAME` y `GHCR_READ_TOKEN` quedan vacíos en `/opt/matp/.env.pruebas`.

Si los paquetes pasan a privados:

1. Cree un token clásico de GitHub con **solo** el permiso `read:packages`, con fecha de vencimiento.
2. Escríbalo en `GHCR_READ_TOKEN` de `/opt/matp/.env.pruebas` (permisos `600`), junto con `GHCR_USERNAME`. Nunca como secreto ni variable del repositorio.
3. **Rotación**: cree el token nuevo, reemplácelo en el archivo y revoque el anterior en GitHub. La siguiente revisión del temporizador ya usa el nuevo; no hace falta reiniciar nada.

### Historial de despliegues

Cada revisión y cada despliegue quedan en `/opt/matp/deployments.log`, una línea por evento:

| Quién escribe | Formato | Estados |
|---|---|---|
| `pull-deploy.sh` | `fecha UTC \| ambiente \| estado \| detalle` | `no_change` (con el digest), `pull_success` (versión y digest), `pull_failed` (motivo) |
| `deploy.sh` | `fecha UTC \| ambiente \| versión \| estado` | `success`, `migration_failed`, `deployment_failed`, `rollback_success`, `rollback_failed` |

```bash
tail -n 20 /opt/matp/deployments.log
grep -v no_change /opt/matp/deployments.log | tail -n 20   # solo despliegues y fallos
```

`curl -s https://<ambiente-de-pruebas>/health` muestra el `commit` que está corriendo: debe coincidir con el último `pull_success`. Si `ALERT_WEBHOOK_URL` está definida, cada fallo también se avisa por ese webhook.

### Desactivación de emergencia

Para que el ambiente de pruebas deje de actualizarse (por ejemplo, durante una demo):

```bash
sudo systemctl disable --now matp-pull-deploy.timer
```

El ambiente sigue funcionando con la versión que tiene. Para volver a la anterior: `MATP_ENV=staging ./scripts/deploy.sh --rollback` (revierte los contenedores, **no** la base de datos). Para reactivar las actualizaciones: `sudo systemctl enable --now matp-pull-deploy.timer`.

> Estos comandos se verifican en una sesión real de la EC2 en la tarea 3.3.

### Sin credenciales de despliegue en el repositorio

Comprobado el 2026-10-25: `gh secret list` y `gh variable list` no devuelven nada. El repositorio no guarda credenciales de AWS, llaves SSH ni tokens; los workflows usan solo `GITHUB_TOKEN`.

## Producción

Producción (la VM de la PUCP) **solo recibe versiones con tag y por acción humana**. Un merge a `main` nunca la toca: la VM no tiene temporizador de *pull* y ningún workflow tiene acceso a ella (los tres workflows usan solo `GITHUB_TOKEN`; comprobado el 2026-10-25).

### Publicar una versión

1. **Confirmar lo que se probó.** En el ambiente de pruebas, `GET /health` devuelve el `commit` que corre ahí. Ese commit es el que se va a etiquetar:

   ```bash
   curl -s https://<ambiente-de-pruebas>/health   # campo "commit"
   ```

2. **Crear el tag** sobre ese commit, con formato `vMAYOR.MENOR.PARCHE` (solo pueden hacerlo los roles autorizados por el *ruleset* de tags `v*`, tarea 4.2):

   ```bash
   git tag -a v0.1.0 <commit> -m "v0.1.0"
   git push origin v0.1.0
   ```

3. **Revisar el workflow «Publicar versión»** ([`release.yml`](../../.github/workflows/release.yml)). No reconstruye nada: reetiqueta las imágenes `sha-<commit>` ya probadas como `v0.1.0`. Falla, y explica por qué, si:
   - el tag no tiene el formato `vMAYOR.MENOR.PARCHE`;
   - el commit no está en `main`;
   - no existen las imágenes `sha-<commit>`, es decir, el CI de ese commit no terminó en verde.

4. **Revisar el GitHub Release** que crea el workflow: trae la tabla de digests de `matp-api` y `matp-web` (los mismos del ambiente de pruebas) y las notas generadas de los PR desde la versión anterior.

5. **Desplegar en la VM**, como persona autorizada (detalle en [`vm.md`](vm.md#desplegar-una-versión)):

   ```bash
   cd /opt/matp/app && git fetch --tags && git checkout v0.1.0
   MATP_ENV=production ./scripts/deploy.sh v0.1.0
   ```

   `deploy.sh` exporta la versión como `MATP_VERSION`, y el compose de producción la pasa a la API como `APP_RELEASE`. Después del despliegue, `GET /health` de producción muestra `"release": "v0.1.0"` y el mismo `commit` del paso 1. El despliegue queda en `/opt/matp/deployments.log`.

Para volver a la versión anterior: `MATP_ENV=production ./scripts/deploy.sh --rollback` (revierte los contenedores, **no** la base de datos; antes de cada migración `deploy.sh` hace un respaldo).
