#!/usr/bin/env bash
# MATP - Simulacro de restauración en un entorno aislado.
# OpenSpec: despliegue-vm-y-respaldos, tarea 3.2 (design D5; RNF-011, RNF-004).
#
# Restaura el ÚLTIMO respaldo en contenedores propios (red y nombres `matp-restore-test`), nunca
# sobre producción, y comprueba: versión del esquema (alembic), conteos de tablas clave y la
# huella SHA-256 de una muestra de fotos contra media_asset.content_sha256. Escribe el registro
# docs/despliegue/simulacros/<fecha>.md con la duración (el RTO medido) y el resultado.
# Termina con código distinto de 0 si algo no coincide.
#
# Necesita Docker, restic (o RESTIC_IMAGE) y las variables de .env.production. Frecuencia
# acordada [SUPUESTO]: mensual y antes de cada entrega del curso.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=scripts/backup/lib.sh
source "${SCRIPT_DIR}/lib.sh"

if [[ -f "$MATP_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$MATP_ENV_FILE" && set +a
fi

PROJECT="matp-restore-test"
NETWORK="${PROJECT}"
DB_CONTAINER="${PROJECT}-db"
WORK_DIR="${BACKUP_WORK_DIR:-/opt/matp/backup-work}/restore-test"
PHOTO_SAMPLE="${RESTORE_PHOTO_SAMPLE:-20}"
RECORD_DIR="${RESTORE_RECORD_DIR:-${REPO_ROOT}/docs/despliegue/simulacros}"
POSTGRES_IMAGE="${RESTORE_POSTGRES_IMAGE:-postgres:18-alpine}"
API_IMAGE="${RESTORE_API_IMAGE:?Defina RESTORE_API_IMAGE (imagen matp-api de la versión desplegada)}"

started_epoch="$(date -u +%s)"
started_at="$(now_utc)"
result="FALLIDO"
step="preparación"
details=()

cleanup() {
    docker rm -f "$DB_CONTAINER" > /dev/null 2>&1 || true
    docker network rm "$NETWORK" > /dev/null 2>&1 || true
    rm -rf "$WORK_DIR"
}

write_record() {
    local finished_epoch duration file
    finished_epoch="$(date -u +%s)"
    duration=$((finished_epoch - started_epoch))
    mkdir -p "$RECORD_DIR"
    file="${RECORD_DIR}/$(date -u +%Y-%m-%d).md"
    {
        echo "# Simulacro de restauración ${started_at}"
        echo
        echo "- **Resultado**: ${result}"
        echo "- **Duración de la restauración (RTO medido)**: ${duration} s"
        echo "- **Versión de la API usada**: ${API_IMAGE}"
        echo "- **Repositorio**: ${RESTIC_REPOSITORY}"
        echo
        echo "## Verificaciones"
        local line
        for line in "${details[@]}"; do
            echo "- ${line}"
        done
    } > "$file"
    log_json info restore_record_written "$file"
}

on_exit() {
    local status=$?
    if [[ $status -ne 0 ]]; then
        details+=("Se interrumpió en el paso: ${step} (revise el registro del script)")
    fi
    write_record
    cleanup
    if [[ $status -ne 0 ]]; then
        notify "el simulacro de restauración FALLÓ (ver ${RECORD_DIR})."
    fi
}
trap on_exit EXIT

require_backup_env
mkdir -p "$WORK_DIR/db" "$WORK_DIR/objects"
docker network create "$NETWORK" > /dev/null

step="restaurar el último respaldo"
# 1. Restaurar el último respaldo ------------------------------------------------------------
log_json info restore_started "$started_at"
restic_cmd restore latest --tag db --target "$WORK_DIR/db"
restic_cmd restore latest --tag objects --target "$WORK_DIR/objects"
details+=("Respaldo restaurado en un directorio temporal")

step="levantar la base aislada y restaurar el volcado"
# 2. Base de datos aislada ---------------------------------------------------------------------
docker run -d --name "$DB_CONTAINER" --network "$NETWORK" \
    -e POSTGRES_PASSWORD=restore-test -e POSTGRES_DB=matp -e POSTGRES_USER=matp \
    "$POSTGRES_IMAGE" > /dev/null
for _ in $(seq 1 60); do
    docker exec "$DB_CONTAINER" pg_isready -U matp -d matp > /dev/null 2>&1 && break
    sleep 2
done
docker exec -i "$DB_CONTAINER" pg_restore -U matp -d matp --no-owner < "$WORK_DIR/db/matp.pgdump"
details+=("Base restaurada con pg_restore")

step="comprobar la versión del esquema"
# 3. Versión del esquema -----------------------------------------------------------------------
current="$(docker run --rm --network "$NETWORK" \
    -e DATABASE_URL="postgresql+psycopg://matp:restore-test@${DB_CONTAINER}:5432/matp" \
    -e S3_BUCKET=restore-test -e S3_ENDPOINT_URL=http://localhost:9 \
    "$API_IMAGE" alembic current 2> /dev/null | tail -n 1)"
case "$current" in
    *"(head)"*) details+=("Esquema en la cabeza de Alembic: ${current}") ;;
    *)
        details+=("Esquema NO está en la cabeza: '${current}'")
        exit 1
        ;;
esac

step="contar las tablas clave"
# 4. Conteos de tablas clave ---------------------------------------------------------------------
for table in piece collection piece_identifier media_asset audit_log app_user; do
    count="$(docker exec "$DB_CONTAINER" psql -U matp -d matp -At -c "SELECT count(*) FROM ${table}")"
    details+=("Filas en ${table}: ${count}")
done

step="comparar la muestra de fotos con su huella"
# 5. Muestra de fotos contra la huella registrada ----------------------------------------------
if docker exec "$DB_CONTAINER" psql -U matp -d matp -At -F $'\t' \
    -c "SELECT storage_key, content_sha256 FROM media_asset WHERE deleted_at IS NULL ORDER BY random() LIMIT ${PHOTO_SAMPLE}" \
    | verify_photos "$WORK_DIR/objects/${BACKUP_MIRROR_DIR:-opt/matp/backup-mirror}"; then
    details+=("Muestra de fotos (${PHOTO_SAMPLE}): todas coinciden con su huella")
else
    details+=("Muestra de fotos: HAY FOTOS QUE NO COINCIDEN (ver salida del script)")
    exit 1
fi

result="CORRECTO"
log_json info restore_finished "$result"
