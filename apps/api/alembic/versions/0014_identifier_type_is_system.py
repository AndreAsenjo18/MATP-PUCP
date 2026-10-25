"""System identifier types.

Revision ID: 0014_identifier_type_is_system
Revises: 0013_normalization_params
Create Date: 2026-10-25

Change de OpenSpec: colecciones-y-vocabularios-admin (tarea 1.1, design D1). Additive only:
`identifier_type.is_system` marks the types whose code and structural rules (lock on
assignment, owned pieces only, unique when current, allowed for temporary loans) cannot be
changed through the API (RN-002, RN-003). The seeded `I` and `COLECCION` types are system types.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_identifier_type_is_system"
down_revision: str | None = "0013_normalization_params"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM_TYPES = ("I", "COLECCION")


def upgrade() -> None:
    # The server default fills the types seeded before this change; the model keeps its own
    # default in Python, like `app_user.must_change_password` (0006).
    op.add_column(
        "identifier_type",
        sa.Column("is_system", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    identifier_type = sa.table(
        "identifier_type", sa.column("code", sa.String()), sa.column("is_system", sa.Boolean())
    )
    op.execute(
        identifier_type.update()
        .where(identifier_type.c.code.in_(SYSTEM_TYPES))
        .values(is_system=True)
    )


def downgrade() -> None:
    op.drop_column("identifier_type", "is_system")
