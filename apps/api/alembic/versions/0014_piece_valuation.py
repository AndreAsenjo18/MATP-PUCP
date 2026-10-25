"""Historical valuations of a piece, append-only.

Revision ID: 0014_piece_valuation
Revises: 0013_normalization_params
Create Date: 2026-10-25

Change de OpenSpec: reportes-inventario (tarea 2.3, design D6; RF-037). Additive only:
`piece_valuation` keeps every valuation of a piece (amount, currency, date, source); the current
one is the most recent by `valued_on`. Like `audit_log` it is append-only and protected by
database triggers: a valuation is never rewritten, a new one is added (RN-005).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_piece_valuation"
down_revision: str | None = "0013_normalization_params"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables created by this migration whose rows can only be inserted (spec auditoria-trazabilidad).
APPEND_ONLY_TABLES = ("piece_valuation",)

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
        "piece_valuation",
        sa.Column("piece_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("valued_on", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by_label", sa.String(length=200), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["piece_id"], ["piece.id"], name=op.f("fk_piece_valuation_piece_id_piece")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_piece_valuation")),
    )
    op.create_index(
        op.f("ix_piece_valuation_piece_id"), "piece_valuation", ["piece_id"], unique=False
    )
    _create_append_only_guards()


def downgrade() -> None:
    _drop_append_only_guards()
    op.drop_index(op.f("ix_piece_valuation_piece_id"), table_name="piece_valuation")
    op.drop_table("piece_valuation")
