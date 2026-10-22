#!/usr/bin/env bash
set -Eeuo pipefail

# Pruebas funcionales de CD2.
# Docker, deploy.sh y curl se simulan: no se modifica AWS.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PULL_SCRIPT="$ROOT/deploy/staging/pull-deploy/pull-deploy.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

COMMIT="1416f8da09ac26de05af8df106be3bc95bb49e64"
OLD_COMMIT="0000000000000000000000000000000000000000"
VERSION="sha-$COMMIT"

DIGEST="ghcr.io/andreasenjo18/matp-api@sha256:$(printf '%064d' 1)"
OLD_DIGEST="ghcr.io/andreasenjo18/matp-api@sha256:$(printf '%064d' 2)"

API_IMAGE="ghcr.io/andreasenjo18/matp-api:$VERSION"
WEB_IMAGE="ghcr.io/andreasenjo18/matp-web:$VERSION"

export MATP_ENV=staging
export MATP_DEPLOY_STATE_DIR="$TMP/state"
export MATP_DEPLOYMENTS_LOG="$TMP/deployments.log"
export MATP_DEPLOY_SCRIPT="$TMP/deploy.sh"
export MATP_HEALTH_URL="https://example.invalid/health"

export MOCK_COMMIT="$COMMIT"
export MOCK_HEALTH_COMMIT="$COMMIT"
export MOCK_DIGEST="$DIGEST"
export MOCK_CALLS="$TMP/deploy-calls.log"
export MOCK_DEPLOY_EXIT=0

export MOCK_API_IMAGE="$API_IMAGE"
export MOCK_WEB_IMAGE="$WEB_IMAGE"
export MOCK_WEB_HEALTH="healthy"
export MOCK_API_ID="sha256:aaaaaaaa"
export MOCK_WEB_ID="sha256:bbbbbbbb"
export MOCK_WEB_RUNNING_ID="$MOCK_WEB_ID"

unset ALERT_WEBHOOK_URL

mkdir -p "$TMP/bin" "$MATP_DEPLOY_STATE_DIR"
export PATH="$TMP/bin:$PATH"

DIGEST_FILE="$MATP_DEPLOY_STATE_DIR/last-deployed-digest"

# Docker simulado: permite inspeccionar imágenes y contenedores.
cat > "$TMP/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
    pull)
        exit 0
        ;;
    image)
        [[ "${2:-}" == "inspect" ]] || exit 1
        image="${3:-}"

        if [[ "$*" == *"RepoDigests"* ]]; then
            printf '%s\n' "$MOCK_DIGEST"

        elif [[ "$*" == *"Config.Env"* ]]; then
            printf 'APP_COMMIT=%s\n' "$MOCK_COMMIT"

        elif [[ "$*" == *"{{.Id}}"* ]]; then
            case "$image" in
                ghcr.io/andreasenjo18/matp-api:*)
                    printf '%s\n' "$MOCK_API_ID"
                    ;;
                ghcr.io/andreasenjo18/matp-web:*)
                    printf '%s\n' "$MOCK_WEB_ID"
                    ;;
                *)
                    exit 1
                    ;;
            esac
        else
            exit 1
        fi
        ;;
    inspect)
        container="${2:-}"

        case "$container" in
            matp-staging-api-1)
                printf '%s|running|healthy|%s\n' \
                    "$MOCK_API_IMAGE" "$MOCK_API_ID"
                ;;
            matp-staging-web-1)
                printf '%s|running|%s|%s\n' \
                    "$MOCK_WEB_IMAGE" \
                    "$MOCK_WEB_HEALTH" \
                    "$MOCK_WEB_RUNNING_ID"
                ;;
            *)
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Docker inesperado: $*" >&2
        exit 1
        ;;
esac
MOCK_DOCKER

# Respuesta simulada del endpoint /health.
cat > "$TMP/bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail

printf '{"status":"ok","commit":"%s","checks":{"database":{"status":"ok"},"storage":{"status":"ok"}}}\n' \
    "$MOCK_HEALTH_COMMIT"
MOCK_CURL

# Simulación de deploy.sh.
cat > "$MATP_DEPLOY_SCRIPT" <<'MOCK_DEPLOY'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$1" >> "$MOCK_CALLS"
exit "$MOCK_DEPLOY_EXIT"
MOCK_DEPLOY

chmod +x \
    "$TMP/bin/docker" \
    "$TMP/bin/curl" \
    "$MATP_DEPLOY_SCRIPT"

reset_test() {
    rm -f "$DIGEST_FILE" "$MOCK_CALLS" "$MATP_DEPLOYMENTS_LOG"

    export MOCK_DEPLOY_EXIT=0
    export MOCK_HEALTH_COMMIT="$COMMIT"
    export MOCK_WEB_IMAGE="$WEB_IMAGE"
    export MOCK_WEB_HEALTH="healthy"
    export MOCK_WEB_RUNNING_ID="$MOCK_WEB_ID"
}

assert_contains() {
    grep -Fq "$2" "$1" || {
        echo "FALLO: No se encontró '$2' en $1" >&2
        exit 1
    }
}

assert_digest_unchanged() {
    [[ "$(cat "$DIGEST_FILE")" == "$OLD_DIGEST" ]] || {
        echo "FALLO: El digest anterior fue reemplazado." >&2
        exit 1
    }
}

prepare_old_digest() {
    printf '%s\n' "$OLD_DIGEST" > "$DIGEST_FILE"
}

echo "Prueba 1: sin cambios no debe desplegar"
reset_test
printf '%s\n' "$DIGEST" > "$DIGEST_FILE"

bash "$PULL_SCRIPT"

[[ ! -f "$MOCK_CALLS" ]] || {
    echo "FALLO: Se desplegó sin cambios." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "no_change"
echo "OK: sin cambios"

echo "Prueba 2: despliegue correcto de API y Web"
reset_test

bash "$PULL_SCRIPT"

assert_contains "$MOCK_CALLS" "$VERSION"

[[ "$(cat "$DIGEST_FILE")" == "$DIGEST" ]] || {
    echo "FALLO: No se registró el digest nuevo." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_success"
echo "OK: despliegue completo confirmado"

echo "Prueba 3: deploy.sh falla"
reset_test
prepare_old_digest
export MOCK_DEPLOY_EXIT=1

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó un despliegue fallido." >&2
    exit 1
fi

assert_digest_unchanged
assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: fallo de deploy.sh rechazado"

echo "Prueba 4: /health devuelve un commit anterior"
reset_test
prepare_old_digest
export MOCK_HEALTH_COMMIT="$OLD_COMMIT"

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó un commit incorrecto." >&2
    exit 1
fi

assert_digest_unchanged
assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: commit incorrecto rechazado"

echo "Prueba 5: Web utiliza una etiqueta incorrecta"
reset_test
prepare_old_digest
export MOCK_WEB_IMAGE="ghcr.io/andreasenjo18/matp-web:main"

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó una Web con versión incorrecta." >&2
    exit 1
fi

assert_digest_unchanged
assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: versión incorrecta de Web rechazada"

echo "Prueba 6: Web no está saludable"
reset_test
prepare_old_digest
export MOCK_WEB_HEALTH="unhealthy"

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó una Web no saludable." >&2
    exit 1
fi

assert_digest_unchanged
assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: Web no saludable rechazada"

echo "Prueba 7: Web utiliza un ID de imagen distinto"
reset_test
prepare_old_digest
export MOCK_WEB_RUNNING_ID="sha256:cccccccc"

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó una imagen Web incorrecta." >&2
    exit 1
fi

assert_digest_unchanged
assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: imagen Web incorrecta rechazada"

echo "Las siete pruebas funcionales de CD2 finalizaron correctamente."
