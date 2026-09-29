"""Domain rules of the piece record sheet (spec catalogo-piezas; RF-005..009, RN-003, RN-006)."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import refined_context, require_audit_context
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.models import Piece

EDITABLE_FIELDS = frozenset(
    {
        "description",
        "collection_id",
        "lender_name",
        "loan_agreement_ref",
        "temporary_inventory_number",
        "acquisition_method_term_id",
        "entry_date",
        "author",
        "provenance",
        "period_text",
        "period_type",
        "period_from",
        "period_to",
        "object_type_term_id",
        "category_term_id",
        "dimensions_text",
        "dimensions",
        "conservation_status_term_id",
        "recorded_by",
        "notes",
        "parent_piece_id",
        "availability_term_id",
        "current_location_id",
    }
)


def validate_period(period_from: int | None, period_to: int | None) -> None:
    """Structured period must be coherent; the original text is always kept (RF-007)."""
    if period_from is not None and period_to is not None and period_from > period_to:
        raise ValidationFailed(
            "La época estructurada es incoherente: el año desde es mayor que el año hasta. "
            "El texto original se conserva.",
            code="invalid_period_range",
        )


def validate_dimensions(dimensions: list[Any] | None) -> None:
    for item in dimensions or []:
        value = item.get("value") if isinstance(item, dict) else None
        if not isinstance(value, int | float) or isinstance(value, bool) or value < 0:
            raise ValidationFailed(
                "Cada medida estructurada debe tener un valor numérico no negativo; "
                "el texto original de medidas se conserva.",
                code="invalid_dimension",
            )


def _legal_owner_for(tenure_regime: TenureRegime, legal_owner: str | None) -> str | None:
    if tenure_regime is TenureRegime.OWNED:
        if legal_owner and legal_owner.strip() != LEGAL_OWNER_PUCP:
            raise BusinessRuleViolation(
                "La PUCP es la única propietaria legal de las piezas en propiedad (RN-006).",
                code="invalid_legal_owner",
            )
        return LEGAL_OWNER_PUCP
    return None


def create_piece(
    session: Session,
    *,
    title: str | None,
    tenure_regime: TenureRegime | None,
    legal_owner: str | None = None,
    **fields: Any,
) -> Piece:
    """Create a piece applying the minimum sheet and tenure rules."""
    require_audit_context(session)
    unknown = set(fields) - EDITABLE_FIELDS
    if unknown:
        raise ValidationFailed(f"Campos desconocidos: {', '.join(sorted(unknown))}.")
    if not title or not title.strip():
        raise ValidationFailed("La denominación es obligatoria.", code="title_required")
    if tenure_regime is None:
        raise ValidationFailed("El régimen de tenencia es obligatorio.", code="tenure_required")
    validate_period(fields.get("period_from"), fields.get("period_to"))
    validate_dimensions(fields.get("dimensions"))
    owner = _legal_owner_for(tenure_regime, legal_owner)
    if fields.get("parent_piece_id") is not None:
        _ensure_exists(session, fields["parent_piece_id"])

    piece = Piece(id=new_uuid(), title=title.strip(), tenure_regime=tenure_regime, **fields)
    piece.legal_owner = owner
    session.add(piece)
    session.flush()
    return piece


def change_tenure(
    session: Session, piece: Piece, new_regime: TenureRegime, reason: str | None
) -> None:
    """Change the tenure regime (e.g. comodato -> propiedad) with a mandatory reason."""
    require_audit_context(session)
    if not reason or not reason.strip():
        raise ValidationFailed(
            "El cambio de régimen de tenencia exige motivo y documento de respaldo.",
            code="reason_required",
        )
    if new_regime is piece.tenure_regime:
        return
    piece.tenure_regime = new_regime
    piece.legal_owner = _legal_owner_for(new_regime, None)
    with refined_context(session, reason=reason.strip()):
        session.flush()  # the flush guard rejects leaving OWNED while holding a code I


def _ensure_exists(session: Session, piece_id: uuid.UUID) -> Piece:
    piece = session.get(Piece, piece_id)
    if piece is None:
        raise NotFound("La pieza indicada no existe o está eliminada.")
    return piece


def set_parent(session: Session, piece: Piece, parent_id: uuid.UUID | None) -> None:
    """Attach a piece to a set, rejecting cycles (RF-009)."""
    require_audit_context(session)
    if parent_id is not None:
        _ensure_exists(session, parent_id)
        cursor: uuid.UUID | None = parent_id
        visited: set[uuid.UUID] = set()
        while cursor is not None and cursor not in visited:
            if cursor == piece.id:
                raise BusinessRuleViolation(
                    "Un conjunto no puede tener como padre a uno de sus componentes.",
                    code="piece_hierarchy_cycle",
                )
            visited.add(cursor)
            ancestor = session.get(Piece, cursor, execution_options={INCLUDE_DELETED: True})
            cursor = ancestor.parent_piece_id if ancestor else None
    piece.parent_piece_id = parent_id
    session.flush()


def update_piece(session: Session, piece: Piece, **changes: Any) -> Piece:
    """Generic sheet update. Audit entries are generated automatically, only for real changes."""
    require_audit_context(session)
    unknown = set(changes) - EDITABLE_FIELDS - {"title"}
    if unknown:
        raise ValidationFailed(f"Campos no editables: {', '.join(sorted(unknown))}.")
    if "title" in changes and (not changes["title"] or not str(changes["title"]).strip()):
        raise ValidationFailed("La denominación es obligatoria.", code="title_required")
    validate_period(
        changes.get("period_from", piece.period_from), changes.get("period_to", piece.period_to)
    )
    if "dimensions" in changes:
        validate_dimensions(changes["dimensions"])
    if "parent_piece_id" in changes:
        set_parent(session, piece, changes.pop("parent_piece_id"))
    for key, value in changes.items():
        setattr(piece, key, value)
    session.flush()
    return piece
