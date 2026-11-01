"""Absence markers of the museum's real files: «No presenta» and «No registra».

Revision ID: 0020_real_absence_markers
Revises: 0019_photo_batches
Create Date: 2026-10-31

Change de OpenSpec: formatos-reales-importacion (tarea 4.1, design D5). Data only: the active
``absence_markers`` row of ``normalization_setting``, if any, gains the markers the real files use
(«No presenta» ≈ 74 000 cells, «No registra»), compared without spaces as N1 does. The markers an
administrator added or removed are kept. Downgrade removes only these two.

When ``importacion-fotos-a-catalogo`` (``0019_photo_batches``) reaches ``main`` first, this
migration must revise ``0019_photo_batches`` (``test_migration_history_has_a_single_head``).
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0020_real_absence_markers"
down_revision: str | None = "0019_photo_batches"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KEY = "absence_markers"
NEW_MARKERS = ("NOPRESENTA", "NOREGISTRA")


def _table() -> sa.Table:
    return sa.table(
        "normalization_setting",
        sa.column("id", sa.Uuid()),
        sa.column("key", sa.String()),
        sa.column("value", sa.JSON()),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
    )


def _change(add: bool) -> None:
    if context.is_offline_mode():
        markers = json.dumps(list(NEW_MARKERS))
        if add:
            expression = (
                "(SELECT jsonb_agg(DISTINCT m) FROM jsonb_array_elements_text("
                f"value || '{markers}'::jsonb) AS m)"
            )
        else:
            expression = (
                "COALESCE((SELECT jsonb_agg(m) FROM jsonb_array_elements_text(value) AS m "
                f"WHERE NOT ('{markers}'::jsonb ? m)), '[]'::jsonb)"
            )
        op.execute(
            f"UPDATE normalization_setting SET value = {expression} "
            f"WHERE key = '{KEY}' AND deleted_at IS NULL"
        )
        return
    table = _table()
    bind = op.get_bind()
    for setting_id, value in bind.execute(
        sa.select(table.c.id, table.c.value).where(
            table.c.key == KEY, table.c.deleted_at.is_(None)
        )
    ):
        current = json.loads(value) if isinstance(value, str) else list(value or [])
        if add:
            updated = current + [marker for marker in NEW_MARKERS if marker not in current]
        else:
            updated = [marker for marker in current if marker not in NEW_MARKERS]
        if updated != current:
            bind.execute(table.update().where(table.c.id == setting_id).values(value=updated))


def upgrade() -> None:
    _change(add=True)


def downgrade() -> None:
    _change(add=False)
