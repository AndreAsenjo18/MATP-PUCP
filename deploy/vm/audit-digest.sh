#!/usr/bin/env bash
# MATP - Resumen diario de integridad de la auditoría (change despliegue-vm-y-respaldos, tarea 4.1;
# comando del change auditoria-y-soft-delete-transversal, RF-040, RNF-007).
#
# 1) Sella los días cerrados que aún no tienen resumen y 2) recalcula todos los resúmenes para
# detectar si alguien alteró la auditoría. Si cualquiera de los dos pasos falla avisa por webhook.
# Lo programa deploy/vm/systemd/matp-audit-digest.timer (00:30).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/../../scripts/backup/lib.sh"

if [[ -f "$MATP_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$MATP_ENV_FILE" && set +a
fi

# shellcheck disable=SC2086  # MATP_COMPOSE es un comando con argumentos
if ! $MATP_COMPOSE exec -T api python -m app.modules.audit.digest; then
    log_json error audit_digest_failed "no se pudo sellar el resumen diario"
    notify "no se pudo generar el resumen diario de integridad de la auditoría."
    exit 1
fi
log_json info audit_digest_sealed ""

# shellcheck disable=SC2086
if ! $MATP_COMPOSE exec -T api python -m app.modules.audit.digest --verify; then
    log_json error audit_integrity_failed "la verificación de los resúmenes encontró diferencias"
    notify "ALERTA: la verificación de integridad de la auditoría encontró diferencias. Revise audit_digest."
    exit 1
fi
log_json info audit_integrity_ok ""
