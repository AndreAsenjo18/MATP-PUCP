"""Domain rules for piece identifiers (spec identificacion-piezas; RF-002..004, RN-001..004).

Rules are enforced twice: here, with clear messages for users, and in flush guards registered
below, so that no code path (API, import, seed, scripts) can bypass them.
"""

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
from app.modules.audit.tracking import (
    INCLUDE_DELETED,
    column_changes,
    register_flush_guard,
)
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.identification.models import (
    IdentifierType,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.identification.normalization import NormalizationResult, normalize
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


def _ensure_unique(
    session: Session,
    identifier_type: IdentifierType,
    normalized_value: str,
    *,
    exclude_identifier_id: object | None = None,
) -> None:
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


def _normalize_value(identifier_type: IdentifierType, raw_value: str | None) -> NormalizationResult:
    if raw_value is None or not raw_value.strip():
        raise ValidationFailed(
            "El valor del identificador no puede estar vacío.", code="empty_identifier"
        )
    result = normalize(identifier_type.normalization_rule, raw_value)
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
) -> PieceIdentifier:
    """Register an external identifier. The original value is always kept as written."""
    require_audit_context(session)
    identifier_type = get_identifier_type(session, type_code)
    _check_tenure_allows(identifier_type, piece)
    result = _normalize_value(identifier_type, raw_value)
    assert raw_value is not None

    if identifier_type.is_unique_when_current:
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
        is_current=True,
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
    result = _normalize_value(identifier_type, new_raw_value)
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
                if "tenure_regime" in changes and obj.tenure_regime is not TenureRegime.OWNED:
                    _guard_tenure_change(session, obj)

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


def _guard_tenure_change(session: Session, piece: Piece) -> None:
    restricted = session.scalars(
        select(PieceIdentifier.identifier_type_code)
        .join(IdentifierType, IdentifierType.code == PieceIdentifier.identifier_type_code)
        .where(
            PieceIdentifier.piece_id == piece.id,
            PieceIdentifier.is_current,
            IdentifierType.owned_pieces_only,
        )
    ).first()
    if restricted:
        raise BusinessRuleViolation(
            "La pieza tiene código I vigente y no puede pasar a comodato ni a préstamo "
            "temporal (RN-003, RN-004).",
            code="tenure_change_with_inventory_code",
        )
