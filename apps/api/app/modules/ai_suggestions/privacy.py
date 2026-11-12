"""Data minimization for what leaves the catalog toward an AI provider (RNF-014; RN-009).

Only RIA-01's own free-text fields may be sent — never sensitive fields such as
``lender_name`` (the comodante, per PieceContext's equivalent restriction in ``services/ai``).
"""

import unicodedata

from app.core.errors import ValidationFailed
from app.modules.catalog.models import Piece

ALLOWED_SOURCE_FIELDS = frozenset({"notes", "description"})

# Carga masiva con IA (change carga-masiva-con-ia, D2): campos del catálogo que la IA MUST NOT
# recibir como destino posible de una columna, ni ver valores de muestra de una columna que
# parezca contenerlos. Mismo espíritu que RF-041 (comodato, donantes).
SENSITIVE_MAPPING_FIELDS = frozenset({"lender_name", "loan_agreement_ref"})
# [SUPUESTO] palabras clave para reconocer, por el encabezado, una columna con datos sensibles
# aunque todavía no se sepa a qué campo correspondería.
_SENSITIVE_HEADER_KEYWORDS = (
    "comodante",
    "donante",
    "prestamista",
    "propietario anterior",
    "valor",
    "precio",
    "tasacion",
    "dni",
    "ruc",
)


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def safe_target_fields(target_fields: dict[str, str]) -> dict[str, str]:
    """``target_fields`` sin los campos sensibles: nunca se le ofrecen a la IA como destino."""
    return {
        field: label
        for field, label in target_fields.items()
        if field not in SENSITIVE_MAPPING_FIELDS
    }


def row_free_text(free_text_columns: dict[str, object]) -> str:
    """Carga masiva con IA (change carga-masiva-con-ia, D3): une en un solo texto los valores de
    las columnas de texto libre de una fila (``imports.mapping.free_text_values``), sin las
    columnas sensibles, para pedirle la extracción a la IA."""
    if not free_text_columns:
        return ""
    headers = list(free_text_columns.keys())
    safe = safe_sample_rows(headers, [free_text_columns])[0]
    parts = [
        str(value).strip() for value in safe.values() if isinstance(value, str) and value.strip()
    ]
    return "\n".join(parts)


def safe_sample_rows(
    headers: list[str], sample_rows: list[dict[str, object]]
) -> list[dict[str, object]]:
    """``sample_rows`` sin las columnas cuyo encabezado sugiere datos sensibles (D2)."""
    sensitive_headers = {
        h for h in headers if any(k in _fold(h) for k in _SENSITIVE_HEADER_KEYWORDS)
    }
    if not sensitive_headers:
        return sample_rows
    return [{k: v for k, v in row.items() if k not in sensitive_headers} for row in sample_rows]


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
