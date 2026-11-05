#!/usr/bin/env bash
# MATP - Respaldo cifrado de la base de datos y del almacenamiento de objetos.
# OpenSpec: despliegue-vm-y-respaldos, tarea 3.1 (ADR-011, design D4; RNF-011, RNF-014).
#
# Qué hace, en orden:
#   1. pg_dump (formato custom) en streaming directo a restic: nunca toca el disco sin cifrar.
#   2. Espejo local del bucket (rclone) y respaldo del espejo con restic.
#   3. Retención: restic forget --prune (30 diarios, 8 semanales, 6 mensuales) [SUPUESTO C6].
#   4. Marcador JSON que lee /health (backup_status) y aviso por webhook si algo falla.
#
# Se programa con deploy/vm/systemd/matp-backup.timer. Variables: .env.production
# (RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE, ALERT_WEBHOOK_URL, ver .env.example).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

KEEP_DAILY="${BACKUP_KEEP_DAILY:-30}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
MIRROR_DIR="${BACKUP_MIRROR_DIR:-/opt/matp/backup-mirror}"
SKIP_OBJECTS="${BACKUP_SKIP_OBJECTS:-0}"

# lib.sh ya cargó $MATP_ENV_FILE (sin ejecutarlo) antes de leer cualquier valor por defecto.

previous="$(previous_success)"

fail() {
    local reason="$1"
    log_json error backup_failed "$reason"
    write_marker failed "$previous"
    notify "el respaldo falló: ${reason}. El último exitoso fue ${previous:-nunca}."
    exit 1
}

# Candado: dos respaldos a la vez dañarían el espejo.
mkdir -p "$MATP_STATE_DIR"
exec 9> "${MATP_STATE_DIR}/backup.lock"
if command -v flock > /dev/null 2>&1 && ! flock -n 9; then
    log_json warn backup_skipped "otro respaldo está en curso"
    exit 0
fi

require_backup_env || fail "variables o clave de respaldos incompletas"
log_json info backup_started "destino: ${RESTIC_REPOSITORY}"

# 1. Base de datos --------------------------------------------------------------------------
# shellcheck disable=SC2086  # MATP_COMPOSE es un comando con argumentos
if ! $MATP_COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" --format=custom \
    | restic_cmd backup --stdin --stdin-filename matp.pgdump --tag db --tag "$(date -u +%Y-%m-%d)"; then
    fail "no se pudo respaldar la base de datos en el destino externo"
fi
log_json info database_backed_up ""

# 2. Almacenamiento de objetos ---------------------------------------------------------------
if [[ "$SKIP_OBJECTS" != "1" ]]; then
    mkdir -p "$MIRROR_DIR"
    if ! rclone_sync_bucket "${S3_BUCKET:?}" "$MIRROR_DIR"; then
        fail "no se pudo copiar el bucket al espejo local"
    fi
    if ! restic_cmd backup "$MIRROR_DIR" --tag objects --tag "$(date -u +%Y-%m-%d)"; then
        fail "no se pudieron respaldar los objetos en el destino externo"
    fi
    log_json info objects_backed_up ""
fi

# 3. Retención -------------------------------------------------------------------------------
if ! restic_cmd forget --prune --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" \
    --keep-monthly "$KEEP_MONTHLY"; then
    fail "el respaldo se guardó pero no se pudo aplicar la retención"
fi

write_marker ok "$(now_utc)"
log_json info backup_finished ""
