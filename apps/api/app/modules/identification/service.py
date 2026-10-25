"""Domain rules for piece identifiers (spec identificacion-piezas; RF-002..004, RN-001..004).

Rules are enforced twice: here, with clear messages for users, and in flush guards registered
below, so that no code path (API, import, seed, scripts) can bypass them.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import (
    BusinessRuleViolation,
    ImmutableInventoryCode,
    NotFound,
    PermissionDenied,
    ValidationFailed,
)
from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, refined_context, require_audit_context
from app.modules.audit.models import AuditAction
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.tracking import (
    INCLUDE_DELETED,
    column_changes,
    register_flush_guard,
)
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.tenure import ensure_no_forbidden_identifiers, find_transition
from app.modules.identification.models import (
    IdentifierType,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.identification.normalization import (
    TYPE_INVENTORY,
    NormalizationParams,
    NormalizationResult,
    is_absence_marker,
    normalize,
)
from app.modules.identification.params import session_params
from app.modules.users.service import ADMIN_ROLE, user_has_role

TENURE_LABELS = {
    TenureRegime.OWNED: "propiedad",
    TenureRegime.LOAN_FOR_USE: "comodato",
    TenureRegime.TEMPORARY_LOAN: "préstamo temporal",
}

# Fields of a locked identifier that only the audited correction procedure may change.
_PROTECTED_FIELDS = frozenset(
    {
        "piece_id",
        "identifier_type_code",
        "original_value",
        "normalized_value",
        "normalization_status",
        "is_current",
        "is_locked",
        "deleted_at",
        "replaced_by_id",
    }
)


def get_identifier_type(session: Session, code: str) -> IdentifierType:
    identifier_type = session.scalar(
        select(IdentifierType).where(IdentifierType.code == code, IdentifierType.is_active)
    )
    if identifier_type is None:
        available = ", ".join(
            session.scalars(
                select(IdentifierType.code)
                .where(IdentifierType.is_active)
                .order_by(IdentifierType.sort_order)
            )
        )
        raise ValidationFailed(
            f"El tipo de identificador '{code}' no existe. Tipos disponibles: {available}.",
            code="unknown_identifier_type",
        )
    return identifier_type


def current_identifiers(session: Session, piece: Piece, type_code: str) -> list[PieceIdentifier]:
    return list(
        session.scalars(
            select(PieceIdentifier).where(
                PieceIdentifier.piece_id == piece.id,
                PieceIdentifier.identifier_type_code == type_code,
                PieceIdentifier.is_current,
            )
        )
    )


def _check_tenure_allows(identifier_type: IdentifierType, piece: Piece) -> None:
    not_owned = piece.tenure_regime is not TenureRegime.OWNED
    temporary = piece.tenure_regime is TenureRegime.TEMPORARY_LOAN
    if (identifier_type.owned_pieces_only and not_owned) or (
        temporary and not identifier_type.allowed_for_temporary_loan
    ):
        raise BusinessRuleViolation(
            f"Una pieza en {TENURE_LABELS[piece.tenure_regime]} no puede recibir "
            f"{identifier_type.label} (RN-003, RN-004).",
            code="identifier_not_allowed_for_tenure",
        )


def find_code_owner(
    session: Session,
    identifier_type: IdentifierType,
    normalized_value: str,
    *,
    exclude_piece_id: uuid.UUID | None = None,
    exclude_identifier_id: object | None = None,
) -> tuple[PieceIdentifier, Piece] | None:
    """The current identifier with that value and the piece that owns it.

    A logically deleted piece still owns its inventory code (it is never reused silently), so the
    owner may be a deleted piece; ``None`` means that nobody holds that value.
    """
    statement = (
        select(PieceIdentifier, Piece)
        .join(Piece, Piece.id == PieceIdentifier.piece_id)
        .where(
            PieceIdentifier.identifier_type_code == identifier_type.code,
            PieceIdentifier.normalized_value == normalized_value,
            PieceIdentifier.is_current,
            PieceIdentifier.deleted_at.is_(None),
        )
        # Pieces deleted logically still own their inventory code (never reused silently).
        .execution_options(**{INCLUDE_DELETED: True})
    )
    for identifier, owner in session.execute(statement).tuples():
        if identifier.id == exclude_identifier_id:
            continue
        if owner.id == exclude_piece_id:
            continue
        return identifier, owner
    return None


def _ensure_unique(
    session: Session,
    identifier_type: IdentifierType,
    normalized_value: str,
    *,
    exclude_identifier_id: object | None = None,
) -> None:
    found = find_code_owner(
        session,
        identifier_type,
        normalized_value,
        exclude_identifier_id=exclude_identifier_id,
    )
    if found is None:
        return
    _identifier, owner = found
    if owner.deleted_at is not None:
        raise BusinessRuleViolation(
            f"El código {normalized_value} pertenece a una pieza eliminada; solo un "
            "Administrador puede reasignarlo mediante el procedimiento de corrección.",
            code="identifier_of_deleted_piece",
            details={"piece_id": str(owner.id)},
        )
    raise BusinessRuleViolation(
        f"El código {normalized_value} ya está asignado a otra pieza activa.",
        code="duplicate_identifier",
        details={"piece_id": str(owner.id)},
    )


def _normalize_value(
    identifier_type: IdentifierType, raw_value: str | None, params: NormalizationParams
) -> NormalizationResult:
    """Normalize with the current parameters (``session_params``, design D5 of plantillas-mapeo)."""
    if raw_value is None or not raw_value.strip():
        raise ValidationFailed(
            "El valor del identificador no puede estar vacío.", code="empty_identifier"
        )
    result = normalize(identifier_type.normalization_rule, raw_value, params=params)
    if identifier_type.locks_on_assignment:
        if result.is_absent:
            raise ValidationFailed(
                f"'{raw_value}' indica ausencia de código: la pieza se registra sin "
                f"{identifier_type.label}.",
                code="absence_marker",
            )
        if result.status is NormalizationStatus.UNPARSEABLE:
            raise ValidationFailed(
                f"El formato de '{raw_value}' no se reconoce como {identifier_type.label}.",
                code="unrecognized_format",
            )
    return result


def add_identifier(
    session: Session,
    piece: Piece,
    type_code: str,
    raw_value: str | None,
    *,
    source: str | None = None,
    replaces: PieceIdentifier | None = None,
    notes: str | None = None,
    is_current: bool = True,
) -> PieceIdentifier:
    """Register an external identifier. The original value is always kept as written.

    ``is_current=False`` registers an identifier that is already historical (the temporary number
    of a piece that leaves the temporary loan, design D4).
    """
    require_audit_context(session)
    identifier_type = get_identifier_type(session, type_code)
    _check_tenure_allows(identifier_type, piece)
    result = _normalize_value(identifier_type, raw_value, session_params(session))
    assert raw_value is not None

    if identifier_type.is_unique_when_current and is_current:
        if current_identifiers(session, piece, type_code):
            raise ImmutableInventoryCode(
                f"La pieza ya tiene {identifier_type.label}; no se puede cambiar. Solo un "
                "Administrador puede corregirlo con el procedimiento de corrección auditado.",
            )
        if result.normalized:
            _ensure_unique(session, identifier_type, result.normalized)

    if replaces is not None:
        if replaces.is_locked:
            raise ImmutableInventoryCode(
                "Un código bloqueado solo se reemplaza con el procedimiento de corrección."
            )
        if replaces.piece_id != piece.id or replaces.identifier_type_code != type_code:
            raise ValidationFailed(
                "Solo se puede reemplazar un identificador del mismo tipo y de la misma pieza.",
                code="invalid_replacement",
            )

    identifier = PieceIdentifier(
        id=new_uuid(),
        piece_id=piece.id,
        identifier_type_code=type_code,
        original_value=raw_value,
        normalized_value=result.normalized,
        normalization_status=result.status,
        detected_format=result.detected_format,
        is_current=is_current,
        is_locked=identifier_type.locks_on_assignment,
        source=source,
        notes=notes,
    )
    session.add(identifier)
    session.flush()
    if replaces is not None:
        replaces.is_current = False
        replaces.replaced_by_id = identifier.id
        session.flush()
    return identifier


def set_inventory_code(
    session: Session,
    piece: Piece,
    raw_value: str | None,
    *,
    source: str | None = "Ficha",
) -> PieceIdentifier | None:
    """Create or verify the piece's code I from the record sheet (design D4).

    - `raw_value` empty/None: no-op (the sheet is not touching the code I).
    - `raw_value` is an absence marker (`S/N`, `s/c`, `-`, `0`): the piece is registered without
      a code I (A5); the marker is never stored as a code.
    - No vigente code I yet: creates it with `add_identifier` (which already enforces
      RN-003/RN-004 via `_check_tenure_allows` and uniqueness via `_ensure_unique`).
    - A vigente code I exists and the normalized value matches: no-op, idempotent PUT.
    - A vigente code I exists and the normalized value differs: raises `ImmutableInventoryCode`
      (RN-002); correcting it is only possible through the audited correction procedure.
    """
    if raw_value is None or not raw_value.strip():
        return None
    params = session_params(session)
    if is_absence_marker(raw_value, params=params):
        return None
    identifier_type = get_identifier_type(session, TYPE_INVENTORY)
    _check_tenure_allows(identifier_type, piece)
    result = _normalize_value(identifier_type, raw_value, params)
    current = current_identifiers(session, piece, TYPE_INVENTORY)
    if current:
        if result.normalized and result.normalized == current[0].normalized_value:
            return current[0]
        raise ImmutableInventoryCode(
            "El código I asignado no se puede cambiar en una edición normal; use el "
            "procedimiento de corrección auditado (RN-002).",
        )
    return add_identifier(session, piece, TYPE_INVENTORY, raw_value, source=source)


def correct_locked_identifier(
    session: Session,
    piece: Piece,
    type_code: str,
    new_raw_value: str,
    reason: str | None,
) -> PieceIdentifier:
    """Audited correction procedure of an inventory code (RF-003, RN-002). Administrators only."""
    context = require_audit_context(session)
    if context.user_id is None or not user_has_role(session, context.user_id, ADMIN_ROLE):
        raise PermissionDenied(
            "Solo un Administrador puede corregir un código I.", code="admin_required"
        )
    if not reason or not reason.strip():
        raise ValidationFailed("La corrección exige indicar el motivo.", code="reason_required")
    identifier_type = get_identifier_type(session, type_code)
    current = current_identifiers(session, piece, type_code)
    if not current:
        raise NotFound(f"La pieza no tiene {identifier_type.label} que corregir.")
    old = current[0]
    result = _normalize_value(identifier_type, new_raw_value, session_params(session))
    if result.normalized == old.normalized_value:
        raise ValidationFailed(
            "El valor corregido es igual al vigente.", code="correction_without_change"
        )
    if result.normalized:
        _ensure_unique(session, identifier_type, result.normalized)

    with refined_context(
        session,
        action=AuditAction.CORRECTION,
        reason=reason.strip(),
        allow_inventory_code_correction=True,
    ):
        # Separate flushes keep the partial unique index and the self FK consistent.
        old.is_current = False
        session.flush()
        new = PieceIdentifier(
            id=new_uuid(),
            piece_id=piece.id,
            identifier_type_code=type_code,
            original_value=new_raw_value,
            normalized_value=result.normalized,
            normalization_status=result.status,
            detected_format=result.detected_format,
            is_current=True,
            is_locked=True,
            source="Corrección administrativa",
            notes=reason.strip(),
        )
        session.add(new)
        session.flush()
        old.replaced_by_id = new.id
        session.flush()
    return new


def retire_identifier(
    session: Session, piece: Piece, identifier: PieceIdentifier, reason: str | None
) -> None:
    """Logical removal of a wrongly assigned secondary code (RN-005).

    The row stays as a non-current identifier with who, when and why, so it remains in the
    piece's history and in the audit log. An inventory code (I) is never removed (RN-002): it
    is only corrected by an Administrator with the audited procedure.
    """
    require_audit_context(session)
    if identifier.piece_id != piece.id:
        raise NotFound("El identificador no pertenece a la pieza.")
    identifier_type = session.scalar(
        select(IdentifierType).where(IdentifierType.code == identifier.identifier_type_code)
    )
    if identifier.is_locked or (
        identifier_type is not None and identifier_type.locks_on_assignment
    ):
        raise ImmutableInventoryCode(
            "El código I no se puede eliminar (RN-002); solo un Administrador puede "
            "corregirlo con el procedimiento de corrección auditado.",
        )
    identifier.is_current = False
    soft_delete(session, identifier, reason)


@register_flush_guard
def _guard_identifier_rules(session: Session, context: AuditContext | None) -> None:
    """Enforce RN-002/RN-003 for every flush, whatever code path produced the change."""
    correction_allowed = bool(context and context.allow_inventory_code_correction)
    with session.no_autoflush:
        for obj in session.dirty:
            if isinstance(obj, PieceIdentifier):
                changes = column_changes(obj)
                was_locked = changes["is_locked"][0] if "is_locked" in changes else obj.is_locked
                if was_locked and set(changes) & _PROTECTED_FIELDS and not correction_allowed:
                    raise ImmutableInventoryCode(
                        "El código I asignado no se puede editar ni eliminar; solo un "
                        "Administrador puede corregirlo con el procedimiento auditado (RN-002)."
                    )
            elif isinstance(obj, Piece):
                changes = column_changes(obj)
                if "tenure_regime" in changes:
                    previous, _current = changes["tenure_regime"]
                    _guard_tenure_change(session, obj, TenureRegime(previous))

        for obj in session.new:
            if isinstance(obj, PieceIdentifier):
                identifier_type = session.scalar(
                    select(IdentifierType).where(IdentifierType.code == obj.identifier_type_code)
                )
                piece = obj.piece or session.get(
                    Piece, obj.piece_id, execution_options={INCLUDE_DELETED: True}
                )
                if identifier_type is not None and piece is not None:
                    _check_tenure_allows(identifier_type, piece)


def _guard_tenure_change(session: Session, piece: Piece, previous_regime: TenureRegime) -> None:
    """Second enforcement of the transition table, for the paths that skip the service."""
    transition = find_transition(previous_regime, piece.tenure_regime)
    if transition is None:
        return
    ensure_no_forbidden_identifiers(session, piece, transition)
