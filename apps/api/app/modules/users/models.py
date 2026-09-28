"""Users, roles and permission matrix (spec usuarios-roles; RF-039, RNF-012, RNF-013)."""

import uuid
from datetime import datetime
from typing import ClassVar

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AppUser(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "app_user"
    # The password hash is never copied into the audit log (RNF-013).
    __audit_exclude__: ClassVar[frozenset[str]] = frozenset(
        {"created_at", "updated_at", "password_hash", "last_login_at", "failed_login_count"}
    )

    email: Mapped[str] = mapped_column(String(254))
    full_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Marks generated demo users (RNF-014): real personal data never lives in dev databases.
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    # Subject of a future institutional SSO (PUCP) identity, without redoing roles.
    external_subject: Mapped[str | None] = mapped_column(String(255))
    last_login_at: Mapped[datetime | None] = mapped_column(default=None)
    failed_login_count: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(default=None)

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user", foreign_keys="UserRole.user_id"
    )

    __table_args__ = (
        Index(
            "uq_app_user_email_active",
            func.lower(email),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class Role(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "role"

    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    # External researcher role is modelled but disabled in phase 1 (RF-042).
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Permission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "permission"

    code: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str] = mapped_column(Text)


class RolePermission(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "role_permission"

    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("role.id"), index=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("permission.id"), index=True)

    __table_args__ = (
        Index(
            "uq_role_permission_active",
            "role_id",
            "permission_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class UserRole(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "user_role"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("role.id"), index=True)

    user: Mapped[AppUser] = relationship(back_populates="roles", foreign_keys=[user_id])
    role: Mapped[Role] = relationship()

    __table_args__ = (
        Index(
            "uq_user_role_active",
            "user_id",
            "role_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
