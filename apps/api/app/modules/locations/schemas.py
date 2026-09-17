"""API schemas for locations and movements (spec ubicacion-movimientos; RF-016, RF-017)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_LOCATION_ID, EX_PIECE_ID, LocationRef, ORMModel
from app.modules.locations.models import LocationLevel, MovementType

_SITE_REF = {
    "id": "01920000-0000-7000-8000-000000000400",
    "level": "SITE",
    "code": "SEDE1",
    "name": "Sede 1 (ficticia)",
}
_SPACE_REF = {
    "id": EX_LOCATION_ID,
    "level": "SPACE",
    "code": "SEDE1-DEP-A",
    "name": "Depósito A (ficticio)",
}


class LocationOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    **_SPACE_REF,
                    "parent_id": _SITE_REF["id"],
                    "description": None,
                    "is_active": True,
                    "path": [_SITE_REF, _SPACE_REF],
                }
            ]
        },
    )

    id: uuid.UUID
    parent_id: uuid.UUID | None
    level: LocationLevel
    code: str
    name: str
    description: str | None
    is_active: bool
    path: list[LocationRef] = Field(default_factory=list, description="Ruta desde la sede.")


class LocationCreate(BaseModel):
    parent_id: uuid.UUID | None = None
    level: LocationLevel
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None


class PieceLocation(BaseModel):
    """Current location of a piece; levels below SPACE require sensitive.exact_location."""

    location_id: uuid.UUID | None
    path: list[LocationRef]
    is_exact: bool = Field(description="False si se omitieron niveles por el rol (RF-041).")


class MovementOut(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "01920000-0000-7000-8000-000000000411",
                    "piece_id": EX_PIECE_ID,
                    "movement_type": "MOVE",
                    "from_location": None,
                    "to_location": _SPACE_REF,
                    "reason": "Reordenamiento de depósito (sintético)",
                    "performed_by_label": "Auxiliar de depósito (sintético)",
                    "occurred_at": EX_DATETIME,
                }
            ]
        },
    )

    id: uuid.UUID
    piece_id: uuid.UUID
    movement_type: MovementType
    from_location: LocationRef | None
    to_location: LocationRef | None
    reason: str | None
    performed_by_label: str | None
    occurred_at: datetime


class MovementCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"movement_type": "MOVE", "to_location_id": EX_LOCATION_ID, "reason": "Traslado"}
            ]
        }
    )

    movement_type: MovementType = MovementType.MOVE
    to_location_id: uuid.UUID | None = Field(None, description="Obligatorio para MOVE.")
    reason: str | None = None
