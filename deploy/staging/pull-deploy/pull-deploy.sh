#!/usr/bin/env bash
set -Eeuo pipefail

# MATP - CD2: despliegue automático pull-based en staging.
# OpenSpec: pipeline-despliegue-ambientes, tarea 3.1.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

STATE_DIR="${MATP_DEPLOY_STATE_DIR:-/opt/matp/state}"
DEPLOYMENTS_LOG="${MATP_DEPLOYMENTS_LOG:-/opt/matp/deployments.log}"
DEPLOY_SCRIPT="${MATP_DEPLOY_SCRIPT:-$PROJECT_ROOT/scripts/deploy.sh}"

IMAGE="ghcr.io/andreasenjo18/matp-api:main"

DIGEST_FILE="$STATE_DIR/last-deployed-digest"
LOCK_FILE="$STATE_DIR/pull-deploy.lock"

MATP_ENV="${MATP_ENV:-staging}"
export MATP_ENV

log_event() {
    local status="$1"
    local detail="${2:-}"

    printf '%s | %s | %s | %s\n' \
        "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        "$MATP_ENV" \
        "$status" \
        "$detail" >> "$DEPLOYMENTS_LOG"
}

alert_failure() {
    local message="$1"

    echo "ERROR: $message" >&2

    if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
        curl --fail --silent --show-error \
            --max-time 10 \
            -X POST \
            -H "Content-Type: application/json" \
            --data "$(printf '%s' "$message" | python3 -c \
                'import json,sys; print(json.dumps({"text":sys.stdin.read()}))')" \
            "$ALERT_WEBHOOK_URL" >&2 || true
    fi
}

fail() {
    local message="$1"

    log_event "pull_failed" "$message" || true
    alert_failure "$message"
    exit 1
}

# Evitar despliegues fuera del entorno de pruebas.
[[ "$MATP_ENV" == "staging" ]] ||
    { echo "ERROR: CD2 solo puede ejecutarse en staging." >&2; exit 2; }

mkdir -p "$STATE_DIR"
touch "$DEPLOYMENTS_LOG"

command -v flock >/dev/null 2>&1 ||
    fail "flock no está disponible."

exec 8>"$LOCK_FILE"

if ! flock -n 8; then
    echo "Otro proceso CD2 está en ejecución. Se omite esta revisión."
    exit 0
fi

echo "Consultando la imagen principal de MATP en GHCR..."

# Descargar la imagen principal para inspeccionar su digest y commit.
if ! docker pull "$IMAGE"; then
    fail "No se pudo consultar o descargar $IMAGE."
fi

# Obtener el digest del manifiesto asociado a la imagen descargada.
CURRENT_DIGEST="$(
    docker image inspect "$IMAGE" \
        --format '{{index .RepoDigests 0}}' 2>/dev/null || true
)"

[[ "$CURRENT_DIGEST" =~ @sha256:[a-f0-9]{64}$ ]] ||
    fail "No se pudo obtener un digest válido de GHCR."

# Consultar el último digest desplegado.
LAST_DIGEST=""

if [[ -f "$DIGEST_FILE" ]]; then
    LAST_DIGEST="$(cat "$DIGEST_FILE")"
fi

# No volver a desplegar si la imagen no cambió.
if [[ "$CURRENT_DIGEST" == "$LAST_DIGEST" ]]; then
    echo "Sin cambios en GHCR. MATP ya está actualizado."
    log_event "no_change" "$CURRENT_DIGEST"
    exit 0
fi

# Identificar el commit real incrustado en la imagen.
APP_COMMIT="$(
    docker image inspect "$IMAGE" \
        --format '{{range .Config.Env}}{{println .}}{{end}}' |
        sed -n 's/^APP_COMMIT=//p' |
        head -n 1
)"

[[ "$APP_COMMIT" =~ ^[a-f0-9]{40}$ ]] ||
    fail "La imagen no contiene un APP_COMMIT válido."

TARGET_VERSION="sha-$APP_COMMIT"

echo "Nueva versión detectada: $TARGET_VERSION"
echo "Digest: $CURRENT_DIGEST"

[[ -f "$DEPLOY_SCRIPT" ]] ||
    fail "No existe deploy.sh en $DEPLOY_SCRIPT."

# El deploy.sh ejecuta respaldo, migraciones y verificaciones.
# No se omite ninguna de esas protecciones.
if ! bash "$DEPLOY_SCRIPT" "$TARGET_VERSION"; then
    fail "Falló el despliegue de $TARGET_VERSION. No se actualizará el digest registrado."
fi

# Registrar el digest solamente después del despliegue exitoso.
TEMP_DIGEST="$(mktemp "$STATE_DIR/.digest.XXXXXX")"

printf '%s\n' "$CURRENT_DIGEST" > "$TEMP_DIGEST"
mv -f "$TEMP_DIGEST" "$DIGEST_FILE"

log_event "pull_success" "$TARGET_VERSION | $CURRENT_DIGEST"

echo "Despliegue automático completado: $TARGET_VERSION"
