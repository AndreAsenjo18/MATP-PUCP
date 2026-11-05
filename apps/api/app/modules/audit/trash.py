"""Papelera: lo eliminado lógicamente y su restauración verificando dependencias.

Diseño D2 del change `auditoria-y-soft-delete-transversal` (RNF-006, RN-005). Como nunca se
borra información, todo registro con ``deleted_at`` sigue disponible aquí y puede volver al
catálogo siempre que sus dependencias estén activas. Cada tipo de entidad declara sus
verificadores; si alguno falla, la restauración se rechaza indicando qué restaurar primero.
"""

import uuid
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, Select, String, cast, func, literal, select, union_all
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.core.errors import BusinessRuleViolation, NotFound, ValidationFailed
from app.core.models_base import Base, SoftDeleteMixin
from app.modules.audit.soft_delete import restore
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import TYPE_INVENTORY
from app.modules.imports.models import ImportMappingTemplate
from app.modules.locations.models import Location
from app.modules.media.models import MediaAsset
from app.modules.users.models import AppUser

# Longitud del texto descriptivo de cada fila: la unión necesita un tipo común.
LABEL_LENGTH = 500


@dataclass(frozen=True)
class RestoreBlocker:
    """Dependencia que impide restaurar un registro (se devuelve como 409)."""

    entity_type: str
    entity_id: uuid.UUID | None
    label: str
    message: str

    @property
    def details(self) -> dict[str, Any]:
        return {
            "dependency_entity_type": self.entity_type,
            "dependency_entity_id": str(self.entity_id) if self.entity_id else None,
            "dependency_label": self.label,
        }


class RestoreDependencyMissing(BusinessRuleViolation):
    """Alguna dependencia del registro sigue eliminada o entra en conflicto."""

    code = "restore_dependency"


DependencyCheck = Callable[[Session, Any], RestoreBlocker | None]


@dataclass(frozen=True)
class TrashableEntity:
    """Tipo de entidad que aparece en la papelera y cómo restaurarla."""

    entity_type: str
    model: type[Base]
    type_label: str
    label_column: InstrumentedAttribute[Any] | ColumnElement[Any]
    dependencies: tuple[DependencyCheck, ...] = ()

    def describe(self, obj: Any) -> str:
        value = obj
        for attribute in ("denomination", "name", "label", "original_value", "storage_key"):
            if hasattr(obj, attribute):
                value = getattr(obj, attribute)
                break
        return str(value)


@dataclass(frozen=True)
class TrashEntry:
    """Fila de la papelera, independiente del tipo de entidad."""

    entity_type: str
    entity_id: uuid.UUID
    entity_label: str
    type_label: str
    deleted_at: datetime | None
    deleted_by_id: uuid.UUID | None
    deletion_reason: str | None


def _fetch(session: Session, model: type[Any], entity_id: uuid.UUID | None) -> Any | None:
    if entity_id is None:
        return None
    return session.get(model, entity_id, execution_options={INCLUDE_DELETED: True})


def _active_parent_check(
    model: type[Any],
    foreign_key: str,
    entity_type: str,
    type_label: str,
    *,
    noun: str,
) -> DependencyCheck:
    """Verificador genérico: el registro al que apunta ``foreign_key`` no puede estar eliminado."""

    def check(session: Session, obj: Any) -> RestoreBlocker | None:
        parent = _fetch(session, model, getattr(obj, foreign_key))
        if parent is None or parent.deleted_at is None:
            return None
        label = str(getattr(parent, "name", None) or getattr(parent, "label", parent.id))
        return RestoreBlocker(
            entity_type=entity_type,
            entity_id=parent.id,
            label=label,
            message=(
                f"No se puede restaurar: {noun} «{label}» ({type_label}) también está eliminada. "
                "Restáurela primero."
            ),
        )

    return check


def _inventory_code_conflict(session: Session, piece: Piece) -> RestoreBlocker | None:
    """RN-002: el código I vigente de la pieza no puede estar ya en una pieza activa."""
    codes = list(
        session.scalars(
            select(PieceIdentifier.normalized_value)
            .where(
                PieceIdentifier.piece_id == piece.id,
                PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
                PieceIdentifier.is_current,
                PieceIdentifier.deleted_at.is_(None),
                PieceIdentifier.normalized_value.is_not(None),
            )
            .execution_options(**{INCLUDE_DELETED: True})
        )
    )
    if not codes:
        return None
    conflict = session.execute(
        select(Piece.id, Piece.denomination, PieceIdentifier.normalized_value)
        .join(PieceIdentifier, PieceIdentifier.piece_id == Piece.id)
        .where(
            PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
            PieceIdentifier.is_current,
            PieceIdentifier.deleted_at.is_(None),
            PieceIdentifier.normalized_value.in_(codes),
            Piece.id != piece.id,
            Piece.deleted_at.is_(None),
        )
        .execution_options(**{INCLUDE_DELETED: True})
    ).first()
    if conflict is None:
        return None
    other_id, denomination, code = conflict
    return RestoreBlocker(
        entity_type="piece",
        entity_id=other_id,
        label=denomination,
        message=(
            f"No se puede restaurar: el código I {code} ya está vigente en la pieza activa "
            f"«{denomination}». Corrija el código con el procedimiento de corrección antes de "
            "restaurar esta pieza (RN-002)."
        ),
    )


TRASHABLE: dict[str, TrashableEntity] = {
    entity.entity_type: entity
    for entity in (
        TrashableEntity(
            entity_type="piece",
            model=Piece,
            type_label="Pieza",
            label_column=Piece.denomination,
            dependencies=(
                _active_parent_check(
                    Collection, "collection_id", "collection", "Colección", noun="la colección"
                ),
                _inventory_code_conflict,
            ),
        ),
        TrashableEntity(
            entity_type="piece_identifier",
            model=PieceIdentifier,
            type_label="Identificador de pieza",
            label_column=PieceIdentifier.original_value,
            dependencies=(
                _active_parent_check(Piece, "piece_id", "piece", "Pieza", noun="la pieza"),
            ),
        ),
        TrashableEntity(
            entity_type="media_asset",
            model=MediaAsset,
            type_label="Fotografía o documento",
            label_column=func.coalesce(MediaAsset.original_filename, MediaAsset.storage_key),
            dependencies=(
                _active_parent_check(Piece, "piece_id", "piece", "Pieza", noun="la pieza"),
            ),
        ),
        TrashableEntity(
            entity_type="collection",
            model=Collection,
            type_label="Colección",
            label_column=Collection.name,
            dependencies=(
                _active_parent_check(
                    Collection,
                    "parent_id",
                    "collection",
                    "Colección",
                    noun="la colección superior",
                ),
            ),
        ),
        TrashableEntity(
            entity_type="term",
            model=Term,
            type_label="Término de vocabulario",
            label_column=Term.label,
            dependencies=(
                _active_parent_check(
                    Vocabulary, "vocabulary_id", "vocabulary", "Vocabulario", noun="el vocabulario"
                ),
            ),
        ),
        # El vocabulario es la dependencia de los términos, así que también se restaura desde
        # aquí: un 409 que pide restaurar algo inalcanzable dejaría el término bloqueado.
        TrashableEntity(
            entity_type="vocabulary",
            model=Vocabulary,
            type_label="Vocabulario",
            label_column=Vocabulary.name,
        ),
        TrashableEntity(
            entity_type="location",
            model=Location,
            type_label="Ubicación",
            label_column=Location.name,
            dependencies=(
                _active_parent_check(
                    Location, "parent_id", "location", "Ubicación", noun="la ubicación superior"
                ),
            ),
        ),
        TrashableEntity(
            entity_type="import_mapping_template",
            model=ImportMappingTemplate,
            type_label="Plantilla de mapeo",
            label_column=ImportMappingTemplate.name,
        ),
    )
}


def get_trashable(entity_type: str) -> TrashableEntity:
    entity = TRASHABLE.get(entity_type)
    if entity is None:
        available = ", ".join(sorted(TRASHABLE))
        raise ValidationFailed(
            f"El tipo de entidad «{entity_type}» no se gestiona desde la papelera. "
            f"Tipos admitidos: {available}.",
            code="unknown_entity_type",
            details={"entity_type": entity_type, "supported": sorted(TRASHABLE)},
        )
    return entity


def _trash_select(entity: TrashableEntity) -> Select[Any]:
    model: Any = entity.model
    return select(
        literal(entity.entity_type).label("entity_type"),
        model.id.label("entity_id"),
        cast(entity.label_column, String(LABEL_LENGTH)).label("entity_label"),
        literal(entity.type_label).label("type_label"),
        model.deleted_at.label("deleted_at"),
        model.deleted_by_id.label("deleted_by_id"),
        cast(model.deletion_reason, String(LABEL_LENGTH)).label("deletion_reason"),
    ).where(model.deleted_at.is_not(None))


def list_trash(
    session: Session,
    *,
    entity_types: Sequence[str] | None = None,
    deleted_by: uuid.UUID | None = None,
    deleted_from: datetime | None = None,
    deleted_to: datetime | None = None,
    limit: int,
    offset: int,
) -> tuple[list[TrashEntry], int]:
    """Página de la papelera ordenada por fecha de eliminación (lo más reciente primero)."""
    selected = [get_trashable(name) for name in (entity_types or sorted(TRASHABLE))]
    parts = []
    for entity in selected:
        model: Any = entity.model
        part = _trash_select(entity)
        if deleted_by is not None:
            part = part.where(model.deleted_by_id == deleted_by)
        if deleted_from is not None:
            part = part.where(model.deleted_at >= deleted_from)
        if deleted_to is not None:
            part = part.where(model.deleted_at <= deleted_to)
        parts.append(part)
    combined = union_all(*parts).subquery("trash")
    options = {INCLUDE_DELETED: True}
    total = session.scalar(select(func.count()).select_from(combined).execution_options(**options))
    rows = session.execute(
        select(combined)
        .order_by(combined.c.deleted_at.desc(), combined.c.entity_type, combined.c.entity_id)
        .limit(limit)
        .offset(offset)
        .execution_options(**options)
    ).all()
    entries = [
        TrashEntry(
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            entity_label=row.entity_label or str(row.entity_id),
            type_label=row.type_label,
            deleted_at=row.deleted_at,
            deleted_by_id=row.deleted_by_id,
            deletion_reason=row.deletion_reason,
        )
        for row in rows
    ]
    return entries, total or 0


def blockers_for(session: Session, entity: TrashableEntity, obj: Any) -> list[RestoreBlocker]:
    """Dependencias que impiden restaurar ``obj`` (vacío si se puede restaurar)."""
    found: list[RestoreBlocker] = []
    for check in entity.dependencies:
        blocker = check(session, obj)
        if blocker is not None:
            found.append(blocker)
    return found


def get_trashed(session: Session, entity: TrashableEntity, entity_id: uuid.UUID) -> Any:
    obj = _fetch(session, entity.model, entity_id)
    if obj is None:
        raise NotFound(f"No existe un registro de tipo {entity.type_label} con ese identificador.")
    if not isinstance(obj, SoftDeleteMixin) or obj.deleted_at is None:
        raise BusinessRuleViolation(
            f"{entity.type_label} «{entity.describe(obj)}» no está en la papelera.",
            code="not_deleted",
        )
    return obj


def restore_from_trash(
    session: Session, entity_type: str, entity_id: uuid.UUID, reason: str | None = None
) -> TrashEntry:
    """Restaura un registro eliminado lógicamente tras verificar sus dependencias.

    Levanta ``RestoreDependencyMissing`` (409 ``restore_dependency``) con la dependencia que hay
    que restaurar primero, y delega en ``soft_delete.restore`` el control de rol y la auditoría.
    """
    entity = get_trashable(entity_type)
    obj = get_trashed(session, entity, entity_id)
    blockers = blockers_for(session, entity, obj)
    if blockers:
        first = blockers[0]
        raise RestoreDependencyMissing(
            first.message,
            details={
                **first.details,
                "blockers": [
                    blocker.details | {"message": blocker.message} for blocker in blockers
                ],
            },
        )
    deleted_at, deleted_by_id, deletion_reason = (
        obj.deleted_at,
        obj.deleted_by_id,
        obj.deletion_reason,
    )
    restore(session, obj, reason)
    return TrashEntry(
        entity_type=entity.entity_type,
        entity_id=obj.id,
        entity_label=entity.describe(obj),
        type_label=entity.type_label,
        deleted_at=deleted_at,
        deleted_by_id=deleted_by_id,
        deletion_reason=deletion_reason,
    )


def deleted_by_names(session: Session, entries: Iterable[TrashEntry]) -> dict[uuid.UUID, str]:
    """Nombres de quienes eliminaron las filas de una página (una sola consulta)."""
    wanted = {entry.deleted_by_id for entry in entries if entry.deleted_by_id is not None}
    if not wanted:
        return {}
    rows = session.execute(
        select(AppUser.id, AppUser.full_name).where(AppUser.id.in_(wanted))
    ).all()
    return {row[0]: row[1] for row in rows}
