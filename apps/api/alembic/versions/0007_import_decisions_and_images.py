"""Import decisions, application change set and images embedded in the workbook.

Revision ID: 0007_import_decisions_and_images
Revises: 06fcd85b7c46
Create Date: 2026-10-21

Change de OpenSpec: importacion-pipeline-reconciliacion (tareas 4.1, 4.2 y 5.1; design D5, D6
y D8). Additive only:
- `import_row.resolution`: human resolution of a row (target piece or new, field decisions);
- `import_batch.change_set_id`: change set shared by every catalog change of the application;
- `import_image`: images extracted from the workbook, pending explicit association.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_import_decisions_and_images"
down_revision: str | None = "06fcd85b7c46"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column("import_row", sa.Column("resolution", _json(), nullable=True))
    op.add_column("import_batch", sa.Column("change_set_id", sa.Uuid(), nullable=True))
    op.create_table(
        "import_image",
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("image_number", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("anchor_row_number", sa.Integer(), nullable=True),
        sa.Column("import_row_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ASSOCIATED",
                name="import_image_status",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("media_asset_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["import_batch.id"], name=op.f("fk_import_image_batch_id_import_batch")
        ),
        sa.ForeignKeyConstraint(
            ["import_row_id"],
            ["import_row.id"],
            name=op.f("fk_import_image_import_row_id_import_row"),
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_asset.id"],
            name=op.f("fk_import_image_media_asset_id_media_asset"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_image")),
        sa.UniqueConstraint(
            "batch_id", "image_number", name=op.f("uq_import_image_batch_id_image_number")
        ),
    )
    op.create_index(op.f("ix_import_image_batch_id"), "import_image", ["batch_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_import_image_batch_id"), table_name="import_image")
    op.drop_table("import_image")
    with op.batch_alter_table("import_batch") as batch_op:
        batch_op.drop_column("change_set_id")
    with op.batch_alter_table("import_row") as batch_op:
        batch_op.drop_column("resolution")
