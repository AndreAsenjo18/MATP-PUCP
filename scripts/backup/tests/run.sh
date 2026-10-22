#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKUP_SCRIPT="$ROOT/scripts/backup/backup.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export MATP_ENV_FILE="$TMP/.env.pruebas"
export MATP_BACKUP_DIR="$TMP/backups"
export MATP_POSTGRES_IMAGE="postgres:18"
export MOCK_DOCKER_RESULT="success"

mkdir -p "$TMP/bin"
export PATH="$TMP/bin:$PATH"

# Solo se usa en pruebas. No es una contraseña real.
printf '%s\n' \
    'DATABASE_URL=postgresql://test:test@localhost:5432/test' \
    > "$MATP_ENV_FILE"

# Simula el comando Docker sin acceder a PostgreSQL.
cat > "$TMP/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

[[ "${1:-}" == "run" ]] || exit 1

if [[ "$MOCK_DOCKER_RESULT" == "failure" ]]; then
    echo "Error simulado de pg_dump" >&2
    exit 1
fi

# backup.sh pasa el nombre temporal como último argumento.
for argument in "$@"; do
    filename="$argument"
done

printf 'Respaldo simulado para pruebas\n' \
    > "$MATP_BACKUP_DIR/$filename"
MOCK

chmod +x "$TMP/bin/docker"

echo "Prueba 1: respaldo exitoso"

bash "$BACKUP_SCRIPT"

shopt -s nullglob
backups=("$MATP_BACKUP_DIR"/*.dump)

[[ "${#backups[@]}" -eq 1 ]] || {
    echo "FALLO: No se generó exactamente un respaldo." >&2
    exit 1
}

[[ -s "${backups[0]}" ]] || {
    echo "FALLO: El respaldo está vacío." >&2
    exit 1
}

echo "OK: respaldo generado"

echo "Prueba 2: fallo de pg_dump"

rm -f -- "$MATP_BACKUP_DIR"/*.dump
export MOCK_DOCKER_RESULT="failure"

if bash "$BACKUP_SCRIPT"; then
    echo "FALLO: El script aceptó un respaldo fallido." >&2
    exit 1
fi

backups=("$MATP_BACKUP_DIR"/*.dump)

[[ "${#backups[@]}" -eq 0 ]] || {
    echo "FALLO: Se conservó un respaldo incompleto." >&2
    exit 1
}

echo "OK: respaldo fallido rechazado"
echo "Las dos pruebas funcionales finalizaron correctamente."
