"""Completeness alert definitions (spec calidad-datos; RF-019, RF-035, RN-010, design D1).

Each alert is defined exactly once here — `applies_to` (denominator) and `predicate`
(numerator) as SQLAlchemy expressions on `Piece`, portable between PostgreSQL and SQLite — and
reused by the piece's alerts, the incomplete-pieces report, the dashboard KPIs and the search
filter, so the same piece never shows a different count in two places (spec, escenario "Misma
cifra en todos los lugares").

All alerts exclude pieces that are soft-deleted or merged into another one; callers add
``Piece.deleted_at.is_(None)`` (already applied by the session's global filter in most query
paths) and ``Piece.merged_into_id.is_(None)`` explicitly.
"""

import enum
import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from sqlalchemy import ColumnElement, and_, case, exists, literal, not_, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.errors import ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import require_audit_context
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.identification.models import (
    INVENTORY_CODE_TYPE,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.locations.models import Location, LocationLevel
from app.modules.media.models import MediaAsset
from app.modules.quality.models import CompletenessFieldKind, CompletenessRule


class AlertCode(enum.StrEnum):
    MISSING_INVENTORY_CODE = "MISSING_INVENTORY_CODE"
    MISSING_PHOTO = "MISSING_PHOTO"
    MISSING_LOCATION = "MISSING_LOCATION"
    MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS"
    MISSING_RECOMMENDED_FIELDS = "MISSING_RECOMMENDED_FIELDS"
    UNNORMALIZABLE_IDENTIFIER = "UNNORMALIZABLE_IDENTIFIER"


#: Campos de `piece` administrables como obligatorios/recomendados (design D2). Lista blanca:
#: un `field` fuera de este conjunto no se acepta en `completeness_rule` (spec, escenario "Campo
#: inexistente en la regla"). `materials` es la relación `piece_material`, no una columna propia.
FIELD_WHITELIST: frozenset[str] = frozenset(
    {
        "denomination",
        "tenure_regime",
        "collection_id",
        "category_id",
        "description",
        "epoch_original_text",
        "materials",
        "dimensions_text",
        "conservation_state_id",
        "provenance",
    }
)

#: Valores iniciales [SUPUESTO B1] (design D2), usados también si `completeness_rule` está vacía
#: (p. ej. antes de sembrar datos).
DEFAULT_REQUIRED_FIELDS: tuple[str, ...] = ("denomination", "tenure_regime")
DEFAULT_RECOMMENDED_FIELDS: tuple[str, ...] = (
    "collection_id",
    "category_id",
    "description",
    "epoch_original_text",
    "materials",
    "dimensions_text",
    "conservation_state_id",
    "provenance",
)


@dataclass(frozen=True)
class ActiveRules:
    """Campos obligatorios/recomendados vigentes, leídos de `completeness_rule`."""

    required_fields: tuple[str, ...]
    recommended_fields: tuple[str, ...]


def load_active_rules(session: Session) -> ActiveRules:
    """Campos activos por tipo; si la tabla está vacía, usa los valores por defecto
    [SUPUESTO B1]."""
    rows = session.scalars(
        select(CompletenessRule).where(CompletenessRule.is_active.is_(True))
    ).all()
    required = tuple(r.field for r in rows if r.kind is CompletenessFieldKind.REQUIRED)
    recommended = tuple(r.field for r in rows if r.kind is CompletenessFieldKind.RECOMMENDED)
    return ActiveRules(
        required_fields=required or DEFAULT_REQUIRED_FIELDS,
        recommended_fields=recommended or DEFAULT_RECOMMENDED_FIELDS,
    )


def _field_is_empty(field: str) -> ColumnElement[bool]:
    """Condición "vacío" de un campo de `FIELD_WHITELIST` (columna nula/cadena vacía, o
    ninguna fila activa de `piece_material` cuando el campo es "materials")."""
    if field == "materials":
        pm = aliased(PieceMaterial)
        return ~exists(
            select(1).select_from(pm).where(pm.piece_id == Piece.id, pm.deleted_at.is_(None))
        )
    column = getattr(Piece, field)
    if column.type.python_type is str:
        return or_(column.is_(None), column == "")
    return column.is_(None)


def missing_fields_predicate(fields: Sequence[str]) -> ColumnElement[bool]:
    """Al menos uno de `fields` está vacío. Lista vacía -> nunca aplica (literal falso)."""
    if not fields:
        return literal(False)
    return or_(*(_field_is_empty(field) for field in fields))


def _has_current_inventory_code() -> ColumnElement[bool]:
    pi = aliased(PieceIdentifier)
    return exists(
        select(1)
        .select_from(pi)
        .where(
            pi.piece_id == Piece.id,
            pi.identifier_type_code == INVENTORY_CODE_TYPE,
            pi.is_current.is_(True),
            pi.deleted_at.is_(None),
        )
    )


def _has_active_photo() -> ColumnElement[bool]:
    ma = aliased(MediaAsset)
    return exists(select(1).select_from(ma).where(ma.piece_id == Piece.id, ma.deleted_at.is_(None)))


def _has_unparseable_current_identifier() -> ColumnElement[bool]:
    pi = aliased(PieceIdentifier)
    return exists(
        select(1)
        .select_from(pi)
        .where(
            pi.piece_id == Piece.id,
            pi.is_current.is_(True),
            pi.deleted_at.is_(None),
            pi.normalization_status == NormalizationStatus.UNPARSEABLE,
        )
    )


def _location_has_site_and_space() -> ColumnElement[bool]:
    """La ubicación de la pieza (o alguno de sus hasta 4 ancestros — la jerarquía tiene 5
    niveles fijos: SITE/SPACE/FURNITURE/SHELF_LEVEL/CONTAINER) incluye un nivel SITE y uno SPACE.

    Autojoins acotados en vez de una CTE recursiva: la profundidad máxima es fija y conocida
    (`LocationLevel` no crece), así que es más simple y más rápido que una CTE correlacionada.
    """
    l0, l1, l2, l3, l4 = (aliased(Location) for _ in range(5))
    chain = (
        select(1)
        .select_from(l0)
        .outerjoin(l1, l1.id == l0.parent_id)
        .outerjoin(l2, l2.id == l1.parent_id)
        .outerjoin(l3, l3.id == l2.parent_id)
        .outerjoin(l4, l4.id == l3.parent_id)
        .where(l0.id == Piece.current_location_id)
        .where(
            or_(
                l0.level == LocationLevel.SITE,
                l1.level == LocationLevel.SITE,
                l2.level == LocationLevel.SITE,
                l3.level == LocationLevel.SITE,
                l4.level == LocationLevel.SITE,
            )
        )
        .where(
            or_(
                l0.level == LocationLevel.SPACE,
                l1.level == LocationLevel.SPACE,
                l2.level == LocationLevel.SPACE,
                l3.level == LocationLevel.SPACE,
                l4.level == LocationLevel.SPACE,
            )
        )
    )
    return exists(chain)


@dataclass(frozen=True)
class AlertDefinition:
    code: AlertCode
    message: str
    suggested_action: str
    field: str | None
    applies_to: Callable[[ActiveRules], ColumnElement[bool]]
    predicate: Callable[[ActiveRules], ColumnElement[bool]]


ALERTS: dict[AlertCode, AlertDefinition] = {
    AlertCode.MISSING_INVENTORY_CODE: AlertDefinition(
        code=AlertCode.MISSING_INVENTORY_CODE,
        message="La pieza no tiene código I asignado.",
        suggested_action="Asignar código de inventario general",
        field="identifiers",
        applies_to=lambda _rules: Piece.tenure_regime == TenureRegime.OWNED,
        predicate=lambda _rules: not_(_has_current_inventory_code()),
    ),
    AlertCode.MISSING_PHOTO: AlertDefinition(
        code=AlertCode.MISSING_PHOTO,
        message="La pieza no tiene fotografías.",
        suggested_action="Subir al menos una fotografía",
        field="media",
        applies_to=lambda _rules: literal(True),
        predicate=lambda _rules: not_(_has_active_photo()),
    ),
    AlertCode.MISSING_LOCATION: AlertDefinition(
        code=AlertCode.MISSING_LOCATION,
        message="La pieza no tiene ubicación (sede y espacio) registrada.",
        suggested_action="Registrar sede y espacio",
        field="location",
        applies_to=lambda _rules: literal(True),
        predicate=lambda _rules: (
            Piece.current_location_id.is_(None) | not_(_location_has_site_and_space())
        ),
    ),
    AlertCode.MISSING_REQUIRED_FIELDS: AlertDefinition(
        code=AlertCode.MISSING_REQUIRED_FIELDS,
        message="Faltan campos obligatorios de la ficha.",
        suggested_action="Completar los campos obligatorios marcados en el editor",
        field="required_fields",
        applies_to=lambda _rules: literal(True),
        predicate=lambda rules: missing_fields_predicate(rules.required_fields),
    ),
    AlertCode.MISSING_RECOMMENDED_FIELDS: AlertDefinition(
        code=AlertCode.MISSING_RECOMMENDED_FIELDS,
        message="Faltan campos recomendados de la ficha.",
        suggested_action="Completar los campos recomendados marcados en el editor",
        field="recommended_fields",
        applies_to=lambda _rules: literal(True),
        predicate=lambda rules: missing_fields_predicate(rules.recommended_fields),
    ),
    AlertCode.UNNORMALIZABLE_IDENTIFIER: AlertDefinition(
        code=AlertCode.UNNORMALIZABLE_IDENTIFIER,
        message="Hay un identificador vigente que no se pudo normalizar.",
        suggested_action="Revisar y corregir el identificador en la sección de códigos",
        field="identifiers",
        applies_to=lambda _rules: literal(True),
        predicate=lambda _rules: _has_unparseable_current_identifier(),
    ),
}


def alert_condition(code: AlertCode, rules: ActiveRules) -> ColumnElement[bool]:
    """`applies_to AND predicate` para un alerta, lista para usar en un WHERE sobre `Piece`."""
    definition = ALERTS[code]
    return and_(definition.applies_to(rules), definition.predicate(rules))


def active_alerts_for_piece(
    session: Session, piece_id: uuid.UUID, rules: ActiveRules | None = None
) -> list[AlertCode]:
    """Alertas activas de una pieza, en el orden declarado de `ALERTS` (RF-019).

    No incluye piezas eliminadas o fusionadas: si `piece_id` no corresponde a una pieza activa
    y no fusionada, devuelve la lista vacía (spec, escenario "Pieza fusionada").
    """
    return active_alerts_for_pieces(session, [piece_id], rules).get(piece_id, [])


#: Piezas por consulta en `active_alerts_for_pieces` (lista `IN` acotada).
ALERTS_BATCH_SIZE = 1000


def active_alerts_for_pieces(
    session: Session, piece_ids: Sequence[uuid.UUID], rules: ActiveRules | None = None
) -> dict[uuid.UUID, list[AlertCode]]:
    """Alertas activas de varias piezas con una consulta por lote: una columna por alerta, con las
    mismas definiciones de `ALERTS` (el reporte de incompletas ya no consulta pieza por pieza).

    Las piezas eliminadas o fusionadas no aparecen en el resultado.
    """
    rules = rules or load_active_rules(session)
    columns = [
        case((alert_condition(code, rules), True), else_=False).label(code.value) for code in ALERTS
    ]
    ids = list(dict.fromkeys(piece_ids))
    result: dict[uuid.UUID, list[AlertCode]] = {}
    for start in range(0, len(ids), ALERTS_BATCH_SIZE):
        chunk = ids[start : start + ALERTS_BATCH_SIZE]
        statement = select(Piece.id, *columns).where(
            Piece.id.in_(chunk), Piece.deleted_at.is_(None), Piece.merged_into_id.is_(None)
        )
        for row in session.execute(statement):
            result[row[0]] = [code for code, active in zip(ALERTS, row[1:], strict=True) if active]
    return result


def list_completeness_rules(session: Session) -> list[CompletenessRule]:
    return list(session.scalars(select(CompletenessRule).order_by(CompletenessRule.field)).all())


def replace_completeness_rules(
    session: Session, rules: Sequence[tuple[str, CompletenessFieldKind, bool]]
) -> list[CompletenessRule]:
    """Reemplaza el conjunto completo de reglas (design D2; PUT, no PATCH parcial).

    `field` se valida contra `FIELD_WHITELIST`: un campo que no es de la ficha responde 422 con
    los campos admitidos (spec, escenario "Campo inexistente en la regla"). Los campos activos
    que ya no vienen en `rules` se desactivan, nunca se eliminan la fila (conservan su historial
    de auditoría). Requiere contexto de auditoría (quien hace el cambio queda registrado, spec
    escenario "Campo recomendado agregado").
    """
    require_audit_context(session)
    unknown = {field for field, _kind, _active in rules} - FIELD_WHITELIST
    if unknown:
        raise ValidationFailed(
            f"Campo(s) no admitido(s) para una regla de completitud: {', '.join(sorted(unknown))}.",
            code="unknown_completeness_field",
            details={"allowed": sorted(FIELD_WHITELIST)},
        )
    existing = {rule.field: rule for rule in session.scalars(select(CompletenessRule))}
    incoming_fields: set[str] = set()
    for field, kind, is_active in rules:
        incoming_fields.add(field)
        rule = existing.get(field)
        if rule is None:
            session.add(
                CompletenessRule(id=new_uuid(), field=field, kind=kind, is_active=is_active)
            )
        else:
            rule.kind = kind
            rule.is_active = is_active
    for field, rule in existing.items():
        if field not in incoming_fields and rule.is_active:
            rule.is_active = False
    session.flush()
    return list_completeness_rules(session)
