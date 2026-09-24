"""AI providers selectable with AI_PROVIDER (mock by default)."""

from matp_ai.config import Settings
from matp_ai.providers.base import AIProvider, ProviderUnavailable
from matp_ai.providers.llm import LLMProvider
from matp_ai.providers.mock import MockProvider

__all__ = ["AIProvider", "LLMProvider", "MockProvider", "ProviderUnavailable", "get_provider"]


def get_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "llm":
        return LLMProvider(settings)
    return MockProvider()
