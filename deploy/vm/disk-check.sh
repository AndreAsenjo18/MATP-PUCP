#!/usr/bin/env bash
# MATP - Alerta de espacio en disco (change despliegue-vm-y-respaldos, tarea 4.1; RNF-015).
# Avisa por webhook cuando el uso supera DISK_ALERT_THRESHOLD (80 % por defecto) e incluye los
# directorios que más ocupan. Lo programa deploy/vm/systemd/matp-disk-check.timer (cada hora).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/../../scripts/backup/lib.sh"

THRESHOLD="${DISK_ALERT_THRESHOLD:-80}"
MOUNT="${DISK_CHECK_PATH:-/}"

used="$(df --output=pcent "$MOUNT" | tail -n 1 | tr -dc '0-9')"
if [[ -z "$used" ]]; then
    log_json error disk_check_failed "no se pudo leer el uso de ${MOUNT}"
    exit 1
fi

if (( used >= THRESHOLD )); then
    top="$(du -x -d 2 "$MOUNT" 2> /dev/null | sort -rn | sed -n '2,6p' | awk '{printf "%s %s; ", $1, $2}')"
    log_json warn disk_almost_full "${used}% en ${MOUNT}"
    notify "disco al ${used}% en ${MOUNT} (umbral ${THRESHOLD}%). Mayores: ${top}"
else
    log_json info disk_ok "${used}% en ${MOUNT}"
fi
