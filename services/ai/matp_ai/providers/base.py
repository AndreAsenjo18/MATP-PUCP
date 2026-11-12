"""Provider interface (design D8 of contratos-api-borrador)."""

from abc import ABC, abstractmethod

from matp_ai.schemas import (
    ColumnMappingResult,
    DescriptionResult,
    ExtractionResult,
    PieceContext,
    TermSuggestionResult,
)


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

    @abstractmethod
    def suggest_column_mapping(
        self,
        headers: list[str],
        sample_rows: list[dict[str, object]],
        target_fields: dict[str, str],
    ) -> ColumnMappingResult:
        """Carga masiva con IA (change carga-masiva-con-ia): a qué campo de ``target_fields``
        corresponde cada columna de un archivo que ninguna plantilla guardada reconoció."""
