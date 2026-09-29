"""Location hierarchy and movement rules (spec ubicacion-movimientos; RF-016, RF-017, RF-019)."""

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.audit.context import require_audit_context
from app.modules.catalog.models import Piece
from app.modules.locations.models import Location, LocationLevel, MovementType, PieceMovement

# [SUPUESTO] Allowed parent level for each level (question A7).
ALLOWED_PARENT: dict[LocationLevel, set[LocationLevel | None]] = {
    LocationLevel.SITE: {None},
    LocationLevel.SPACE: {LocationLevel.SITE},
    LocationLevel.FURNITURE: {LocationLevel.SPACE},
    LocationLevel.SHELF_LEVEL: {LocationLevel.FURNITURE},
    LocationLevel.CONTAINER: {LocationLevel.SHELF_LEVEL, LocationLevel.FURNITURE},
}


def create_location(
    session: Session,
    *,
    level: LocationLevel,
    code: str,
    name: str,
    parent: Location | None = None,
    description: str | None = None,
) -> Location:
    require_audit_context(session)
    parent_level = parent.level if parent is not None else None
    if parent_level not in ALLOWED_PARENT[level]:
        where = parent_level.value if parent_level else "la raíz"
        raise ValidationFailed(
            f"Un lugar de nivel {level.value} no puede ubicarse dentro de {where}.",
            code="invalid_location_parent",
        )
    location = Location(
        id=new_uuid(),
        level=level,
        code=code.strip().upper(),
        name=name.strip(),
        parent_id=parent.id if parent else None,
        description=description,
    )
    session.add(location)
    session.flush()
    return location


def location_path(session: Session, location: Location) -> list[Location]:
    path = [location]
    while path[-1].parent_id is not None:
        parent = session.get(Location, path[-1].parent_id)
        if parent is None:
            break
        path.append(parent)
    return list(reversed(path))


def is_without_location(piece: Piece) -> bool:
    """RF-019: an active piece without site and space is "sin ubicación"."""
    return piece.current_location_id is None


def move_piece(
    session: Session,
    piece: Piece,
    destination: Location,
    reason: str | None,
    *,
    performed_by_label: str | None = None,
) -> PieceMovement:
    context = require_audit_context(session)
    if destination.level is LocationLevel.SITE:
        raise ValidationFailed(
            "La ubicación debe indicar al menos sede y espacio.", code="space_required"
        )
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
        performed_by_user_id=context.user_id,
        performed_by_label=performed_by_label or context.actor_label,
        occurred_at=utcnow(),
    )
    session.add(movement)
    piece.current_location_id = destination.id
    session.flush()
    return movement


def verify_location(session: Session, piece: Piece) -> PieceMovement:
    context = require_audit_context(session)
    if piece.current_location_id is None:
        raise BusinessRuleViolation(
            "La pieza no tiene ubicación registrada que verificar.", code="without_location"
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
