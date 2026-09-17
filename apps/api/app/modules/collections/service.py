"""Collections rules (spec colecciones-vocabularios; RF-010)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, NotFound, ValidationFailed
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
