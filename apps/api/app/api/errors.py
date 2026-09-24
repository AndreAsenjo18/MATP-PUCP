"""Uniform HTTP error format (design D4 of contratos-api-borrador; RNF-009).

Every error body is ``{"code", "message", "details"}`` with a stable machine-readable code and a
Spanish user-facing message. Stack traces, SQL and connection strings are never returned.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import (
    AuthenticationRequired,
    BusinessRuleViolation,
    DomainError,
    NotFound,
    PermissionDenied,
    ValidationFailed,
)

logger = logging.getLogger("matp.api")


class ErrorResponse(BaseModel):
    """Error body shared by every endpoint."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "code": "duplicate_acronym",
                    "message": "La sigla M.M.Z. coincide con la de la colección existente "
                    "Colección MMZ (ficticia) (MMZ).",
                    "details": {"collection_id": "01920000-0000-7000-8000-000000000001"},
                }
            ]
        }
    )

    code: str = Field(description="Código estable del error, en inglés (snake_case).")
    message: str = Field(description="Mensaje para la persona usuaria, en español.")
    details: dict[str, Any] = Field(default_factory=dict)


class NotImplementedResponse(ErrorResponse):
    """Body returned by stub operations (``x-status: stub``)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "code": "not_implemented",
                    "message": "Operación del contrato aún no implementada. La implementa el "
                    "change importacion-pipeline-reconciliacion.",
                    "details": {},
                    "change": "importacion-pipeline-reconciliacion",
                    "example": {"id": "01920000-0000-7000-8000-000000000010"},
                }
            ]
        }
    )

    change: str = Field(description="Change de OpenSpec que implementará la operación.")
    example: Any | None = Field(
        default=None, description="Ejemplo sintético del cuerpo que devolverá la operación."
    )


class NotImplementedEndpoint(Exception):
    def __init__(self, change: str, example: Any | None = None) -> None:
        super().__init__(change)
        self.change = change
        self.example = example


STATUS_BY_ERROR: list[tuple[type[DomainError], int]] = [
    (AuthenticationRequired, status.HTTP_401_UNAUTHORIZED),
    (NotFound, status.HTTP_404_NOT_FOUND),
    (PermissionDenied, status.HTTP_403_FORBIDDEN),
    (ValidationFailed, status.HTTP_422_UNPROCESSABLE_CONTENT),
    (BusinessRuleViolation, status.HTTP_409_CONFLICT),
]

HTTP_CODES = {
    400: "bad_request",
    401: "authentication_required",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "request_validation_failed",
}

HTTP_MESSAGES = {
    404: "El recurso solicitado no existe.",
    405: "Método no permitido para este recurso.",
}

# Documented on every business route.
COMMON_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Falta identificar al usuario (RF-042)."},
    403: {"model": ErrorResponse, "description": "El rol no tiene el permiso requerido."},
    422: {"model": ErrorResponse, "description": "Datos no válidos."},
}


def _error(status_code: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    body = ErrorResponse(code=code, message=message, details=details or {})
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))


def status_for(exc: DomainError) -> int:
    for error_cls, status_code in STATUS_BY_ERROR:
        if isinstance(exc, error_cls):
            return status_code
    return status.HTTP_400_BAD_REQUEST


async def _domain_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    return _error(status_for(exc), exc.code, exc.message, exc.details)


async def _validation_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    fields = [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "type": error.get("type"),
            "message": error.get("msg"),
        }
        for error in exc.errors()
    ]
    return _error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "request_validation_failed",
        "Revise los datos enviados: hay campos obligatorios vacíos o con formato no válido.",
        {"fields": fields},
    )


async def _integrity_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.warning("Integrity error: %s", type(exc).__name__)
    return _error(
        status.HTTP_409_CONFLICT,
        "integrity_conflict",
        "La operación entra en conflicto con datos existentes (por ejemplo, un valor único "
        "repetido). No se guardó ningún cambio.",
    )


async def _http_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = HTTP_CODES.get(exc.status_code, "http_error")
    message = HTTP_MESSAGES.get(exc.status_code) or (
        exc.detail if isinstance(exc.detail, str) else "Error en la petición."
    )
    return _error(exc.status_code, code, message)


async def _not_implemented_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NotImplementedEndpoint)
    body = NotImplementedResponse(
        code="not_implemented",
        message=(
            f"Operación del contrato aún no implementada. La implementa el change {exc.change}."
        ),
        change=exc.change,
        example=exc.example,
    )
    return JSONResponse(status_code=status.HTTP_501_NOT_IMPLEMENTED, content=jsonable_encoder(body))


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(IntegrityError, _integrity_handler)
    app.add_exception_handler(StarletteHTTPException, _http_handler)
    app.add_exception_handler(NotImplementedEndpoint, _not_implemented_handler)
