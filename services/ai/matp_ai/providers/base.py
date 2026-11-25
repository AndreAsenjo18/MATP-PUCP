"""Provider interface (design D8 of contratos-api-borrador)."""

from abc import ABC, abstractmethod

from matp_ai.schemas import (
    ColumnMappingResult,
    CompletePieceRequest,
    CompletionResult,
    DescriptionResult,
    ExtractionResult,
    JudgeDuplicatesRequest,
    JudgeDuplicatesResult,
    LedgerPageExtraction,
    LedgerPageImage,
    PieceContext,
    SearchInterpretation,
    SearchValidValues,
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

    @abstractmethod
    def interpret_search(self, text: str, valid_values: SearchValidValues) -> SearchInterpretation:
        """RIA-06 (change busqueda-lenguaje-natural): traduce una frase de búsqueda, escrita o
        dictada, a los filtros que ya entiende el buscador — solo de lectura, nunca escribe nada."""

    @abstractmethod
    def complete_piece(self, request: CompletePieceRequest) -> CompletionResult:
        """RIA-01 + RIA-03 (change ia-completar-ficha): proposals for the missing fields of one
        piece, read only from its own text and photo, each with its evidence. The caller runs
        ``finish_completion`` again on whatever comes back (D2)."""

    @abstractmethod
    def extract_ledger_page(self, image: LedgerPageImage) -> LedgerPageExtraction:
        """RIA-07 (change digitalizacion-libro-registros): por cada fila que se distinga en la
        foto de una página del libro de registros manuscrito, propone sus datos con su confianza.
        Solo de lectura: no decide NUEVA/ACTUALIZACIÓN ni escribe nada — eso lo hace, como con
        cualquier importación, la clasificación por código que ya existe sobre lo que devuelve."""

    @abstractmethod
    def judge_duplicates(self, request: JudgeDuplicatesRequest) -> JudgeDuplicatesResult:
        """RIA-02 (change ia-juicio-duplicados): for each pair, whether both records describe the
        same physical piece (``same``, ``distinct`` or ``unsure``), with a confidence and a
        one-sentence reason. Read only from the catalog fields received; nothing is applied
        (RN-009). The caller runs ``finish_judgments`` on whatever comes back (D4)."""
