"""Data minimization for what leaves the catalog toward an AI provider (RNF-014; RN-009).

Only RIA-01's own free-text fields may be sent — never sensitive fields such as
``lender_name`` (the comodante, per PieceContext's equivalent restriction in ``services/ai``).
"""

from app.core.errors import ValidationFailed
from app.modules.catalog.models import Piece

ALLOWED_SOURCE_FIELDS = frozenset({"notes", "description"})


def extraction_text(piece: Piece, field: str | None) -> str:
    """The free text to send for RIA-01, from an explicit, allowed field of the piece."""
    chosen = field or "notes"
    if chosen not in ALLOWED_SOURCE_FIELDS:
        raise ValidationFailed(
            f"El campo {chosen!r} no se puede enviar a la IA. Campos permitidos: "
            + ", ".join(sorted(ALLOWED_SOURCE_FIELDS)),
            code="source_field_not_allowed",
        )
    text = (getattr(piece, chosen) or "").strip()
    if not text:
        raise ValidationFailed(
            f"La ficha no tiene texto en {chosen!r} para analizar.",
            code="source_field_empty",
        )
    return text
