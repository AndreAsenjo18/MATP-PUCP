"""Import batches record the chosen sheet, the header row, the column mapping and the
background stage heartbeat.

Revision ID: 0005_import_batch_processing
Revises: 0004_duplicate_detection
Create Date: 2026-10-16

Change de OpenSpec: importacion-pipeline-reconciliacion (tareas 1.1 y 3.1, decisiones D1 a D3).
Additive: five nullable columns on `import_batch`, so existing batches keep working.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_import_batch_processing"
down_revision: str | None = "0004_duplicate_detection"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = ("sheet_name", "header_row", "processing_started_at", "heartbeat_at", "mapping")


def upgrade() -> None:
    op.add_column("import_batch", sa.Column("sheet_name", sa.String(length=200), nullable=True))
    op.add_column("import_batch", sa.Column("header_row", sa.Integer(), nullable=True))
    op.add_column(
        "import_batch",
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "import_batch", sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "import_batch",
        sa.Column(
            "mapping",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    with op.batch_alter_table("import_batch") as batch_op:
        for column in reversed(COLUMNS):
            batch_op.drop_column(column)
