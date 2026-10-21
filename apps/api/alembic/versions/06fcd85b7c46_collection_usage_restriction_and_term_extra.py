"""Collection default usage restriction + term extra metadata.

Revision ID: 06fcd85b7c46
Revises: 0005_import_batch_processing
Create Date: 2026-10-20

Change: fotografias-multiples-por-pieza (tarea 1.3, decisión D5).
Adds collection.default_usage_restriction_term_id (FK to term) and term.extra (JSON).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.models_base import JsonType

revision: str = "06fcd85b7c46"
down_revision: str | None = "0005_import_batch_processing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    # term.extra for blocks_external_download (USAGE_RESTRICTION) and future metadata
    if _is_sqlite():
        op.execute("ALTER TABLE term ADD COLUMN extra JSON")
    else:
        op.add_column("term", sa.Column("extra", JsonType, nullable=True))

    # collection.default_usage_restriction_term_id (FK to term.id)
    if _is_sqlite():
        op.execute(
            "ALTER TABLE collection ADD COLUMN default_usage_restriction_term_id CHAR(32) "
            "CONSTRAINT fk_collection_default_usage_restriction_term_id_term REFERENCES term (id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS "
            "ix_collection_default_usage_restriction_term_id "
            "ON collection (default_usage_restriction_term_id)"
        )
    else:
        op.add_column(
            "collection",
            sa.Column(
                "default_usage_restriction_term_id",
                sa.Uuid(),
                sa.ForeignKey("term.id"),
                nullable=True,
            ),
        )
        op.create_index(
            op.f("ix_collection_default_usage_restriction_term_id"),
            "collection",
            ["default_usage_restriction_term_id"],
            unique=False,
        )


def downgrade() -> None:
    if _is_sqlite():
        # Drop index first (explicit, like 0003 does)
        op.execute("DROP INDEX IF EXISTS ix_collection_default_usage_restriction_term_id")
        # Drop column via batch mode (recreates table without column)
        with op.batch_alter_table("collection") as batch_op:
            batch_op.drop_column("default_usage_restriction_term_id")
        with op.batch_alter_table("term") as batch_op:
            batch_op.drop_column("extra")
        return

    op.drop_index(op.f("ix_collection_default_usage_restriction_term_id"), table_name="collection")
    op.drop_constraint(op.f("fk_collection_default_usage_restriction_term_id_term"), "collection", type_="foreignkey")
    op.drop_column("collection", "default_usage_restriction_term_id")
    op.drop_column("term", "extra")