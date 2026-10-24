"""Photos of an import batch (``import_photo``).

Revision ID: 0011_import_photos
Revises: 0006_audit_digest
Create Date: 2026-10-22

Change de OpenSpec: importacion-masiva-fotografias (tarea 1.2; design D1). Additive only: the
``import_photo`` table holds the photos added to a batch until it is applied. The unique
``(batch_id, content_sha256)`` lets an interrupted upload resume without registering the same
photo twice in the batch.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_import_photos"
down_revision: str | None = "0006_audit_digest"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=40)


def upgrade() -> None:
    op.create_table(
        "import_photo",
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("relative_path", sa.String(length=1000), nullable=False),
        sa.Column("original_filename", sa.String(length=300), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("storage_prefix", sa.String(length=500), nullable=False),
        sa.Column(
            "status",
            _enum(
                "import_photo_status",
                "PENDING_UPLOAD",
                "UPLOADED",
                "VERIFIED",
                "REJECTED",
                "DISCARDED",
                "APPLIED",
            ),
            nullable=False,
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("row_id", sa.Uuid(), nullable=True),
        sa.Column(
            "match_status",
            _enum("photo_match_status", "MATCHED", "AMBIGUOUS", "UNMATCHED", "MANUAL"),
            nullable=True,
        ),
        sa.Column(
            "match_source",
            _enum("photo_match_source", "FILENAME", "FOLDER", "COLUMN", "MANUAL", "EMBEDDED"),
            nullable=True,
        ),
        sa.Column("candidate_row_ids", _json(), nullable=True),
        sa.Column("sort_key", sa.Integer(), nullable=True),
        sa.Column("duplicate_of_existing", sa.Boolean(), nullable=False),
        sa.Column("duplicate_confirmed", sa.Boolean(), nullable=False),
        sa.Column("media_asset_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["import_batch.id"], name=op.f("fk_import_photo_batch_id_import_batch")
        ),
        sa.ForeignKeyConstraint(
            ["row_id"], ["import_row.id"], name=op.f("fk_import_photo_row_id_import_row")
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_asset.id"],
            name=op.f("fk_import_photo_media_asset_id_media_asset"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_photo")),
        sa.UniqueConstraint(
            "batch_id", "content_sha256", name=op.f("uq_import_photo_batch_id_content_sha256")
        ),
    )


def downgrade() -> None:
    op.drop_table("import_photo")
