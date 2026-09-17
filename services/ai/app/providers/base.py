"""Provider interface (design D8 of contratos-api-borrador)."""

from abc import ABC, abstractmethod

from app.schemas import DescriptionResult, ExtractionResult, PieceContext, TermSuggestionResult


class ProviderUnavailable(RuntimeError):
    """The configured provider cannot answer; the rest of the system keeps working."""


class AIProvider(ABC):
    name: str
    model: str

    @abstractmethod
    def extract_structured(self, text: str) -> ExtractionResult:
        """RIA-01: structured data (dimensions, exhibitions, status, review marks) from text."""

    @abstractmethod
    def suggest_terms(self, piece: PieceContext) -> TermSuggestionResult:
        """RIA-03: normalized vocabulary terms for a piece."""

    @abstractmethod
    def describe(self, piece: PieceContext) -> DescriptionResult:
        """RIA-04: preliminary description built from metadata."""
