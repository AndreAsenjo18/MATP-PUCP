#!/usr/bin/env bash
set -Eeuo pipefail

# MATP - CD2: despliegue automático pull-based en staging.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

STATE_DIR="${MATP_DEPLOY_STATE_DIR:-/opt/matp/state}"
DEPLOYMENTS_LOG="${MATP_DEPLOYMENTS_LOG:-/opt/matp/deployments.log}"
DEPLOY_SCRIPT="${MATP_DEPLOY_SCRIPT:-$PROJECT_ROOT/scripts/deploy.sh}"
HEALTH_URL="${MATP_HEALTH_URL:-https://54-237-95-196.sslip.io/health}"

API_REPO="ghcr.io/andreasenjo18/matp-api"
WEB_REPO="ghcr.io/andreasenjo18/matp-web"
MAIN_IMAGE="$API_REPO:main"

API_CONTAINER="matp-staging-api-1"
WEB_CONTAINER="matp-staging-web-1"

DIGEST_FILE="$STATE_DIR/last-deployed-digest"
LOCK_FILE="$STATE_DIR/pull-deploy.lock"

MATP_ENV="${MATP_ENV:-staging}"
export MATP_ENV

log_event() {
    local status="$1"
    local detail="${2:-}"

    printf '%s | %s | %s | %s\n' \
        "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        "$MATP_ENV" "$status" "$detail" >> "$DEPLOYMENTS_LOG"
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

verify_container() {
    local container="$1"
    local expected_image="$2"
    local actual_info
    local actual_image
    local actual_status
    local actual_health
    local actual_id
    local expected_id

    actual_info="$(
        docker inspect "$container" \
            --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}|{{.Image}}' \
            2>/dev/null
    )" || fail "No se encontró el contenedor $container."

    IFS='|' read -r \
        actual_image actual_status actual_health actual_id \
        <<< "$actual_info"

    expected_id="$(
        docker image inspect "$expected_image" \
            --format '{{.Id}}' 2>/dev/null
    )" || fail "No se pudo inspeccionar $expected_image."

    [[ "$actual_image" == "$expected_image" ]] ||
        fail "$container utiliza una etiqueta diferente de $expected_image."

    [[ "$actual_status" == "running" ]] ||
        fail "$container no está en ejecución."

    [[ "$actual_health" == "healthy" ]] ||
        fail "$container no está saludable."

    [[ -n "$expected_id" && "$actual_id" == "$expected_id" ]] ||
        fail "$container no utiliza la imagen Docker esperada."

    echo "Verificado: $container ($expected_image)"
}

[[ "$MATP_ENV" == "staging" ]] || {
    echo "ERROR: CD2 solo se permite en staging." >&2
    exit 2
}

mkdir -p "$STATE_DIR"
touch "$DEPLOYMENTS_LOG"

for tool in docker flock curl python3; do
    command -v "$tool" >/dev/null 2>&1 ||
        fail "Herramienta requerida no disponible: $tool"
done

exec 8>"$LOCK_FILE"

if ! flock -n 8; then
    echo "Otra ejecución CD2 está activa. Se omite esta revisión."
    exit 0
fi

echo "Consultando GHCR..."

docker pull "$MAIN_IMAGE" ||
    fail "No se pudo descargar $MAIN_IMAGE."

CURRENT_DIGEST="$(
    docker image inspect "$MAIN_IMAGE" \
        --format '{{index .RepoDigests 0}}' 2>/dev/null || true
)"

[[ "$CURRENT_DIGEST" =~ @sha256:[a-f0-9]{64}$ ]] ||
    fail "No se obtuvo un digest válido para main."

LAST_DIGEST=""
if [[ -f "$DIGEST_FILE" ]]; then
    LAST_DIGEST="$(cat "$DIGEST_FILE")"
fi

if [[ "$CURRENT_DIGEST" == "$LAST_DIGEST" ]]; then
    echo "Sin cambios en GHCR."
    log_event "no_change" "$CURRENT_DIGEST"
    exit 0
fi

APP_COMMIT="$(
    docker image inspect "$MAIN_IMAGE" \
        --format '{{range .Config.Env}}{{println .}}{{end}}' |
        sed -n 's/^APP_COMMIT=//p' |
        head -n 1
)"

[[ "$APP_COMMIT" =~ ^[a-f0-9]{40}$ ]] ||
    fail "La imagen no contiene un APP_COMMIT válido."

TARGET_VERSION="sha-$APP_COMMIT"
API_IMAGE="$API_REPO:$TARGET_VERSION"
WEB_IMAGE="$WEB_REPO:$TARGET_VERSION"

echo "Nueva versión detectada: $TARGET_VERSION"

docker pull "$API_IMAGE" ||
    fail "No está disponible la API $TARGET_VERSION."

docker pull "$WEB_IMAGE" ||
    fail "No está disponible la Web $TARGET_VERSION."

FIXED_DIGEST="$(
    docker image inspect "$API_IMAGE" \
        --format '{{index .RepoDigests 0}}' 2>/dev/null || true
)"

[[ "$FIXED_DIGEST" == "$CURRENT_DIGEST" ]] ||
    fail "La etiqueta fija de API no coincide con main."

[[ -f "$DEPLOY_SCRIPT" ]] ||
    fail "No existe deploy.sh: $DEPLOY_SCRIPT"

echo "Ejecutando despliegue de $TARGET_VERSION..."

if ! bash "$DEPLOY_SCRIPT" "$TARGET_VERSION"; then
    fail "Falló deploy.sh para $TARGET_VERSION. Digest sin actualizar."
fi

echo "Verificando /health..."

HEALTH_JSON="$(
    curl --fail --silent --show-error \
        --max-time 15 "$HEALTH_URL"
)" || fail "No se pudo consultar /health."

if ! printf '%s' "$HEALTH_JSON" | python3 -c '
import json
import sys

expected = sys.argv[1]

try:
    data = json.load(sys.stdin)
    valid = (
        data.get("status") == "ok"
        and data.get("commit") == expected
        and data.get("checks", {}).get("database", {}).get("status") == "ok"
        and data.get("checks", {}).get("storage", {}).get("status") == "ok"
    )
except (ValueError, TypeError, AttributeError):
    valid = False

sys.exit(0 if valid else 1)
' "$APP_COMMIT"; then
    fail "La API no confirma el commit esperado o presenta errores."
fi

echo "Verificando contenedores API y Web..."

verify_container "$API_CONTAINER" "$API_IMAGE"
verify_container "$WEB_CONTAINER" "$WEB_IMAGE"

# El digest se registra únicamente después de todas las verificaciones.
TEMP_DIGEST="$(mktemp "$STATE_DIR/.digest.XXXXXX")"
printf '%s\n' "$CURRENT_DIGEST" > "$TEMP_DIGEST"
mv -f "$TEMP_DIGEST" "$DIGEST_FILE"

log_event "pull_success" "$TARGET_VERSION | $CURRENT_DIGEST"

echo "Despliegue confirmado: $TARGET_VERSION"
