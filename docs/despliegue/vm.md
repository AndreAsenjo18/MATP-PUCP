# Despliegue en la VM institucional

Guía para que **otra persona repita el despliegue** (RNF-004). Change `despliegue-vm-y-respaldos`; decisiones en [ADR-011](../adr/ADR-011-despliegue-proxy-respaldos.md). Antes de empezar, pida a la DTI lo de [`checklist-vm.md`](checklist-vm.md).

> **Estado**: los archivos están escritos y probados sin Docker (configuración, scripts con dobles y pruebas de la API). **Falta el primer despliegue real en la VM y un simulacro de restauración registrado**; hasta entonces, esta guía no está verificada de punta a punta.

## Cómo queda armado

```text
Internet/red PUCP ──443──▶ proxy (Caddy) ──/api/*, /health*──▶ api  ──▶ db (PostgreSQL)
                                │                                 └──▶ storage (MinIO)
                                ├──/*────────────────────────────▶ web
                                └──media.<dominio>───────────────▶ storage
```

- **Solo el proxy publica puertos** (80, 443). La base de datos y el almacenamiento no.
- La IA asistiva vive **dentro del contenedor de la API**; no se publica ninguna ruta `/ai/*`.
- Web y API comparten **dominio**: las cookies de sesión lo necesitan (ADR-009).
- Las fotos salen por `media.<dominio>` (las URL prefirmadas firman host y ruta; ver [`almacenamiento.md`](almacenamiento.md)).

## Requisitos de la VM

| Qué | Mínimo sugerido [SUPUESTO] |
|---|---|
| Sistema | Linux con systemd (Debian/Ubuntu/RHEL) |
| Recursos | 2 vCPU, 4 GB de RAM, 40 GB de disco |
| Software | Docker Engine con Compose **>= 2.24**, `git`, `curl`, `flock` (util-linux) |
| Red | Puertos 80 y 443 abiertos; salida a GHCR y al destino de respaldos |
| Nombres | `<dominio>` y `media.<dominio>` apuntando a la VM |

## Instalación (una vez)

1. Cree el usuario y las carpetas:

   ```bash
   sudo useradd --system --create-home --home-dir /opt/matp --shell /bin/bash matp
   sudo usermod -aG docker matp
   sudo -u matp mkdir -p /opt/matp/state /opt/matp/secrets /opt/matp/backup-work /opt/matp/certs
   ```

2. Clone el repositorio en `/opt/matp/app` (solo lo usan los scripts y los archivos de `deploy/`):

   ```bash
   sudo -u matp git clone https://github.com/AndreAsenjo18/MATP-PUCP.git /opt/matp/app
   ```

3. Cree `/opt/matp/.env.production` **con permisos 600** a partir de `.env.example` (sección «Producción en la VM» y las variables obligatorias de base de datos, almacenamiento y API). Valores que cambian respecto de desarrollo:
   - `APP_ENV=production` (la API no arranca con `COOKIE_SECURE=false`).
   - Contraseñas propias, largas y distintas en `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` y `S3_SECRET_ACCESS_KEY`.
   - `S3_PUBLIC_ENDPOINT_URL=https://media.<dominio>` y `WEB_ORIGIN=https://<dominio>`.
   - `SEED_DEV_PASSWORD` **vacío**: los usuarios sintéticos no pueden entrar en producción.
   - `MATP_DOMAIN`, `BACKUP_STATUS_FILE=/var/lib/matp/backup-status.json`, `RESTIC_*` y `ALERT_WEBHOOK_URL`.

   ```bash
   sudo chmod 600 /opt/matp/.env.production && sudo chown matp: /opt/matp/.env.production
   ```

4. **Clave de los respaldos**: genere una frase larga, guárdela en `/opt/matp/secrets/restic.key` (permisos 600) y **guarde otra copia fuera de la VM** (ver «Custodia de la clave»).

5. Inicialice el repositorio de respaldos, **una sola vez**:

   ```bash
   set -a; source /opt/matp/.env.production; set +a
   restic init        # o: docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE ... $RESTIC_IMAGE init
   ```

6. Instale las tareas programadas:

   ```bash
   sudo cp /opt/matp/app/deploy/vm/systemd/*.service /opt/matp/app/deploy/vm/systemd/*.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now matp-backup.timer matp-backup-check.timer matp-disk-check.timer \
     matp-kpis-snapshot.timer matp-audit-digest.timer
   systemctl list-timers 'matp-*'
   ```

   `matp-kpis-snapshot` y `matp-audit-digest` ya están programadas, pero su orden está **comentada** hasta que existan los comandos de `alertas-y-reporte-incompletas` y `auditoria-y-soft-delete-transversal`.

7. Si la DTI entrega un certificado institucional, siga la nota de `deploy/vm/Caddyfile` (crear `deploy/vm/certs/tls.caddy` y copiar los dos archivos). Sin certificado se usa el automático (Let's Encrypt) si el dominio es público.

## Desplegar una versión

Las imágenes se publican solas al crear un tag `vX.Y.Z` en GitHub (workflow «Publicar versión»). **La VM no se despliega sola**: una persona autorizada ejecuta, en la VM:

```bash
cd /opt/matp/app && git fetch --tags && git checkout vX.Y.Z
MATP_ENV=production ./scripts/deploy.sh vX.Y.Z
```

`scripts/deploy.sh` valida las variables, baja las imágenes, **hace un respaldo antes de migrar**, aplica las migraciones en un contenedor aparte, levanta los servicios, espera la salud de la API y la web y anota la versión en `/opt/matp/deployments.log`. Si falta una variable obligatoria **se detiene antes de tocar los servicios** e indica cuál.

Compruebe después:

```bash
curl -fsS https://<dominio>/health | jq '{status, release, backup}'
```

`backup.status` debe ser `ok` (o `stale` si aún no corrió el primer respaldo).

## Si la migración falla

La versión anterior **sigue atendiendo** y el script lo informa. El respaldo previo queda identificado en el registro de respaldos (`/opt/matp/state/backup.log`) por si hay que restaurarlo.

## Vuelta atrás

```bash
MATP_ENV=production ./scripts/deploy.sh --rollback
```

Vuelve los contenedores a la versión anterior registrada. **No revierte la base de datos**: si la migración ya se aplicó y no es reversible, restaure el respaldo previo (siguiente sección). Por convención las migraciones son aditivas (ADR-004).

## Respaldos

| Qué | Cómo |
|---|---|
| Respaldo nocturno (02:00) | `matp-backup.timer` → `scripts/backup/backup-restic.sh`: `pg_dump` en streaming a restic (cifrado antes de salir de la VM) + espejo del bucket + retención (30 diarios, 8 semanales, 6 mensuales) [SUPUESTO C6] |
| Verificación semanal (domingo) | `matp-backup-check.timer` → `scripts/backup/check.sh`: `restic check --read-data-subset=5%` |
| Respaldo manual | `npm run backup:local` (o `bash scripts/backup/backup-restic.sh`) |
| Si falla | Se registra, se avisa por `ALERT_WEBHOOK_URL` y `/health` informa `backup.status: stale` |
| Disco | `matp-disk-check.timer` avisa si el uso supera `DISK_ALERT_THRESHOLD` (80 %) |

### Restaurar de verdad (emergencia)

1. Detenga los servicios: `docker compose ... stop api web`.
2. Restaure el volcado: `restic restore latest --tag db --target /tmp/restore` y luego `pg_restore --clean --no-owner -d matp /tmp/restore/matp.pgdump` dentro del contenedor `db`.
3. Restaure los objetos: `restic restore latest --tag objects --target /tmp/restore-objects` y cópielos al bucket con `rclone sync`.
4. Levante de nuevo y compruebe `/health`.

### Simulacro de restauración

```bash
RESTORE_API_IMAGE=ghcr.io/andreasenjo18/matp-api:vX.Y.Z npm run restore:test
```

Restaura el último respaldo en contenedores aislados (`matp-restore-test`), verifica que el esquema esté en la cabeza de Alembic, cuenta las tablas clave y compara una muestra de fotos con la huella registrada. Escribe `docs/despliegue/simulacros/<fecha>.md` con el **tiempo medido (RTO)**. Hágalo **mensualmente y antes de cada entrega** [SUPUESTO]. Si una foto no coincide, el simulacro falla y dice cuál.

## Custodia de la clave de respaldos

**Sin la clave, los respaldos son ilegibles — para cualquiera, también para nosotros.**

- Hay una copia en la VM (para que el respaldo automático funcione) y **otra fuera de ella**, en custodia del Líder de Proyecto y del Implantador (dos personas, en gestores de contraseñas distintos).
- El simulacro de cada mes confirma que la clave guardada fuera sigue sirviendo: ábralo con **esa** copia, no con la de la VM.
- Si se pierde la clave se pierde la capacidad de restaurar. Rotarla implica un repositorio nuevo.

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El despliegue pide `MATP_DOMAIN` | Falta la variable | Añádala a `.env.production` |
| `/health` dice `backup.status: stale` | No corrió el respaldo, falló o la clave no se lee | `journalctl -u matp-backup`, `tail /opt/matp/state/backup.log` |
| El navegador no guarda la sesión | Se accede por `http://` o por otro dominio | Use `https://<dominio>`: la cookie es `Secure` |
| Las fotos no cargan | `media.<dominio>` no resuelve o `S3_PUBLIC_ENDPOINT_URL` es otro | Revise DNS y la variable |
