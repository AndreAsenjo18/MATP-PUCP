"""Request dependencies: DB session, authenticated user and permissions (ADR-009).

The user is identified by the server-side session behind the ``matp_session`` cookie
(``users/sessions.py``). Permissions are read from the database on every request, so a change
to the matrix applies from the next operation (RF-039).

The ``X-MATP-User`` header (ADR-005: e-mail or UUID of an active synthetic user) survives only
under ``APP_ENV=test``, where it keeps unit tests short; development, demo and production use
the real login. The routers never changed: they depend on ``get_current_user`` and
``require_permission``.
"""

import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, Request, Security
from fastapi.security import APIKeyCookie, APIKeyHeader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationRequired, PermissionDenied
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.models import AppUser, Permission, Role, RolePermission, UserRole
from app.modules.users.sessions import SESSION_COOKIE, SessionRevoked, resolve_session

DEV_USER_HEADER = "X-MATP-User"

dev_user_header = APIKeyHeader(
    name=DEV_USER_HEADER,
    scheme_name="DevUserHeader",
    description=(
        "Identidad de PRUEBAS (ADR-005): correo o UUID de un usuario sintético activo, p. ej. "
        "`catalogador@matp.local`. Solo se acepta con APP_ENV=test; en desarrollo, demostración "
        "y producción se usa el inicio de sesión (ADR-009)."
    ),
    auto_error=False,
)

session_cookie = APIKeyCookie(
    name=SESSION_COOKIE,
    scheme_name="cookieAuth",
    description=(
        "Sesión de servidor (ADR-009): token opaco en cookie `HttpOnly` que entrega "
        "`POST /auth/login`. Las escrituras exigen además la cabecera `X-CSRF-Token`."
    ),
    auto_error=False,
)


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    email: str
    full_name: str
    roles: tuple[str, ...]
    permissions: frozenset[str] = field(default_factory=frozenset)
    # Set when the user came in through a session (not through the test header).
    session_id: uuid.UUID | None = None
    # A temporary password is still in force: only me, logout and change-password work.
    must_change_password: bool = False
    auth_mode: str = "session"

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def get_session(request: Request) -> Iterator[Session]:
    session: Session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


SessionDep = Annotated[Session, Depends(get_session)]


def _find_user(session: Session, raw: str) -> AppUser | None:
    value = raw.strip()
    try:
        user_id = uuid.UUID(value)
    except ValueError:
        return session.scalar(select(AppUser).where(func.lower(AppUser.email) == value.lower()))
    return session.get(AppUser, user_id)


def load_permissions(
    session: Session, user_id: uuid.UUID
) -> tuple[tuple[str, ...], frozenset[str]]:
    roles = tuple(
        sorted(
            session.scalars(
                select(Role.code)
                .join(UserRole, UserRole.role_id == Role.id)
                .where(UserRole.user_id == user_id, Role.is_enabled.is_(True))
            )
        )
    )
    permissions = frozenset(
        session.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id, Role.is_enabled.is_(True))
        )
    )
    return roles, permissions


def _user_from_header(session: Session, header_value: str) -> CurrentUser:
    user = _find_user(session, header_value)
    if user is None or not user.is_active or not user.is_synthetic:
        raise AuthenticationRequired(
            "El usuario indicado no existe, está inactivo o no es un usuario de desarrollo "
            "sintético."
        )
    roles, permissions = load_permissions(session, user.id)
    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
        auth_mode="dev-header",
    )


def _user_from_session(request: Request, session: Session, token: str) -> CurrentUser:
    live = resolve_session(session, request.app.state.settings, token)
    user = session.get(AppUser, live.user_id)
    if user is None or not user.is_active:
        raise SessionRevoked("Su cuenta está desactivada. Contacte a un administrador.")
    roles, permissions = load_permissions(session, user.id)
    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
        session_id=live.id,
        must_change_password=user.must_change_password,
    )


def authenticate(
    request: Request, session: Session, header_value: str | None, session_token: str | None
) -> CurrentUser:
    """Identify the caller: the session cookie first, the test header only under APP_ENV=test."""
    if session_token:
        return _user_from_session(request, session, session_token)
    if header_value and header_value.strip() and request.app.state.settings.app_env == "test":
        return _user_from_header(session, header_value)
    raise AuthenticationRequired(
        "Debe iniciar sesión para acceder a los datos del catálogo (uso interno)."
    )


def get_session_user(
    request: Request,
    session: SessionDep,
    header_value: Annotated[str | None, Security(dev_user_header)] = None,
    session_token: Annotated[str | None, Security(session_cookie)] = None,
) -> CurrentUser:
    """Authenticated user *without* the forced password change.

    Only ``GET /auth/me``, ``POST /auth/logout`` and ``POST /auth/change-password`` use this
    one, so a person holding a temporary password can see who they are, leave, or replace it.
    """
    return authenticate(request, session, header_value, session_token)


def get_current_user(
    user: Annotated[CurrentUser, Depends(get_session_user)],
) -> CurrentUser:
    """Authenticated user for every other route; a temporary password blocks them (D2)."""
    if user.must_change_password:
        raise PermissionDenied(
            "Debe definir una contraseña nueva antes de continuar.",
            code="password_change_required",
        )
    return user


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
SessionUserDep = Annotated[CurrentUser, Depends(get_session_user)]


def require_permission(permission: str) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(user: CurrentUserDep) -> CurrentUser:
        if not user.can(permission):
            raise PermissionDenied(
                f"Su rol no tiene el permiso necesario para esta operación ({permission}).",
                details={"permission": permission},
            )
        return user

    dependency.__name__ = f"require_{permission.replace('.', '_')}"
    return dependency


def writer(session: Session, user: CurrentUser, reason: str | None = None) -> Session:
    """Attach a manual audit context to the request session (audit stays in the service layer)."""
    set_audit_context(
        session, AuditContext(origin=AuditOrigin.MANUAL, user_id=user.id, reason=reason)
    )
    return session
