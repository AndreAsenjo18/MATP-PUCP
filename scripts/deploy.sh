#!/usr/bin/env bash
set -Eeuo pipefail

# MATP - Despliegue de staging y producción.
# OpenSpec: despliegue-vm-y-respaldos, tarea 2.2.
#
# Requisitos: Bash, Docker Compose v2 y flock (Linux).
# IMPORTANTE: el rollback revierte contenedores, NO la base de datos.

usage() {
    echo "Uso: $0 <sha-COMMIT|vX.Y.Z|--rollback>"
}

error() {
    echo "ERROR: $*" >&2
    exit 1
}

valid_version() {
    [[ "$1" =~ ^(sha-[a-f0-9]{40}|v[0-9]+\.[0-9]+\.[0-9]+)$ ]]
}

log_event() {
    local status="$1"
    local version="$2"

    printf '%s | %s | %s | %s\n' \
        "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        "$MATP_ENV" \
        "$version" \
        "$status" >> "$DEPLOYMENTS_LOG"
}

write_state() {
    local new_current="$1"
    local new_previous="${2:-}"
    local temp_current
    local temp_previous

    temp_current="$(mktemp "$DEPLOY_STATE_DIR/.current.XXXXXX")"
    printf '%s\n' "$new_current" > "$temp_current"

    if [[ -n "$new_previous" ]]; then
        temp_previous="$(mktemp "$DEPLOY_STATE_DIR/.previous.XXXXXX")"
        printf '%s\n' "$new_previous" > "$temp_previous"
        mv -f "$temp_previous" "$PREVIOUS_VERSION_FILE"
    fi

    mv -f "$temp_current" "$CURRENT_VERSION_FILE"
}

deploy_containers() {
    docker compose "${COMPOSE_ARGS[@]}" up \
        -d \
        --no-deps \
        --no-build \
        --wait \
        --wait-timeout 120 \
        api web
}

# ------------------------------------------------------------
# 1. Validación de argumentos y entorno
# ------------------------------------------------------------

if [[ $# -ne 1 ]]; then
    usage
    exit 2
fi

REQUEST="$1"
IS_ROLLBACK=false

if [[ "$REQUEST" == "--rollback" ]]; then
    IS_ROLLBACK=true
elif ! valid_version "$REQUEST"; then
    echo "ERROR: Formato de versión inválido: $REQUEST" >&2
    usage
    exit 2
fi

MATP_ENV="${MATP_ENV:-}"

case "$MATP_ENV" in
    staging)
        DEFAULT_ENV_FILE="/opt/matp/.env.pruebas"
        ;;
    production)
        DEFAULT_ENV_FILE="/opt/matp/.env.production"
        ;;
    *)
        error "MATP_ENV debe ser staging o production."
        ;;
esac

MATP_ENV_FILE="${MATP_ENV_FILE:-$DEFAULT_ENV_FILE}"

[[ -f "$MATP_ENV_FILE" ]] ||
    error "No existe el archivo: $MATP_ENV_FILE"

for variable in DATABASE_URL S3_BUCKET; do
    if ! grep -Eq "^[[:space:]]*${variable}=[^[:space:]#]+" \
        "$MATP_ENV_FILE"; then
        error "Falta la variable obligatoria $variable o está vacía."
    fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

case "$MATP_ENV" in
    staging)
        COMPOSE_FILES=(
            "$PROJECT_ROOT/deploy/staging/docker-compose.staging.yml"
        )
        ;;
    production)
        COMPOSE_FILES=(
            "$PROJECT_ROOT/docker-compose.yml"
            "$PROJECT_ROOT/deploy/vm/docker-compose.prod.yml"
        )
        ;;
esac

COMPOSE_ARGS=(
    --project-directory "$PROJECT_ROOT"
    --env-file "$MATP_ENV_FILE"
)

for compose_file in "${COMPOSE_FILES[@]}"; do
    [[ -f "$compose_file" ]] ||
        error "No existe el archivo Compose: $compose_file"

    COMPOSE_ARGS+=(-f "$compose_file")
done

export MATP_ENV_FILE

# ------------------------------------------------------------
# 2. Estado persistente y exclusión mutua
# ------------------------------------------------------------

DEPLOY_STATE_DIR="${MATP_DEPLOY_STATE_DIR:-/opt/matp/state}"
DEPLOYMENTS_LOG="${MATP_DEPLOYMENTS_LOG:-/opt/matp/deployments.log}"

mkdir -p "$DEPLOY_STATE_DIR"

CURRENT_VERSION_FILE="$DEPLOY_STATE_DIR/current-version"
PREVIOUS_VERSION_FILE="$DEPLOY_STATE_DIR/previous-version"
LOCK_FILE="$DEPLOY_STATE_DIR/deploy.lock"

command -v flock >/dev/null 2>&1 ||
    error "No está disponible flock."

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
    error "Ya hay otro despliegue en ejecución."
fi

CURRENT_VERSION=""
PREVIOUS_VERSION=""

if [[ -f "$CURRENT_VERSION_FILE" ]]; then
    CURRENT_VERSION="$(cat "$CURRENT_VERSION_FILE")"
    valid_version "$CURRENT_VERSION" ||
        error "La versión actual registrada es inválida."
fi

if [[ -f "$PREVIOUS_VERSION_FILE" ]]; then
    PREVIOUS_VERSION="$(cat "$PREVIOUS_VERSION_FILE")"
    valid_version "$PREVIOUS_VERSION" ||
        error "La versión anterior registrada es inválida."
fi

# ------------------------------------------------------------
# 3. Determinar versión de destino
# ------------------------------------------------------------

if [[ "$IS_ROLLBACK" == true ]]; then

    [[ -n "$CURRENT_VERSION" ]] ||
        error "No existe una versión actual registrada."

    [[ -n "$PREVIOUS_VERSION" ]] ||
        error "No existe una versión anterior para restaurar."

    [[ "$CURRENT_VERSION" != "$PREVIOUS_VERSION" ]] ||
        error "Las versiones actual y anterior son iguales."

    # No se restauran automáticamente las migraciones PostgreSQL.
    if [[ "${MATP_ALLOW_APP_ROLLBACK:-}" != "1" ]]; then
        error "El rollback solo revierte la aplicación. Verifique la compatibilidad de la base de datos y establezca MATP_ALLOW_APP_ROLLBACK=1 para autorizarlo."
    fi

    VERSION="$PREVIOUS_VERSION"
    echo "Rollback: $CURRENT_VERSION -> $VERSION"

else
    VERSION="$REQUEST"
    echo "Despliegue solicitado: $VERSION"

    if [[ "$VERSION" == "$CURRENT_VERSION" ]]; then
        echo "La versión solicitada ya figura como desplegada."
        exit 0
    fi
fi

export MATP_VERSION="$VERSION"

# ------------------------------------------------------------
# 4. Validar Compose y descargar imágenes
# ------------------------------------------------------------

echo "Validando Docker Compose..."

docker compose "${COMPOSE_ARGS[@]}" config --quiet ||
    error "La configuración Docker Compose es inválida."

echo "Descargando imágenes de $VERSION..."

docker compose "${COMPOSE_ARGS[@]}" pull api web ||
    error "No se pudieron descargar las imágenes."

# ------------------------------------------------------------
# 5. Rollback de aplicación
# ------------------------------------------------------------

if [[ "$IS_ROLLBACK" == true ]]; then

    echo "Restaurando los contenedores de $VERSION..."

    if ! deploy_containers; then
        log_event "rollback_failed" "$VERSION" || true
        error "Falló el rollback. Revise los contenedores manualmente."
    fi

    # Conserva la versión reemplazada como candidata de retorno.
    write_state "$VERSION" "$CURRENT_VERSION"

    log_event "rollback_success" "$VERSION"

    echo "Rollback de aplicación completado: $VERSION"
    echo "La base de datos NO fue restaurada."
    exit 0
fi

# ------------------------------------------------------------
# 6. Respaldo obligatorio
# ------------------------------------------------------------

# Staging conserva su respaldo previo (pg_dump + copia verificada en S3, backup.sh). La VM de
# producción usa el respaldo cifrado con restic (backup-restic.sh, ADR-011): destino externo,
# retención y marcador de estado para /health.
case "$MATP_ENV" in
    production) BACKUP_SCRIPT="$PROJECT_ROOT/scripts/backup/backup-restic.sh" ;;
    *) BACKUP_SCRIPT="$PROJECT_ROOT/scripts/backup/backup.sh" ;;
esac

[[ -f "$BACKUP_SCRIPT" ]] ||
    error "No existe el script de respaldo: $BACKUP_SCRIPT"

echo "Ejecutando respaldo previo..."

if ! bash "$BACKUP_SCRIPT"; then
    error "El respaldo falló. No se ejecutarán migraciones."
fi

echo "El respaldo terminó sin errores."

# ------------------------------------------------------------
# 7. Migraciones
# ------------------------------------------------------------

echo "Ejecutando migraciones con Alembic..."

if ! docker compose "${COMPOSE_ARGS[@]}" run \
    --rm \
    --no-deps \
    api \
    alembic upgrade head; then

    log_event "migration_failed" "$VERSION" || true

    error "Fallaron las migraciones. Revise la base de datos antes de continuar."
fi

echo "Migraciones completadas."

# ------------------------------------------------------------
# 8. Actualización de contenedores
# ------------------------------------------------------------

echo "Iniciando y comprobando servicios..."

if ! deploy_containers; then
    log_event "deployment_failed" "$VERSION" || true

    error "Los servicios no iniciaron correctamente. Se requiere recuperación; el rollback no se ejecuta automáticamente."
fi

# ------------------------------------------------------------
# 9. Registrar resultado
# ------------------------------------------------------------

# El estado se actualiza después del arranque satisfactorio.
write_state "$VERSION" "$CURRENT_VERSION"

if ! log_event "success" "$VERSION"; then
    echo "ADVERTENCIA: El despliegue funcionó, pero falló el registro histórico." >&2
fi

echo "Despliegue completado: $VERSION"
echo "Entorno: $MATP_ENV"
