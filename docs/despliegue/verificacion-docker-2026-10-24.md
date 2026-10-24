# Verificación con Docker real (2026-10-24)

Evidencia del change `despliegue-vm-y-respaldos`: lo que antes solo se había probado sin Docker se ejecutó en la **EC2 de staging** (AWS Academy, Amazon Linux 2023, Docker 25.0.14, Compose v5.6.0). **No es la VM de la PUCP**: sirve para validar los archivos, no sustituye el primer despliegue real ni un simulacro contra el destino externo definitivo.

## Cómo se hizo (sin tocar el staging)

- Los archivos se copiaron a un directorio temporal aislado y se **eliminó todo al terminar** (archivos, contenedores, redes, volúmenes e imágenes descargadas).
- Variables **ficticias**; no se leyó `.env.pruebas`, ni se usaron RDS o S3.
- Proyectos Compose propios (`matp-vfy`, `matp-verify`, `matp-restore-test`), con puertos remapeados para no chocar con el Caddy de staging. El stack `matp-staging` siguió `healthy` durante y después de la verificación.

## Resultados

| # | Verificación | Resultado |
|---|---|---|
| 1 | `docker compose config` del overlay de producción | Válido |
| 2 | Puertos publicados | Solo el proxy (80, 443, 443/udp); `api`, `web`, `db` y `storage` no publican |
| 3 | Falta una variable obligatoria (`MATP_DOMAIN` o `MATP_VERSION`) | `config` falla (código 1) indicando la variable, antes de tocar nada |
| 4 | `caddy validate` (Caddy 2.11.4) | `Valid configuration`; HTTP→HTTPS automático; solo `<dominio>` y `media.<dominio>`; ninguna ruta `/ai` |
| 5 | `shellcheck` (nivel `style`) de los scripts de respaldo y `disk-check.sh` | Sin observaciones |
| 6 | `systemd-analyze verify` de las 10 unidades | Sin observaciones sobre las unidades de MATP |
| 7 | Pruebas existentes del respaldo de staging (`scripts/backup/tests/run.sh`) | 4 de 4 |
| 8 | Overlay completo en un proyecto aislado (`up -d --wait`) | Los 5 servicios `healthy`; solo el proxy escucha en el host |
| 9 | Proxy | 308 de HTTP a HTTPS; HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options`; sin cabecera `Server`; `/health` y `/api/*` llegan a la API; `/ai/*` no llega a la IA |
| 10 | Endurecimiento | API uid 999 con sistema de archivos de solo lectura (escribir en `/app` falla, `/tmp` sí) y marcador de respaldo montado solo lectura; web uid 100; proxy **uid 1000** (corregido tras esta prueba); `cap_drop: ALL`; límites de memoria y logs rotados (`10m` × 5) en todos |
| 11 | Respaldo real con **restic 0.19.1** y `pg_dump` real | Instantáneas de base y de objetos; retención aplicada; marcador `ok` |
| 12 | `restic check --read-data-subset=5%` | Sin errores |
| 13 | Simulacro de restauración (`restore-test.sh`) con datos sintéticos | **CORRECTO**: esquema en la cabeza de Alembic (`0011_import_photos`), conteos de tablas clave y muestra de fotos coincide con su huella; **RTO medido: 10 s** (base pequeña; no extrapolar) |
| 14 | Foto alterada dentro del respaldo | Simulacro **FALLIDO**, indicando la foto afectada (`HUELLA DISTINTA: <clave>`) y registro del fallo |
| 15 | Destino de respaldos inaccesible | El respaldo falla, el marcador pasa a `failed` **conservando el último éxito** y se registra el motivo |

## Defectos que esta verificación encontró (y se corrigieron)

1. **El espejo del bucket no estaba montado en el contenedor de restic**: el respaldo de objetos habría fallado cada noche (`/…/mirror does not exist`). Corregido en `scripts/backup/lib.sh` y cubierto por la prueba `test_the_restic_container_sees_the_mirror_and_runs_as_the_caller`.
2. **restic corría como root** dentro de su contenedor: los archivos restaurados en el simulacro no se habrían podido leer. Ahora corre con el usuario de quien invoca.
3. **El proxy corría como uid 0** (con capacidades recortadas). Ahora corre como uid 1000 con `net.ipv4.ip_unprivileged_port_start=0`.
4. **El simulacro no decía en qué paso falló** cuando se interrumpía antes de las verificaciones. Ahora el registro incluye el paso.
5. **`scripts/deploy.sh` tenía una línea en blanco antes del shebang** (ya venía así de main): ejecutado directamente se habría interpretado con `sh`. Corregido.
6. Un error de proceso propio: una versión previa de este change **sobrescribió `scripts/backup/backup.sh`**, el respaldo previo al despliegue de staging. Se restauró idéntico a main y el respaldo con restic pasó a `backup-restic.sh`; `deploy.sh` usa el de restic solo con `MATP_ENV=production`.

## Lo que sigue sin verificar

- **Despliegue real en la VM de la PUCP** y primer respaldo contra el destino externo definitivo (hay que pedir los datos de la DTI, ver [`checklist-vm.md`](checklist-vm.md)).
- **`/health` con el campo `backup` desde una imagen real**: la imagen de staging (`ed64b2a`) es anterior a ese cambio y devuelve `backup: null`. El comportamiento está cubierto por pruebas de la API; falta verlo en una imagen publicada.
- **Workflow `release.yml`** en un tag de prueba, y una ejecución con `rclone` real contra un bucket (el ensayo usó un doble que copia un directorio).
- **Rollback de `deploy.sh --rollback`** y el escaneo de puertos desde otra máquina.
