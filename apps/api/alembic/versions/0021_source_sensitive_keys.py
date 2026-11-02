"""Sensitive keys of the source data of a piece (personal data of the owner).

Revision ID: 0021_source_sensitive_keys
Revises: 0020_real_absence_markers
Create Date: 2026-10-31

Change de OpenSpec: formatos-reales-importacion (tarea 6.1, design D6). Additive only: the keys of
``piece_source_record.payload`` with personal data of the owner, shown only with
``sensitive.donor_data`` (RF-041, RNF-014). The table is append-only: its trigger rejects updates
and deletes of rows, not a new nullable column.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_source_sensitive_keys"
down_revision: str | None = "0020_real_absence_markers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
    op.add_column("piece_source_record", sa.Column("sensitive_keys", json_type, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("piece_source_record") as batch_op:
        batch_op.drop_column("sensitive_keys")
