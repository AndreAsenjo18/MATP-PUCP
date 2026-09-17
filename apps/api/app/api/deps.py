"""Request dependencies: DB session, provisional identity and permissions (design D5, ADR-005).

The provisional identity is the ``X-MATP-User`` header (e-mail or UUID of an active synthetic
user). It is rejected in production. The change ``autenticacion-y-matriz-permisos`` replaces
``get_current_user`` with JWT authentication without touching the routers.
"""

import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, Request, Security
from fastapi.security import APIKeyHeader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationRequired, PermissionDenied
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.models import AppUser, Permission, Role, RolePermission, UserRole

DEV_USER_HEADER = "X-MATP-User"

dev_user_header = APIKeyHeader(
    name=DEV_USER_HEADER,
    scheme_name="DevUserHeader",
    description=(
        "Identidad PROVISIONAL de desarrollo (ADR-005): correo o UUID de un usuario sintético "
        "activo, p. ej. `catalogador@matp.local`. Rechazada con APP_ENV=production. Se reemplaza "
        "por JWT en el change autenticacion-y-matriz-permisos."
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


def get_current_user(
    request: Request,
    session: SessionDep,
    header_value: Annotated[str | None, Security(dev_user_header)] = None,
) -> CurrentUser:
    settings = request.app.state.settings
    if settings.app_env == "production":
        raise AuthenticationRequired(
            "La autenticación de producción aún no está disponible; la identidad de desarrollo "
            "no se acepta en este entorno.",
            code="production_auth_unavailable",
        )
    if not header_value or not header_value.strip():
        raise AuthenticationRequired(
            "Debe identificarse para acceder a los datos del catálogo (uso interno)."
        )
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
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


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
