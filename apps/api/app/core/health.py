"""Health endpoints (spec plataforma: entorno local reproducible con verificación de salud)."""

from collections.abc import Callable
from typing import Literal

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel

HealthCheck = Callable[[], None]


class DependencyStatus(BaseModel):
    status: Literal["ok", "error"]
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    version: str
    checks: dict[str, DependencyStatus]


class LivenessResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str


router = APIRouter(tags=["health"])


def run_checks(checks: dict[str, HealthCheck]) -> dict[str, DependencyStatus]:
    results: dict[str, DependencyStatus] = {}
    for name, check in checks.items():
        try:
            check()
            results[name] = DependencyStatus(status="ok")
        except Exception as exc:  # noqa: BLE001 - any failure means the dependency is down
            # Only the exception class is exposed: messages may contain hosts or credentials.
            results[name] = DependencyStatus(status="error", detail=type(exc).__name__)
    return results


@router.get("/health", response_model=HealthResponse, summary="Estado del servicio y dependencias")
def health(request: Request, response: Response) -> HealthResponse:
    results = run_checks(request.app.state.health_checks)
    degraded = any(item.status == "error" for item in results.values())
    if degraded:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="degraded" if degraded else "ok",
        service="api",
        version=request.app.version,
        checks=results,
    )


@router.get("/health/live", response_model=LivenessResponse, summary="Proceso en ejecución")
def liveness() -> LivenessResponse:
    return LivenessResponse(service="api")
