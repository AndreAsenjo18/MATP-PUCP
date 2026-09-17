"""AI service application factory. Run with: uvicorn app.main:create_app --factory --port 8100"""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from app.config import Settings, get_settings


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "ai"
    version: str
    provider: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="MATP AI service",
        description=(
            "Servicio de IA asistiva desacoplado. Toda salida requiere aprobación humana (RN-009)."
        ),
        version=settings.app_version,
    )
    app.state.settings = settings

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse(version=settings.app_version, provider=settings.ai_provider)

    return app
