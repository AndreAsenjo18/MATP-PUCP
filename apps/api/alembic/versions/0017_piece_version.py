"""Version of the piece sheet for optimistic concurrency.

Revision ID: 0017_piece_version
Revises: 0016_export_job_kind_check
Create Date: 2026-10-25

Change de OpenSpec: ficha-pieza-crud (tarea 1.1, design D2). Additive only: `piece.version`
starts at 1 for every existing piece and SQLAlchemy increments it on each update
(`version_id_col`); the PUT of the sheet requires it in `If-Match`.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_piece_version"
down_revision: str | None = "0016_export_job_kind_check"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("piece", sa.Column("version", sa.Integer(), server_default="1", nullable=False))


def downgrade() -> None:
    op.drop_column("piece", "version")
