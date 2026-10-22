"""User and permission-matrix administration (ADR-009, decision D5; RF-039, RN-005).

Every change here is a write in the caller's audit context (the administrator). Users are never
deleted, only deactivated (RN-005). Anything that changes what a user may do (deactivating, a
new password, other roles) revokes their sessions in the same transaction, and anything that
could leave the system without an active administrator is refused with ``last_administrator``
*after* the change is flushed, so the check sees the state it would leave behind; the request
session is rolled back when the error propagates, so nothing persists.
"""

import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.modules.audit.soft_delete import soft_delete
from app.modules.users.models import AppUser, Permission, Role, RolePermission, UserRole
from app.modules.users.passwords import hash_password, validate_password
from app.modules.users.sessions import RevokeReason, revoke_user_sessions

ADMIN_PERMISSION = "users.manage"


class RoleDisabled(ConflictError):
    code = "role_disabled"


class LastAdministrator(ConflictError):
    code = "last_administrator"


class EmailTaken(ConflictError):
    code = "email_taken"


def generate_temporary_password() -> str:
    """A random password that satisfies the policy; shown to the administrator only once."""
    return secrets.token_urlsafe(12)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def user_roles(db: Session, user_id: uuid.UUID) -> list[str]:
    return sorted(
        db.scalars(
            select(Role.code)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
    )


def get_user(db: Session, user_id: uuid.UUID) -> AppUser:
    user = db.get(AppUser, user_id)
    if user is None:
        raise NotFound("El usuario no existe.")
    return user


def _resolve_roles(db: Session, codes: list[str]) -> list[Role]:
    wanted = list(dict.fromkeys(codes))
    roles = {r.code: r for r in db.scalars(select(Role).where(Role.code.in_(wanted)))}
    unknown = [code for code in wanted if code not in roles]
    if unknown:
        raise ValidationFailed(
            f"Roles inexistentes: {', '.join(unknown)}.",
            code="unknown_role",
            details={"roles": unknown},
        )
    disabled = [code for code, role in roles.items() if not role.is_enabled]
    if disabled:
        raise RoleDisabled(
            f"Los roles {', '.join(disabled)} están desactivados en esta fase y no se asignan.",
            details={"roles": disabled},
        )
    return [roles[code] for code in wanted]


def _set_roles(db: Session, user: AppUser, roles: list[Role], reason: str) -> bool:
    """Replace the user's roles; returns whether anything changed."""
    current = {
        row.role_id: row for row in db.scalars(select(UserRole).where(UserRole.user_id == user.id))
    }
    wanted = {role.id for role in roles}
    changed = False
    for role_id, row in current.items():
        if role_id not in wanted:
            soft_delete(db, row, reason)
            changed = True
    for role in roles:
        if role.id not in current:
            db.add(UserRole(user_id=user.id, role_id=role.id))
            changed = True
    db.flush()
    return changed


def ensure_an_administrator_remains(db: Session) -> None:
    """At least one active user must hold ``users.manage`` through an enabled role (D5)."""
    db.flush()
    admins = db.scalar(
        select(func.count(func.distinct(AppUser.id)))
        .join(UserRole, UserRole.user_id == AppUser.id)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(
            AppUser.is_active.is_(True),
            Role.is_enabled.is_(True),
            Permission.code == ADMIN_PERMISSION,
        )
    )
    if not admins:
        raise LastAdministrator(
            "La operación dejaría el sistema sin ningún administrador activo; no se aplicó."
        )


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    role_codes: list[str],
    initial_password: str | None,
) -> tuple[AppUser, str]:
    """Create an account with a temporary password; returns the user and that password."""
    normalized = normalize_email(email)
    if "@" not in normalized:
        raise ValidationFailed("El correo no es válido.", code="invalid_email")
    if db.scalar(select(AppUser.id).where(func.lower(AppUser.email) == normalized)):
        raise EmailTaken("Ya existe un usuario con ese correo.")
    roles = _resolve_roles(db, role_codes)
    password = initial_password or generate_temporary_password()
    validate_password(password, email=normalized)
    user = AppUser(
        email=normalized,
        full_name=full_name.strip(),
        password_hash=hash_password(password, email=normalized),
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    for role in roles:
        db.add(UserRole(user_id=user.id, role_id=role.id))
    db.flush()
    return user, password


def update_user(
    db: Session,
    user: AppUser,
    *,
    full_name: str | None = None,
    is_active: bool | None = None,
    role_codes: list[str] | None = None,
    reset_password: bool = False,
) -> str | None:
    """Apply a partial update; returns the new temporary password when it was reset."""
    temporary: str | None = None
    revoke: RevokeReason | None = None
    if full_name is not None:
        user.full_name = full_name.strip()
    if is_active is not None and is_active != user.is_active:
        user.is_active = is_active
        if not is_active:
            revoke = RevokeReason.USER_DEACTIVATED
    if role_codes is not None:
        roles = _resolve_roles(db, role_codes)
        if _set_roles(db, user, roles, "Cambio de roles por un administrador") and revoke is None:
            revoke = RevokeReason.ROLES_CHANGED
    if reset_password:
        temporary = generate_temporary_password()
        user.password_hash = hash_password(temporary, email=user.email)
        user.must_change_password = True
        user.failed_login_count = 0
        user.locked_until = None
        revoke = revoke or RevokeReason.PASSWORD_RESET
    if revoke is not None:
        revoke_user_sessions(db, user.id, revoke)
    ensure_an_administrator_remains(db)
    return temporary


def replace_role_permissions(
    db: Session, role: Role, permission_codes: list[str], reason: str
) -> None:
    """Replace the permissions of a role; every grant and removal is audited (RF-039)."""
    wanted = set(permission_codes)
    known = {p.code: p for p in db.scalars(select(Permission).where(Permission.code.in_(wanted)))}
    unknown = sorted(wanted - set(known))
    if unknown:
        raise ValidationFailed(
            f"Permisos inexistentes: {', '.join(unknown)}.",
            code="unknown_permission",
            details={"permissions": unknown},
        )
    current = {
        row.permission_id: row
        for row in db.scalars(select(RolePermission).where(RolePermission.role_id == role.id))
    }
    wanted_ids = {known[code].id for code in wanted}
    for permission_id, row in current.items():
        if permission_id not in wanted_ids:
            soft_delete(db, row, reason)
    for code in sorted(wanted):
        if known[code].id not in current:
            db.add(RolePermission(role_id=role.id, permission_id=known[code].id))
    ensure_an_administrator_remains(db)
