"""Users, roles and permission matrix (spec usuarios-roles; RF-039, RNF-012, RNF-013)."""

import enum
import uuid
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models_base import (
    Base,
    JsonType,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
    utcnow,
)


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
    # Accounts created by an administrator get a temporary password: until it is replaced the
    # only reachable operations are `me`, `logout` and `change-password` (ADR-009, decision D2).
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)

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


class UserSession(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Opaque server-side session (ADR-009, decision D1).

    The database never holds the token itself, only its SHA-256 digest, so a dump of this
    table cannot be replayed as a cookie. Sessions are revoked (``revoked_at``), never
    deleted (RN-005); ``SoftDeleteMixin`` keeps the no-physical-delete guard in force.
    """

    __tablename__ = "user_session"
    # The digest is a credential and the heartbeat/fingerprint columns are pure noise (RNF-013).
    __audit_exclude__: ClassVar[frozenset[str]] = frozenset(
        {"created_at", "updated_at", "token_hash", "last_seen_at", "ip_address", "user_agent"}
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    # SHA-256 of the random 256-bit token, hex encoded.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # Idle expiry is computed from this column, refreshed at most once per minute.
    last_seen_at: Mapped[datetime] = mapped_column(default=utcnow)
    # Absolute expiry, fixed when the session is issued (SESSION_MAX_HOURS).
    expires_at: Mapped[datetime] = mapped_column()
    revoked_at: Mapped[datetime | None] = mapped_column(default=None)
    revoked_reason: Mapped[str | None] = mapped_column(String(60), default=None)
    # IPv6 fits in 45 characters.
    ip_address: Mapped[str | None] = mapped_column(String(45), default=None)
    user_agent: Mapped[str | None] = mapped_column(String(300), default=None)

    __table_args__ = (Index("ix_user_session_user_id_revoked_at", "user_id", "revoked_at"),)


class AuthEventType(enum.StrEnum):
    """Authentication events kept for security review (ADR-009, decision D3)."""

    LOGIN_OK = "LOGIN_OK"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOCKED = "LOCKED"
    LOGOUT = "LOGOUT"
    SESSION_REVOKED = "SESSION_REVOKED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"


class AuthEvent(UUIDPrimaryKeyMixin, Base):
    """Append-only authentication ledger (RNF-012, RNF-013, RNF-014).

    Every failure answers the client with the same generic message, so the real reason only
    lives here, in ``detail``. Passwords are never written, and the e-mail typed for an
    account that does not exist is stored only as a digest, so failed attempts cannot be
    turned into a list of addresses.
    """

    __tablename__ = "auth_event"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    occurred_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    event: Mapped[AuthEventType] = mapped_column(str_enum(AuthEventType, "auth_event_type"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"), index=True)
    # SHA-256 of the lowercased e-mail typed in, hex encoded; never the address itself.
    email_attempted_hash: Mapped[str | None] = mapped_column(String(64))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    # Real reason, e.g. "unknown_email", "bad_password", "account_locked"; never a password.
    detail: Mapped[str | None] = mapped_column(String(120))

    __table_args__ = (Index("ix_auth_event_event_occurred_at", "event", "occurred_at"),)


class SensitiveAccessLog(UUIDPrimaryKeyMixin, Base):
    """Append-only record of unmasked sensitive data served to a user (RNF-014, RF-041).

    Only which fields of which entities were handed over, never their values: the log must
    not become a second copy of the personal data it protects.
    """

    __tablename__ = "sensitive_access_log"
    __audited__: ClassVar[bool] = False
    __append_only__: ClassVar[bool] = True

    occurred_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    route: Mapped[str] = mapped_column(String(200))
    entity_type: Mapped[str] = mapped_column(String(60))
    # Up to 100 entity ids per request (design D6); a wider response is recorded truncated.
    entity_ids: Mapped[list[Any]] = mapped_column(JsonType)
    fields: Mapped[list[Any]] = mapped_column(JsonType)
