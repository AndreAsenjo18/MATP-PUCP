#!/usr/bin/env bash
set -Eeuo pipefail

# Pruebas funcionales de CD2 con Docker y deploy.sh simulados.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PULL_SCRIPT="$ROOT/deploy/staging/pull-deploy/pull-deploy.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export MATP_ENV=staging
export MATP_DEPLOY_STATE_DIR="$TMP/state"
export MATP_DEPLOYMENTS_LOG="$TMP/deployments.log"
export MATP_DEPLOY_SCRIPT="$TMP/deploy.sh"
export MOCK_CALLS="$TMP/deploy-calls.log"

mkdir -p "$TMP/bin" "$MATP_DEPLOY_STATE_DIR"
export PATH="$TMP/bin:$PATH"

COMMIT="1416f8da09ac26de05af8df106be3bc95bb49e64"
DIGEST="ghcr.io/andreasenjo18/matp-api@sha256:$(printf '%064d' 1)"
DIGEST_FILE="$MATP_DEPLOY_STATE_DIR/last-deployed-digest"

export MOCK_COMMIT="$COMMIT"
export MOCK_DIGEST="$DIGEST"

# Sustituye únicamente al comando docker durante las pruebas.
cat > "$TMP/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

case "$*" in
    "pull ghcr.io/andreasenjo18/matp-api:main")
        exit 0
        ;;
    *"RepoDigests"*)
        printf '%s\n' "$MOCK_DIGEST"
        ;;
    *"Config.Env"*)
        printf 'APP_COMMIT=%s\n' "$MOCK_COMMIT"
        ;;
    *)
        echo "Comando Docker inesperado: $*" >&2
        exit 1
        ;;
esac
MOCK_DOCKER

# Simula el resultado de scripts/deploy.sh.
cat > "$MATP_DEPLOY_SCRIPT" <<'MOCK_DEPLOY'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$1" >> "$MOCK_CALLS"
exit "${MOCK_DEPLOY_EXIT:-0}"
MOCK_DEPLOY

chmod +x "$TMP/bin/docker" "$MATP_DEPLOY_SCRIPT"

reset_test() {
    rm -f "$DIGEST_FILE" "$MOCK_CALLS" "$MATP_DEPLOYMENTS_LOG"
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

echo "Prueba 2: nuevo digest debe desplegar el commit"
reset_test

bash "$PULL_SCRIPT"

assert_contains "$MOCK_CALLS" "sha-$COMMIT"
[[ "$(cat "$DIGEST_FILE")" == "$DIGEST" ]] || {
    echo "FALLO: No se guardó el digest nuevo." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_success"
echo "OK: despliegue exitoso"

echo "Prueba 3: un fallo no debe guardar el digest"
reset_test
export MOCK_DEPLOY_EXIT=1

if bash "$PULL_SCRIPT"; then
    echo "FALLO: Se esperaba un error de despliegue." >&2
    exit 1
fi

assert_contains "$MOCK_CALLS" "sha-$COMMIT"
[[ ! -f "$DIGEST_FILE" ]] || {
    echo "FALLO: Se guardó el digest de un despliegue fallido." >&2
    exit 1
}

assert_contains "$MATP_DEPLOYMENTS_LOG" "pull_failed"
echo "OK: despliegue fallido"

echo "Las tres pruebas de CD2 finalizaron correctamente."
