"""Language-model provider stub, selected with AI_PROVIDER=llm.

The real client (endpoint, prompts, redaction of sensitive data) is implemented in the change
``ia-extraccion-texto-libre``. Until then every call reports the provider as unavailable (503).
"""

from app.config import Settings
from app.providers.base import AIProvider, ProviderUnavailable
from app.schemas import DescriptionResult, ExtractionResult, PieceContext, TermSuggestionResult

_MESSAGE = (
    "El proveedor de IA 'llm' aún no está implementado (change ia-extraccion-texto-libre). "
    "Use AI_PROVIDER=mock; el resto del sistema sigue operando."
)


class LLMProvider(AIProvider):
    name = "llm"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.llm_model or "sin-configurar"
        self.base_url = settings.llm_base_url

    def extract_structured(self, text: str) -> ExtractionResult:
        raise ProviderUnavailable(_MESSAGE)

    def suggest_terms(self, piece: PieceContext) -> TermSuggestionResult:
        raise ProviderUnavailable(_MESSAGE)

    def describe(self, piece: PieceContext) -> DescriptionResult:
        raise ProviderUnavailable(_MESSAGE)
