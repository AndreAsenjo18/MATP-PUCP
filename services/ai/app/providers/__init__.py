"""AI providers selectable with AI_PROVIDER (mock by default)."""

from app.config import Settings
from app.providers.base import AIProvider, ProviderUnavailable
from app.providers.llm import LLMProvider
from app.providers.mock import MockProvider

__all__ = ["AIProvider", "LLMProvider", "MockProvider", "ProviderUnavailable", "get_provider"]


def get_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "llm":
        return LLMProvider(settings)
    return MockProvider()
