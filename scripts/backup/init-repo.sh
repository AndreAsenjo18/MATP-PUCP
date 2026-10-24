#!/usr/bin/env bash
# MATP - Inicializa el repositorio de respaldos de restic (una sola vez, primera instalación).
# OpenSpec: despliegue-vm-y-respaldos, tarea 3.1. Usa restic instalado o su imagen RESTIC_IMAGE
# y lee RESTIC_REPOSITORY y RESTIC_PASSWORD_FILE de .env.production (sin ejecutar el archivo).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_backup_env
restic_cmd init
log_json info restic_repository_ready "${RESTIC_REPOSITORY}"
echo "Guarde ahora una copia de la clave (${RESTIC_PASSWORD_FILE}) FUERA de la VM: sin ella los respaldos no se pueden leer."
