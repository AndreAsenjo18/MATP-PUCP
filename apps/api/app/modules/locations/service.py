"""Location hierarchy and movement rules (spec ubicacion-movimientos; RF-016, RF-017, RF-019,
RF-020, RF-040, RF-041, RN-005)."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import require_audit_context
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.locations import hierarchy
from app.modules.locations.models import (
    Location,
    LocationLevel,
    MovementType,
    PieceMovement,
    SpaceKind,
)

# Re-exported for callers that only knew about the old location of this table (design D1).
ALLOWED_PARENT = hierarchy.ALLOWED_PARENT

BATCH_LIMIT = 200

#: Nada enviado por quien llama (distinto de enviar explícitamente `None`).
UNSET: Any = object()

# [SUPUESTO] Mapeo de tipo de espacio a término de disponibilidad (design D5), configurable.
SPACE_KIND_AVAILABILITY_CODE: dict[SpaceKind, str] = {
    SpaceKind.DEPOSIT: "EN_DEPOSITO",
    SpaceKind.EXHIBITION_ROOM: "EN_SALA",
    SpaceKind.WORKSHOP: "EN_RESTAURACION",
}


# --------------------------------------------------------------------------------- ubicaciones
def _find_duplicate_code(
    session: Session, code: str, *, exclude_id: uuid.UUID | None = None
) -> Location | None:
    statement = select(Location).where(
        func.upper(Location.code) == code, Location.deleted_at.is_(None)
    )
    if exclude_id is not None:
        statement = statement.where(Location.id != exclude_id)
    return session.scalar(statement)


def _assert_space_kind_allowed(level: LocationLevel, space_kind: SpaceKind | None) -> None:
    if space_kind is not None and level is not LocationLevel.SPACE:
        raise ValidationFailed(
            "El tipo de espacio solo aplica al nivel Depósito/Espacio.",
            code="space_kind_not_applicable",
        )


def create_location(
    session: Session,
    *,
    level: LocationLevel,
    code: str,
    name: str,
    parent: Location | None = None,
    description: str | None = None,
    space_kind: SpaceKind | None = None,
) -> Location:
    require_audit_context(session)
    parent_level = parent.level if parent is not None else None
    hierarchy.assert_allowed_parent(level, parent_level)
    _assert_space_kind_allowed(level, space_kind)
    normalized = hierarchy.normalize_code(code)
    duplicate = _find_duplicate_code(session, normalized)
    if duplicate is not None:
        raise ConflictError(
            f'Ya existe una ubicación activa con el código "{duplicate.code}".',
            code="duplicate_location_code",
            details={"existing_location_id": str(duplicate.id)},
        )
    location = Location(
        id=new_uuid(),
        level=level,
        code=normalized,
        name=name.strip(),
        parent_id=parent.id if parent else None,
        description=description,
        space_kind=space_kind,
    )
    session.add(location)
    session.flush()
    return location


def location_path(session: Session, location: Location) -> list[Location]:
    return hierarchy.full_path(session, location)


def is_without_location(piece: Piece) -> bool:
    """RF-019: an active piece without site and space is "sin ubicación"."""
    return piece.current_location_id is None


def count_active_pieces(session: Session, location_ids: set[uuid.UUID]) -> int:
    if not location_ids:
        return 0
    return (
        session.scalar(
            select(func.count(Piece.id)).where(
                Piece.current_location_id.in_(location_ids), Piece.deleted_at.is_(None)
            )
        )
        or 0
    )


def _record_relocation_movement(
    session: Session, piece: Piece, *, reason: str, origin_ref: str
) -> None:
    """A piece's container changed parent in the tree; the piece itself did not move inside it,
    but the event is logged for traceability (design D4)."""
    context = require_audit_context(session)
    session.add(
        PieceMovement(
            id=new_uuid(),
            piece_id=piece.id,
            movement_type=MovementType.MOVE,
            from_location_id=piece.current_location_id,
            to_location_id=piece.current_location_id,
            reason=reason,
            origin_ref=origin_ref,
            performed_by_user_id=context.user_id,
            performed_by_label=context.actor_label,
            occurred_at=utcnow(),
        )
    )


def update_location(
    session: Session,
    location: Location,
    *,
    name: str | None = None,
    description: Any = UNSET,
    is_active: bool | None = None,
    space_kind: Any = UNSET,
    new_parent_id: uuid.UUID | None = None,
    confirm_affected_count: int | None = None,
) -> Location:
    require_audit_context(session)
    if name is not None:
        location.name = name.strip()
    if description is not UNSET:
        location.description = description
    if space_kind is not UNSET:
        _assert_space_kind_allowed(location.level, space_kind)
        location.space_kind = space_kind

    if new_parent_id is not None and new_parent_id != location.parent_id:
        _relocate_node(session, location, new_parent_id, confirm_affected_count)

    if is_active is False and location.is_active:
        affected = count_active_pieces(session, hierarchy.subtree_ids(session, location.id))
        if affected > 0:
            raise ConflictError(
                f"Debe reubicar {affected} pieza(s) antes de desactivar esta ubicación.",
                code="location_not_empty",
                details={"affected_pieces": affected},
            )
        location.is_active = False
    elif is_active is True:
        location.is_active = True

    session.flush()
    return location


def _relocate_node(
    session: Session,
    location: Location,
    new_parent_id: uuid.UUID,
    confirm_affected_count: int | None,
) -> None:
    new_parent = session.get(Location, new_parent_id)
    if new_parent is None or new_parent.deleted_at is not None:
        raise NotFound("La nueva ubicación padre no existe o fue eliminada.")
    if hierarchy.would_cycle(session, location.id, new_parent_id):
        raise ValidationFailed(
            "No se puede ubicar un lugar dentro de uno de sus propios niveles.",
            code="location_cycle",
        )
    hierarchy.assert_allowed_parent(location.level, new_parent.level)

    subtree = hierarchy.subtree_ids(session, location.id)
    affected = count_active_pieces(session, subtree)
    if affected > 0:
        if confirm_affected_count != affected:
            raise ConflictError(
                f"Confirme el número actual de piezas afectadas ({affected}).",
                code="confirm_affected_count_mismatch",
                details={"affected_pieces": affected},
            )
        origin_ref = f"relocation:{new_uuid()}"
        pieces = session.scalars(
            select(Piece).where(Piece.current_location_id.in_(subtree), Piece.deleted_at.is_(None))
        )
        reason = f"Reubicación de {location.code}"
        for piece in pieces:
            _record_relocation_movement(session, piece, reason=reason, origin_ref=origin_ref)
    location.parent_id = new_parent_id


# ----------------------------------------------------------------------------- disponibilidad
def _availability_term_id(session: Session, code: str) -> uuid.UUID | None:
    return session.scalar(
        select(Term.id)
        .join(Vocabulary)
        .where(Vocabulary.code == VocabularyCode.AVAILABILITY, Term.code == code)
    )


def propose_availability_for_location(session: Session, location: Location) -> uuid.UUID | None:
    """RF-020, design D5: disponibilidad sugerida por el tipo de espacio del destino."""
    space = hierarchy.space_kind_ancestor(session, location)
    if space is None or space.space_kind is None:
        return None
    code = SPACE_KIND_AVAILABILITY_CODE.get(space.space_kind)
    if code is None:
        return None
    return _availability_term_id(session, code)


def assert_availability_coherent(
    session: Session, piece: Piece, availability_term_id: uuid.UUID
) -> None:
    """Rejects a manual availability that contradicts the piece's current location (design D5)."""
    term = session.get(Term, availability_term_id)
    if term is None:
        return
    reverse = {code: kind for kind, code in SPACE_KIND_AVAILABILITY_CODE.items()}
    expected_kind = reverse.get(term.code)
    if expected_kind is None:
        return
    current_kind: SpaceKind | None = None
    if piece.current_location_id is not None:
        location = session.get(Location, piece.current_location_id)
        if location is not None:
            space = hierarchy.space_kind_ancestor(session, location)
            current_kind = space.space_kind if space else None
    if current_kind != expected_kind:
        raise ConflictError(
            "La disponibilidad indicada no coincide con la ubicación actual de la pieza.",
            code="availability_incoherent",
            details={
                "current_location_id": (
                    str(piece.current_location_id) if piece.current_location_id else None
                )
            },
        )


# -------------------------------------------------------------------------------- movimientos
def _assert_destination_valid(destination: Location) -> None:
    if destination.deleted_at is not None or not destination.is_active:
        raise ValidationFailed(
            "La ubicación de destino no está activa.", code="invalid_destination"
        )
    if destination.level is LocationLevel.SITE:
        raise ValidationFailed(
            "La ubicación debe indicar al menos sede y espacio.", code="space_required"
        )


def _assert_expected_from(piece: Piece, expected_from_location_id: Any) -> None:
    if expected_from_location_id is UNSET:
        return
    if piece.current_location_id != expected_from_location_id:
        raise ConflictError(
            "La pieza ya cambió de ubicación; actualice la pantalla antes de continuar.",
            code="location_changed",
            details={
                "current_location_id": (
                    str(piece.current_location_id) if piece.current_location_id else None
                )
            },
        )


def _lock_piece_row(session: Session, piece: Piece) -> None:
    """`SELECT ... FOR UPDATE` (design D2): serializa movimientos concurrentes sobre la misma
    pieza en PostgreSQL. SQLite (pruebas) ignora la cláusula; no hay concurrencia real ahí."""
    session.execute(select(Piece.id).where(Piece.id == piece.id).with_for_update())


def move_piece(
    session: Session,
    piece: Piece,
    destination: Location,
    reason: str | None,
    *,
    performed_by_label: str | None = None,
    expected_from_location_id: Any = UNSET,
    origin_ref: str | None = None,
) -> PieceMovement:
    context = require_audit_context(session)
    _lock_piece_row(session, piece)
    _assert_destination_valid(destination)
    _assert_expected_from(piece, expected_from_location_id)
    if destination.id == piece.current_location_id:
        raise BusinessRuleViolation(
            "La pieza ya está en esa ubicación; registre una verificación.", code="same_location"
        )
    movement = PieceMovement(
        id=new_uuid(),
        piece_id=piece.id,
        movement_type=MovementType.MOVE,
        from_location_id=piece.current_location_id,
        to_location_id=destination.id,
        reason=reason,
        origin_ref=origin_ref,
        performed_by_user_id=context.user_id,
        performed_by_label=performed_by_label or context.actor_label,
        occurred_at=utcnow(),
    )
    session.add(movement)
    piece.current_location_id = destination.id
    proposed = propose_availability_for_location(session, destination)
    if proposed is not None:
        piece.availability_term_id = proposed
    session.flush()
    return movement


def verify_location(
    session: Session, piece: Piece, *, expected_location_id: Any = UNSET
) -> PieceMovement:
    context = require_audit_context(session)
    _lock_piece_row(session, piece)
    if piece.current_location_id is None:
        raise BusinessRuleViolation(
            "La pieza no tiene ubicación registrada que verificar.", code="without_location"
        )
    if (
        expected_location_id is not UNSET
        and expected_location_id is not None
        and expected_location_id != piece.current_location_id
    ):
        raise ValidationFailed(
            "La ubicación indicada no coincide con la registrada; registre un movimiento.",
            code="verification_location_mismatch",
            details={"current_location_id": str(piece.current_location_id)},
        )
    movement = PieceMovement(
        id=new_uuid(),
        piece_id=piece.id,
        movement_type=MovementType.VERIFICATION,
        from_location_id=piece.current_location_id,
        to_location_id=piece.current_location_id,
        performed_by_user_id=context.user_id,
        performed_by_label=context.actor_label,
        occurred_at=utcnow(),
    )
    session.add(movement)
    session.flush()
    return movement


def correct_movement(
    session: Session,
    piece: Piece,
    destination: Location,
    *,
    corrects_movement_id: uuid.UUID,
    reason: str | None,
    performed_by_label: str | None = None,
) -> PieceMovement:
    """Administrador, design D2: repara un movimiento mal registrado sin editarlo (RN-005)."""
    context = require_audit_context(session)
    _lock_piece_row(session, piece)
    previous = session.get(PieceMovement, corrects_movement_id)
    if previous is None or previous.piece_id != piece.id:
        raise NotFound("El movimiento a corregir no existe en esta pieza.")
    _assert_destination_valid(destination)
    movement = PieceMovement(
        id=new_uuid(),
        piece_id=piece.id,
        movement_type=MovementType.CORRECTION,
        from_location_id=piece.current_location_id,
        to_location_id=destination.id,
        reason=reason,
        corrects_movement_id=corrects_movement_id,
        performed_by_user_id=context.user_id,
        performed_by_label=performed_by_label or context.actor_label,
        occurred_at=utcnow(),
    )
    session.add(movement)
    piece.current_location_id = destination.id
    proposed = propose_availability_for_location(session, destination)
    if proposed is not None:
        piece.availability_term_id = proposed
    session.flush()
    return movement


# ---------------------------------------------------------------------------- lote (móvil)
@dataclass
class BatchItemFailure:
    piece_id: uuid.UUID
    code: str
    message: str


@dataclass
class BatchMovementOutcome:
    movements: list[PieceMovement] = field(default_factory=list)
    failures: list[BatchItemFailure] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failures


def move_pieces_batch(
    session: Session,
    *,
    movement_type: MovementType,
    destination: Location,
    reason: str | None,
    items: Sequence[tuple[uuid.UUID, Any]],
    performed_by_label: str | None = None,
) -> BatchMovementOutcome:
    """Mueve o verifica varias piezas hacia `destination`, todo o nada (design D3, RNF-005)."""
    context = require_audit_context(session)
    if len(items) > BATCH_LIMIT:
        raise ValidationFailed(
            f"El lote admite hasta {BATCH_LIMIT} piezas.",
            code="batch_too_large",
            details={"limit": BATCH_LIMIT, "received": len(items)},
        )
    if not items:
        raise ValidationFailed("El lote debe incluir al menos una pieza.", code="batch_empty")
    if movement_type not in (MovementType.MOVE, MovementType.VERIFICATION):
        raise ValidationFailed(
            "El lote solo admite movimientos o verificaciones.", code="invalid_movement_type"
        )
    _assert_destination_valid(destination)

    outcome = BatchMovementOutcome()
    seen_pieces: set[uuid.UUID] = set()
    checked: list[tuple[Piece, Any]] = []
    for piece_id, expected_from_location_id in items:
        if piece_id in seen_pieces:
            outcome.failures.append(
                BatchItemFailure(piece_id, "duplicate_piece", "La pieza se repite en el lote.")
            )
            continue
        seen_pieces.add(piece_id)
        piece = session.get(Piece, piece_id)
        if piece is None or piece.deleted_at is not None:
            outcome.failures.append(
                BatchItemFailure(piece_id, "piece_not_found", "La pieza no existe o fue eliminada.")
            )
            continue
        _lock_piece_row(session, piece)
        if movement_type is MovementType.MOVE:
            if destination.id == piece.current_location_id:
                outcome.failures.append(
                    BatchItemFailure(
                        piece_id, "same_location", "La pieza ya está en el destino del lote."
                    )
                )
                continue
            if (
                expected_from_location_id is not None
                and piece.current_location_id != expected_from_location_id
            ):
                outcome.failures.append(
                    BatchItemFailure(
                        piece_id,
                        "location_changed",
                        "La pieza ya cambió de ubicación.",
                    )
                )
                continue
        else:  # VERIFICATION
            if piece.current_location_id != destination.id:
                outcome.failures.append(
                    BatchItemFailure(
                        piece_id,
                        "verification_location_mismatch",
                        "La ubicación indicada no coincide con la registrada.",
                    )
                )
                continue
        checked.append((piece, expected_from_location_id))

    if outcome.failures:
        return outcome  # all-or-nothing: nothing is written (design D3)

    origin_ref = f"batch:{new_uuid()}"
    proposed = (
        propose_availability_for_location(session, destination)
        if movement_type is MovementType.MOVE
        else None
    )
    for piece, _expected in checked:
        movement = PieceMovement(
            id=new_uuid(),
            piece_id=piece.id,
            movement_type=movement_type,
            from_location_id=piece.current_location_id,
            to_location_id=destination.id,
            reason=reason,
            origin_ref=origin_ref,
            performed_by_user_id=context.user_id,
            performed_by_label=performed_by_label or context.actor_label,
            occurred_at=utcnow(),
        )
        session.add(movement)
        outcome.movements.append(movement)
        if movement_type is MovementType.MOVE:
            piece.current_location_id = destination.id
            if proposed is not None:
                piece.availability_term_id = proposed
    session.flush()
    return outcome
