#!/usr/bin/env bash
set -Eeuo pipefail

# Pruebas de respaldo local y S3 sin conexiones reales.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKUP_SCRIPT="$ROOT/scripts/backup/backup.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin"

export PATH="$TMP/bin:$PATH"
export MATP_ENV_FILE="$TMP/.env.pruebas"
export MATP_BACKUP_DIR="$TMP/backups"
export MATP_BACKUP_S3_BUCKET="matp-backup-test"
export MATP_BACKUP_S3_PREFIX="staging/postgresql"
export MATP_POSTGRES_IMAGE="postgres:18"

export MOCK_S3_FILE="$TMP/s3-object.dump"
export MOCK_DOCKER_RESULT="success"
export MOCK_S3_RESULT="success"

printf '%s\n' \
    'DATABASE_URL=postgresql://test:test@localhost/test' \
    > "$MATP_ENV_FILE"

cat > "$TMP/bin/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

[[ "${1:-}" == "run" ]] || exit 1

if [[ "$MOCK_DOCKER_RESULT" == "failure" ]]; then
    echo "Error simulado de pg_dump" >&2
    exit 1
fi

# El último argumento es el nombre del archivo temporal.
for argument in "$@"; do
    filename="$argument"
done

printf 'Contenido de respaldo simulado\n' \
    > "$MATP_BACKUP_DIR/$filename"
MOCK_DOCKER

cat > "$TMP/bin/aws" <<'MOCK_AWS'
#!/usr/bin/env bash
set -euo pipefail

[[ "${1:-}" == "s3" && "${2:-}" == "cp" ]] || exit 1

source_path="${3:-}"
destination="${4:-}"

if [[ "$source_path" == s3://* ]]; then
    # Descarga desde S3.
    if [[ "$MOCK_S3_RESULT" == "download_failure" ]]; then
        echo "Error simulado de descarga S3" >&2
        exit 1
    fi

    cp "$MOCK_S3_FILE" "$destination"

    if [[ "$MOCK_S3_RESULT" == "corrupt" ]]; then
        printf 'alteracion\n' >> "$destination"
    fi
else
    # Subida a S3.
    if [[ "$MOCK_S3_RESULT" == "upload_failure" ]]; then
        echo "Error simulado de subida S3" >&2
        exit 1
    fi

    cp "$source_path" "$MOCK_S3_FILE"
fi
MOCK_AWS

chmod +x "$TMP/bin/docker" "$TMP/bin/aws"

reset_test() {
    rm -rf "$MATP_BACKUP_DIR"
    rm -f "$MOCK_S3_FILE"

    mkdir -p "$MATP_BACKUP_DIR"

    export MOCK_DOCKER_RESULT="success"
    export MOCK_S3_RESULT="success"
}

count_backups() {
    local files=()
    shopt -s nullglob
    files=("$MATP_BACKUP_DIR"/*.dump)
    printf '%s\n' "${#files[@]}"
}

assert_no_partial_files() {
    local files=()
    shopt -s nullglob
    files=("$MATP_BACKUP_DIR"/*.partial "$MATP_BACKUP_DIR"/*.s3-check)

    [[ "${#files[@]}" -eq 0 ]] || {
        echo "FALLO: Quedaron archivos temporales." >&2
        exit 1
    }
}

echo "Prueba 1: respaldo local y S3 correctos"
reset_test

bash "$BACKUP_SCRIPT"

[[ "$(count_backups)" -eq 1 ]] || exit 1
[[ -s "$MOCK_S3_FILE" ]] || exit 1
assert_no_partial_files

echo "OK: respaldo completo"

echo "Prueba 2: falla pg_dump"
reset_test
export MOCK_DOCKER_RESULT="failure"

if bash "$BACKUP_SCRIPT"; then
    echo "FALLO: Se aceptó un pg_dump fallido." >&2
    exit 1
fi

[[ "$(count_backups)" -eq 0 ]] || exit 1
[[ ! -f "$MOCK_S3_FILE" ]] || exit 1
assert_no_partial_files

echo "OK: fallo de pg_dump rechazado"

echo "Prueba 3: falla la subida a S3"
reset_test
export MOCK_S3_RESULT="upload_failure"

if bash "$BACKUP_SCRIPT"; then
    echo "FALLO: Se aceptó un error de subida." >&2
    exit 1
fi

# El respaldo local se conserva para recuperación.
[[ "$(count_backups)" -eq 1 ]] || exit 1
assert_no_partial_files

echo "OK: fallo de subida rechazado"

echo "Prueba 4: la copia descargada es diferente"
reset_test
export MOCK_S3_RESULT="corrupt"

if bash "$BACKUP_SCRIPT"; then
    echo "FALLO: Se aceptó una copia corrupta." >&2
    exit 1
fi

[[ "$(count_backups)" -eq 1 ]] || exit 1
assert_no_partial_files

echo "OK: copia corrupta rechazada"

echo "Las cuatro pruebas de respaldo finalizaron correctamente."
