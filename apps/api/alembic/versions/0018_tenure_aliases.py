"""Acquisition method → tenure regime correspondences as a normalization parameter.

Revision ID: 0018_tenure_aliases
Revises: 0017_piece_version
Create Date: 2026-10-31

Change de OpenSpec: ajustes-lectura-importacion (tarea 1.2, design D1). Data only: a
`normalization_setting` row with key `tenure_aliases` and, as value, the correspondences from a
folded label (lowercase, without accents, spaces collapsed) to a tenure regime code. The museum
confirmed that «Cesión de uso» and «Custodia» are comodato (L5, 2026-10-31); the owned ones are
[SUPUESTO]. Copied here so the migration does not change if the code changes
(`tests/test_import_tenure_aliases.py` checks they match `DEFAULT_TENURE_ALIASES`).

The row is inserted with SQL, without the ORM: like the rows of 0013 it creates no `audit_log`
entry. An active row with that key, if any, is kept. Downgrade removes only the row this
migration inserted (its data did not exist before).
"""

import base64
import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import context, op

revision: str = "0018_tenure_aliases"
down_revision: str | None = "0017_piece_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KEY = "tenure_aliases"
TENURE_ALIASES = {
    "propiedad": "OWNED",
    "propio": "OWNED",
    "donacion": "OWNED",
    "compra": "OWNED",
    "legado": "OWNED",
    "transferencia interna": "OWNED",
    "comodato": "LOAN_FOR_USE",
    "cesion de uso": "LOAN_FOR_USE",
    "custodia": "LOAN_FOR_USE",
    "prestamo temporal": "TEMPORARY_LOAN",
}
# Marks the row of this migration, so downgrade never touches a row an administrator created.
MIGRATION_ID = uuid.UUID("5f0c2a8e-18a1-4c6e-9b3d-0018aa0018aa")


def upgrade() -> None:
    if context.is_offline_mode():
        if op.get_context().dialect.name != "postgresql":
            raise NotImplementedError("El SQL sin conexión de esta migración es solo para PostgreSQL.")
        encoded = base64.b64encode(json.dumps(TENURE_ALIASES, ensure_ascii=False).encode()).decode()
        op.execute(
            "INSERT INTO normalization_setting (id, key, value, created_at, updated_at) "
            f"SELECT '{MIGRATION_ID}', '{KEY}', "
            f"convert_from(decode('{encoded}', 'base64'), 'UTF8')::jsonb, now(), now() "
            "WHERE NOT EXISTS (SELECT 1 FROM normalization_setting "
            f"WHERE key = '{KEY}' AND deleted_at IS NULL)"
        )
        return
    setting = sa.table(
        "normalization_setting",
        sa.column("id", sa.Uuid()),
        sa.column("key", sa.String()),
        sa.column("value", sa.JSON()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
    )
    exists = op.get_bind().scalar(
        sa.select(sa.func.count())
        .select_from(setting)
        .where(setting.c.key == KEY, setting.c.deleted_at.is_(None))
    )
    if exists:
        return
    now = datetime.now(UTC)
    op.bulk_insert(
        setting,
        [
            {
                "id": MIGRATION_ID,
                "key": KEY,
                "value": TENURE_ALIASES,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )


def downgrade() -> None:
    if context.is_offline_mode():
        op.execute(f"DELETE FROM normalization_setting WHERE id = '{MIGRATION_ID}'")
        return
    setting = sa.table("normalization_setting", sa.column("id", sa.Uuid()))
    op.execute(setting.delete().where(setting.c.id == MIGRATION_ID))
