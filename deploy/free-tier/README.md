# Contingencia en servicios gratuitos (free tier)

Para **demostrar el sistema si la VM institucional no está disponible** (por ejemplo, una semana antes de la exposición). Change `despliegue-vm-y-respaldos`, [ADR-011](../../docs/adr/ADR-011-despliegue-proxy-respaldos.md), RNF-002.

> **Solo datos sintéticos.** Estos servicios están fuera de la PUCP; no se suben datos reales del museo (Ley 29733, RNF-014).
> **Los límites cambian con frecuencia**: la tabla de abajo es del **2026-10-22**. Verifique cada cifra en la página del proveedor antes de depender de ella.

## Arquitectura de contingencia

| Pieza | Servicio | Nota |
|---|---|---|
| Frontend (Next.js) | **Vercel Hobby** | Uso no comercial |
| API + IA asistiva (mismo proceso) | **Render Free** (servicio web con Docker) | Se apaga por inactividad; ver «Arranque en frío» |
| Base de datos | **Neon** (PostgreSQL) | Con `sslmode=require` |
| Objetos (fotos) | **Cloudflare R2** | API compatible con S3 |

Aquí **la web y la API están en dominios distintos**, a diferencia de la VM. Eso obliga a:

- `NEXT_PUBLIC_API_URL=https://<api>.onrender.com` en la web (en la VM va vacío).
- `WEB_ORIGIN=https://<web>.vercel.app` en la API: CORS con credenciales solo para ese origen.
- Cookies `SameSite=None; Secure` (ADR-009, punto 8). **Pendiente de implementar** en `autenticacion-y-matriz-permisos`: hasta entonces el inicio de sesión entre dominios distintos no funciona en navegadores que bloquean cookies de terceros. Plan B de demostración: un único dominio con un proxy (por ejemplo, la web de Vercel reenviando `/api/*` con `rewrites` hacia Render).

## Variables de entorno

Imágenes: use las de GHCR del tag vigente (`ghcr.io/andreasenjo18/matp-api:vX.Y.Z`); Render las ejecuta como «imagen existente».

**API (Render)**

| Variable | Valor |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | `postgresql+psycopg://<usuario>:<clave>@<host>.neon.tech/<base>?sslmode=require` |
| `S3_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_ENDPOINT_URL` | igual que la anterior (R2 firma con ese host) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Del token de R2 con permisos de lectura y escritura sobre ese bucket |
| `S3_REGION` | `auto` |
| `WEB_ORIGIN` / `CORS_ORIGINS` | `https://<web>.vercel.app` |
| `COOKIE_SECURE` | `true` |
| `AI_PROVIDER` | `mock` |
| `SEED_DEV_PASSWORD` | vacío |

**Web (Vercel)**: `NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_URL=https://<api>.onrender.com` y `API_INTERNAL_URL=https://<api>.onrender.com`.

Primera carga de datos sintéticos: ejecute la semilla contra Neon desde su máquina (`DATABASE_URL=... python -m app.seed`), con el bucket de R2 ya creado.

## Respaldo equivalente

- **Base de datos**: Neon guarda historial propio (restauración a un punto en el tiempo; el período depende del plan, verifíquelo). Además, un **`pg_dump` semanal** desde GitHub Actions programado, subido a R2 (cifrado con `age` o `gpg` antes de subir):

  ```yaml
  # .github/workflows/free-tier-backup.yml (a crear si se usa la contingencia)
  on:
    schedule: [{ cron: "0 6 * * 0" }]   # domingos 06:00 UTC
  jobs:
    dump:
      runs-on: ubuntu-latest
      steps:
        - run: pg_dump --format=custom "$NEON_DATABASE_URL" | age -r "$AGE_PUBLIC_KEY" > matp.pgdump.age
        - run: aws s3 cp matp.pgdump.age "s3://$R2_BUCKET/backups/$(date +%F).pgdump.age" --endpoint-url "$R2_ENDPOINT"
  ```

  Los secretos (`NEON_DATABASE_URL`, `AGE_PUBLIC_KEY`, credenciales de R2) van en *GitHub Secrets*; la clave privada de `age` se guarda fuera de GitHub.
- **Objetos**: R2 es el almacenamiento principal; copie el bucket a otro destino con `rclone sync` antes de cada entrega.

## Límites conocidos (consultados el 2026-10-22)

| Servicio | Límite relevante | Qué pasa al alcanzarlo | Cómo detectarlo |
|---|---|---|---|
| **Render Free** | Se apaga tras 15 min sin tráfico; 750 horas gratuitas por mes y espacio de trabajo | Con las horas agotadas, Render suspende los servicios gratuitos hasta el mes siguiente | Panel de Render → *Billing*; la primera petición tarda cerca de 1 minuto |
| **Neon Free** | 100 horas de cómputo por proyecto al mes; 0,5 GB de almacenamiento por proyecto (hay páginas que dicen 1 GB: verifique); 5 GB de transferencia al mes; el cómputo se apaga a los 5 min de inactividad | Al alcanzar un límite mensual se suspende el cómputo hasta el mes siguiente | Neon → *Usage*; errores de conexión de la API |
| **Cloudflare R2** | 10 GB-mes de almacenamiento, 1 millón de operaciones de escritura y 10 millones de lectura al mes, sin cargo por salida | Pasado el límite se cobra por uso (hay que tener método de pago); no corta el servicio | Panel de R2 → *Metrics* |
| **Vercel Hobby** | Solo uso **no comercial** y personal; 100 GB de transferencia; funciones de 10 s por defecto (configurable hasta 60 s según su documentación) | Hay que esperar 30 días para volver a usar la función que se excedió | Panel de Vercel → *Usage* |

### Si se agota el almacenamiento de Neon

1. Confírmelo en *Usage* de Neon (o por errores `disk full` / compute suspendido en los registros de la API).
2. Libere espacio: borre ramas y proyectos de prueba; la API no borra datos del catálogo (RN-005), así que en una demo con datos sintéticos lo más rápido es **recrear la base** y volver a correr la semilla.
3. Si hay que conservar el contenido: restaure el último `pg_dump` en un proyecto nuevo y cambie `DATABASE_URL` en Render.

## Arranque en frío (qué decirle al público)

La primera petición a Render puede tardar cerca de un minuto. Antes de una demostración, abra `https://<api>.onrender.com/health` unos minutos antes. No use *pings* periódicos para mantenerlo despierto: consumen las 750 horas del mes y contradicen el espíritu del plan gratuito.

## Procedimiento ante un corte de la VM antes de una entrega

1. Cree el tag de la versión vigente (si no existe) para tener imágenes en GHCR.
2. Cree el proyecto en Neon y el bucket y token en R2; configure las variables de arriba.
3. Despliegue la API en Render y la web en Vercel; corra la semilla.
4. Compruebe `GET /health`, inicie sesión con un usuario sintético, busque una pieza y cargue una foto.
5. Anote en el acta de la entrega que se usó la contingencia y la fecha.
