"""Daily cryptographic digest of the audit log: append-only evidence of integrity.

Revision ID: 0006_audit_digest
Revises: 0010_export_jobs
Create Date: 2026-10-20

Change de OpenSpec: auditoria-y-soft-delete-transversal (tarea 4.1, decisión D5; RNF-007).
`audit_digest` keeps one row per closed day with the digest of its `audit_log` rows chained to
the previous day. Like `audit_log` it is append-only and protected by database triggers, so an
existing digest cannot be rewritten to hide an alteration: the evidence is only valid if the
row that holds it cannot change.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_audit_digest"
down_revision: str | None = "0010_export_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables created by this migration whose rows can only be inserted (spec auditoria-trazabilidad).
APPEND_ONLY_TABLES = ("audit_digest",)

# The PostgreSQL trigger function `matp_reject_append_only_change()` is created by
# 0001_core_data_model, an ancestor of this revision, and shared by every append-only table.


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
        "audit_digest",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("first_entry_id", sa.Uuid(), nullable=True),
        sa.Column("last_entry_id", sa.Uuid(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("previous_day", sa.Date(), nullable=True),
        sa.Column("previous_sha256", sa.String(length=64), nullable=True),
        sa.Column("algorithm", sa.String(length=40), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_digest")),
        sa.UniqueConstraint("day", name=op.f("uq_audit_digest_day")),
    )
    _create_append_only_guards()


def downgrade() -> None:
    _drop_append_only_guards()
    op.drop_table("audit_digest")
