#!/usr/bin/env bash
set -Eeuo pipefail

# MATP - Respaldo PostgreSQL previo al despliegue.
# Compatible con RDS PostgreSQL 18.
# No modifica la base de datos de origen.

ENV_FILE="${MATP_ENV_FILE:-/opt/matp/.env.pruebas}"
BACKUP_DIR="${MATP_BACKUP_DIR:-/opt/matp/backups}"
POSTGRES_IMAGE="${MATP_POSTGRES_IMAGE:-postgres:18}"

error() {
    echo "ERROR [backup]: $*" >&2
    exit 1
}

command -v docker >/dev/null 2>&1 ||
    error "Docker no está disponible."

[[ -f "$ENV_FILE" ]] ||
    error "No existe el archivo de configuración: $ENV_FILE"

[[ -r "$ENV_FILE" ]] ||
    error "No se puede leer el archivo de configuración."

# Evita que los respaldos sean accesibles a otros usuarios.
umask 077

mkdir -p "$BACKUP_DIR" ||
    error "No se pudo crear el directorio de respaldos."

chmod 700 "$BACKUP_DIR" ||
    error "No se pudieron configurar los permisos."

# Directorio absoluto requerido para el montaje Docker.
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
BACKUP_ID="${TIMESTAMP}-$$"

BACKUP_NAME="matp-${BACKUP_ID}.dump"
TEMP_NAME=".matp-${BACKUP_ID}.partial"

BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
TEMP_PATH="$BACKUP_DIR/$TEMP_NAME"

cleanup() {
    rm -f -- "$TEMP_PATH"
}

trap cleanup EXIT

echo "Iniciando respaldo PostgreSQL..."
echo "Destino: $BACKUP_PATH"

# La contraseña se obtiene del archivo privado mediante
# --env-file. No se imprime ni se introduce en GitHub.
#
# DATABASE_URL puede usar el prefijo SQLAlchemy:
# postgresql+psycopg://
#
# pg_dump necesita el formato estándar:
# postgresql://

if ! docker run --rm \
    --network bridge \
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
    error "Falló pg_dump o la validación del respaldo."
fi

[[ -s "$TEMP_PATH" ]] ||
    error "El archivo de respaldo está vacío o no existe."

mv -- "$TEMP_PATH" "$BACKUP_PATH" ||
    error "No se pudo finalizar el archivo de respaldo."

chmod 600 "$BACKUP_PATH" ||
    error "No se pudieron proteger los permisos del respaldo."

echo "Respaldo generado y validado correctamente."
echo "Archivo: $BACKUP_PATH"
echo "Tamaño: $(du -h "$BACKUP_PATH" | cut -f1)"
