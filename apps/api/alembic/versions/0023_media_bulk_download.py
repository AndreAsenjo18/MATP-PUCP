"""Photo packages of several pieces (``media_bulk_download``).

Revision ID: 0023_media_bulk_download
Revises: 0021_source_sensitive_keys
Create Date: 2026-10-31

Change de OpenSpec: descargas-masivas-y-enriquecimiento-lote (tarea 2.1; design D1 and D2).
Additive only: one row per requested package, with its state, the pieces asked for, the photos
left out by their restriction and the ZIP in the object storage. An expired package keeps its
row; only its file stops being served.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0023_media_bulk_download"
down_revision: str | None = "0021_source_sensitive_keys"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "media_bulk_download",
        sa.Column("requested_by_id", sa.Uuid(), nullable=False),
        sa.Column("piece_ids", _json(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "RUNNING",
                "READY",
                "FAILED",
                name="media_bulk_download_status",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("included_photos", sa.Integer(), nullable=True),
        sa.Column("omitted", _json(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["deleted_by_id"],
            ["app_user.id"],
            name=op.f("fk_media_bulk_download_deleted_by_id_app_user"),
        ),
        sa.ForeignKeyConstraint(
            ["requested_by_id"],
            ["app_user.id"],
            name=op.f("fk_media_bulk_download_requested_by_id_app_user"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_bulk_download")),
    )
    op.create_index(
        op.f("ix_media_bulk_download_deleted_at"), "media_bulk_download", ["deleted_at"]
    )
    op.create_index(
        op.f("ix_media_bulk_download_requested_by_id"), "media_bulk_download", ["requested_by_id"]
    )
    op.create_index(op.f("ix_media_bulk_download_status"), "media_bulk_download", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_media_bulk_download_status"), table_name="media_bulk_download")
    op.drop_index(op.f("ix_media_bulk_download_requested_by_id"), table_name="media_bulk_download")
    op.drop_index(op.f("ix_media_bulk_download_deleted_at"), table_name="media_bulk_download")
    op.drop_table("media_bulk_download")
