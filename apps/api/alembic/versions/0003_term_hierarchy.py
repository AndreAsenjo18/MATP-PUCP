"""Vocabulary terms get a parent so categories can form a hierarchy.

Revision ID: 0003_term_hierarchy
Revises: 0002_loans_and_exhibitions
Create Date: 2026-10-09

Change de OpenSpec: alinear-api-endpoints-v1 (tarea 2.2, decisión C4d de design.md).
Categories and conservation states stay in `vocabulary`/`term` (RN-010); `GET/POST /categories`
and `GET /conservation-states` are a facade over them, so no row is moved and every piece keeps
its `category_id` and `conservation_state_id`. Only `term.parent_id` is added.

On SQLite (test suite only) the column is added in place, with its foreign key inline, because
a batch rebuild of `term` drops the table while other rows still point at it. The downgrade does
need that rebuild, so on SQLite it only works while no row references a term; the downgrade
with data is verified on PostgreSQL (`tests/test_migrations_postgresql.py`).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_term_hierarchy"
down_revision: str | None = "0002_loans_and_exhibitions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    if _is_sqlite():
        op.execute(
            "ALTER TABLE term ADD COLUMN parent_id CHAR(32) "
            "CONSTRAINT fk_term_parent_id_term REFERENCES term (id)"
        )
    else:
        op.add_column("term", sa.Column("parent_id", sa.Uuid(), nullable=True))
        op.create_foreign_key(op.f("fk_term_parent_id_term"), "term", "term", ["parent_id"], ["id"])
    op.create_index(op.f("ix_term_parent_id"), "term", ["parent_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_term_parent_id"), table_name="term")
    if _is_sqlite():
        # The rebuilt table has no parent_id, so its inline foreign key goes with it.
        with op.batch_alter_table("term") as batch_op:
            batch_op.drop_column("parent_id")
        return
    op.drop_constraint(op.f("fk_term_parent_id_term"), "term", type_="foreignkey")
    op.drop_column("term", "parent_id")
