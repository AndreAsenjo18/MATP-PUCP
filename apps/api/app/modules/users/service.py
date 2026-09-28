"""Role lookups used by domain rules. Full authorization arrives with the auth change."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import Role, UserRole

ADMIN_ROLE = "ADMIN"
COLLECTIONS_MANAGER_ROLE = "COLLECTIONS_MANAGER"


def user_role_codes(session: Session, user_id: uuid.UUID) -> set[str]:
    rows = session.scalars(
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id, Role.is_enabled.is_(True))
    )
    return set(rows)


def user_has_role(session: Session, user_id: uuid.UUID, *codes: str) -> bool:
    return bool(user_role_codes(session, user_id) & set(codes))
