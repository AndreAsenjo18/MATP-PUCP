"""Locations tree and identifier normalization preview.

Specs ubicacion-movimientos and identificacion-piezas.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.enums import (
    LOCATION_LEVEL_LABELS,
    SPACE_KIND_LABELS,
    LocationLevelLabel,
    code_of,
    label_of,
)
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.refs import LocationRef
from app.api.stubs import implemented
from app.core.errors import NotFound, ValidationFailed
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.catalog.schemas import PieceSummary
from app.modules.identification.normalization import is_absence_marker, propose_identifiers
from app.modules.identification.params import session_params
from app.modules.identification.schemas import (
    NormalizedProposal,
    NormalizeRequest,
    NormalizeResponse,
)
from app.modules.locations import hierarchy as location_hierarchy
from app.modules.locations import idempotency
from app.modules.locations import service as location_service
from app.modules.locations.models import Location, PieceMovement
from app.modules.locations.schemas import (
    BatchMovementFailureOut,
    BatchMovementRequest,
    BatchMovementResponse,
    LocationCreate,
    LocationNode,
    LocationOut,
    LocationUpdate,
    MovementOut,
)
from app.modules.users.sensitive import PERM_EXACT_LOCATION, PUBLIC_LOCATION_LEVELS

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
LocationManager = Annotated[CurrentUser, Depends(require_permission("locations.manage"))]
MovementRegistrar = Annotated[CurrentUser, Depends(require_permission("movements.register"))]


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
    level: Annotated[
        LocationLevelLabel | None,
        Query(
            description="Nivel jerárquico en español: Sede, Depósito, Mueble, Nivel o Contenedor."
        ),
    ] = None,
) -> list[LocationOut]:
    sought = code_of(LOCATION_LEVEL_LABELS, level, "level") if level is not None else None
    statement = select(Location).order_by(Location.code)
    if parent_id is not None:
        statement = statement.where(Location.parent_id == parent_id)
    if sought is not None:
        statement = statement.where(Location.level == sought)
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


def _space_kind_code(label: str | None) -> str | None:
    return code_of(SPACE_KIND_LABELS, label, "space_kind") if label is not None else None


@router.post(
    "/locations",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorResponse, "description": "El padre indicado no existe."},
        409: {"model": ErrorResponse, "description": "El código ya está en uso (RF-016)."},
        422: {"model": ErrorResponse, "description": "Nivel de padre no permitido."},
    },
    summary="Crear una ubicación en la jerarquía sede › espacio › mueble › nivel › contenedor",
    tags=["Ubicaciones"],
    **implemented(),
)
def create_location(
    body: LocationCreate, session: SessionDep, user: LocationManager
) -> LocationOut:
    parent = None
    if body.parent_id is not None:
        parent = session.get(Location, body.parent_id)
        if parent is None or parent.deleted_at is not None:
            raise NotFound("La ubicación padre no existe o fue eliminada.")
    level = code_of(LOCATION_LEVEL_LABELS, body.level, "level")
    writer(session, user)
    location = location_service.create_location(
        session,
        level=level,
        code=body.code,
        name=body.name,
        parent=parent,
        description=body.description,
        space_kind=_space_kind_code(body.space_kind),
    )
    session.commit()
    return _location_out(CatalogReader(session, Viewer(user.permissions)), location)


@router.put(
    "/locations/{location_id}",
    response_model=LocationOut,
    responses={
        404: {"model": ErrorResponse, "description": "La ubicación o el nuevo padre no existen."},
        409: {
            "model": ErrorResponse,
            "description": "La ubicación tiene piezas (desactivación o confirmación de conteo).",
        },
        422: {"model": ErrorResponse, "description": "Ciclo o nivel de padre no permitido."},
    },
    summary="Editar, desactivar o reubicar una ubicación (design D4)",
    tags=["Ubicaciones"],
    **implemented(),
)
def update_location(
    location_id: uuid.UUID, body: LocationUpdate, session: SessionDep, user: LocationManager
) -> LocationOut:
    location = session.get(Location, location_id)
    if location is None or location.deleted_at is not None:
        raise NotFound("La ubicación no existe o fue eliminada.")
    writer(session, user)
    fields = body.model_fields_set
    location_service.update_location(
        session,
        location,
        name=body.name,
        description=body.description if "description" in fields else location_service.UNSET,
        is_active=body.is_active,
        space_kind=(
            _space_kind_code(body.space_kind) if "space_kind" in fields else location_service.UNSET
        ),
        new_parent_id=body.parent_id,
        confirm_affected_count=body.confirm_affected_count,
    )
    session.commit()
    return _location_out(CatalogReader(session, Viewer(user.permissions)), location)


@router.get(
    "/locations/{location_id}/pieces",
    response_model=list[PieceSummary],
    responses={404: {"model": ErrorResponse, "description": "No existe o no es visible."}},
    summary=(
        "Listar las piezas guardadas en un espacio, mueble, nivel o contenedor (RF-034, RF-016)"
    ),
    tags=["Ubicaciones"],
    **implemented(),
)
def get_pieces_in_location(
    location_id: uuid.UUID, session: SessionDep, user: Reader
) -> list[PieceSummary]:
    location = session.get(Location, location_id)
    if (
        location is None
        or location.deleted_at is not None
        or (location.level not in PUBLIC_LOCATION_LEVELS and not user.can(PERM_EXACT_LOCATION))
    ):
        raise NotFound("La ubicación no existe o no está disponible para su rol.")
    ids = location_hierarchy.subtree_ids(session, location_id)
    pieces = session.scalars(
        select(Piece)
        .where(Piece.current_location_id.in_(ids), Piece.deleted_at.is_(None))
        .order_by(Piece.denomination)
    )
    reader = CatalogReader(session, Viewer(user.permissions))
    return reader.summaries(list(pieces))


def _batch_movement_out(reader: CatalogReader, movement: PieceMovement) -> MovementOut:
    def visible_ref(location_id: uuid.UUID | None) -> LocationRef | None:
        path, _exact = reader.visible_path(location_id)
        return LocationRef.model_validate(path[-1]) if path else None

    return MovementOut(
        id=movement.id,
        piece_id=movement.piece_id,
        movement_type=movement.movement_type,
        from_location=visible_ref(movement.from_location_id),
        to_location=visible_ref(movement.to_location_id),
        reason=movement.reason,
        corrects_movement_id=movement.corrects_movement_id,
        performed_by_label=movement.performed_by_label,
        occurred_at=movement.occurred_at,
    )


@router.post(
    "/movements/batch",
    response_model=BatchMovementResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorResponse, "description": "El destino no existe o fue eliminado."},
        409: {
            "model": ErrorResponse,
            "description": "El destino cambió respecto a lo visto, o la clave no coincide.",
        },
        422: {
            "model": ErrorResponse,
            "description": "Lote vacío, destino inválido o límite excedido.",
        },
    },
    summary="Mover o verificar varias piezas escaneadas hacia un mismo destino (vista móvil)",
    tags=["Ubicaciones"],
    **implemented(),
)
def move_pieces_batch(
    body: BatchMovementRequest,
    session: SessionDep,
    user: MovementRegistrar,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BatchMovementResponse:
    payload_hash = idempotency.request_hash(body.model_dump(mode="json"))
    if idempotency_key:
        cached = idempotency.find_valid(session, scope="movements_batch", key=idempotency_key)
        if cached is not None:
            if cached.request_hash != payload_hash:
                raise ValidationFailed(
                    "La clave de reintento ya se usó con una petición distinta.",
                    code="idempotency_key_reused",
                )
            return BatchMovementResponse.model_validate(cached.response_body)

    destination = session.get(Location, body.to_location_id)
    if destination is None or destination.deleted_at is not None:
        raise NotFound("La ubicación de destino no existe o fue eliminada.")
    writer(session, user, body.reason)
    outcome = location_service.move_pieces_batch(
        session,
        movement_type=body.movement_type,
        destination=destination,
        reason=body.reason,
        items=[(item.piece_id, item.expected_from_location_id) for item in body.items],
        performed_by_label=user.full_name,
    )
    reader = CatalogReader(session, Viewer(user.permissions))
    response = BatchMovementResponse(
        registered=[_batch_movement_out(reader, movement) for movement in outcome.movements],
        failures=[
            BatchMovementFailureOut(piece_id=f.piece_id, code=f.code, message=f.message)
            for f in outcome.failures
        ],
    )
    if outcome.failures:
        # Todo o nada (design D3): nada se escribió; el código distingue conflicto de validación.
        status_code = (
            status.HTTP_409_CONFLICT
            if any(f.code == "location_changed" for f in outcome.failures)
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        return JSONResponse(
            status_code=status_code, content=jsonable_encoder(response.model_dump(mode="json"))
        )
    if idempotency_key:
        # Guarda la respuesta en la misma transacción: si la caída ocurre antes del commit, el
        # reintento repite todo el lote; si ocurre después, nunca re-procesa (RNF-005).
        idempotency.store(
            session,
            scope="movements_batch",
            key=idempotency_key,
            user_id=user.id,
            payload_hash=payload_hash,
            response_status=status.HTTP_201_CREATED,
            response_body=response.model_dump(mode="json"),
        )
    session.commit()
    return response


@router.post(
    "/identifiers/normalize",
    response_model=NormalizeResponse,
    summary="Vista previa de la normalización de una celda de códigos (RF-023)",
    tags=["Identificadores"],
    **implemented(),
)
def normalize_identifiers(
    body: NormalizeRequest, session: SessionDep, user: Reader
) -> NormalizeResponse:
    # Current markers, separators and aliases, as the import applies them (design D5).
    params = session_params(session)
    proposals = propose_identifiers(body.value, default_type=body.default_type, params=params)
    return NormalizeResponse(
        value=body.value,
        is_absence_marker=is_absence_marker(body.value, params=params),
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
