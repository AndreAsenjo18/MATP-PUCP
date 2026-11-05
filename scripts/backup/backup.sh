#!/usr/bin/env bash
set -Eeuo pipefail

# MATP - Respaldo PostgreSQL previo al despliegue.
# Genera, valida, sube a S3 y verifica la integridad.
# Un fallo impide que deploy.sh ejecute migraciones.

ENV_FILE="${MATP_ENV_FILE:-/opt/matp/.env.pruebas}"
BACKUP_DIR="${MATP_BACKUP_DIR:-/opt/matp/backups}"
POSTGRES_IMAGE="${MATP_POSTGRES_IMAGE:-postgres:18}"

S3_BUCKET="${MATP_BACKUP_S3_BUCKET:-matp-staging-db-backups-761312607064}"
S3_PREFIX="${MATP_BACKUP_S3_PREFIX:-staging/postgresql}"

error() {
    echo "ERROR [backup]: $*" >&2
    exit 1
}

for tool in docker aws cmp; do
    command -v "$tool" >/dev/null 2>&1 ||
        error "Herramienta requerida no disponible: $tool"
done

[[ -f "$ENV_FILE" && -r "$ENV_FILE" ]] ||
    error "No se puede leer $ENV_FILE."

[[ -n "$S3_BUCKET" && -n "$S3_PREFIX" ]] ||
    error "El bucket y prefijo S3 son obligatorios."

umask 077

mkdir -p "$BACKUP_DIR" ||
    error "No se pudo crear el directorio de respaldos."

chmod 700 "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
BACKUP_ID="${TIMESTAMP}-$$"

BACKUP_NAME="matp-${BACKUP_ID}.dump"
TEMP_NAME=".matp-${BACKUP_ID}.partial"

BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
TEMP_PATH="$BACKUP_DIR/$TEMP_NAME"
VERIFY_PATH="$BACKUP_DIR/.matp-${BACKUP_ID}.s3-check"

S3_KEY="${S3_PREFIX%/}/$BACKUP_NAME"
S3_URI="s3://$S3_BUCKET/$S3_KEY"

cleanup() {
    rm -f -- "$TEMP_PATH" "$VERIFY_PATH"
}

trap cleanup EXIT

echo "Iniciando respaldo PostgreSQL..."
echo "Destino local: $BACKUP_PATH"

# PostgreSQL 18 se ejecuta con el UID/GID del usuario EC2.
# La conexión se lee del archivo de entorno privado.

if ! docker run --rm \
    --network bridge \
    --user "$(id -u):$(id -g)" \
    --env-file "$ENV_FILE" \
    --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
    "$POSTGRES_IMAGE" \
    sh -ec '
        if [ -z "${DATABASE_URL:-}" ]; then
            echo "ERROR: DATABASE_URL no está definido." >&2
            exit 1
        fi

        DB_URL=$(printf "%s" "$DATABASE_URL" |
            sed "s#^postgresql+psycopg://#postgresql://#")

        pg_dump \
            --format=custom \
            --no-owner \
            --no-acl \
            --file="/backup/$1" \
            --dbname="$DB_URL"

        test -s "/backup/$1"

        pg_restore \
            --list \
            "/backup/$1" >/dev/null

        chmod 600 "/backup/$1"
    ' sh "$TEMP_NAME"; then
    error "Falló pg_dump o la validación local."
fi

[[ -s "$TEMP_PATH" ]] ||
    error "El archivo temporal no existe o está vacío."

mv -- "$TEMP_PATH" "$BACKUP_PATH" ||
    error "No se pudo finalizar el respaldo local."

chmod 600 "$BACKUP_PATH"

echo "Respaldo local generado y validado."
echo "Subiendo copia cifrada a S3..."

if ! aws s3 cp \
    "$BACKUP_PATH" "$S3_URI" \
    --sse AES256 \
    --only-show-errors; then
    error "Falló la subida a S3. Se conserva el respaldo local."
fi

echo "Descargando copia para comprobar integridad..."

if ! aws s3 cp \
    "$S3_URI" "$VERIFY_PATH" \
    --only-show-errors; then
    error "No se pudo descargar la copia de S3."
fi

if ! cmp -s "$BACKUP_PATH" "$VERIFY_PATH"; then
    error "La copia de S3 no coincide con el respaldo local."
fi

echo "Integridad S3: OK"
echo "Respaldo previo completado correctamente."
echo "Archivo local: $BACKUP_PATH"
echo "Destino S3: $S3_URI"
