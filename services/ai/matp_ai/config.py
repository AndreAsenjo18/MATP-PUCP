"""Typed configuration for the AI service (spec plataforma / ia-asistiva)."""

from functools import lru_cache
from typing import Literal, get_args

from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["mock", "llm"]
ALLOWED_PROVIDERS: tuple[str, ...] = get_args(ProviderName)


class ConfigurationError(RuntimeError):
    """Raised when the environment does not provide a valid configuration."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    app_version: str = "0.1.0"
    ai_provider: ProviderName = "mock"
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None

    @model_validator(mode="after")
    def _llm_requires_credentials(self) -> "Settings":
        if self.ai_provider == "llm" and not (self.llm_api_key and self.llm_model):
            raise ValueError("AI_PROVIDER=llm requiere LLM_API_KEY y LLM_MODEL")
        return self


def load_settings(**overrides: object) -> Settings:
    try:
        return Settings(**overrides)  # type: ignore[arg-type]
    except ValidationError as exc:
        messages: list[str] = []
        for error in exc.errors():
            name = str(error["loc"][0]).upper() if error["loc"] else ""
            if name == "AI_PROVIDER":
                messages.append(
                    f"AI_PROVIDER={error.get('input')!r} no es válido. "
                    f"Valores permitidos: {', '.join(ALLOWED_PROVIDERS)}"
                )
            else:
                label = f"{name}: " if name else ""
                messages.append(f"{label}{error['msg']}")
        raise ConfigurationError("\n".join(messages)) from exc


@lru_cache
def get_settings() -> Settings:
    return load_settings()
