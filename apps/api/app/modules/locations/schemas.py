"""API schemas for locations and movements (spec ubicacion-movimientos; RF-016, RF-017)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.api.enums import (
    LOCATION_LEVEL_LABELS,
    SPACE_KIND_LABELS,
    LocationLevelLabel,
    SpaceKindLabel,
    code_of,
    serialize_label,
)
from app.api.refs import EX_DATETIME, EX_LOCATION_ID, EX_PIECE_ID, LocationRef, ORMModel
from app.modules.locations.models import LocationLevel, MovementType, SpaceKind

_SITE_REF = {
    "id": "01920000-0000-7000-8000-000000000400",
    "level": "Sede",
    "code": "SEDE1",
    "name": "Sede 1 (ficticia)",
}
_SPACE_REF = {
    "id": EX_LOCATION_ID,
    "level": "Depósito",
    "code": "SEDE1-DEP-A",
    "name": "Depósito A (ficticio)",
}


def _space_kind_label(value: object) -> str | None:
    """Acepta la etiqueta del contrato, el código interno o `None` y devuelve la canónica."""
    if value is None:
        return None
    if isinstance(value, SpaceKind):
        return SPACE_KIND_LABELS[value]
    return SPACE_KIND_LABELS[code_of(SPACE_KIND_LABELS, str(value), "space_kind")]


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
    level: LocationLevelLabel = Field(
        description="Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor."
    )
    code: str
    name: str
    description: str | None
    is_active: bool
    space_kind: SpaceKindLabel | None = Field(
        None, description="[SUPUESTO] Tipo de espacio; solo aplica al nivel Depósito."
    )
    path: list[LocationRef] = Field(default_factory=list, description="Ruta desde la sede.")

    @field_validator("level", mode="before")
    @classmethod
    def _level_to_label(cls, value: object) -> str | None:
        """Emite la etiqueta en español del contrato aunque llegue el código interno."""
        label = serialize_label(LOCATION_LEVEL_LABELS, value)  # type: ignore[arg-type]
        assert label is not None, "level es obligatorio en LocationOut"
        return label

    @field_validator("space_kind", mode="before")
    @classmethod
    def _space_kind_to_label(cls, value: object) -> str | None:
        return serialize_label(SPACE_KIND_LABELS, value) if value is not None else None  # type: ignore[arg-type]


class LocationNode(BaseModel):
    """Nodo del árbol de ubicaciones (contrato del equipo: `LocationNode`; RF-016)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": _SITE_REF["id"],
                    "name": _SITE_REF["name"],
                    "level_type": "Sede",
                    "children": [
                        {
                            "id": _SPACE_REF["id"],
                            "name": _SPACE_REF["name"],
                            "level_type": "Depósito",
                            "children": [],
                        }
                    ],
                }
            ]
        }
    )

    id: uuid.UUID
    name: str
    level_type: str = Field(
        description="Nivel jerárquico: Sede, Depósito, Mueble, Nivel o Contenedor."
    )
    children: list["LocationNode"] = Field(default_factory=list)


class LocationCreate(BaseModel):
    parent_id: uuid.UUID | None = None
    level: LocationLevelLabel = Field(
        description="Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor."
    )
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    space_kind: SpaceKindLabel | None = Field(
        None, description="[SUPUESTO] Tipo de espacio; solo admitido en el nivel Depósito."
    )

    @field_validator("level", mode="before")
    @classmethod
    def _level_from_label(cls, value: object) -> str | None:
        """Acepta la etiqueta del contrato (o el código interno) y devuelve la canónica."""
        if value is None:
            return None
        code = (
            value
            if isinstance(value, LocationLevel)
            else code_of(LOCATION_LEVEL_LABELS, str(value), "level")
        )
        return LOCATION_LEVEL_LABELS[code]

    @field_validator("space_kind", mode="before")
    @classmethod
    def _space_kind_from_label(cls, value: object) -> str | None:
        return _space_kind_label(value)


class LocationUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"name": "Rack B", "description": None, "is_active": True}]}
    )

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    space_kind: SpaceKindLabel | None = None
    parent_id: uuid.UUID | None = Field(
        None, description="Nuevo padre; reubica el nodo y sus piezas (design D4)."
    )
    confirm_affected_count: int | None = Field(
        None,
        description=(
            "Obligatorio al reubicar un nodo con piezas: número de piezas afectadas que la "
            "pantalla mostró antes de confirmar."
        ),
    )

    @field_validator("space_kind", mode="before")
    @classmethod
    def _space_kind_from_label(cls, value: object) -> str | None:
        return _space_kind_label(value)


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
    corrects_movement_id: uuid.UUID | None = None
    performed_by_label: str | None
    occurred_at: datetime


class MovementCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "movement_type": "MOVE",
                    "destination_location_id": EX_LOCATION_ID,
                    "reason": "Traslado",
                }
            ]
        }
    )

    movement_type: MovementType = MovementType.MOVE
    to_location_id: uuid.UUID | None = Field(
        None, description="Obligatorio para MOVE y CORRECTION."
    )
    destination_location_id: uuid.UUID | None = Field(
        None, description="Alias del contrato de interfaces (MovePieceRequest)."
    )
    reason: str | None = None
    expected_from_location_id: uuid.UUID | None = Field(
        None,
        description=(
            "Ubicación que el usuario vio antes de mover la pieza; si ya cambió, la API "
            "responde 409 (design D2, control de concurrencia)."
        ),
    )
    corrects_movement_id: uuid.UUID | None = Field(
        None, description="Obligatorio para CORRECTION: movimiento que se corrige (RN-005)."
    )

    @model_validator(mode="after")
    def _sync_destination_location(self) -> "MovementCreate":
        if self.to_location_id is None and self.destination_location_id is not None:
            self.to_location_id = self.destination_location_id
        elif self.destination_location_id is None and self.to_location_id is not None:
            self.destination_location_id = self.to_location_id
        return self


class BatchMovementItem(BaseModel):
    piece_id: uuid.UUID
    expected_from_location_id: uuid.UUID | None = Field(
        None, description="Ubicación que el usuario vio para esta pieza (control de concurrencia)."
    )


class BatchMovementRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "movement_type": "MOVE",
                    "to_location_id": EX_LOCATION_ID,
                    "reason": "Traslado masivo de depósito",
                    "items": [{"piece_id": EX_PIECE_ID}],
                }
            ]
        }
    )

    movement_type: MovementType = MovementType.MOVE
    to_location_id: uuid.UUID
    reason: str | None = None
    items: list[BatchMovementItem] = Field(min_length=1, max_length=200)


class BatchMovementFailureOut(BaseModel):
    piece_id: uuid.UUID
    code: str
    message: str


class BatchMovementResponse(BaseModel):
    registered: list[MovementOut] = Field(default_factory=list)
    failures: list[BatchMovementFailureOut] = Field(default_factory=list)
