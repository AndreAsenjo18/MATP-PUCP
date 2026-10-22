#!/usr/bin/env bash
set -Eeuo pipefail

# Pruebas de CD2 sin conexión a GHCR ni AWS.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PULL_SCRIPT="$ROOT/deploy/staging/pull-deploy/pull-deploy.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

COMMIT="1416f8da09ac26de05af8df106be3bc95bb49e64"
OLD_COMMIT="0000000000000000000000000000000000000000"
DIGEST="ghcr.io/andreasenjo18/matp-api@sha256:$(printf '%064d' 1)"
OLD_DIGEST="ghcr.io/andreasenjo18/matp-api@sha256:$(printf '%064d' 2)"

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

unset ALERT_WEBHOOK_URL

mkdir -p "$TMP/bin" "$MATP_DEPLOY_STATE_DIR"
export PATH="$TMP/bin:$PATH"

DIGEST_FILE="$MATP_DEPLOY_STATE_DIR/last-deployed-digest"

cat > "$TMP/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

case "$1" in
    pull)
        exit 0
        ;;
    image)
        [[ "${2:-}" == "inspect" ]] || exit 1

        if [[ "$*" == *"RepoDigests"* ]]; then
            printf '%s\n' "$MOCK_DIGEST"
        elif [[ "$*" == *"Config.Env"* ]]; then
            printf 'APP_COMMIT=%s\n' "$MOCK_COMMIT"
        else
            exit 1
        fi
        ;;
    *)
        echo "Docker inesperado: $*" >&2
        exit 1
        ;;
esac
MOCK_DOCKER

cat > "$TMP/bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail

printf '{"status":"ok","commit":"%s","checks":{"database":{"status":"ok"},"storage":{"status":"ok"}}}\n' \
    "$MOCK_HEALTH_COMMIT"
MOCK_CURL

cat > "$MATP_DEPLOY_SCRIPT" <<'MOCK_DEPLOY'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$1" >> "$MOCK_CALLS"
exit "$MOCK_DEPLOY_EXIT"
MOCK_DEPLOY

chmod +x "$TMP/bin/docker" "$TMP/bin/curl" "$MATP_DEPLOY_SCRIPT"

reset_test() {
    rm -f "$DIGEST_FILE" "$MOCK_CALLS" "$MATP_DEPLOYMENTS_LOG"
    export MOCK_DEPLOY_EXIT=0
    export MOCK_HEALTH_COMMIT="$COMMIT"
}

assert_contains() {
    grep -Fq "$2" "$1" || {
        echo "FALLO: No se encontró '$2' en $1" >&2
        exit 1
    }
}

echo "Prueba 1: sin cambios no debe desplegar"
reset_test
printf '%s\n' "$DIGEST" > "$DIGEST_FILE"

bash "$PULL_SCRIPT"

[[ ! -f "$MOCK_CALLS" ]] || {
    echo "FALLO: Se ejecutó deploy.sh sin cambios." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "no_change"
echo "OK: sin cambios"

echo "Prueba 2: nuevo digest, despliegue y health correctos"
reset_test

bash "$PULL_SCRIPT"

assert_contains "$MOCK_CALLS" "sha-$COMMIT"
[[ "$(cat "$DIGEST_FILE")" == "$DIGEST" ]] || {
    echo "FALLO: No se registró el digest nuevo." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_success"
echo "OK: despliegue confirmado"

echo "Prueba 3: fallo de deploy.sh"
reset_test
export MOCK_DEPLOY_EXIT=1

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó un despliegue fallido." >&2
    exit 1
fi

[[ ! -f "$DIGEST_FILE" ]] || {
    echo "FALLO: Se registró un despliegue fallido." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: fallo de deploy.sh rechazado"

echo "Prueba 4: health devuelve el commit anterior"
reset_test
export MOCK_HEALTH_COMMIT="$OLD_COMMIT"
printf '%s\n' "$OLD_DIGEST" > "$DIGEST_FILE"

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se aceptó un commit incorrecto." >&2
    exit 1
fi

assert_contains "$MOCK_CALLS" "sha-$COMMIT"

[[ "$(cat "$DIGEST_FILE")" == "$OLD_DIGEST" ]] || {
    echo "FALLO: El digest anterior fue reemplazado." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: commit incorrecto rechazado"

echo "Las cuatro pruebas de CD2 finalizaron correctamente."
