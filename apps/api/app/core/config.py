"""Typed configuration loaded from environment variables.

Required variables have no default: if any is missing the service refuses to start
and reports, in Spanish, which variables are missing (spec plataforma, RNF-002).
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(RuntimeError):
    """Raised when the environment does not provide a valid configuration."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_version: str = "0.1.0"
    # Build identity reported by /health (change pipeline-despliegue-ambientes, design D5):
    # APP_COMMIT comes from the image build (GIT_SHA), APP_RELEASE from deploy.sh.
    app_commit: str = "dev"
    app_release: str | None = None
    log_level: str = "INFO"

    # Database (PostgreSQL in every environment; SQLite only inside unit tests).
    database_url: str = Field(min_length=1)

    # S3-compatible object storage (MinIO locally, Cloudflare R2 / S3 elsewhere).
    # Credentials are optional: when both are empty boto3 falls back to its default
    # credential chain (AWS_* variables, shared profile or EC2 instance role — ADR-013).
    s3_endpoint_url: str | None = None
    s3_public_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket: str = Field(min_length=1)
    s3_auto_create_bucket: bool = False

    # Authentication: opaque server-side sessions, not JWT (ADR-009). There is no shared secret
    # to configure: the session token is random and only its SHA-256 digest is stored.
    # Idle and absolute session lifetimes [SUPUESTO C7].
    session_idle_minutes: int = Field(30, ge=1)
    session_max_hours: int = Field(12, ge=1)
    # Temporary account lock after repeated failures [SUPUESTO C7].
    login_max_failed_attempts: int = Field(5, ge=1)
    login_lock_minutes: int = Field(15, ge=1)
    # Web origin allowed to send credentials; it matters in the free-tier contingency, where the
    # web and the API live on different domains (ADR-009, point 8).
    web_origin: str = "http://localhost:3000"
    # `Secure` flag of the session and CSRF cookies: only local development may turn it off.
    cookie_secure: bool = True
    # Identity provider (ADR-009, decision D8): "local" verifies a password against the
    # database; "oidc" (institutional PUCP account) is a documented stub in phase 1 (RNF-012).
    auth_provider: Literal["local", "oidc"] = "local"
    # Password of the synthetic seed users, so development can sign in without the dev header.
    # Never set in production: synthetic users cannot sign in there (ADR-009, point 7).
    seed_dev_password: str | None = None

    # IA asistiva: se ejecuta dentro de este mismo proceso, montada en AI_MOUNT_PATH (ADR-008).
    ai_mount_path: str = "/ai"
    cors_origins: str = "http://localhost:3000"
    health_check_timeout_seconds: float = 2.0

    # Import pipeline limits (design D2 of importacion-pipeline-reconciliacion) [SUPUESTO].
    import_max_bytes: int = Field(50 * 1024 * 1024, ge=1)
    import_max_rows: int = Field(20_000, ge=1)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def session_max_minutes(self) -> int:
        """Absolute session lifetime in minutes (ADR-009, decision D1)."""
        return self.session_max_hours * 60

    @field_validator(
        "s3_access_key_id",
        "s3_secret_access_key",
        "app_release",
        "seed_dev_password",
        mode="before",
    )
    @classmethod
    def _empty_string_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _s3_credentials_both_or_neither(self) -> "Settings":
        if (self.s3_access_key_id is None) != (self.s3_secret_access_key is None):
            raise ValueError(
                "S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY deben definirse ambas o ninguna "
                "(dejarlas vacías usa la cadena de credenciales por defecto de AWS)"
            )
        return self

    @model_validator(mode="after")
    def _production_requires_secure_cookies(self) -> "Settings":
        """HTTPS es obligatorio en producción, así que la cookie de sesión va siempre `Secure`."""
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError(
                "COOKIE_SECURE no puede ser falso con APP_ENV=production: la cookie de sesión "
                "solo viaja por HTTPS (RNF-013, ADR-009)"
            )
        return self


def _format_errors(exc: ValidationError) -> str:
    missing: list[str] = []
    invalid: list[str] = []
    for error in exc.errors():
        name = str(error["loc"][0]).upper() if error["loc"] else "?"
        if error["type"] == "missing":
            missing.append(name)
        elif error["type"] == "value_error" and not error["loc"]:
            # Model-level validation (e.g. S3 credentials both-or-neither): message already clear.
            invalid.append(str(error["msg"]).removeprefix("Value error, "))
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
