"""Locations tree and identifier normalization preview.

Specs ubicacion-movimientos and identificacion-piezas.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.api.enums import LOCATION_LEVEL_LABELS, label_of
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.refs import LocationRef
from app.api.stubs import (
    CHANGE_LOCATIONS,
    example_of,
    implemented,
    not_implemented,
    stub,
)
from app.core.errors import NotFound
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.catalog.schemas import PieceSummary
from app.modules.identification.normalization import is_absence_marker, propose_identifiers
from app.modules.identification.schemas import (
    NormalizedProposal,
    NormalizeRequest,
    NormalizeResponse,
)
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.schemas import (
    LocationCreate,
    LocationNode,
    LocationOut,
    LocationUpdate,
)
from app.modules.users.sensitive import PERM_EXACT_LOCATION, PUBLIC_LOCATION_LEVELS

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
LocationManager = Annotated[CurrentUser, Depends(require_permission("locations.manage"))]


def _location_out(reader: CatalogReader, location: Location) -> LocationOut:
    out = LocationOut.model_validate(location)
    out.path = [LocationRef.model_validate(node) for node in reader.location_path(location.id)]
    return out


@router.get(
    "/locations",
    response_model=list[LocationOut],
    summary="Listar ubicaciones (sin niveles de ubicación exacta si el rol no lo permite)",
    tags=["Ubicaciones"],
    **implemented(),
)
def list_locations(
    session: SessionDep,
    user: Reader,
    parent_id: Annotated[uuid.UUID | None, Query(description="Solo hijos directos.")] = None,
    level: LocationLevel | None = None,
) -> list[LocationOut]:
    statement = select(Location).order_by(Location.code)
    if parent_id is not None:
        statement = statement.where(Location.parent_id == parent_id)
    if level is not None:
        statement = statement.where(Location.level == level)
    if not user.can(PERM_EXACT_LOCATION):
        statement = statement.where(Location.level.in_(PUBLIC_LOCATION_LEVELS))
    reader = CatalogReader(session, Viewer(user.permissions))
    return [_location_out(reader, location) for location in session.scalars(statement)]


@router.get(
    "/locations/tree",
    response_model=list[LocationNode],
    summary="Árbol jerárquico de ubicaciones, de la sede al contenedor (RF-016)",
    tags=["Ubicaciones"],
    **implemented(),
)
def get_locations_tree(session: SessionDep, user: Reader) -> list[LocationNode]:
    """Contrato: `getLocationsTree`. Poda los niveles que el rol no puede ver (RF-041)."""
    statement = select(Location).where(Location.deleted_at.is_(None)).order_by(Location.code)
    if not user.can(PERM_EXACT_LOCATION):
        statement = statement.where(Location.level.in_(PUBLIC_LOCATION_LEVELS))
    locations = list(session.scalars(statement))
    nodes = {
        location.id: LocationNode(
            id=location.id,
            name=location.name,
            level_type=label_of(LOCATION_LEVEL_LABELS, location.level) or str(location.level),
        )
        for location in locations
    }
    roots: list[LocationNode] = []
    for location in locations:
        node = nodes[location.id]
        parent = nodes.get(location.parent_id) if location.parent_id else None
        # Un nodo cuyo padre se podó por permisos cuelga de la raíz, no desaparece.
        (parent.children if parent else roots).append(node)
    return roots


@router.get(
    "/locations/{location_id}",
    response_model=LocationOut,
    responses={404: {"model": ErrorResponse, "description": "No existe o no es visible."}},
    summary="Detalle de una ubicación con su ruta",
    tags=["Ubicaciones"],
    **implemented(),
)
def get_location(location_id: uuid.UUID, session: SessionDep, user: Reader) -> LocationOut:
    location = session.get(Location, location_id)
    if (
        location is None
        or location.deleted_at is not None
        or (location.level not in PUBLIC_LOCATION_LEVELS and not user.can(PERM_EXACT_LOCATION))
    ):
        raise NotFound("La ubicación no existe o no está disponible para su rol.")
    return _location_out(CatalogReader(session, Viewer(user.permissions)), location)


@router.post(
    "/locations",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una ubicación en la jerarquía sede › espacio › mueble › nivel › contenedor",
    tags=["Ubicaciones"],
    **stub(CHANGE_LOCATIONS),
)
def create_location(body: LocationCreate, user: LocationManager) -> LocationOut:
    raise not_implemented(CHANGE_LOCATIONS, LocationOut)


@router.put(
    "/locations/{location_id}",
    response_model=LocationOut,
    summary="Editar o desactivar una ubicación",
    tags=["Ubicaciones"],
    **stub(CHANGE_LOCATIONS),
)
def update_location(
    location_id: uuid.UUID, body: LocationUpdate, user: LocationManager
) -> LocationOut:
    raise not_implemented(CHANGE_LOCATIONS, LocationOut)


@router.get(
    "/locations/{location_id}/pieces",
    response_model=list[PieceSummary],
    summary="Listar las piezas guardadas en un espacio, mueble, nivel o contenedor (RF-025)",
    tags=["Ubicaciones"],
    **stub(CHANGE_LOCATIONS),
)
def get_pieces_in_location(location_id: uuid.UUID, user: Reader) -> list[PieceSummary]:
    raise not_implemented(CHANGE_LOCATIONS, [example_of(PieceSummary)])


@router.post(
    "/identifiers/normalize",
    response_model=NormalizeResponse,
    summary="Vista previa de la normalización de una celda de códigos (RF-023)",
    tags=["Identificadores"],
    **implemented(),
)
def normalize_identifiers(body: NormalizeRequest, user: Reader) -> NormalizeResponse:
    proposals = propose_identifiers(body.value, default_type=body.default_type)
    return NormalizeResponse(
        value=body.value,
        is_absence_marker=is_absence_marker(body.value),
        proposals=[
            NormalizedProposal(
                type_code=proposal.type_code,
                original=proposal.result.original,
                normalized=proposal.result.normalized,
                status=proposal.result.status,
                detected_format=proposal.result.detected_format,
                is_absent=proposal.result.is_absent,
                requires_confirmation=proposal.requires_confirmation,
                notes=proposal.notes,
            )
            for proposal in proposals
        ],
    )
