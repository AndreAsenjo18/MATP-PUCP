"""Spec plataforma — Entorno local reproducible con verificación de salud."""

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import SECRET


def _ok() -> None:
    return None


def _fail() -> None:
    raise ConnectionError(f"could not connect to postgresql://matp:{SECRET}@db:5432/matp")


def test_health_ok(settings: Settings) -> None:
    app = create_app(settings, health_checks={"database": _ok, "storage": _ok})
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "api"
    assert body["version"] == settings.app_version
    assert body["checks"] == {
        "database": {"status": "ok", "detail": None},
        "storage": {"status": "ok", "detail": None},
    }


def test_health_degraded_when_database_down(settings: Settings) -> None:
    app = create_app(settings, health_checks={"database": _fail, "storage": _ok})
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "error"
    assert body["checks"]["storage"]["status"] == "ok"


def test_health_never_exposes_secrets(settings: Settings) -> None:
    app = create_app(settings, health_checks={"database": _fail, "storage": _fail})
    with TestClient(app) as client:
        text = client.get("/health").text
    assert SECRET not in text
    assert "postgresql://" not in text


def test_real_database_check_with_sqlite(settings: Settings) -> None:
    app = create_app(settings, health_checks=None)
    app.state.health_checks = {"database": app.state.health_checks["database"]}
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["checks"]["database"]["status"] == "ok"


def test_liveness_has_no_dependencies(settings: Settings) -> None:
    app = create_app(settings, health_checks={"database": _fail})
    with TestClient(app) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "api"}


def test_ai_application_is_mounted_in_the_same_process(settings: Settings) -> None:
    """ADR-008: la IA asistiva no tiene contenedor propio; responde bajo AI_MOUNT_PATH."""
    app = create_app(settings, health_checks={"database": _ok, "storage": _ok})
    with TestClient(app) as client:
        response = client.get(f"{settings.ai_mount_path}/health")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "ai"
    assert body["provider"] == "mock"


def test_ai_suggestion_endpoint_answers_without_a_separate_service(settings: Settings) -> None:
    app = create_app(settings, health_checks={"database": _ok, "storage": _ok})
    with TestClient(app) as client:
        response = client.post(
            f"{settings.ai_mount_path}/v1/describe",
            json={"title": "Retablo ayacuchano", "materials": ["madera", "yeso"]},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["function_code"] == "RIA_04"
    assert body["requires_human_approval"] is True
    assert body["status"] == "PENDING_REVIEW"
