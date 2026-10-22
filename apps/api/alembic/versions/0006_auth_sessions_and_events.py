"""Server-side sessions, authentication ledger and sensitive-access log (ADR-009).

Revision ID: 0006_auth_sessions_and_events
Revises: 0007_import_decisions_and_images
Create Date: 2026-10-20

Change de OpenSpec: autenticacion-y-matriz-permisos (tarea 1.1, decisiones D1, D3 y D6).
Additive only:
- `user_session`: opaque sessions, identified by the SHA-256 digest of their token; revoked,
  never deleted, so it carries the usual soft-delete columns (RN-005);
- `auth_event`: logins, failures, locks, logouts, revocations and password changes;
- `sensitive_access_log`: which unmasked sensitive fields were served to whom (RNF-014);
- `app_user.must_change_password`: temporary password set by an administrator (D2). Existing
  rows get `false` through a server default that is then dropped, so the column matches the
  model exactly.

`auth_event` and `sensitive_access_log` are ledgers: nothing may update or delete a row, which
the database itself enforces with the triggers below (same guard as `audit_log`, ADR-004). The
PostgreSQL trigger function `matp_reject_append_only_change()` already exists since 0001, so it
is reused here and this downgrade only drops its own triggers.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_auth_sessions_and_events"
down_revision: str | None = "0007_import_decisions_and_images"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables this migration creates as insert-only (RN-005; cross-cutting rule of CLAUDE.md).
# `user_session` is not here: a session is revoked (`revoked_at`), and it inherits
# `SoftDeleteMixin`, so it is covered by the no-physical-delete side of the same rule.
APPEND_ONLY_TABLES = ("auth_event", "sensitive_access_log")

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

AUTH_EVENTS = (
    "LOGIN_OK",
    "LOGIN_FAILED",
    "LOCKED",
    "LOGOUT",
    "SESSION_REVOKED",
    "PASSWORD_CHANGED",
)


def _create_append_only_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        for table in APPEND_ONLY_TABLES:
            op.execute(
                f"CREATE TRIGGER trg_{table}_append_only BEFORE UPDATE OR DELETE ON {table} "
                "FOR EACH ROW EXECUTE FUNCTION matp_reject_append_only_change()"
            )
            op.execute(
                f"CREATE TRIGGER trg_{table}_no_truncate BEFORE TRUNCATE ON {table} "
                "FOR EACH STATEMENT EXECUTE FUNCTION matp_reject_append_only_change()"
            )
    elif dialect == "sqlite":
        for table in APPEND_ONLY_TABLES:
            for operation in ("UPDATE", "DELETE"):
                op.execute(
                    f"CREATE TRIGGER trg_{table}_no_{operation.lower()} BEFORE {operation} "
                    f"ON {table} BEGIN SELECT RAISE(ABORT, 'La tabla {table} es de solo "
                    "inserción'); END"
                )


def _drop_append_only_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        for table in APPEND_ONLY_TABLES:
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_append_only ON {table}")
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_no_truncate ON {table}")
    elif dialect == "sqlite":
        for table in APPEND_ONLY_TABLES:
            for operation in ("update", "delete"):
                op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_no_{operation}")


def upgrade() -> None:
    op.create_table(
        "auth_event",
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "event",
            sa.Enum(
                *AUTH_EVENTS,
                name="auth_event_type",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("email_attempted_hash", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("detail", sa.String(length=120), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_auth_event_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_event")),
    )
    op.create_index(
        "ix_auth_event_event_occurred_at", "auth_event", ["event", "occurred_at"], unique=False
    )
    op.create_index(
        op.f("ix_auth_event_occurred_at"), "auth_event", ["occurred_at"], unique=False
    )
    op.create_index(op.f("ix_auth_event_user_id"), "auth_event", ["user_id"], unique=False)

    op.create_table(
        "sensitive_access_log",
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("route", sa.String(length=200), nullable=False),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_ids", JSON_TYPE, nullable=False),
        sa.Column("fields", JSON_TYPE, nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_sensitive_access_log_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sensitive_access_log")),
    )
    op.create_index(
        op.f("ix_sensitive_access_log_occurred_at"),
        "sensitive_access_log",
        ["occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sensitive_access_log_user_id"), "sensitive_access_log", ["user_id"], unique=False
    )

    op.create_table(
        "user_session",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(length=60), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["deleted_by_id"], ["app_user.id"], name=op.f("fk_user_session_deleted_by_id_app_user")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_user_session_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_session")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_user_session_token_hash")),
    )
    op.create_index(
        op.f("ix_user_session_deleted_at"), "user_session", ["deleted_at"], unique=False
    )
    op.create_index(op.f("ix_user_session_user_id"), "user_session", ["user_id"], unique=False)
    op.create_index(
        "ix_user_session_user_id_revoked_at",
        "user_session",
        ["user_id", "revoked_at"],
        unique=False,
    )

    _create_append_only_guards()

    # The server default fills the users seeded before this change (the model keeps its own
    # default in Python). It is not dropped afterwards: on SQLite that would rebuild `app_user`
    # and lose `uq_app_user_email_active`, an expression index SQLite cannot reflect.
    op.add_column(
        "app_user",
        sa.Column(
            "must_change_password", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("app_user", "must_change_password")

    _drop_append_only_guards()

    op.drop_index("ix_user_session_user_id_revoked_at", table_name="user_session")
    op.drop_index(op.f("ix_user_session_user_id"), table_name="user_session")
    op.drop_index(op.f("ix_user_session_deleted_at"), table_name="user_session")
    op.drop_table("user_session")

    op.drop_index(op.f("ix_sensitive_access_log_user_id"), table_name="sensitive_access_log")
    op.drop_index(op.f("ix_sensitive_access_log_occurred_at"), table_name="sensitive_access_log")
    op.drop_table("sensitive_access_log")

    op.drop_index(op.f("ix_auth_event_user_id"), table_name="auth_event")
    op.drop_index(op.f("ix_auth_event_occurred_at"), table_name="auth_event")
    op.drop_index("ix_auth_event_event_occurred_at", table_name="auth_event")
    op.drop_table("auth_event")
