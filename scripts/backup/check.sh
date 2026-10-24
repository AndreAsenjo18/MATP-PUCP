#!/usr/bin/env bash
# MATP - Verificación de integridad del repositorio de respaldos.
# OpenSpec: despliegue-vm-y-respaldos, tarea 3.2 (design D4; RNF-011).
#
# `restic check --read-data-subset` lee una muestra de los datos cifrados (5 % por defecto) para
# detectar corrupción antes de necesitar una restauración. Se programa cada domingo
# (deploy/vm/systemd/matp-backup-check.timer). Avisa por webhook si falla.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

SUBSET="${BACKUP_CHECK_SUBSET:-5%}"

if [[ -f "$MATP_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$MATP_ENV_FILE" && set +a
fi

require_backup_env || { notify "no se pudo verificar los respaldos: faltan variables o la clave."; exit 1; }

log_json info check_started "muestra: ${SUBSET}"
if restic_cmd check --read-data-subset="$SUBSET"; then
    log_json info check_finished "repositorio íntegro"
else
    log_json error check_failed "restic check encontró errores"
    notify "la verificación de integridad de los respaldos FALLÓ. Revise el repositorio antes del próximo respaldo."
    exit 1
fi
