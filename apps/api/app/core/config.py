"""Typed configuration loaded from environment variables.

Required variables have no default: if any is missing the service refuses to start
and reports, in Spanish, which variables are missing (spec plataforma, RNF-002).
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(RuntimeError):
    """Raised when the environment does not provide a valid configuration."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"

    # Database (PostgreSQL in every environment; SQLite only inside unit tests).
    database_url: str = Field(min_length=1)

    # S3-compatible object storage (MinIO locally, Cloudflare R2 / S3 elsewhere).
    s3_endpoint_url: str | None = None
    s3_public_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key_id: str = Field(min_length=1)
    s3_secret_access_key: str = Field(min_length=1)
    s3_bucket: str = Field(min_length=1)
    s3_auto_create_bucket: bool = False

    # Authentication (JWT). Implemented in a later change; the secret is required from day one.
    jwt_secret: str = Field(min_length=16)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Internal services.
    ai_service_url: str = "http://ai:8100"
    cors_origins: str = "http://localhost:3000"
    health_check_timeout_seconds: float = 2.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def _format_errors(exc: ValidationError) -> str:
    missing: list[str] = []
    invalid: list[str] = []
    for error in exc.errors():
        name = str(error["loc"][0]).upper() if error["loc"] else "?"
        if error["type"] == "missing":
            missing.append(name)
        else:
            invalid.append(f"{name} ({error['msg']})")
    parts: list[str] = []
    if missing:
        parts.append("Faltan variables de entorno obligatorias: " + ", ".join(sorted(missing)))
    if invalid:
        parts.append("Variables de entorno con valor no válido: " + "; ".join(invalid))
    parts.append("Revise su archivo .env (plantilla en .env.example).")
    return "\n".join(parts)


def load_settings(**overrides: object) -> Settings:
    """Build settings from the environment, translating validation errors to a clear message."""
    try:
        return Settings(**overrides)  # type: ignore[arg-type]
    except ValidationError as exc:
        raise ConfigurationError(_format_errors(exc)) from exc


@lru_cache
def get_settings() -> Settings:
    return load_settings()
