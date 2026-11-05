#!/usr/bin/env bash
# MATP - Funciones comunes de los respaldos (change despliegue-vm-y-respaldos, tareas 3.1 y 3.2).
#
# Se carga con `source`; no se ejecuta. Todo lo que habla con el exterior (restic, compose, curl)
# se invoca por variables (RESTIC_BIN, MATP_COMPOSE, CURL_BIN) para poder sustituirlo en pruebas
# y para usar la imagen de contenedor cuando restic no está instalado en la VM.

# Carga un archivo de variables SIN ejecutarlo (nada de `source`: un valor con `&`, `$(` o `;`
# no debe poder ejecutar nada) y con la misma precedencia que Docker Compose: lo que ya está en
# el entorno gana sobre el archivo. Acepta `CLAVE=valor`, comillas simples o dobles alrededor
# del valor y comentarios con `#` al inicio de línea.
load_env_file() {
    local file="$1" line key value
    [[ -r "$file" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
        [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
        key="${BASH_REMATCH[2]}"
        value="${BASH_REMATCH[3]}"
        if [[ "$value" =~ ^\"(.*)\"[[:space:]]*$ || "$value" =~ ^\'(.*)\'[[:space:]]*$ ]]; then
            value="${BASH_REMATCH[1]}"
        fi
        if [[ -z "${!key+x}" ]]; then
            export "$key=$value"
        fi
    done < "$file"
}

: "${MATP_ENV_FILE:=/opt/matp/.env.production}"
# Antes de leer cualquier valor por defecto: así MATP_STATE_DIR, BACKUP_*, RESTIC_* y demás de
# .env.production mandan en todos los scripts (antes se leían antes de cargar el archivo).
load_env_file "$MATP_ENV_FILE"
: "${MATP_STATE_DIR:=/opt/matp/state}"
# Ruta EN LA VM del marcador. La API lo ve montado en /var/lib/matp (BACKUP_STATUS_FILE de
# .env.production apunta a esa ruta de contenedor, por eso aquí se usa otro nombre).
: "${BACKUP_MARKER_FILE:=${MATP_STATE_DIR}/backup-status.json}"
: "${BACKUP_LOG_FILE:=${MATP_STATE_DIR}/backup.log}"
: "${CURL_BIN:=curl}"
# shellcheck disable=SC2034  # lo usan los scripts que cargan esta biblioteca
MATP_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# El compose de producción exige MATP_VERSION: si no viene, se toma la versión desplegada.
if [[ -z "${MATP_VERSION:-}" && -r "${MATP_STATE_DIR}/current-version" ]]; then
    MATP_VERSION="$(cat "${MATP_STATE_DIR}/current-version")"
    export MATP_VERSION
fi
: "${MATP_COMPOSE:=docker compose --project-directory ${MATP_REPO_ROOT} --env-file ${MATP_ENV_FILE} -f ${MATP_REPO_ROOT}/docker-compose.yml -f ${MATP_REPO_ROOT}/deploy/vm/docker-compose.prod.yml}"

now_utc() {
    date -u +'%Y-%m-%dT%H:%M:%SZ'
}

# Registro estructurado (una línea JSON) a la salida de error y al archivo de registro.
log_json() {
    local level="$1" event="$2" detail="${3:-}"
    local line
    detail="${detail//\\/\\\\}"
    detail="${detail//\"/\\\"}"
    line="$(printf '{"ts":"%s","level":"%s","event":"%s","detail":"%s"}' \
        "$(now_utc)" "$level" "$event" "$detail")"
    printf '%s\n' "$line" >&2
    if [[ -d "$(dirname "$BACKUP_LOG_FILE")" ]]; then
        printf '%s\n' "$line" >> "$BACKUP_LOG_FILE" 2>/dev/null || true
    fi
}

# Avisa al Administrador por webhook (ALERT_WEBHOOK_URL). Sin canal configurado solo registra.
notify() {
    local message="$1"
    if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
        log_json warn notify_skipped "sin ALERT_WEBHOOK_URL: $message"
        return 0
    fi
    local body="${message//\\/\\\\}"
    body="${body//\"/\\\"}"
    if ! "$CURL_BIN" --silent --show-error --fail --max-time 20 \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"MATP: ${body}\"}" "$ALERT_WEBHOOK_URL" > /dev/null; then
        log_json error notify_failed "no se pudo avisar por el webhook"
    fi
}

# Valor de last_success_at del marcador actual (vacío si no existe).
previous_success() {
    [[ -f "$BACKUP_MARKER_FILE" ]] || return 0
    sed -n 's/.*"last_success_at": *"\([^"]*\)".*/\1/p' "$BACKUP_MARKER_FILE" | head -n 1
}

# Escribe el marcador que lee /health (backup_status). Escritura atómica.
# Uso: write_marker ok|failed <last_success_at>
write_marker() {
    local result="$1" last_success="$2"
    local tmp
    mkdir -p "$(dirname "$BACKUP_MARKER_FILE")"
    tmp="$(mktemp "$(dirname "$BACKUP_MARKER_FILE")/.status.XXXXXX")"
    printf '{"last_attempt_at": "%s", "last_success_at": "%s", "last_result": "%s"}\n' \
        "$(now_utc)" "$last_success" "$result" > "$tmp"
    chmod 644 "$tmp"
    mv -f "$tmp" "$BACKUP_MARKER_FILE"
}

# restic instalado en la VM o, si no, su imagen (RESTIC_IMAGE, versión fijada en .env.production).
restic_cmd() {
    if [[ -n "${RESTIC_BIN:-}" ]]; then
        "$RESTIC_BIN" "$@"
    elif command -v restic > /dev/null 2>&1; then
        restic "$@"
    else
        : "${RESTIC_IMAGE:?Defina RESTIC_IMAGE o instale restic en la VM}"
        # Corre con el usuario de quien invoca (no root): los archivos que restic restaura en el
        # simulacro deben poder leerse desde la VM. RESTIC_DOCKER_ARGS permite montar un
        # repositorio local (ensayos) o añadir redes; con un destino S3 no hace falta.
        local work="${BACKUP_WORK_DIR:-/opt/matp/backup-work}"
        # El espejo del bucket es lo que restic respalda: debe verse dentro del contenedor.
        local mirror="${BACKUP_MIRROR_DIR:-/opt/matp/backup-mirror}"
        mkdir -p "$work" "$mirror"
        # shellcheck disable=SC2086  # RESTIC_DOCKER_ARGS son opciones separadas por espacios
        docker run --rm -i --user "$(id -u):$(id -g)" \
            -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE -e RESTIC_CACHE_DIR=/tmp/restic-cache \
            -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
            -v "${RESTIC_PASSWORD_FILE}:${RESTIC_PASSWORD_FILE}:ro" \
            -v "${work}:${work}" \
            -v "${mirror}:${mirror}:ro" \
            ${RESTIC_DOCKER_ARGS:-} \
            "$RESTIC_IMAGE" "$@"
    fi
}

# Red de Compose del servicio de almacenamiento: `storage:9000` solo resuelve dentro de ella.
storage_network() {
    local container
    # shellcheck disable=SC2086  # MATP_COMPOSE es un comando con argumentos
    container="$($MATP_COMPOSE ps -q storage 2> /dev/null | head -n 1)"
    [[ -n "$container" ]] || return 1
    docker inspect "$container" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' \
        | head -n 1
}

# rclone instalado en la VM (o RCLONE_BIN) o, si no, su imagen RCLONE_IMAGE dentro de la red de
# Compose, con el usuario de quien invoca. Uso: _rclone <carpeta-a-montar|""> <argumentos...>
_rclone() {
    local mount="$1"
    shift
    if [[ -n "${RCLONE_BIN:-}" ]]; then
        "$RCLONE_BIN" "$@"
    elif command -v rclone > /dev/null 2>&1; then
        rclone "$@"
    else
        : "${RCLONE_IMAGE:?Defina RCLONE_IMAGE o instale rclone en la VM}"
        local network volume=()
        network="$(storage_network)" || {
            log_json error storage_network_missing "el servicio storage no está en ejecución"
            return 1
        }
        [[ -n "$mount" ]] && volume=(-v "${mount}:${mount}")
        docker run --rm --network "$network" --user "$(id -u):$(id -g)" \
            -e RCLONE_CONFIG=/dev/null "${volume[@]}" "$RCLONE_IMAGE" "$@"
    fi
}

rclone_s3_options() {
    printf '%s\n' --s3-provider Other --s3-endpoint "${S3_ENDPOINT_URL:?}" \
        --s3-access-key-id "${S3_ACCESS_KEY_ID:?}" --s3-secret-access-key "${S3_SECRET_ACCESS_KEY:?}"
}

# Uso: rclone_sync_bucket <bucket> <directorio-espejo>
rclone_sync_bucket() {
    local bucket="$1" mirror="$2" opts=()
    mapfile -t opts < <(rclone_s3_options)
    _rclone "$mirror" sync ":s3:${bucket}" "$mirror" "${opts[@]}"
}

# Crea el bucket si no existe (primera instalación: el respaldo previo al primer despliegue corre
# antes de que la API pueda crearlo). Uso: rclone_make_bucket <bucket>
rclone_make_bucket() {
    local bucket="$1" opts=()
    mapfile -t opts < <(rclone_s3_options)
    _rclone "" mkdir ":s3:${bucket}" "${opts[@]}"
}

require_backup_env() {
    local name
    for name in RESTIC_REPOSITORY RESTIC_PASSWORD_FILE; do
        if [[ -z "${!name:-}" ]]; then
            log_json error missing_variable "$name"
            echo "ERROR: falta la variable $name (ver /opt/matp/.env.production)" >&2
            return 1
        fi
    done
    if [[ ! -r "$RESTIC_PASSWORD_FILE" ]]; then
        log_json error missing_key "no se puede leer RESTIC_PASSWORD_FILE"
        echo "ERROR: no se puede leer la clave de respaldos en RESTIC_PASSWORD_FILE" >&2
        return 1
    fi
}

# Compara cada foto restaurada con la huella que la base registró (spec: «Foto corrupta»).
# Entrada: líneas "clave<TAB>sha256" por la entrada estándar; $1 = directorio con los objetos.
# Devuelve 0 si todas coinciden; si no, imprime las afectadas y devuelve 1.
verify_photos() {
    local objects_dir="$1" bad=0 key expected actual
    while IFS=$'\t' read -r key expected; do
        expected="${expected//$'\r'/}"  # tolera finales de línea CRLF
        [[ -n "$key" ]] || continue
        if [[ ! -f "$objects_dir/$key" ]]; then
            echo "FALTA: $key"
            bad=1
            continue
        fi
        actual="$(sha256sum "$objects_dir/$key" | cut -d' ' -f1)"
        if [[ "$actual" != "$expected" ]]; then
            echo "HUELLA DISTINTA: $key"
            bad=1
        fi
    done
    return "$bad"
}
