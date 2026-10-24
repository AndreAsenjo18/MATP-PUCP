"""Spec plataforma — Despliegue en la VM, proxy, respaldos y programación (change
despliegue-vm-y-respaldos, tareas 1.2, 1.3, 3.1, 3.2 y 4.1).

Nada de esto necesita Docker: el compose y el Caddyfile se leen como texto/YAML, y los scripts de
respaldo se ejecutan con Bash contra dobles de `restic`, `rclone`, `curl` y `docker compose`. Lo
que sí exige Docker (`docker compose config`, `caddy validate`, el simulacro real) queda en la
tarea 7.1 del change.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[3]
VM = REPO / "deploy" / "vm"
BACKUP = REPO / "scripts" / "backup"

MEDIA_SITE = chr(10) + "media.{$MATP_DOMAIN} {"
BASH = shutil.which("bash")
needs_bash = pytest.mark.skipif(BASH is None, reason="requiere Bash")


def _scalar(loader: yaml.SafeLoader, node: yaml.Node) -> object:
    value = loader.construct_scalar(node)
    return None if value in ("", "null") else value


class _ComposeLoader(yaml.SafeLoader):
    """Lee las etiquetas `!reset` y `!override` del overlay como valores normales."""


for _tag in ("!reset", "!override"):
    _ComposeLoader.add_constructor(
        _tag,
        lambda loader, node: (
            loader.construct_sequence(node, deep=True)
            if isinstance(node, yaml.SequenceNode)
            else _scalar(loader, node)
        ),
    )


@pytest.fixture(scope="module")
def prod() -> dict:
    text = (VM / "docker-compose.prod.yml").read_text(encoding="utf-8")
    return yaml.load(text, Loader=_ComposeLoader)


# ------------------------------------------------------------------------- overlay de compose
def test_only_the_proxy_publishes_ports(prod: dict) -> None:
    """Spec: «Puertos internos no expuestos»."""
    services = prod["services"]
    assert set(services["proxy"]["ports"]) == {"80:80", "443:443", "443:443/udp"}
    for name in ("api", "web", "db", "storage"):
        assert services[name]["ports"] == [], f"{name} no debe publicar puertos en producción"


def test_application_images_come_from_a_required_version(prod: dict) -> None:
    for name in ("api", "web"):
        image = prod["services"][name]["image"]
        assert "${MATP_VERSION:?" in image, f"{name}: la versión es obligatoria"
        assert ":latest" not in image
        assert prod["services"][name]["build"] is None


def test_third_party_images_are_pinned(prod: dict) -> None:
    proxy_image = prod["services"]["proxy"]["image"]
    assert re.fullmatch(r"caddy:\d+\.\d+\.\d+-alpine", proxy_image), proxy_image


def test_proxy_api_and_web_run_without_extra_privileges(prod: dict) -> None:
    for name in ("proxy", "api", "web"):
        service = prod["services"][name]
        assert "no-new-privileges:true" in service["security_opt"]
        assert service["cap_drop"] == ["ALL"]
    assert prod["services"]["proxy"]["cap_add"] == ["NET_BIND_SERVICE"]
    # Sin root dentro de ningún contenedor propio: el proxy fija usuario y deja bajar a 80/443.
    assert prod["services"]["proxy"]["user"] == "1000:1000"
    assert prod["services"]["proxy"]["sysctls"]["net.ipv4.ip_unprivileged_port_start"] == "0"
    assert prod["services"]["api"]["read_only"] is True


def test_every_service_has_limits_and_rotating_logs(prod: dict) -> None:
    """Spec: «Registros acotados» y límites de recursos (RNF-015)."""
    for name, service in prod["services"].items():
        assert service["deploy"]["resources"]["limits"]["memory"], name
        options = service["logging"]["options"]
        assert service["logging"]["driver"] == "json-file", name
        assert options["max-size"] == "10m" and options["max-file"] == "5", name


def test_proxy_needs_the_domain_and_waits_for_healthy_services(prod: dict) -> None:
    proxy = prod["services"]["proxy"]
    assert "${MATP_DOMAIN:?" in proxy["environment"]["MATP_DOMAIN"]
    assert proxy["depends_on"]["api"]["condition"] == "service_healthy"
    assert proxy["depends_on"]["web"]["condition"] == "service_healthy"
    assert proxy["restart"] == "unless-stopped"


def test_the_api_sees_the_backup_marker_read_only(prod: dict) -> None:
    mounts = prod["services"]["api"]["volumes"]
    assert any(item.endswith(":/var/lib/matp:ro") for item in mounts)


# ------------------------------------------------------------------------------------ Caddyfile
@pytest.fixture(scope="module")
def caddyfile() -> str:
    return (VM / "Caddyfile").read_text(encoding="utf-8")


def test_caddyfile_sends_security_headers(caddyfile: str) -> None:
    for header in (
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Permissions-Policy",
    ):
        assert header in caddyfile
    assert "includeSubDomains" in caddyfile


def test_caddyfile_routes_api_health_and_web_under_one_domain(caddyfile: str) -> None:
    main = caddyfile.split(MEDIA_SITE)[0]
    assert "handle /api/*" in main and "reverse_proxy api:8000" in main
    assert "handle /health*" in main
    assert "reverse_proxy web:3000" in main


def test_caddyfile_never_publishes_the_ai_service(caddyfile: str) -> None:
    code = "\n".join(line for line in caddyfile.splitlines() if not line.lstrip().startswith("#"))
    assert "/ai" not in code


def test_caddyfile_serves_photos_from_their_own_subdomain(caddyfile: str) -> None:
    media = caddyfile.split(MEDIA_SITE, 1)[1]
    assert "reverse_proxy storage:9000" in media
    assert "rewrite" not in media and "uri strip_prefix" not in media  # keeps the signed path


def test_caddyfile_accepts_an_institutional_certificate_without_other_changes(
    caddyfile: str,
) -> None:
    assert "import /etc/caddy/certs/tls*.caddy" in caddyfile
    assert "(certificate)" in caddyfile


def test_csp_allows_only_the_known_origins(caddyfile: str) -> None:
    policy = next(line for line in caddyfile.splitlines() if "Content-Security-Policy" in line)
    assert "default-src 'self'" in policy and "frame-ancestors 'none'" in policy
    assert "object-src 'none'" in policy
    assert "*" not in policy.replace("'self'", "")


# --------------------------------------------------------------------------------------- systemd
UNITS = [
    "matp-backup",
    "matp-backup-check",
    "matp-disk-check",
    "matp-kpis-snapshot",
    "matp-audit-digest",
]


def test_the_audit_digest_unit_runs_the_real_command() -> None:
    service = (VM / "systemd" / "matp-audit-digest.service").read_text(encoding="utf-8")
    assert "ExecStart=/opt/matp/app/deploy/vm/audit-digest.sh" in service
    script = (VM / "audit-digest.sh").read_text(encoding="utf-8")
    assert "python -m app.modules.audit.digest" in script and "--verify" in script


@pytest.mark.parametrize("name", UNITS)
def test_every_unit_has_a_service_and_a_timer(name: str) -> None:
    service = (VM / "systemd" / f"{name}.service").read_text(encoding="utf-8")
    timer = (VM / "systemd" / f"{name}.timer").read_text(encoding="utf-8")
    assert "[Service]" in service and "Type=oneshot" in service and "ExecStart=" in service
    assert re.search(r"^OnCalendar=\S", timer, re.M)
    assert "WantedBy=timers.target" in timer


def test_schedule_follows_the_design() -> None:
    timer = lambda n: (VM / "systemd" / f"{n}.timer").read_text(encoding="utf-8")  # noqa: E731
    assert "OnCalendar=*-*-* 02:00:00" in timer("matp-backup")
    assert "OnCalendar=Sun" in timer("matp-backup-check")
    assert "OnCalendar=hourly" in timer("matp-disk-check")
    assert "OnCalendar=*-*-* 23:50:00" in timer("matp-kpis-snapshot")
    assert "OnCalendar=*-*-* 00:30:00" in timer("matp-audit-digest")


@pytest.mark.parametrize("name", ["matp-kpis-snapshot"])
def test_commands_that_do_not_exist_yet_stay_commented(name: str) -> None:
    service = (VM / "systemd" / f"{name}.service").read_text(encoding="utf-8")
    assert "ExecStart=/bin/true" in service
    commented = [line for line in service.splitlines() if line.startswith("# ExecStart=")]
    assert len(commented) == 1


# --------------------------------------------------------------- scripts (Bash con dobles)
def _posix(path: Path) -> str:
    return path.as_posix()


@pytest.fixture
def shim(tmp_path: Path) -> dict[str, str]:
    """Entorno con dobles que registran sus llamadas en `calls.log`."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"

    def write(name: str, body: str) -> str:
        path = bin_dir / name
        path.write_text("#!/usr/bin/env bash\n" + body, encoding="utf-8", newline="\n")
        path.chmod(0o755)
        return _posix(path)

    restic = write(
        "restic",
        f'echo "restic $*" >> {_posix(calls)}\n'
        '[[ "$1" == "backup" && "$*" == *--stdin* ]] && cat > /dev/null\n'
        '[[ "${FAKE_RESTIC_FAIL:-}" == "$1" ]] && exit 1\nexit 0\n',
    )
    rclone = write("rclone", f'echo "rclone $*" >> {_posix(calls)}\nexit 0\n')
    curl = write("curl", f'echo "curl $*" >> {_posix(calls)}\nexit 0\n')
    compose = write("compose", f'echo "compose $*" >> {_posix(calls)}\necho "PGDMP-fake"\n')
    key = tmp_path / "restic.key"
    key.write_text("clave-de-prueba", encoding="utf-8")
    state = tmp_path / "state"
    return {
        "RESTIC_BIN": restic,
        "RCLONE_BIN": rclone,
        "CURL_BIN": curl,
        "MATP_COMPOSE": f"bash {compose}",
        "MATP_ENV_FILE": _posix(tmp_path / "no-existe.env"),
        "MATP_STATE_DIR": _posix(state),
        "BACKUP_MIRROR_DIR": _posix(tmp_path / "mirror"),
        "RESTIC_REPOSITORY": "s3:https://destino.example/matp-respaldos",
        "RESTIC_PASSWORD_FILE": _posix(key),
        "POSTGRES_USER": "matp",
        "POSTGRES_DB": "matp",
        "S3_BUCKET": "matp-media",
        "S3_ENDPOINT_URL": "http://storage:9000",
        "S3_ACCESS_KEY_ID": "id",
        "S3_SECRET_ACCESS_KEY": "secreto",
        "ALERT_WEBHOOK_URL": "https://alertas.example/hook",
        "_CALLS": _posix(calls),
    }


def _run(script: Path, env: dict[str, str], **extra: str) -> subprocess.CompletedProcess[str]:
    import os

    full = {**os.environ, **env, **extra}
    return subprocess.run(
        [BASH or "bash", _posix(script)], env=full, capture_output=True, text=True, timeout=60
    )


def _calls(env: dict[str, str]) -> str:
    path = Path(env["_CALLS"])
    return path.read_text(encoding="utf-8") if path.exists() else ""


@needs_bash
@pytest.mark.parametrize(
    "script", [*sorted(BACKUP.glob("*.sh")), VM / "disk-check.sh", VM / "audit-digest.sh"]
)
def test_scripts_have_valid_bash_syntax(script: Path) -> None:
    result = subprocess.run([BASH or "bash", "-n", _posix(script)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


@needs_bash
def test_a_successful_backup_saves_db_and_objects_and_marks_ok(shim: dict[str, str]) -> None:
    """Spec: «Respaldo nocturno exitoso»."""
    result = _run(BACKUP / "backup-restic.sh", shim)

    assert result.returncode == 0, result.stderr
    calls = _calls(shim)
    assert "backup --stdin --stdin-filename matp.pgdump --tag db" in calls
    assert "rclone sync :s3:matp-media" in calls
    assert "--tag objects" in calls
    assert "forget --prune --keep-daily 30 --keep-weekly 8 --keep-monthly 6" in calls
    assert "curl" not in calls  # nobody is alerted when everything worked
    marker = json.loads((Path(shim["MATP_STATE_DIR"]) / "backup-status.json").read_text())
    assert marker["last_result"] == "ok" and marker["last_success_at"].endswith("Z")


@needs_bash
def test_an_unreachable_destination_marks_the_backup_failed_and_alerts(
    shim: dict[str, str],
) -> None:
    """Spec: «Destino externo inaccesible»: se registra, se notifica y el estado lo refleja."""
    state = Path(shim["MATP_STATE_DIR"])
    state.mkdir(parents=True)
    old = "2026-10-20T02:03:40Z"
    (state / "backup-status.json").write_text(
        json.dumps({"last_success_at": old, "last_result": "ok"}), encoding="utf-8"
    )

    result = _run(BACKUP / "backup-restic.sh", shim, FAKE_RESTIC_FAIL="backup")

    assert result.returncode == 1
    marker = json.loads((state / "backup-status.json").read_text())
    assert marker["last_result"] == "failed"
    assert marker["last_success_at"] == old  # the last real success is kept
    assert "curl" in _calls(shim) and "alertas.example/hook" in _calls(shim)
    assert "backup_failed" in result.stderr


@needs_bash
def test_a_backup_without_the_key_refuses_to_run_and_says_why(shim: dict[str, str]) -> None:
    """Spec: «Respaldo sin la clave» (sin clave no hay respaldo cifrado, y se avisa)."""
    result = _run(BACKUP / "backup-restic.sh", shim, RESTIC_PASSWORD_FILE="/no/existe.key")
    assert result.returncode == 1
    assert "restic backup" not in _calls(shim)
    assert "curl" in _calls(shim)


@needs_bash
def test_the_integrity_check_reads_a_data_subset_and_alerts_on_failure(
    shim: dict[str, str],
) -> None:
    ok = _run(BACKUP / "check.sh", shim)
    assert ok.returncode == 0, ok.stderr
    assert "check --read-data-subset=5%" in _calls(shim)

    bad = _run(BACKUP / "check.sh", shim, FAKE_RESTIC_FAIL="check")
    assert bad.returncode == 1
    assert "curl" in _calls(shim)


@needs_bash
def test_photo_verification_flags_a_corrupt_or_missing_photo(tmp_path: Path) -> None:
    """Spec: «Foto corrupta en el respaldo»: el simulacro falla indicando la foto."""
    objects = tmp_path / "objects"
    (objects / "fotos").mkdir(parents=True)
    good = objects / "fotos" / "buena.jpg"
    good.write_bytes(b"contenido original")
    bad = objects / "fotos" / "danada.jpg"
    bad.write_bytes(b"contenido alterado")
    import hashlib

    sha_good = hashlib.sha256(b"contenido original").hexdigest()
    sha_bad = hashlib.sha256(b"contenido original").hexdigest()  # the hash recorded in the DB
    rows = (
        f"fotos/buena.jpg\t{sha_good}\nfotos/danada.jpg\t{sha_bad}\nfotos/falta.jpg\t{sha_good}\n"
    )
    script = f'source "{_posix(BACKUP / "lib.sh")}"; verify_photos "{_posix(objects)}"'

    import os

    result = subprocess.run(
        [BASH or "bash", "-c", script],
        input=rows,
        capture_output=True,
        text=True,
        env={**os.environ, "MATP_STATE_DIR": _posix(tmp_path / "s")},
    )

    assert result.returncode == 1
    assert "HUELLA DISTINTA: fotos/danada.jpg" in result.stdout
    assert "FALTA: fotos/falta.jpg" in result.stdout
    assert "fotos/buena.jpg" not in result.stdout


@needs_bash
def test_photo_verification_passes_when_every_hash_matches(tmp_path: Path) -> None:
    import hashlib
    import os

    (tmp_path / "a.jpg").write_bytes(b"uno")
    rows = f"a.jpg\t{hashlib.sha256(b'uno').hexdigest()}\n"
    script = f'source "{_posix(BACKUP / "lib.sh")}"; verify_photos "{_posix(tmp_path)}"'
    result = subprocess.run(
        [BASH or "bash", "-c", script],
        input=rows,
        capture_output=True,
        text=True,
        env={**os.environ, "MATP_STATE_DIR": _posix(tmp_path / "s")},
    )
    assert result.returncode == 0 and result.stdout == ""


@needs_bash
@pytest.mark.skipif(shutil.which("restic") is not None, reason="restic está instalado aquí")
def test_the_restic_container_sees_the_mirror_and_runs_as_the_caller(
    tmp_path: Path, shim: dict[str, str]
) -> None:
    """Regresión del ensayo en Docker real: sin montar el espejo, restic no veía qué respaldar.

    Sin binario `restic` el script usa su imagen: debe montar el espejo (solo lectura), el
    directorio de trabajo y la clave, y correr con el usuario de quien invoca para que los
    archivos restaurados en el simulacro se puedan leer desde la VM.
    """
    import os

    bin_dir = tmp_path / "dockerbin"
    bin_dir.mkdir()
    log = tmp_path / "docker.log"
    docker = bin_dir / "docker"
    docker.write_text(f'#!/usr/bin/env bash\necho "$*" >> {_posix(log)}\n', newline="\n")
    docker.chmod(0o755)
    mirror, work = tmp_path / "mirror", tmp_path / "work"
    script = f'source "{_posix(BACKUP / "lib.sh")}"; restic_cmd backup "{_posix(mirror)}"'
    env = {
        **os.environ,
        "PATH": f"{_posix(bin_dir)}:{os.environ['PATH']}",
        "MATP_STATE_DIR": _posix(tmp_path / "s"),
        "RESTIC_IMAGE": "restic/restic:0.19.1",
        "RESTIC_PASSWORD_FILE": shim["RESTIC_PASSWORD_FILE"],
        "BACKUP_MIRROR_DIR": _posix(mirror),
        "BACKUP_WORK_DIR": _posix(work),
    }
    subprocess.run([BASH or "bash", "-c", script], env=env, check=True)

    call = log.read_text(encoding="utf-8")
    assert f"-v {_posix(mirror)}:{_posix(mirror)}:ro" in call
    assert f"-v {_posix(work)}:{_posix(work)}" in call
    assert f"-v {shim['RESTIC_PASSWORD_FILE']}:{shim['RESTIC_PASSWORD_FILE']}:ro" in call
    assert "--user " in call and "restic/restic:0.19.1 backup" in call
