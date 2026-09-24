"""Collections rules (spec colecciones-vocabularios; RF-010)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import require_audit_context
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection
from app.modules.identification.normalization import normalize_acronym


def create_collection(
    session: Session,
    *,
    name: str,
    acronym: str | None = None,
    parent_id: uuid.UUID | None = None,
    default_tenure_regime: TenureRegime = TenureRegime.OWNED,
    description: str | None = None,
    origin_description: str | None = None,
) -> Collection:
    require_audit_context(session)
    if not name or not name.strip():
        raise ValidationFailed("El nombre de la colección es obligatorio.", code="name_required")
    normalized = normalize_acronym(acronym)
    if normalized:
        existing = session.scalar(
            select(Collection).where(Collection.acronym_normalized == normalized)
        )
        if existing is not None:
            raise ValidationFailed(
                f"La sigla {acronym} coincide con la de la colección existente "
                f"{existing.name} ({existing.acronym}).",
                code="duplicate_acronym",
                details={"collection_id": str(existing.id)},
            )
    if parent_id is not None and session.get(Collection, parent_id) is None:
        raise NotFound("La colección padre no existe o está eliminada.")
    collection = Collection(
        id=new_uuid(),
        name=name.strip(),
        acronym=acronym,
        acronym_normalized=normalized,
        parent_id=parent_id,
        default_tenure_regime=default_tenure_regime,
        description=description,
        origin_description=origin_description,
    )
    session.add(collection)
    session.flush()
    return collection


def move_collection(
    session: Session, collection: Collection, new_parent_id: uuid.UUID | None
) -> None:
    require_audit_context(session)
    cursor = new_parent_id
    while cursor is not None:
        if cursor == collection.id:
            raise BusinessRuleViolation(
                "Una colección no puede quedar dentro de una de sus subcolecciones.",
                code="collection_hierarchy_cycle",
            )
        parent = session.get(Collection, cursor, execution_options={INCLUDE_DELETED: True})
        if parent is None:
            raise NotFound("La colección padre no existe.")
        cursor = parent.parent_id
    collection.parent_id = new_parent_id
    session.flush()


def update_collection(session: Session, collection: Collection, changes: dict[str, object]) -> None:
    """Partial update. Acronym uniqueness and hierarchy rules are re-checked (RF-010)."""
    require_audit_context(session)
    if "name" in changes:
        name = changes["name"]
        if not isinstance(name, str) or not name.strip():
            raise ValidationFailed(
                "El nombre de la colección es obligatorio.", code="name_required"
            )
        collection.name = name.strip()
    if "acronym" in changes:
        acronym = changes["acronym"]
        normalized = normalize_acronym(acronym if isinstance(acronym, str) else None)
        if normalized:
            existing = session.scalar(
                select(Collection).where(
                    Collection.acronym_normalized == normalized, Collection.id != collection.id
                )
            )
            if existing is not None:
                raise ValidationFailed(
                    f"La sigla {acronym} coincide con la de la colección existente "
                    f"{existing.name} ({existing.acronym}).",
                    code="duplicate_acronym",
                    details={"collection_id": str(existing.id)},
                )
        collection.acronym = acronym if isinstance(acronym, str) else None
        collection.acronym_normalized = normalized
    for key in ("description", "origin_description", "is_active"):
        if key in changes:
            setattr(collection, key, changes[key])
    if "parent_id" in changes and changes["parent_id"] != collection.parent_id:
        parent_id = changes["parent_id"]
        move_collection(
            session, collection, parent_id if isinstance(parent_id, uuid.UUID) else None
        )
    session.flush()


def delete_collection(session: Session, collection: Collection, reason: str | None) -> None:
    """Logical deletion; rejected while the collection still groups pieces or subcollections."""
    from app.modules.audit.soft_delete import soft_delete
    from app.modules.catalog.models import Piece

    require_audit_context(session)
    pieces = session.scalar(
        select(func.count()).select_from(Piece).where(Piece.collection_id == collection.id)
    )
    children = session.scalar(
        select(func.count()).select_from(Collection).where(Collection.parent_id == collection.id)
    )
    if pieces or children:
        raise ConflictError(
            "No se puede eliminar una colección que aún agrupa piezas o subcolecciones; "
            "reasígnelas primero o desactive la colección.",
            code="collection_not_empty",
            details={"pieces": pieces or 0, "subcollections": children or 0},
        )
    soft_delete(session, collection, reason)
