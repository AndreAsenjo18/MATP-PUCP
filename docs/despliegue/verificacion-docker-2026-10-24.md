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

## Verificaciones posteriores (mismo día)

### Autenticación detrás del proxy HTTPS (tarea 5.1 de `autenticacion-y-matriz-permisos`)

Overlay de producción completo en un proyecto aislado, con la imagen publicada de la API, `APP_ENV=production`, `SESSION_IDLE_MINUTES=1` y datos sintéticos. Migraciones y semilla por la misma vía que `deploy.sh` (`compose run --rm --no-deps api alembic upgrade head`).

| Verificación | Resultado |
|---|---|
| Usuario **sintético** en producción | `401 invalid_credentials` (mismo mensaje genérico) |
| Cookie de sesión | `HttpOnly; Secure; SameSite=lax; Max-Age=43200`; el token **no** viaja en el cuerpo |
| Cookie CSRF | `Secure; SameSite=lax`, legible por la web (sin `HttpOnly`) |
| `GET /auth/me` | 200 con cookie, 401 sin cookie |
| Escritura (crear colección) | Sin `X-CSRF-Token` → `csrf_failed`; con token de otra sesión → `csrf_failed`; con el correcto → 201 |
| Cookie `Secure` por `http` | El proxy responde 308 a HTTPS antes de atender |
| Bloqueo | 5 contraseñas incorrectas seguidas; la correcta durante el bloqueo sigue dando `invalid_credentials` |
| Expiración por inactividad (1 min) | Tras 70 s → `session_expired`; después → `session_revoked` |
| Logout | 204; cookies borradas (`Max-Age=0`); reusar la cookie copiada → `session_revoked` |
| Registro de eventos | `LOGIN_OK`, `LOGIN_FAILED`, `LOCKED`, `LOGOUT` y `SESSION_REVOKED` guardados; **0 filas con la contraseña en claro**; la base solo guarda huellas SHA-256 de 64 hex |

### Auditoría sobre PostgreSQL real (tarea 6.1 de `auditoria-y-soft-delete-transversal`)

PostgreSQL 18.6, 14 migraciones aplicadas, 300 piezas sintéticas (20 201 filas de auditoría).

| Verificación | Resultado |
|---|---|
| Disparadores de solo inserción | 2 por tabla en `audit_log`, `auth_event`, `sensitive_access_log` y `audit_digest`; `UPDATE`, `DELETE` y `TRUNCATE` sobre `audit_log` son rechazados («es de solo inserción») y las 20 201 filas siguen |
| Resumen diario de integridad | Sella el día (20 201 filas); `--verify` intacto → código 0 |
| Alteración simulada (se altera una fila con los disparadores desactivados solo en la base descartable) | `--verify` → código 1 e identifica el día (`ALTERADO 2026-10-21`); al restaurar la fila → código 0 |
| Importación que no se debe aplicar | La sábana sintética trae una fila con código de inventario en una pieza en comodato (RN-003/RN-004): el lote queda `FAILED_APPLY` sin aplicar **ninguna** fila, como debe |
| Lote grande: 300 piezas nuevas importadas | Conjunto de cambios de 601 entidades y 4801 filas de auditoría; vista previa sin conflictos (exige `preview_token`) |
| Reversión de ese lote | **2 s**; piezas activas 598 → 298; las 300 quedan con eliminación lógica (600 filas físicas: nada se borra, RN-005); nuevo conjunto `REVERT`/`SOFT_DELETE` de 1801 filas; el original queda marcado como revertido; `--verify` sigue en 0 |

### `/health` con el campo `backup` en una imagen publicada

El CD2 desplegó solo la imagen de `main` (`5887375`, que incluye este change) y `GET /health` devuelve `"backup": {"status": "disabled", ...}` (staging no configura el marcador, como se espera). El comportamiento con marcador (`ok`/`stale`) sigue cubierto por las pruebas de la API.

## Lo que sigue sin verificar

- **Despliegue real en la VM de la PUCP** y primer respaldo contra el destino externo definitivo (hay que pedir los datos de la DTI, ver [`checklist-vm.md`](checklist-vm.md)).
- **Workflow `release.yml`** en un tag de prueba, y una ejecución con `rclone` real contra un bucket (el ensayo usó un doble que copia un directorio).
- **Rollback de `deploy.sh --rollback`** y el escaneo de puertos desde otra máquina.
