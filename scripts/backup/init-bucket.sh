#!/usr/bin/env bash
# MATP - Crea el bucket de objetos si no existe (primera instalación en la VM).
# OpenSpec: despliegue-vm-y-respaldos, tarea 3.1. `scripts/deploy.sh` respalda antes de migrar y
# ese respaldo copia el bucket; en el primer despliegue la API aún no ha podido crearlo.
# Requiere el servicio `storage` en ejecución (docs/despliegue/vm.md, «Primera instalación»).
set -Eeuo pipefail

# El compose de producción exige MATP_VERSION para interpolar; aquí solo se necesita localizar la red.
export MATP_VERSION="${MATP_VERSION:-primera-instalacion}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

rclone_make_bucket "${S3_BUCKET:?Defina S3_BUCKET en .env.production}"
log_json info bucket_ready "${S3_BUCKET}"
