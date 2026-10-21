"""Reglas de jerarquía de ubicaciones: padres permitidos, ciclos y ruta completa.

Spec ubicacion-movimientos (design D1). La tabla de padres permitidos vive aquí, separada del
servicio de escritura, para poder ajustarla cuando la contraparte confirme los niveles reales
(pregunta A7) sin tocar la lógica de movimientos.
"""

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.modules.locations.models import Location, LocationLevel

# [SUPUESTO] Allowed parent level for each level (question A7). `None` means "sin padre"
# (solo SITE). Si la contraparte confirma cajas apoyadas directamente en un espacio, se agrega
# `LocationLevel.SPACE` al conjunto de `CONTAINER` (design D1).
ALLOWED_PARENT: dict[LocationLevel, set[LocationLevel | None]] = {
    LocationLevel.SITE: {None},
    LocationLevel.SPACE: {LocationLevel.SITE},
    LocationLevel.FURNITURE: {LocationLevel.SPACE},
    LocationLevel.SHELF_LEVEL: {LocationLevel.FURNITURE},
    LocationLevel.CONTAINER: {LocationLevel.SHELF_LEVEL, LocationLevel.FURNITURE},
}

_WHITESPACE = re.compile(r"\s+")


def normalize_code(code: str) -> str:
    """Mayúsculas y sin espacios dobles, para comparar códigos de forma consistente (design D1)."""
    return _WHITESPACE.sub(" ", code.strip()).upper()


def assert_allowed_parent(level: LocationLevel, parent_level: LocationLevel | None) -> None:
    if parent_level not in ALLOWED_PARENT[level]:
        where = parent_level.value if parent_level else "la raíz"
        allowed = sorted(p.value if p else "ninguno (sede)" for p in ALLOWED_PARENT[level])
        raise ValidationFailed(
            f"Un lugar de nivel {level.value} no puede ubicarse dentro de {where}. "
            f"Padres permitidos: {', '.join(allowed)}.",
            code="invalid_location_parent",
            details={"level": level.value, "allowed_parents": allowed},
        )


def full_path(session: Session, location: Location) -> list[Location]:
    """Ruta desde la sede hasta `location`, inclusive. Recorrido portable (SQLite y PostgreSQL);
    una CTE recursiva es una optimización posible pero no necesaria para la corrección (design D1).
    """
    path = [location]
    seen = {location.id}
    while path[-1].parent_id is not None:
        parent_id = path[-1].parent_id
        if parent_id in seen:
            break
        parent = session.get(Location, parent_id)
        if parent is None:
            break
        path.append(parent)
        seen.add(parent.id)
    return list(reversed(path))


def subtree_ids(session: Session, root_id: uuid.UUID) -> set[uuid.UUID]:
    """IDs de `root_id` y de todos sus descendientes (activos o no)."""
    rows = session.execute(select(Location.id, Location.parent_id)).all()
    children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
    for node_id, parent_id in rows:
        children.setdefault(parent_id, []).append(node_id)
    found = {root_id}
    stack = [root_id]
    while stack:
        for child in children.get(stack.pop(), []):
            if child not in found:
                found.add(child)
                stack.append(child)
    return found


def would_cycle(session: Session, location_id: uuid.UUID, new_parent_id: uuid.UUID) -> bool:
    """True si colocar `location_id` bajo `new_parent_id` lo pondría dentro de sí mismo."""
    if new_parent_id == location_id:
        return True
    return new_parent_id in subtree_ids(session, location_id)


def space_kind_ancestor(session: Session, location: Location) -> Location | None:
    """El ancestro de nivel SPACE de `location` (incluida ella misma), si existe (design D5)."""
    for node in reversed(full_path(session, location)):
        if node.level is LocationLevel.SPACE:
            return node
    return None
