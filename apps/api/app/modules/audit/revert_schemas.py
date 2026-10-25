"""API schemas of the revert engine (design D1; RNF-007, RF-040, RN-002).

Kept apart from ``app/modules/audit/schemas.py`` so the reversal operations of the change
``auditoria-y-soft-delete-transversal`` do not collide with the audit query ones.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID, EX_USER_ID
from app.api.stubs import example_of
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.revert import (
    ChangeSetSummary,
    ConflictReason,
    RevertConflict,
    RevertItem,
    RevertItemKind,
    RevertPlan,
)

EX_CHANGE_SET_ID = "01920000-0000-7000-8000-000000000a00"
EX_REVERT_CHANGE_SET_ID = "01920000-0000-7000-8000-000000000a10"
EX_TOKEN = "9f2b7c1d4e6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c"


class ChangeSetEntityOut(BaseModel):
    entity_type: str = Field(description="Tabla de la entidad afectada, p. ej. `piece`.")
    entity_id: uuid.UUID
    field_count: int = Field(ge=0, description="Campos registrados para esta entidad.")


class ChangeSetSummaryOut(BaseModel):
    """Resumen agrupado de un conjunto de cambios (design D3)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "change_set_id": EX_CHANGE_SET_ID,
                    "occurred_at": EX_DATETIME,
                    "origin": "MANUAL",
                    "origin_ref": None,
                    "user_id": EX_USER_ID,
                    "actor_label": None,
                    "reason": "Corrección de procedencia según el libro de inventario",
                    "actions": ["UPDATE"],
                    "entity_count": 1,
                    "field_count": 2,
                    "entities": [
                        {"entity_type": "piece", "entity_id": EX_PIECE_ID, "field_count": 2}
                    ],
                    "reverted": False,
                    "reverted_by_change_set_id": None,
                    "reverts_change_set_id": None,
                }
            ]
        }
    )

    change_set_id: uuid.UUID
    occurred_at: datetime
    origin: AuditOrigin
    origin_ref: str | None
    user_id: uuid.UUID | None
    actor_label: str | None
    reason: str | None
    actions: list[AuditAction]
    entity_count: int = Field(ge=0)
    field_count: int = Field(ge=0)
    entities: list[ChangeSetEntityOut]
    reverted: bool = Field(description="Verdadero cuando ya existe un conjunto de reversión.")
    reverted_by_change_set_id: uuid.UUID | None
    reverts_change_set_id: uuid.UUID | None = Field(
        default=None, description="Conjunto original cuando este conjunto es una reversión."
    )

    @classmethod
    def of(cls, summary: ChangeSetSummary) -> "ChangeSetSummaryOut":
        return cls(
            change_set_id=summary.change_set_id,
            occurred_at=summary.occurred_at,
            origin=summary.origin,
            origin_ref=summary.origin_ref,
            user_id=summary.user_id,
            actor_label=summary.actor_label,
            reason=summary.reason,
            actions=list(summary.actions),
            entity_count=summary.entity_count,
            field_count=summary.field_count,
            entities=[
                ChangeSetEntityOut(
                    entity_type=entity.entity_type,
                    entity_id=entity.entity_id,
                    field_count=entity.field_count,
                )
                for entity in summary.entities
            ],
            reverted=summary.reverted,
            reverted_by_change_set_id=summary.reverted_by_change_set_id,
            reverts_change_set_id=summary.reverts_change_set_id,
        )


class RevertConflictOut(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    field: str | None
    reason: ConflictReason
    message: str = Field(description="Explicación en español para la persona usuaria.")
    expected_value: Any | None = Field(
        default=None, description="Valor que dejó el conjunto de cambios."
    )
    current_value: Any | None = Field(default=None, description="Valor almacenado hoy.")
    changed_by_id: uuid.UUID | None = None
    changed_at: datetime | None = None

    @classmethod
    def of(cls, conflict: RevertConflict) -> "RevertConflictOut":
        return cls(
            entity_type=conflict.entity_type,
            entity_id=conflict.entity_id,
            field=conflict.field,
            reason=conflict.reason,
            message=conflict.message,
            expected_value=conflict.expected_value,
            current_value=conflict.current_value,
            changed_by_id=conflict.changed_by_id,
            changed_at=conflict.changed_at,
        )


class RevertItemOut(BaseModel):
    kind: RevertItemKind
    entity_type: str
    entity_id: uuid.UUID
    source_action: AuditAction
    field: str | None
    current_value: Any | None = Field(default=None, description="Valor almacenado hoy.")
    target_value: Any | None = Field(default=None, description="Valor que se restauraría.")
    description: str = Field(description="Qué hará la reversión con este registro, en español.")
    applicable: bool = Field(
        description="Falso en filas informativas (solo inserción) y estados ya resueltos."
    )
    conflict: RevertConflictOut | None = None

    @classmethod
    def of(cls, item: RevertItem) -> "RevertItemOut":
        return cls(
            kind=item.kind,
            entity_type=item.entity_type,
            entity_id=item.entity_id,
            source_action=item.source_action,
            field=item.field,
            current_value=item.current_value,
            target_value=item.target_value,
            description=item.description,
            applicable=item.applicable,
            conflict=(RevertConflictOut.of(item.conflict) if item.conflict is not None else None),
        )


class RevertPreviewOut(BaseModel):
    """Vista previa de una reversión: qué cambia, qué no se toca y qué está en conflicto."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "change_set": example_of(ChangeSetSummaryOut),
                    "preview_token": EX_TOKEN,
                    "items": [
                        {
                            "kind": "RESTORE_VALUE",
                            "entity_type": "piece",
                            "entity_id": EX_PIECE_ID,
                            "source_action": "UPDATE",
                            "field": "provenance",
                            "current_value": "Huancavelica",
                            "target_value": "Ayacucho",
                            "description": "Restaurar «provenance» al valor anterior.",
                            "applicable": True,
                            "conflict": None,
                        }
                    ],
                    "conflicts": [],
                    "notes": [],
                    "required_permissions": ["pieces.update"],
                    "requires_admin": False,
                    "touches_inventory_code": False,
                    "applicable_count": 1,
                }
            ]
        }
    )

    change_set: ChangeSetSummaryOut
    preview_token: str = Field(
        description="Huella del plan. Debe enviarse al confirmar la reversión."
    )
    items: list[RevertItemOut]
    conflicts: list[RevertConflictOut] = Field(
        default_factory=list,
        description="Campos modificados después del conjunto; exigen confirmación explícita.",
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Avisos en español, p. ej. movimientos que requieren un movimiento correctivo.",
    )
    required_permissions: list[str]
    requires_admin: bool
    touches_inventory_code: bool = Field(
        description="Verdadero cuando la reversión afecta un código I (RN-002)."
    )
    applicable_count: int = Field(ge=0, description="Elementos que la reversión aplicaría.")

    @classmethod
    def of(cls, plan: RevertPlan) -> "RevertPreviewOut":
        return cls(
            change_set=ChangeSetSummaryOut.of(plan.summary),
            preview_token=plan.preview_token,
            items=[RevertItemOut.of(item) for item in plan.items],
            conflicts=[RevertConflictOut.of(conflict) for conflict in plan.conflicts],
            notes=list(plan.notes),
            required_permissions=list(plan.required_permissions),
            requires_admin=plan.requires_admin,
            touches_inventory_code=plan.touches_inventory_code,
            applicable_count=len(plan.applicable_items),
        )


class RevertConfirmRequest(BaseModel):
    """Confirmación de una reversión, ligada a la vista previa que la generó."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "reason": "La edición masiva del 20/10 se aplicó al lote equivocado",
                    "preview_token": EX_TOKEN,
                    "confirm_conflicts": False,
                }
            ]
        }
    )

    reason: str = Field(min_length=3, description="Motivo de la reversión (queda en auditoría).")
    preview_token: str = Field(
        min_length=1,
        description=(
            "Huella devuelta por la vista previa, obligatoria: la reversión solo se aplica "
            "ligada a una vista previa. Si el plan cambió, se rechaza con `revert_plan_changed`."
        ),
    )
    confirm_conflicts: bool = Field(
        default=False,
        description=(
            "Confirma explícitamente que los cambios posteriores en conflicto se descartarán."
        ),
    )


class RevertChangeSetOut(BaseModel):
    """Resultado de una reversión aplicada."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "reverted_change_set_id": EX_CHANGE_SET_ID,
                    "new_change_set_id": EX_REVERT_CHANGE_SET_ID,
                    "reverted_fields": 2,
                    "restored_entities": 0,
                    "deleted_entities": 0,
                    "conflicts": [],
                    "notes": [],
                }
            ]
        }
    )

    reverted_change_set_id: uuid.UUID
    new_change_set_id: uuid.UUID = Field(
        description="Conjunto de cambios de tipo reversión, que a su vez puede revertirse."
    )
    reverted_fields: int = Field(ge=0)
    restored_entities: int = Field(ge=0)
    deleted_entities: int = Field(ge=0)
    conflicts: list[RevertConflictOut] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
