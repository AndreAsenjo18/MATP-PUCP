## Context

- `docker-compose.yml` de desarrollo: `db` (`postgres:18-alpine`), `storage` (MinIO `quay.io/minio/minio` con etiqueta fija, ver ADR-003), `api`, `ai`, `web` con healthchecks; puertos 5432/9000/9001 publicados para desarrollo.
- Imágenes Python 3.14 y Next.js `output: standalone`; aún no se han construido por falta de Docker (bloqueo de entorno).
- Datos a proteger: base PostgreSQL (catálogo, auditoría, usuarios con datos personales) y bucket de objetos (fotos originales, archivos de importación, exportaciones temporales).
- Información pendiente de la DTI/contraparte: sistema operativo y recursos de la VM, dominio y certificado, acceso SSH, destino externo de respaldos y correo para alertas [SUPUESTO C6].

## Goals / Non-Goals

**Goals:**
- Un despliegue que otra persona pueda repetir siguiendo un documento (RNF-004).
- RPO ≤ 24 h y RTO ≤ 4 h [SUPUESTO] demostrados con un simulacro real.
- Nada de datos ni credenciales expuestos fuera de la red interna de contenedores.

**Non-Goals:**
- Automatizar la administración del sistema operativo de la VM.
- Escalado horizontal.

## Decisions

### D1. Topología de producción

```mermaid
flowchart LR
    U[Navegador interno PUCP] -->|443 HTTPS| P[proxy Caddy]
    P -->|/api/*| A[api :8000]
    P -->|/*| W[web :3000]
    A --> D[(db PostgreSQL)]
    A --> S[(storage MinIO)]
    A -.-> I[IA asistiva en el mismo contenedor de la API]
    B[backup restic<br/>job programado] --> D
    B --> S
    B -->|cifrado| R[(destino externo<br/>S3 institucional o R2)]
    subgraph red interna
      A
      W
      D
      S
      I
      B
    end
```

- Solo `proxy` publica puertos (80 → redirección, 443). `db`, `storage`, `ai` sin puertos publicados.
- Las URL prefirmadas de fotos deben ser alcanzables por el navegador: el proxy enruta `/media-store/*` al bucket (`S3_PUBLIC_ENDPOINT_URL=https://<dominio>/media-store`) con la firma intacta [SUPUESTO; verificar compatibilidad de firma con ruta reescrita, contingencia: subdominio propio para el almacenamiento].
- Contenedores con usuario no root, `read_only` donde sea posible, `restart: unless-stopped`, límites de memoria acordes a la VM.
- Secretos en `/opt/matp/.env.production` (permisos 600) fuera del repositorio; nunca en imágenes.

### D2. Proxy: Caddy
Caddy con configuración declarativa, HTTPS automático (ACME) si el dominio es público o certificado institucional montado si es interno; HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` básica, `Permissions-Policy`, compresión y límite de tamaño de cuerpo coherente con `IMPORT_MAX_BYTES`.
*Alternativa*: nginx + certbot → más piezas móviles; se documenta como contingencia si la DTI exige nginx.

### D3. Despliegue
- `release.yml` (al crear tag `vX.Y.Z`): construye `api`, `ai`, `web` y publica en GHCR con etiqueta de versión y SHA. Sin secretos de la VM en GitHub.
- `scripts/deploy.sh <version>` en la VM: `pull` → **respaldo previo** → `alembic upgrade head` en contenedor efímero (si falla: se detiene y conserva la versión anterior corriendo) → `up -d` → espera a `/health` 200 en api y web → registra versión desplegada en `/opt/matp/deployments.log`.
- Vuelta atrás: `scripts/deploy.sh --rollback` vuelve a la etiqueta anterior; si la migración no es reversible, se restaura el respaldo previo (documentado; las migraciones deben ser aditivas por convención, ADR-004).

### D4. Respaldos con restic
- Job `backup` (contenedor efímero): `pg_dump --format=custom` en streaming a `restic backup --stdin` + `restic backup` de un espejo local del bucket obtenido con `mc mirror` (o `rclone sync`). Repositorio restic en el destino externo, cifrado con clave guardada fuera de la VM (custodia del Líder y el Implantador; procedimiento documentado).
- Retención `restic forget --keep-daily 30 --keep-weekly 8 --keep-monthly 6 --prune` [SUPUESTO C6].
- Verificación: `restic check --read-data-subset=5%` semanal y resultado registrado.
- Notificación: el script escribe un registro estructurado y, ante fallo, envía un correo por SMTP institucional o un webhook configurable (`ALERT_WEBHOOK_URL`) [SUPUESTO: canal a definir]; además deja un marcador que `/health` de la API expone como `backup_status: stale` si el último respaldo exitoso tiene más de 26 h (visible para el Administrador, sin datos del catálogo).

### D5. Restauración y simulacro
`scripts/backup/restore-test.sh`: restaura el último respaldo en un proyecto compose aislado (`matp-restore-test`) con red propia, ejecuta `alembic current`, cuenta filas de tablas clave, verifica una muestra de fotos por SHA-256 contra `media_asset.content_sha256`, ejecuta `audit:verify` si existe y escribe `docs/despliegue/simulacros/<fecha>.md` con tiempos (RTO medido) y resultado. Frecuencia mensual [SUPUESTO] y antes de cada entrega del curso.

### D6. Programación y monitoreo
- Unidades `systemd` (`deploy/vm/systemd/*.service|*.timer`): `matp-backup` (02:00), `matp-backup-check` (domingo), `matp-kpis-snapshot` (23:50), `matp-audit-digest` (00:30), `matp-disk-check` (cada hora; alerta > 80 %).
*Alternativa*: contenedor con cron → reinicios y zona horaria más difíciles de auditar; systemd queda en el registro del sistema.
- Logs: driver `json-file` con rotación (`max-size 10m`, `max-file 5`).

### D7. Contingencia free tier
`deploy/free-tier/README.md`: web en Vercel Hobby, API y servicio IA en Render Free (arranque en frío documentado), Neon Postgres (PITR del proveedor + `pg_dump` semanal por GitHub Actions programado a R2), Cloudflare R2 para objetos (CORS y URL prefirmadas), cookies `SameSite=None; Secure` y `WEB_ORIGIN`. Tabla de límites conocidos (horas, almacenamiento, suspensión por inactividad) con la fecha de consulta, ya que cambian con frecuencia.

## Risks / Trade-offs

- **Información de la VM desconocida** → todo parametrizado; checklist de datos a pedir a la DTI en `docs/despliegue/checklist-vm.md` y preguntas registradas.
- **Clave de cifrado de respaldos perdida = respaldos inútiles** → custodia dual documentada y verificación en cada simulacro.
- **Reescritura de ruta para URL prefirmadas** puede invalidar la firma → prueba específica; contingencia con subdominio.
- **Sin Docker en la máquina del arranque** → este change no puede verificarse hasta tener Docker y la VM; tareas marcadas en consecuencia.
