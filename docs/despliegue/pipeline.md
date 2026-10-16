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

### Por qué `workflow_run` y no un job dentro de `ci.yml`

La publicación depende de la **conclusión del workflow CI completo**, no de una lista de jobs. Cuando un change añade un check a `ci.yml` (por ejemplo, el de migraciones de `ci-migraciones-postgresql`), ese check pasa a ser requisito para publicar sin tocar este workflow. Un job `publish` con `needs: [api, ai, web, openspec]` obligaría a actualizar la lista a mano, y olvidarlo publicaría imágenes sin pasar el check nuevo.

La contrapartida: GitHub solo ejecuta `workflow_run` desde la versión del archivo que está en `main`. Un cambio en `publish-images.yml` no se puede probar dentro de su PR. Se valida con `actionlint` en el PR y se observa la primera ejecución después del merge.

### Permisos

El workflow usa solo `GITHUB_TOKEN`, con permiso `packages: write`. No hay credenciales de nube ni llaves de servidores en el repositorio.
