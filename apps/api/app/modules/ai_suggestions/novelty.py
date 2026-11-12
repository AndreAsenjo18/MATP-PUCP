"""Separates AI-proposed fields that already match the piece as cataloged (RIA-01; RN-009).

Pure rule-based comparison against the piece's current state — no AI judgment, no extra model
call — run right when a suggestion is created, so a reviewer sees "sin cambios" instead of a
proposal that would be a no-op if approved. Covers ``dimensions`` and ``conservation_status``,
the only two fields with a comparable prior value on the piece; ``review_marks`` and
``exhibitions`` have none, so they are always kept as novel (decisión del equipo, 2026-11-05).
"""

from typing import Any

from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.collections.models import Term

NO_DATA_MESSAGE = "No se reconocieron datos estructurados en el texto."
NO_CHANGE_MESSAGE = "No se notó ningún cambio con respecto a la versión actual de la pieza."


def _dimension_unchanged(piece: Piece, value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    for current in piece.dimensions or []:
        if (
            current.get("dimension") == value.get("dimension")
            and current.get("value") == value.get("value")
            and (current.get("unit") or "cm") == (value.get("unit") or "cm")
        ):
            return True
    return False


def _conservation_status_unchanged(session: Session, piece: Piece, value: Any) -> bool:
    if not isinstance(value, str) or piece.conservation_state_id is None:
        return False
    current = session.get(Term, piece.conservation_state_id)
    return current is not None and current.code == value


def current_value_for(session: Session, piece: Piece, field: str, value: Any) -> Any | None:
    """The piece's comparable current value for ``field`` (change carga-masiva-con-ia, D4): the
    matching dimension by name, or the current conservation status code. ``None`` for
    ``review_marks``/``exhibitions``, which have none to compare against (same scope as
    ``split_unchanged_fields``)."""
    if field == "dimensions" and isinstance(value, dict):
        name = value.get("dimension")
        for current in piece.dimensions or []:
            if current.get("dimension") == name:
                return current
        return None
    if field == "conservation_status" and piece.conservation_state_id is not None:
        current = session.get(Term, piece.conservation_state_id)
        return current.code if current is not None else None
    return None


def split_unchanged_fields(
    session: Session, piece: Piece, fields: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """``(novel, unchanged)`` — ``unchanged`` already matches what the piece has today."""
    novel: list[dict[str, Any]] = []
    unchanged: list[dict[str, Any]] = []
    for item in fields:
        field = item.get("field")
        value = item.get("value")
        is_unchanged = (field == "dimensions" and _dimension_unchanged(piece, value)) or (
            field == "conservation_status" and _conservation_status_unchanged(session, piece, value)
        )
        (unchanged if is_unchanged else novel).append(item)
    return novel, unchanged


def explain_result(
    original_fields: list[dict[str, Any]],
    novel_fields: list[dict[str, Any]],
    provider_message: str | None,
) -> str | None:
    """The message to show when there is nothing to approve; ``None`` while there still is."""
    if novel_fields:
        return None
    if original_fields:
        return NO_CHANGE_MESSAGE
    return provider_message or NO_DATA_MESSAGE
