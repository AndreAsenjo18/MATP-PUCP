"""Single write point for AI-approved data (design D2/D3 of ia-extraccion-texto-libre; RN-009).

Only called after a suggestion is APPROVED or PARTIALLY_APPROVED with a reviewer on record —
``approve_ai_suggestion`` in the API checks that before calling this, and the DB CHECK
``decision_requires_reviewer`` backs it up. Covers RIA-01's ``dimensions``, ``conservation_status``
and ``review_marks``. ``exhibitions`` has no destination yet (RF-018 not built) so it is kept on
the suggestion only, never applied [SUPUESTO].

``approved_data.fields`` may differ from ``output_data.fields``: the reviewer can edit a value
before approving (design: "revisión total, parcial o con edición"), and ``apply_approved``
applies whatever was approved, not what the AI originally proposed. An optional
``approved_data.dimensions_text`` lets the reviewer also replace the free-text "Medidas" field
with their own wording when approving — the AI never writes to it on its own (decisión del
equipo, 2026-11-04).
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.modules.ai_suggestions.models import AiSuggestion, SuggestionStatus
from app.modules.catalog.conservation import record_assessment
from app.modules.catalog.models import Piece
from app.modules.catalog.service import update_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode

APPLICABLE_FIELDS = frozenset({"dimensions", "conservation_status", "review_marks"})


def validate_field_value(field: str, value: Any) -> None:
    """Shape check reused by the bulk-import grid (change carga-masiva-con-ia) to catch an
    invalid edit as soon as the person makes it, instead of only when the whole batch is
    applied. Does not check a ``conservation_status`` code against the vocabulary (needs a
    session); ``apply_approved`` still does that when the value is actually applied."""
    if field not in APPLICABLE_FIELDS:
        raise ValidationFailed(
            f"Tipo de dato de IA no reconocido: {field!r}.", code="unknown_suggestion_field"
        )
    if field == "dimensions":
        _clean_dimension(value)
    elif field == "conservation_status":
        if not isinstance(value, str) or not value.strip():
            raise ValidationFailed(
                "El estado de conservación propuesto debe ser un código de término.",
                code="invalid_conservation_value",
            )
    elif field == "review_marks" and value is not None and not isinstance(value, dict):
        raise ValidationFailed(
            "La marca de revisión debe ser un objeto.", code="invalid_review_mark_value"
        )


def apply_approved(session: Session, suggestion: AiSuggestion, piece: Piece) -> None:
    if suggestion.status not in (SuggestionStatus.APPROVED, SuggestionStatus.PARTIALLY_APPROVED):
        raise BusinessRuleViolation(
            "Solo se aplica una sugerencia aprobada.", code="suggestion_not_approved"
        )
    if suggestion.reviewed_by_id is None:
        raise BusinessRuleViolation(
            "La sugerencia no tiene una persona revisora registrada (RN-009).",
            code="missing_reviewer",
        )
    approved_fields: list[dict[str, Any]] = (suggestion.approved_data or {}).get("fields", [])
    dimensions_text = (suggestion.approved_data or {}).get("dimensions_text")
    new_dimensions: list[dict[str, Any]] = []
    extra_notes: list[str] = []
    for item in approved_fields:
        field = item.get("field")
        value = item.get("value")
        if field == "dimensions":
            new_dimensions.append(_clean_dimension(value))
        elif field == "conservation_status":
            _apply_conservation_status(session, piece, value, suggestion)
        elif field == "review_marks":
            extra_notes.append(_review_mark_note(value))
        elif field not in APPLICABLE_FIELDS | {"exhibitions"}:
            raise ValidationFailed(
                f"Tipo de dato de IA no reconocido: {field!r}.", code="unknown_suggestion_field"
            )
    changes: dict[str, Any] = {}
    if new_dimensions:
        # Approving the same dimension again (e.g. a corrected "alto") replaces it instead of
        # piling up duplicates; a dimension not touched by this suggestion is kept as-is.
        by_name = {d["dimension"]: d for d in (piece.dimensions or [])}
        for dimension in new_dimensions:
            by_name[dimension["dimension"]] = dimension
        changes["dimensions"] = list(by_name.values())
    if dimensions_text is not None:
        # A reviewer can opt in, at approval time, to also replace the free-text "Medidas" field
        # (`dimensions_text`) with their own wording — the AI never touches it on its own.
        if not isinstance(dimensions_text, str) or not dimensions_text.strip():
            raise ValidationFailed(
                "El texto de Medidas no puede quedar vacío.", code="invalid_dimensions_text"
            )
        changes["dimensions_text"] = dimensions_text.strip()
    if extra_notes:
        existing = (piece.notes or "").rstrip()
        existing_lines = set(existing.splitlines())
        new_lines = [note for note in extra_notes if note not in existing_lines]
        if new_lines:
            changes["notes"] = (existing + "\n" if existing else "") + "\n".join(new_lines)
    if changes:
        update_piece(session, piece, **changes)


def _clean_dimension(value: Any) -> dict[str, Any]:
    if (
        not isinstance(value, dict)
        or not isinstance(value.get("dimension"), str)
        or not isinstance(value.get("value"), int | float)
        or isinstance(value.get("value"), bool)
    ):
        raise ValidationFailed(
            "Medida de IA con forma inválida; se esperaba {dimension, value, unit}.",
            code="invalid_dimension_value",
        )
    return {
        "dimension": value["dimension"],
        "value": value["value"],
        "unit": value.get("unit") or "cm",
    }


def _apply_conservation_status(
    session: Session, piece: Piece, value: Any, suggestion: AiSuggestion
) -> None:
    if not isinstance(value, str):
        raise ValidationFailed(
            "El estado de conservación propuesto debe ser un código de término.",
            code="invalid_conservation_value",
        )
    term = session.scalar(
        select(Term)
        .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
        .where(
            Vocabulary.code == VocabularyCode.CONSERVATION_STATUS,
            Term.code == value,
            Term.is_active.is_(True),
            Term.deleted_at.is_(None),
        )
    )
    if term is None:
        raise ValidationFailed(
            f"{value!r} no es un estado de conservación activo; elija un término vigente.",
            code="invalid_conservation_term",
        )
    record_assessment(
        session,
        piece,
        status_term_id=term.id,
        notes=f"Evaluación a partir de una sugerencia de IA aprobada (#{suggestion.id}).",
    )


def _review_mark_note(value: Any) -> str:
    # Sin la fecha de hoy en el texto: dos aprobaciones del mismo año quedan como la misma línea
    # (deduplicadas más abajo) en vez de acumularse — la fecha exacta ya vive en la auditoría
    # (AuditOrigin.AI, origin_ref=suggestion.id), no hace falta repetirla aquí.
    year = value.get("year") if isinstance(value, dict) else None
    when = f" en {year}" if year else ""
    return f"Marca de revisión (IA aprobada): texto revisado{when}."
