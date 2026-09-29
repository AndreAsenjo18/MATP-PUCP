"""API schemas for the audit log (spec auditoria-trazabilidad; RF-040, RNF-007)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_PIECE_ID, EX_USER_ID, ORMModel
from app.modules.audit.models import AuditAction, AuditOrigin


class AuditEntryOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000a01",
                    "occurred_at": EX_DATETIME,
                    "change_set_id": "01920000-0000-7000-8000-000000000a00",
                    "entity_type": "piece",
                    "entity_id": EX_PIECE_ID,
                    "field": "conservation_status_term_id",
                    "old_value": None,
                    "new_value": "01920000-0000-7000-8000-000000000301",
                    "action": "UPDATE",
                    "origin": "MANUAL",
                    "origin_ref": None,
                    "user_id": EX_USER_ID,
                    "actor_label": None,
                    "reason": None,
                }
            ]
        },
    )

    id: uuid.UUID
    occurred_at: datetime
    change_set_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    field: str | None
    old_value: Any | None
    new_value: Any | None
    action: AuditAction
    origin: AuditOrigin
    origin_ref: str | None
    user_id: uuid.UUID | None
    actor_label: str | None
    reason: str | None


class RevertChangeSetRequest(BaseModel):
    reason: str = Field(min_length=3)


class RevertResult(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "reverted_change_set_id": "01920000-0000-7000-8000-000000000a00",
                    "new_change_set_id": "01920000-0000-7000-8000-000000000a10",
                    "reverted_fields": 3,
                    "conflicts": [],
                }
            ]
        }
    )

    reverted_change_set_id: uuid.UUID
    new_change_set_id: uuid.UUID
    reverted_fields: int
    conflicts: list[dict[str, Any]] = Field(
        default_factory=list, description="Campos modificados después; no se revierten."
    )
