"""Spec plataforma — Respaldos: estado visible en /health sin datos del catálogo (task 3.1)."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.backup_status import read_backup_status
from app.core.config import Settings, load_settings
from app.main import create_app
from tests.conftest import SECRET

NOW = datetime(2026, 10, 22, 12, 0, tzinfo=UTC)


def _marker(tmp_path: Path, **fields: object) -> str:
    path = tmp_path / "backup-status.json"
    path.write_text(json.dumps(fields), encoding="utf-8")
    return str(path)


def _iso(delta: timedelta) -> str:
    return (NOW - delta).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_no_marker_configured_means_disabled() -> None:
    assert read_backup_status(None, 26, now=NOW).status == "disabled"
    assert read_backup_status("", 26, now=NOW).status == "disabled"


def test_a_recent_success_is_ok(tmp_path: Path) -> None:
    marker = _marker(tmp_path, last_success_at=_iso(timedelta(hours=3)), last_result="ok")
    status = read_backup_status(marker, 26, now=NOW)
    assert status.status == "ok" and status.last_success_at is not None


def test_a_success_older_than_26_hours_is_stale(tmp_path: Path) -> None:
    """Spec: «el estado técnico indica que el último respaldo exitoso tiene más de 26 horas»."""
    marker = _marker(tmp_path, last_success_at=_iso(timedelta(hours=27)), last_result="ok")
    assert read_backup_status(marker, 26, now=NOW).status == "stale"


def test_a_failed_latest_run_is_stale_at_once(tmp_path: Path) -> None:
    marker = _marker(
        tmp_path,
        last_attempt_at=_iso(timedelta(minutes=5)),
        last_success_at=_iso(timedelta(hours=20)),
        last_result="failed",
    )
    assert read_backup_status(marker, 26, now=NOW).status == "stale"


def test_a_missing_or_unreadable_marker_is_stale(tmp_path: Path) -> None:
    assert read_backup_status(str(tmp_path / "no-existe.json"), 26, now=NOW).status == "stale"
    broken = tmp_path / "roto.json"
    broken.write_text("{no es json", encoding="utf-8")
    assert read_backup_status(str(broken), 26, now=NOW).status == "stale"
    assert read_backup_status(_marker(tmp_path, last_success_at="ayer"), 26, now=NOW).status == (
        "stale"
    )


def _settings(**overrides: object) -> Settings:
    return load_settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        s3_endpoint_url="http://localhost:9000",
        s3_access_key_id="test-access-key",
        s3_secret_access_key=SECRET,
        s3_bucket="matp-test",
        **overrides,
    )


def _health(settings: Settings) -> dict:
    app = create_app(settings, health_checks={})
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    return response.json()


def test_health_reports_disabled_without_a_marker() -> None:
    assert _health(_settings())["backup"] == {
        "status": "disabled",
        "last_success_at": None,
        "max_age_hours": None,
    }


def test_health_reports_stale_without_exposing_paths_or_data(tmp_path: Path) -> None:
    missing = str(tmp_path / "secreto" / "estado.json")
    body = _health(_settings(backup_status_file=missing))
    assert body["backup"]["status"] == "stale"
    assert body["backup"]["max_age_hours"] == 26
    assert "secreto" not in json.dumps(body)  # the marker path never leaves the server


def test_health_reports_ok_after_a_fresh_backup(tmp_path: Path) -> None:
    recent = (datetime.now(UTC) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    marker = _marker(tmp_path, last_success_at=recent, last_result="ok")
    assert _health(_settings(backup_status_file=marker))["backup"]["status"] == "ok"
