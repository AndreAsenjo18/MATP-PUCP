"""Authentication, users, roles, AI suggestions and audit (usuarios-roles, ia-asistiva,
auditoria-trazabilidad)."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, CurrentUserDep, SessionDep, require_permission
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import Page, PageParams, page_params, paginate
from app.api.stubs import (
    CHANGE_AI_EXTRACTION,
    CHANGE_AUDIT,
    CHANGE_AUTH,
    implemented,
    not_implemented,
    page_example,
    stub,
)
from app.core.errors import NotFound
from app.modules.ai_suggestions.models import AiFunction, AiSuggestion, SuggestionStatus
from app.modules.ai_suggestions.schemas import (
    AiSuggestionApproval,
    AiSuggestionCreate,
    AiSuggestionOut,
    AiSuggestionRejection,
)
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.audit.schemas import AuditEntryOut, RevertChangeSetRequest, RevertResult
from app.modules.users.models import Permission, Role, RolePermission
from app.modules.users.schemas import (
    LoginRequest,
    Me,
    PermissionOut,
    RoleOut,
    RolePermissionsUpdate,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
UserManager = Annotated[CurrentUser, Depends(require_permission("users.manage"))]
AiRequester = Annotated[CurrentUser, Depends(require_permission("ai.request"))]
AiReviewer = Annotated[CurrentUser, Depends(require_permission("ai.review"))]
AuditReader = Annotated[CurrentUser, Depends(require_permission("audit.read"))]


# --------------------------------------------------------------------------- auth
@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Iniciar sesión con cuenta individual (bloqueo tras intentos fallidos)",
    tags=["Autenticación"],
    **stub(CHANGE_AUTH),
)
def login(body: LoginRequest) -> TokenResponse:
    raise not_implemented(CHANGE_AUTH, TokenResponse)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión",
    tags=["Autenticación"],
    **stub(CHANGE_AUTH),
)
def logout(user: CurrentUserDep) -> None:
    raise not_implemented(CHANGE_AUTH)


@router.get(
    "/auth/me",
    response_model=Me,
    summary="Usuario actual con roles y permisos efectivos",
    tags=["Autenticación"],
    **implemented(),
)
def get_me(user: CurrentUserDep) -> Me:
    return Me(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=list(user.roles),
        permissions=sorted(user.permissions),
        auth_mode="dev-header",
    )


# -------------------------------------------------------------------------- users
@router.get(
    "/users",
    response_model=Page[UserOut],
    summary="Listar usuarios",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def list_users(
    user: UserManager,
    params: Annotated[PageParams, Depends(page_params)],
    include_inactive: bool = False,
) -> Page[UserOut]:
    raise not_implemented(CHANGE_AUTH, page_example(UserOut))


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un usuario individual con roles",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def create_user(body: UserCreate, user: UserManager) -> UserOut:
    raise not_implemented(CHANGE_AUTH, UserOut)


@router.get(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Detalle de un usuario",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def get_user(user_id: uuid.UUID, user: UserManager) -> UserOut:
    raise not_implemented(CHANGE_AUTH, UserOut)


@router.patch(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Editar, desactivar o cambiar roles de un usuario",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def update_user(user_id: uuid.UUID, body: UserUpdate, user: UserManager) -> UserOut:
    raise not_implemented(CHANGE_AUTH, UserOut)


@router.put(
    "/users/{user_id}/role",
    response_model=UserOut,
    summary="Cambiar el rol o el estado de un usuario (RF-039)",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def update_user_role(user_id: uuid.UUID, body: UserUpdate, user: UserManager) -> UserOut:
    raise not_implemented(CHANGE_AUTH, UserOut)


@router.get(
    "/roles",
    response_model=list[RoleOut],
    summary="Roles y su matriz de permisos [SUPUESTO]",
    tags=["Usuarios y roles"],
    **implemented(),
)
def list_roles(session: SessionDep, user: Reader) -> list[RoleOut]:
    grants: dict[uuid.UUID, list[str]] = {}
    for role_id, code in session.execute(
        select(RolePermission.role_id, Permission.code).join(
            Permission, Permission.id == RolePermission.permission_id
        )
    ).all():
        grants.setdefault(role_id, []).append(code)
    return [
        RoleOut(
            code=role.code,
            name=role.name,
            description=role.description,
            is_enabled=role.is_enabled,
            permissions=sorted(grants.get(role.id, [])),
        )
        for role in session.scalars(select(Role).order_by(Role.name))
    ]


@router.get(
    "/permissions",
    response_model=list[PermissionOut],
    summary="Catálogo de permisos",
    tags=["Usuarios y roles"],
    **implemented(),
)
def list_permissions(session: SessionDep, user: Reader) -> list[PermissionOut]:
    rows = session.scalars(select(Permission).order_by(Permission.code))
    return [PermissionOut.model_validate(row) for row in rows]


@router.put(
    "/roles/{role_code}/permissions",
    response_model=RoleOut,
    summary="Actualizar los permisos de un rol",
    tags=["Usuarios y roles"],
    **stub(CHANGE_AUTH),
)
def update_role_permissions(
    role_code: str, body: RolePermissionsUpdate, user: UserManager
) -> RoleOut:
    raise not_implemented(CHANGE_AUTH, RoleOut)


# ---------------------------------------------------------------- AI suggestions
@router.get(
    "/ai/suggestions",
    response_model=Page[AiSuggestionOut],
    summary="Sugerencias de IA (pendientes por defecto)",
    tags=["IA asistiva"],
    **implemented(),
)
def list_ai_suggestions(
    session: SessionDep,
    user: Reader,
    params: Annotated[PageParams, Depends(page_params)],
    suggestion_status: Annotated[
        SuggestionStatus | None, Query(alias="status")
    ] = SuggestionStatus.PENDING,
    function_code: AiFunction | None = None,
    piece_id: uuid.UUID | None = None,
) -> Page[AiSuggestionOut]:
    statement = select(AiSuggestion).order_by(AiSuggestion.created_at.desc(), AiSuggestion.id)
    if suggestion_status is not None:
        statement = statement.where(AiSuggestion.status == suggestion_status)
    if function_code is not None:
        statement = statement.where(AiSuggestion.function_code == function_code)
    if piece_id is not None:
        statement = statement.where(AiSuggestion.piece_id == piece_id)
    rows, total = paginate(session, statement, params)
    return Page(
        items=[AiSuggestionOut.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get(
    "/ai/suggestions/{suggestion_id}",
    response_model=AiSuggestionOut,
    responses={404: {"model": ErrorResponse, "description": "No existe."}},
    summary="Detalle de una sugerencia de IA",
    tags=["IA asistiva"],
    **implemented(),
)
def get_ai_suggestion(
    suggestion_id: uuid.UUID, session: SessionDep, user: Reader
) -> AiSuggestionOut:
    suggestion = session.get(AiSuggestion, suggestion_id)
    if suggestion is None:
        raise NotFound("La sugerencia no existe.")
    return AiSuggestionOut.model_validate(suggestion)


@router.post(
    "/ai/suggest-cataloging",
    response_model=AiSuggestionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar una sugerencia al servicio de IA (queda PENDIENTE, RN-009)",
    tags=["IA asistiva"],
    **stub(CHANGE_AI_EXTRACTION),
)
def suggest_cataloging(body: AiSuggestionCreate, user: AiRequester) -> AiSuggestionOut:
    raise not_implemented(CHANGE_AI_EXTRACTION, AiSuggestionOut)


@router.post(
    "/ai/suggestions/{suggestion_id}/approve",
    response_model=AiSuggestionOut,
    summary="Aprobar (total, parcial o editada) y aplicar con auditoría de origen IA",
    tags=["IA asistiva"],
    **stub(CHANGE_AI_EXTRACTION),
)
def approve_ai_suggestion(
    suggestion_id: uuid.UUID, body: AiSuggestionApproval, user: AiReviewer
) -> AiSuggestionOut:
    raise not_implemented(CHANGE_AI_EXTRACTION, AiSuggestionOut)


@router.post(
    "/ai/suggestions/{suggestion_id}/reject",
    response_model=AiSuggestionOut,
    summary="Rechazar una sugerencia con motivo",
    tags=["IA asistiva"],
    **stub(CHANGE_AI_EXTRACTION),
)
def reject_ai_suggestion(
    suggestion_id: uuid.UUID, body: AiSuggestionRejection, user: AiReviewer
) -> AiSuggestionOut:
    raise not_implemented(CHANGE_AI_EXTRACTION, AiSuggestionOut)


# -------------------------------------------------------------------------- audit
@router.get(
    "/audit-logs",
    response_model=Page[AuditEntryOut],
    summary="Consultar la auditoría campo a campo (más reciente primero)",
    tags=["Auditoría"],
    **implemented(),
)
def get_audit_logs(
    session: SessionDep,
    user: AuditReader,
    params: Annotated[PageParams, Depends(page_params)],
    entity_type: Annotated[str | None, Query(description="p. ej. piece, collection.")] = None,
    entity_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    origin: AuditOrigin | None = None,
    field: str | None = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
) -> Page[AuditEntryOut]:
    statement = select(AuditLog).order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    if entity_type:
        statement = statement.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        statement = statement.where(AuditLog.entity_id == entity_id)
    if user_id is not None:
        statement = statement.where(AuditLog.user_id == user_id)
    if origin is not None:
        statement = statement.where(AuditLog.origin == origin)
    if field:
        statement = statement.where(AuditLog.field == field)
    if occurred_from is not None:
        statement = statement.where(AuditLog.occurred_at >= occurred_from)
    if occurred_to is not None:
        statement = statement.where(AuditLog.occurred_at <= occurred_to)
    rows, total = paginate(session, statement, params)
    return Page(
        items=[AuditEntryOut.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get(
    "/audit-logs/pieces/{piece_id}",
    response_model=Page[AuditEntryOut],
    summary="Trazabilidad completa de una pieza, de la más reciente a la más antigua (RF-040)",
    tags=["Auditoría"],
    **stub(CHANGE_AUDIT),
)
def get_piece_audit_timeline(
    piece_id: uuid.UUID,
    user: AuditReader,
    params: Annotated[PageParams, Depends(page_params)],
) -> Page[AuditEntryOut]:
    raise not_implemented(CHANGE_AUDIT, page_example(AuditEntryOut))


@router.post(
    "/ai/validate-data",
    response_model=AiSuggestionOut,
    summary="Escaneo de calidad e inconsistencias asistido por IA (queda PENDIENTE, RN-009)",
    tags=["IA asistiva"],
    **stub(CHANGE_AI_EXTRACTION),
)
def validate_data_quality(body: AiSuggestionCreate, user: AiRequester) -> AiSuggestionOut:
    raise not_implemented(CHANGE_AI_EXTRACTION, AiSuggestionOut)


@router.post(
    "/audit/change-sets/{change_set_id}/revert",
    response_model=RevertResult,
    summary="Revertir un conjunto de cambios con una nueva entrada auditada (RNF-007)",
    tags=["Auditoría"],
    **stub(CHANGE_AUDIT),
)
def revert_change_set(
    change_set_id: uuid.UUID,
    body: RevertChangeSetRequest,
    user: Annotated[CurrentUser, Depends(require_permission("pieces.restore"))],
) -> RevertResult:
    raise not_implemented(CHANGE_AUDIT, RevertResult)
