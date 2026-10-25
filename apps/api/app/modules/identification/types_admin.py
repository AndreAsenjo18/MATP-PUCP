"""Administration of identifier types (colecciones-y-vocabularios-admin, D1 and D2; RN-010).

- System types (``is_system``: I and COLECCION) keep their structural rules: only the label,
  the description and the order change (RN-002, RN-003).
- Changing the normalization rule of a type that already has identifiers takes two steps: a
  preview of the impact (how many normalized values change, new collisions between current
  values of a unique type, values that stop being normalizable) whose ``confirm_token`` hashes
  the report, and a confirmation that sends that token. If the data changed since the preview
  the token no longer matches; collisions are always rejected (RN-002). The recalculation is a
  single audited change set with origin "sistema"; original values never change.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass, field, replace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, PermissionDenied
from app.core.models_base import new_uuid
from app.modules.audit.context import audit_context, require_audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.identification.models import (
    IdentifierType,
    NormalizationRule,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.identification.normalization import normalize
from app.modules.identification.params import session_params
from app.modules.users.service import ADMIN_ROLE, user_has_role

#: Structural rules of a system type that the API never changes (design D1).
SYSTEM_PROTECTED_FIELDS = (
    "locks_on_assignment",
    "owned_pieces_only",
    "is_unique_when_current",
    "allowed_for_temporary_loan",
)
#: Fields any type can change through ``PATCH``.
EDITABLE_FIELDS = ("label", "description", "sort_order", "is_active", *SYSTEM_PROTECTED_FIELDS)
#: Identifiers recalculated per flush when a rule changes (design D2).
RECALCULATION_BATCH = 1000
#: Examples of each kind returned by the preview.
PREVIEW_EXAMPLES = 20
RECALCULATION_ACTOR = "recálculo de normalización"


def get_type(session: Session, code: str) -> IdentifierType:
    identifier_type = session.scalar(
        select(IdentifierType).where(
            IdentifierType.code == code, IdentifierType.deleted_at.is_(None)
        )
    )
    if identifier_type is None:
        raise NotFound(f"El tipo de identificador '{code}' no existe.", details={"type_code": code})
    return identifier_type


def create_identifier_type(
    session: Session,
    *,
    code: str,
    label: str,
    description: str | None,
    normalization_rule: NormalizationRule,
    sort_order: int,
) -> IdentifierType:
    """A new, non-system type; available at once for identifiers and mapping templates."""
    require_audit_context(session)
    existing = session.scalar(
        select(IdentifierType.id)
        .where(IdentifierType.code == code)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    if existing is not None:
        raise ConflictError(
            f"Ya existe un tipo de identificador con el código '{code}'.",
            code="identifier_type_exists",
            details={"type_code": code},
        )
    identifier_type = IdentifierType(
        id=new_uuid(),
        code=code,
        label=label.strip(),
        description=description,
        normalization_rule=normalization_rule,
        sort_order=sort_order,
        is_system=False,
    )
    session.add(identifier_type)
    session.flush()
    return identifier_type


# --- vista previa del cambio de regla ----------------------------------------------------------


@dataclass(frozen=True)
class RecalculatedValue:
    identifier_id: uuid.UUID
    piece_id: uuid.UUID
    original_value: str
    normalized_value: str | None
    proposed_value: str | None
    proposed_status: NormalizationStatus
    proposed_format: str | None
    is_current: bool

    def as_json(self) -> dict[str, Any]:
        return {
            "identifier_id": str(self.identifier_id),
            "piece_id": str(self.piece_id),
            "original_value": self.original_value,
            "normalized_value": self.normalized_value,
            "proposed_value": self.proposed_value,
        }


@dataclass(frozen=True)
class Collision:
    normalized_value: str
    piece_ids: tuple[uuid.UUID, ...]

    def as_json(self) -> dict[str, Any]:
        return {
            "normalized_value": self.normalized_value,
            "piece_ids": [str(piece_id) for piece_id in self.piece_ids],
        }


@dataclass(frozen=True)
class NormalizationPreview:
    type_code: str
    current_rule: NormalizationRule
    proposed_rule: NormalizationRule
    total_identifiers: int
    changed: tuple[RecalculatedValue, ...]
    unparseable: tuple[RecalculatedValue, ...]
    collisions: tuple[Collision, ...]
    confirm_token: str
    notes: list[str] = field(default_factory=list)

    @property
    def can_confirm(self) -> bool:
        return not self.collisions


def _type_identifiers(session: Session, code: str) -> list[PieceIdentifier]:
    return list(
        session.scalars(
            select(PieceIdentifier)
            .where(
                PieceIdentifier.identifier_type_code == code,
                PieceIdentifier.deleted_at.is_(None),
            )
            .order_by(PieceIdentifier.id)
        )
    )


def _token(
    identifier_type: IdentifierType, rule: NormalizationRule, values: list[RecalculatedValue]
) -> str:
    canonical = json.dumps(
        {
            "type": identifier_type.code,
            "from": str(identifier_type.normalization_rule),
            "to": str(rule),
            "values": [
                [str(v.identifier_id), v.original_value, v.normalized_value, v.proposed_value]
                for v in values
            ],
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def preview_rule_change(
    session: Session, identifier_type: IdentifierType, rule: NormalizationRule
) -> NormalizationPreview:
    """Impact of normalizing every identifier of the type with ``rule``; writes nothing."""
    params = session_params(session)
    identifiers = _type_identifiers(session, identifier_type.code)
    recalculated: list[RecalculatedValue] = []
    for identifier in identifiers:
        result = normalize(rule, identifier.original_value, params=params)
        recalculated.append(
            RecalculatedValue(
                identifier_id=identifier.id,
                piece_id=identifier.piece_id,
                original_value=identifier.original_value,
                normalized_value=identifier.normalized_value,
                proposed_value=result.normalized,
                proposed_status=result.status,
                proposed_format=result.detected_format,
                is_current=identifier.is_current,
            )
        )
    changed = [
        value
        for value, identifier in zip(recalculated, identifiers, strict=True)
        if (value.proposed_value, value.proposed_status)
        != (identifier.normalized_value, identifier.normalization_status)
    ]
    unparseable = [
        value
        for value, identifier in zip(recalculated, identifiers, strict=True)
        if value.proposed_status is NormalizationStatus.UNPARSEABLE
        and identifier.normalization_status is NormalizationStatus.NORMALIZED
    ]
    collisions: list[Collision] = []
    if identifier_type.is_unique_when_current:
        owners: dict[str, set[uuid.UUID]] = {}
        for value in recalculated:
            if value.is_current and value.proposed_value:
                owners.setdefault(value.proposed_value, set()).add(value.piece_id)
        collisions = [
            Collision(normalized, tuple(sorted(pieces, key=str)))
            for normalized, pieces in sorted(owners.items())
            if len(pieces) > 1
        ]
    notes: list[str] = []
    if identifier_type.locks_on_assignment and changed:
        notes.append(
            "El tipo se bloquea al asignarse: confirmar el cambio es una corrección auditada que "
            "solo puede hacer un Administrador (RN-002)."
        )
    return NormalizationPreview(
        type_code=identifier_type.code,
        current_rule=identifier_type.normalization_rule,
        proposed_rule=rule,
        total_identifiers=len(identifiers),
        changed=tuple(changed),
        unparseable=tuple(unparseable),
        collisions=tuple(collisions),
        confirm_token=_token(identifier_type, rule, recalculated),
        notes=notes,
    )


# --- edición ----------------------------------------------------------------------------------


def _check_system_type(identifier_type: IdentifierType, changes: dict[str, Any]) -> None:
    if not identifier_type.is_system:
        return
    blocked = [
        name
        for name in (*SYSTEM_PROTECTED_FIELDS, "is_active")
        if name in changes and changes[name] != getattr(identifier_type, name)
    ]
    if blocked:
        raise ConflictError(
            f"«{identifier_type.label}» es un tipo de identificador del sistema: solo se pueden "
            "cambiar su etiqueta, descripción y orden (RN-002, RN-003).",
            code="system_identifier_type",
            details={"type_code": identifier_type.code, "fields": blocked},
        )


def _change_rule(
    session: Session,
    identifier_type: IdentifierType,
    rule: NormalizationRule,
    confirm_token: str | None,
) -> int:
    """Apply a rule change; returns how many identifiers were recalculated."""
    preview = preview_rule_change(session, identifier_type, rule)
    if preview.total_identifiers == 0:
        identifier_type.normalization_rule = rule
        return 0
    if confirm_token is None or confirm_token != preview.confirm_token:
        stale = confirm_token is not None
        raise ConflictError(
            (
                "Los identificadores cambiaron después de la vista previa: genere una vista previa "
                "nueva y revise el impacto antes de confirmar."
                if stale
                else f"El tipo tiene {preview.total_identifiers} identificadores registrados: "
                "revise primero la vista previa del impacto y confirme con su `confirm_token`."
            ),
            code="normalization_change_requires_preview",
            details={"stale": stale, "changed": len(preview.changed)},
        )
    if preview.collisions:
        raise ConflictError(
            "La nueva regla dejaría el mismo código vigente en piezas distintas: corrija esos "
            "códigos antes de cambiar la regla (RN-002).",
            code="normalization_collision",
            details={"collisions": [collision.as_json() for collision in preview.collisions]},
        )
    ctx = require_audit_context(session)
    locked = identifier_type.locks_on_assignment
    if (
        locked
        and preview.changed
        and (ctx.user_id is None or not user_has_role(session, ctx.user_id, ADMIN_ROLE))
    ):
        raise PermissionDenied(
            "Cambiar la regla de un tipo que se bloquea al asignarse corrige códigos ya "
            "asignados: solo un Administrador puede confirmarlo (RN-002).",
            code="admin_required",
        )
    identifier_type.normalization_rule = rule
    session.flush()
    recalculation = replace(
        ctx,
        origin=AuditOrigin.SYSTEM,
        actor_label=RECALCULATION_ACTOR,
        origin_ref=f"identifier_type:{identifier_type.code}",
        action=AuditAction.CORRECTION if locked else None,
        allow_inventory_code_correction=locked,
        change_set_id=new_uuid(),
    )
    by_id = {value.identifier_id: value for value in preview.changed}
    with audit_context(session, recalculation):
        for start in range(0, len(preview.changed), RECALCULATION_BATCH):
            chunk = [
                value.identifier_id
                for value in preview.changed[start : start + RECALCULATION_BATCH]
            ]
            for identifier in session.scalars(
                select(PieceIdentifier).where(PieceIdentifier.id.in_(chunk))
            ):
                value = by_id[identifier.id]
                identifier.normalized_value = value.proposed_value
                identifier.normalization_status = value.proposed_status
                identifier.detected_format = value.proposed_format
            session.flush()
    return len(preview.changed)


def update_identifier_type(
    session: Session,
    identifier_type: IdentifierType,
    changes: dict[str, Any],
    *,
    confirm_token: str | None = None,
) -> int:
    """Edit a type; returns how many identifiers a rule change recalculated (0 otherwise)."""
    require_audit_context(session)
    _check_system_type(identifier_type, changes)
    if "label" in changes and changes["label"] is not None:
        changes["label"] = changes["label"].strip()
    for name in EDITABLE_FIELDS:
        if name in changes and changes[name] is not None:
            setattr(identifier_type, name, changes[name])
    if "description" in changes:
        identifier_type.description = changes["description"]
    recalculated = 0
    rule = changes.get("normalization_rule")
    if rule is not None and rule != identifier_type.normalization_rule:
        recalculated = _change_rule(session, identifier_type, rule, confirm_token)
    session.flush()
    return recalculated
