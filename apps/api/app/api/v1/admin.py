"""Authentication, users, roles, AI suggestions and audit (usuarios-roles, ia-asistiva,
auditoria-trazabilidad)."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.batch_limits import ensure_batch_size
from app.api.deps import (
    CurrentUser,
    SessionDep,
    SessionUserDep,
    load_permissions,
    require_permission,
    writer,
)
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.pagination import Page, PageParams, page_params, paginate
from app.api.stubs import (
    CHANGE_AI_EXTRACTION,
    CHANGE_BULK,
    implemented,
    not_implemented,
    stub,
)
from app.core.errors import NotFound
from app.modules.ai_suggestions.models import AiFunction, AiSuggestion, SuggestionStatus
from app.modules.ai_suggestions.schemas import (
    AiBatchOut,
    AiSuggestionApproval,
    AiSuggestionCreate,
    AiSuggestionOut,
    AiSuggestionRejection,
    BatchEnrichRequest,
    CatalogingSuggestionRequest,
)
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.query import (
    CSV_FILENAME,
    AuditExportFormat,
    AuditFilters,
    AuditGroupBy,
    AuditLogPage,
    list_change_sets,
    list_entries,
    stream_change_sets_csv,
    stream_entries_csv,
)
from app.modules.audit.schemas import AuditEntryOut
from app.modules.users import admin as users_admin
from app.modules.users import auth
from app.modules.users.admin import user_roles
from app.modules.users.auth import LoginResult
from app.modules.users.models import (
    AppUser,
    Permission,
    Role,
    RolePermission,
    SensitiveAccessLog,
    UserSession,
)
from app.modules.users.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    Me,
    PermissionOut,
    RoleOut,
    RolePermissionsUpdate,
    SensitiveAccessOut,
    UserCreate,
    UserOut,
    UserRoleUpdate,
    UserUpdate,
)
from app.modules.users.sessions import (
    RevokeReason,
    clear_session_cookies,
    revoke_session,
    set_session_cookies,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
UserManager = Annotated[CurrentUser, Depends(require_permission("users.manage"))]
AiRequester = Annotated[CurrentUser, Depends(require_permission("ai.request"))]
AiReviewer = Annotated[CurrentUser, Depends(require_permission("ai.review"))]
AuditReader = Annotated[CurrentUser, Depends(require_permission("audit.read"))]


# --------------------------------------------------------------------------- auth
def _session_response(
    response: Response, request: Request, db: Session, result: LoginResult
) -> LoginResponse:
    """Set the cookies of a freshly issued session and describe its user."""
    settings = request.app.state.settings
    roles, permissions = load_permissions(db, result.user.id)
    set_session_cookies(response, settings, result.issued)
    return LoginResponse(
        id=result.user.id,
        email=result.user.email,
        full_name=result.user.full_name,
        roles=list(roles),
        permissions=sorted(permissions),
        auth_mode="session",
        must_change_password=result.user.must_change_password,
        csrf_token=result.issued.csrf_token,
        session_expires_at=result.issued.expires_at,
    )


def _client_address(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    summary="Iniciar sesión con cuenta individual (bloqueo tras intentos fallidos)",
    description=(
        "Abre una sesión de servidor y entrega las cookies `matp_session` (HttpOnly) y "
        "`matp_csrf`. Cualquier fallo (correo inexistente, contraseña incorrecta, cuenta "
        "inactiva o bloqueada) responde el mismo `401 invalid_credentials`; si la cuenta tiene "
        "una contraseña temporal, `must_change_password` es verdadero (ADR-009)."
    ),
    tags=["Autenticación"],
    responses={
        401: {"model": ErrorResponse, "description": "Credenciales incorrectas (genérico)."},
        429: {"model": ErrorResponse, "description": "Demasiados intentos desde esta dirección."},
    },
    **implemented(),
)
def login(
    body: LoginRequest, request: Request, response: Response, db: SessionDep
) -> LoginResponse:
    result = auth.login(
        db,
        request.app.state.settings,
        request.app.state.login_throttle,
        username=body.username,
        password=body.password,
        ip_address=_client_address(request),
        user_agent=request.headers.get("user-agent"),
    )
    return _session_response(response, request, db, result)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión",
    description="Revoca la sesión actual y elimina las cookies de sesión y CSRF.",
    tags=["Autenticación"],
    **implemented(),
)
def logout(user: SessionUserDep, request: Request, db: SessionDep) -> Response:
    if user.session_id is not None:
        context = AuditContext(
            origin=AuditOrigin.MANUAL, user_id=user.id, reason="Cierre de sesión"
        )
        with audit_context(db, context):
            live = db.get(UserSession, user.session_id)
            if live is not None:
                revoke_session(db, live, RevokeReason.LOGOUT)
            db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookies(response, request.app.state.settings)
    return response


@router.post(
    "/auth/change-password",
    response_model=LoginResponse,
    summary="Cambiar la contraseña propia (obligatorio con una contraseña temporal)",
    description=(
        "Exige la contraseña actual y una nueva de al menos 12 caracteres que no sea común. "
        "Revoca todas las sesiones del usuario y abre una nueva en este dispositivo. Es la "
        "única operación, junto con `me` y `logout`, que acepta una cuenta con contraseña "
        "temporal (`403 password_change_required` en las demás)."
    ),
    tags=["Autenticación"],
    responses={
        422: {
            "model": ErrorResponse,
            "description": "Contraseña actual incorrecta o nueva que no cumple la política.",
        }
    },
    **implemented(),
)
def change_password(
    body: ChangePasswordRequest,
    user: SessionUserDep,
    request: Request,
    response: Response,
    db: SessionDep,
) -> LoginResponse:
    result = auth.change_password(
        db,
        request.app.state.settings,
        user.id,
        current_password=body.current_password,
        new_password=body.new_password,
        ip_address=_client_address(request),
        user_agent=request.headers.get("user-agent"),
    )
    return _session_response(response, request, db, result)


@router.get(
    "/auth/me",
    response_model=Me,
    summary="Usuario actual con roles y permisos efectivos",
    tags=["Autenticación"],
    **implemented(),
)
def get_me(user: SessionUserDep) -> Me:
    return Me(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=list(user.roles),
        permissions=sorted(user.permissions),
        auth_mode=user.auth_mode,
        must_change_password=user.must_change_password,
    )


# -------------------------------------------------------------------------- users
def _user_out(db: Session, user: AppUser, temporary_password: str | None = None) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=user_roles(db, user.id),
        last_login_at=user.last_login_at,
        locked_until=user.locked_until,
        created_at=user.created_at,
        must_change_password=user.must_change_password,
        temporary_password=temporary_password,
    )


@router.get(
    "/users",
    response_model=Page[UserOut],
    summary="Listar usuarios",
    tags=["Usuarios y roles"],
    **implemented(),
)
def list_users(
    session: SessionDep,
    user: UserManager,
    params: Annotated[PageParams, Depends(page_params)],
    include_inactive: bool = False,
) -> Page[UserOut]:
    statement = select(AppUser).order_by(AppUser.full_name, AppUser.email)
    if not include_inactive:
        statement = statement.where(AppUser.is_active.is_(True))
    rows, total = paginate(session, statement, params)
    return Page[UserOut](
        items=[_user_out(session, row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un usuario individual con roles",
    description=(
        "Crea la cuenta con una contraseña temporal (generada si no se indica) y cambio "
        "obligatorio. La contraseña temporal aparece solo en esta respuesta."
    ),
    tags=["Usuarios y roles"],
    responses={409: {"model": ErrorResponse, "description": "Correo repetido o rol desactivado."}},
    **implemented(),
)
def create_user(body: UserCreate, session: SessionDep, user: UserManager) -> UserOut:
    writer(session, user, "Alta de usuario")
    created, password = users_admin.create_user(
        session,
        email=body.email,
        full_name=body.full_name,
        role_codes=body.roles,
        initial_password=body.initial_password,
    )
    out = _user_out(session, created, password)
    session.commit()
    return out


@router.get(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Detalle de un usuario",
    tags=["Usuarios y roles"],
    **implemented(),
)
def get_user(user_id: uuid.UUID, session: SessionDep, user: UserManager) -> UserOut:
    return _user_out(session, users_admin.get_user(session, user_id))


@router.patch(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Editar, desactivar o cambiar roles de un usuario",
    description=(
        "Desactivar, cambiar roles o restablecer la contraseña revoca las sesiones del usuario "
        "de inmediato. Nunca se elimina físicamente (RN-005). `409 last_administrator` si "
        "dejaría el sistema sin administrador activo."
    ),
    tags=["Usuarios y roles"],
    responses={409: {"model": ErrorResponse, "description": "Rol desactivado o último admin."}},
    **implemented(),
)
def update_user(
    user_id: uuid.UUID, body: UserUpdate, session: SessionDep, user: UserManager
) -> UserOut:
    writer(session, user, "Edición de usuario")
    target = users_admin.get_user(session, user_id)
    temporary = users_admin.update_user(
        session,
        target,
        full_name=body.full_name,
        is_active=body.is_active,
        role_codes=body.roles,
        reset_password=body.reset_password,
    )
    out = _user_out(session, target, temporary)
    session.commit()
    return out


@router.put(
    "/users/{user_id}/role",
    response_model=UserOut,
    summary="Reemplazar los roles asignados a un usuario (RF-039)",
    tags=["Usuarios y roles"],
    responses={409: {"model": ErrorResponse, "description": "Rol desactivado o último admin."}},
    **implemented(),
)
def update_user_role(
    user_id: uuid.UUID, body: UserRoleUpdate, session: SessionDep, user: UserManager
) -> UserOut:
    writer(session, user, "Cambio de roles de usuario")
    target = users_admin.get_user(session, user_id)
    users_admin.update_user(session, target, role_codes=body.roles)
    out = _user_out(session, target)
    session.commit()
    return out


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
    description=(
        "Reemplaza el conjunto de permisos del rol y audita cada alta y baja. Se aplica desde "
        "la siguiente petición de los usuarios del rol. `409 last_administrator` si dejaría "
        "el sistema sin administrador activo."
    ),
    tags=["Usuarios y roles"],
    responses={409: {"model": ErrorResponse, "description": "Dejaría sin administradores."}},
    **implemented(),
)
def update_role_permissions(
    role_code: str, body: RolePermissionsUpdate, session: SessionDep, user: UserManager
) -> RoleOut:
    writer(session, user, body.reason)
    role = session.scalar(select(Role).where(Role.code == role_code))
    if role is None:
        raise NotFound("El rol no existe.")
    users_admin.replace_role_permissions(session, role, body.permissions, body.reason)
    session.commit()
    granted = session.scalars(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
    )
    return RoleOut(
        code=role.code,
        name=role.name,
        description=role.description,
        is_enabled=role.is_enabled,
        permissions=sorted(granted),
    )


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
def suggest_cataloging(body: CatalogingSuggestionRequest, user: AiRequester) -> AiSuggestionOut:
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
    response_model=AuditLogPage,
    summary=(
        "Consultar la auditoría campo a campo o agrupada por conjunto de cambios, "
        "exportable a CSV (RF-040, RF-041)"
    ),
    description=(
        "Devuelve `items` (una fila por campo, de la más reciente a la más antigua) o, con "
        "`group_by=change_set`, `change_sets` con el resumen de cada operación: usuario, fecha, "
        "origen, motivo, entidades afectadas por tipo, campos y estado de reversión. Con "
        "`format=csv` la misma vista se descarga en streaming. Los valores anteriores y nuevos "
        "de los campos sensibles se ocultan según los permisos del rol (RF-041): la fila sigue "
        "mostrando qué campo cambió, quién y cuándo, con `values_masked` en verdadero."
    ),
    tags=["Auditoría"],
    **implemented(),
)
def get_audit_logs(
    request: Request,
    session: SessionDep,
    user: AuditReader,
    params: Annotated[PageParams, Depends(page_params)],
    entity_type: Annotated[str | None, Query(description="p. ej. piece, collection.")] = None,
    entity_id: uuid.UUID | None = None,
    change_set_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    origin: AuditOrigin | None = None,
    origin_ref: Annotated[
        str | None, Query(description="Lote de importación o sugerencia de IA del cambio.")
    ] = None,
    action: AuditAction | None = None,
    field: str | None = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
    group_by: Annotated[
        AuditGroupBy | None, Query(description="Agrupar por conjunto de cambios.")
    ] = None,
    export_format: Annotated[
        AuditExportFormat | None, Query(alias="format", description="Descargar en CSV.")
    ] = None,
) -> AuditLogPage | StreamingResponse:
    filters = AuditFilters(
        entity_type=entity_type,
        entity_id=entity_id,
        change_set_id=change_set_id,
        user_id=user_id,
        origin=origin,
        origin_ref=origin_ref,
        action=action,
        field=field,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
    )
    grouped = group_by is AuditGroupBy.CHANGE_SET
    if export_format is AuditExportFormat.CSV:
        # El cuerpo se genera después de cerrar la sesión de la petición, así que la exportación
        # abre la suya propia y la lee por lotes (diseño D3: CSV en streaming).
        factory = request.app.state.session_factory
        lines = (
            stream_change_sets_csv(factory, filters)
            if grouped
            else stream_entries_csv(factory, filters, permissions=user.permissions)
        )
        return StreamingResponse(
            lines,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{CSV_FILENAME}"'},
        )
    if grouped:
        change_sets, total = list_change_sets(
            session, filters, limit=params.page_size, offset=params.offset
        )
        return AuditLogPage(
            change_sets=change_sets,
            total=total,
            page=params.page,
            page_size=params.page_size,
        )
    items, total = list_entries(
        session,
        filters,
        permissions=user.permissions,
        limit=params.page_size,
        offset=params.offset,
    )
    return AuditLogPage(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get(
    "/audit/sensitive-access",
    response_model=Page[SensitiveAccessOut],
    summary="Consultar los accesos a datos sensibles sin enmascarar (más reciente primero)",
    description=(
        "Una fila por petición que entregó campos sensibles sin enmascarar: usuario, fecha, "
        "ruta, entidades y nombres de campo, nunca sus valores (RNF-014)."
    ),
    tags=["Auditoría"],
    **implemented(),
)
def get_sensitive_access(
    session: SessionDep,
    user: AuditReader,
    params: Annotated[PageParams, Depends(page_params)],
    user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
) -> Page[SensitiveAccessOut]:
    statement = select(SensitiveAccessLog).order_by(
        SensitiveAccessLog.occurred_at.desc(), SensitiveAccessLog.id.desc()
    )
    if user_id:
        statement = statement.where(SensitiveAccessLog.user_id == user_id)
    if entity_type:
        statement = statement.where(SensitiveAccessLog.entity_type == entity_type)
    if occurred_from:
        statement = statement.where(SensitiveAccessLog.occurred_at >= occurred_from)
    if occurred_to:
        statement = statement.where(SensitiveAccessLog.occurred_at <= occurred_to)
    rows, total = paginate(session, statement, params)
    return Page[SensitiveAccessOut](
        items=[SensitiveAccessOut.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get(
    "/audit-logs/pieces/{piece_id}",
    response_model=Page[AuditEntryOut],
    summary="Trazabilidad completa de una pieza, de la más reciente a la más antigua (RF-040)",
    description=(
        "Cada cambio de la ficha, campo a campo, con quién, cuándo, origen y motivo; mismos "
        "datos y máscaras que `GET /audit-logs?entity_type=piece&entity_id=` (los campos "
        "sensibles se enmascaran según el rol)."
    ),
    tags=["Auditoría"],
    **implemented(),
)
def get_piece_audit_timeline(
    piece_id: uuid.UUID,
    session: SessionDep,
    user: AuditReader,
    params: Annotated[PageParams, Depends(page_params)],
) -> Page[AuditEntryOut]:
    items, total = list_entries(
        session,
        AuditFilters(entity_type="piece", entity_id=piece_id),
        permissions=user.permissions,
        limit=params.page_size,
        offset=params.offset,
    )
    return Page[AuditEntryOut](
        items=items, total=total, page=params.page, page_size=params.page_size
    )


@router.post(
    "/ai/validate-data",
    response_model=AiSuggestionOut,
    summary="Escaneo de calidad e inconsistencias asistido por IA (queda PENDIENTE, RN-009)",
    tags=["IA asistiva"],
    **stub(CHANGE_AI_EXTRACTION),
)
def validate_data_quality(body: AiSuggestionCreate, user: AiRequester) -> AiSuggestionOut:
    raise not_implemented(CHANGE_AI_EXTRACTION, AiSuggestionOut)


def batch_enrich_body(request: Request, body: BatchEnrichRequest) -> BatchEnrichRequest:
    """The batch within ``AI_BATCH_ENRICH_MAX_PIECES`` (task 1.2) [SUPUESTO AA1].

    A dependency, so the stub stays a stub: the size is checked before the route is reached.
    """
    limit = request.app.state.settings.ai_batch_enrich_max_pieces
    ensure_batch_size(len(body.piece_ids), limit, "Un lote de descripciones")
    return body


@router.post(
    "/ai/batch-enrich",
    response_model=AiBatchOut,
    summary="Descripciones preliminares por lote para piezas sin descripción (RIA-04, RN-009)",
    tags=["IA asistiva"],
    **stub(CHANGE_BULK),
)
def batch_ai_enrichment(
    user: AiRequester, body: Annotated[BatchEnrichRequest, Depends(batch_enrich_body)]
) -> AiBatchOut:
    """Cada borrador queda como sugerencia PENDIENTE; ninguna ficha cambia sin aprobación."""
    raise not_implemented(CHANGE_BULK, AiBatchOut)
