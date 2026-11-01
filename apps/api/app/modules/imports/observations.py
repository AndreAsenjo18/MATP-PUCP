"""Sheets of quality observations of the consultancy (change formatos-reales-importacion, D8).

The sheets «Errores identificados» and «Errores pendientes» list problems of pieces already in the
inventory. A batch of kind ``OBSERVATIONS`` goes through the same mapping, validation and preview
as an Excel, with three differences:

- its rows are only matched with pieces of the catalogue by their codes: a row without a piece is
  a validation error («pieza no encontrada», with its codes) and stays in the log, not applied;
  a row is never offered as a new piece nor as a possible duplicate;
- the observation is the text of the columns not mapped to a code (``«Columna: valor»``, joined
  with «; »), plus the observations column if one was mapped, preceded by its source;
- the preview shows it as a change of «Observaciones»: the current notes and the notes with the
  observation added. Applying appends the observation to the notes the piece has *then*.

[SUPUESTO L8] The sheets come from the 2024/25 consultancy: a sheet whose name starts with
«Errores» takes the source «Consultoría 2024/25 — <hoja>»; any other sheet, «<archivo> — <hoja>».
"""

import unicodedata
from collections.abc import Sequence
from typing import Any

from app.modules.catalog.models import Piece
from app.modules.imports.classify import ClassifiedRow, RowError
from app.modules.imports.mapping import MappedRow
from app.modules.imports.models import ImportBatch, ImportBatchKind, RowClassification
from app.modules.imports.state import batch_kind

NOTES_FIELD = "notes"
CONSULTANCY_SOURCE = "Consultoría 2024/25"
#: Classifications of a row that found no piece: in an observations batch they are not applied.
NOT_FOUND = frozenset({RowClassification.NEW, RowClassification.POSSIBLE_DUPLICATE})


def is_observations(batch: ImportBatch) -> bool:
    return batch_kind(batch) is ImportBatchKind.OBSERVATIONS


def is_error_sheet(sheet_name: str | None) -> bool:
    """A sheet of errors of the consultancy, offered as observations («Errores pendientes»)."""
    if not sheet_name:
        return False
    plain = unicodedata.normalize("NFKD", sheet_name).encode("ascii", "ignore").decode()
    return plain.strip().lower().startswith("errores")


def observation_source(batch: ImportBatch) -> str:
    sheet = (batch.sheet_name or "").strip()
    if is_error_sheet(sheet):
        return f"{CONSULTANCY_SOURCE} — {sheet.lower()}"
    return f"{batch.file_name} — {sheet}" if sheet else batch.file_name


def _text(value: Any) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def observation_text(mapped: MappedRow) -> str | None:
    """The observation of a row: its observations field and the columns not mapped to a code.

    Columns with the owner's personal data (``sensitive_keys``) never reach the notes (RNF-014,
    D6): they stay restricted in the source data of the piece."""
    sensitive = set(mapped.sensitive_keys)
    parts = [_text(mapped.fields.get(NOTES_FIELD))]
    parts += [
        f"{column}: {_text(value)}"
        for column, value in mapped.source_payload.items()
        if _text(value) and column not in sensitive
    ]
    text = "; ".join(part for part in parts if part)
    return text or None


def observation_line(batch: ImportBatch, mapped: MappedRow) -> str | None:
    text = observation_text(mapped)
    return f"[{observation_source(batch)}] {text}" if text else None


def with_observation(notes: str | None, line: str) -> str:
    """The notes of a piece with ``line`` added at the end; existing text is never lost."""
    current = (notes or "").rstrip()
    return f"{current}\n{line}" if current else line


def observation_diff(piece: Piece, line: str | None) -> dict[str, Any]:
    """The change the row proposes to ``piece``: its notes with the observation added."""
    if not line:
        return {}
    return {
        NOTES_FIELD: {
            "current": piece.notes,
            "incoming": with_observation(piece.notes, line),
            "default_action": "accept",
            "observation": line,
        }
    }


def _codes(mapped: MappedRow) -> str:
    return ", ".join(
        identifier.original_value for identifier in mapped.identifiers if not identifier.is_absent
    )


def observation_errors(
    mapped: MappedRow, result: ClassifiedRow, line: str | None
) -> list[RowError]:
    """Validation errors of a row of an observations batch, instead of those of a piece: a piece
    is not created, so its denomination and tenure regime are not required."""
    errors: list[RowError] = []
    codes = _codes(mapped)
    if not any(identifier.is_matchable for identifier in mapped.identifiers):
        errors.append(
            RowError(
                "observation_without_code",
                "La fila no trae un código legible para identificar la pieza"
                + (f" ({codes})." if codes else "."),
            )
        )
    elif result.classification in NOT_FOUND:
        errors.append(RowError("piece_not_found", f"Pieza no encontrada: {codes}."))
    if line is None:
        errors.append(RowError("observation_empty", "La fila no trae texto de observación."))
    return errors


def classify_observations(
    mapped_rows: Sequence[MappedRow],
    classified: Sequence[ClassifiedRow],
    lines: Sequence[str | None],
) -> None:
    """Adjust in place the classification of the rows of an observations batch (D8)."""
    for mapped, result, line in zip(mapped_rows, classified, lines, strict=True):
        if result.classification is RowClassification.POSSIBLE_DUPLICATE:
            result.classification = RowClassification.NEW
            result.similar = []
        result.validation_errors = observation_errors(mapped, result, line)
