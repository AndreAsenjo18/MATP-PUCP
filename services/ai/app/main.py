"""AI service application factory. Run with: uvicorn app.main:create_app --factory --port 8100"""

from typing import Literal

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.providers import AIProvider, ProviderUnavailable, get_provider
from app.schemas import (
    DescriptionResult,
    ErrorResponse,
    ExtractionResult,
    ExtractRequest,
    PieceContext,
    SuggestionEnvelope,
    TermSuggestionResult,
)

ERRORS: dict[int | str, dict[str, object]] = {
    422: {"model": ErrorResponse, "description": "Entrada no válida."},
    503: {"model": ErrorResponse, "description": "Proveedor de IA no disponible."},
}


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "ai"
    version: str
    provider: str


def create_app(settings: Settings | None = None, provider: AIProvider | None = None) -> FastAPI:
    settings = settings or get_settings()
    provider = provider or get_provider(settings)
    app = FastAPI(
        title="MATP AI service",
        description=(
            "Servicio de IA asistiva desacoplado. Toda salida es una propuesta pendiente de "
            "aprobación humana (RN-009); el servicio no escribe en el catálogo."
        ),
        version=settings.app_version,
        generate_unique_id_function=lambda route: route.name,
    )
    app.state.settings = settings
    app.state.provider = provider

    @app.exception_handler(ProviderUnavailable)
    async def _unavailable(_request: Request, exc: Exception) -> JSONResponse:
        body = ErrorResponse(code="ai_provider_unavailable", message=str(exc))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=body.model_dump()
        )

    @app.exception_handler(RequestValidationError)
    async def _invalid(_request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, RequestValidationError)
        fields = [
            {"location": [str(p) for p in e.get("loc", ())], "message": e.get("msg")}
            for e in exc.errors()
        ]
        body = ErrorResponse(
            code="request_validation_failed",
            message="Revise los datos enviados: " + "; ".join(str(f["message"]) for f in fields),
            details={"fields": fields},
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content=jsonable_encoder(body)
        )

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse(version=settings.app_version, provider=settings.ai_provider)

    @app.post(
        "/v1/extract-structured",
        response_model=SuggestionEnvelope[ExtractionResult],
        responses=ERRORS,
        tags=["IA asistiva"],
        summary="RIA-01: proponer datos estructurados desde texto libre",
    )
    def extract_structured(body: ExtractRequest) -> SuggestionEnvelope[ExtractionResult]:
        return SuggestionEnvelope[ExtractionResult](
            function_code="RIA_01",
            provider=provider.name,
            model=provider.model,
            result=provider.extract_structured(body.text),
        )

    @app.post(
        "/v1/suggest-terms",
        response_model=SuggestionEnvelope[TermSuggestionResult],
        responses=ERRORS,
        tags=["IA asistiva"],
        summary="RIA-03: sugerir términos normalizados de vocabulario",
    )
    def suggest_terms(body: PieceContext) -> SuggestionEnvelope[TermSuggestionResult]:
        return SuggestionEnvelope[TermSuggestionResult](
            function_code="RIA_03",
            provider=provider.name,
            model=provider.model,
            result=provider.suggest_terms(body),
        )

    @app.post(
        "/v1/describe",
        response_model=SuggestionEnvelope[DescriptionResult],
        responses=ERRORS,
        tags=["IA asistiva"],
        summary="RIA-04: descripción preliminar desde metadatos",
    )
    def describe(body: PieceContext) -> SuggestionEnvelope[DescriptionResult]:
        return SuggestionEnvelope[DescriptionResult](
            function_code="RIA_04",
            provider=provider.name,
            model=provider.model,
            result=provider.describe(body),
        )

    return app
