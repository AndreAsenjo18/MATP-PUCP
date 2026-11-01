"""Batches of quality observations: `import_batch.kind` gains `OBSERVATIONS`.

Revision ID: 0022_observation_batches
Revises: 0021_source_sensitive_keys
Create Date: 2026-11-01

Change de OpenSpec: formatos-reales-importacion (tarea 6.2; design D8). The sheets «Errores
identificados» and «Errores pendientes» of the 2024/25 consultancy are loaded as observations of
the pieces they identify, never as pieces. The enum is a VARCHAR with a named CHECK, so the CHECK
is replaced (as in 0016 and 0019). No data to migrate.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0022_observation_batches"
down_revision: str | None = "0021_source_sensitive_keys"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KIND_CHECK = "ck_import_batch_import_batch_kind"
OLD_KINDS = ("SPREADSHEET", "PHOTOS")
NEW_KINDS = (*OLD_KINDS, "OBSERVATIONS")


def _condition(kinds: Sequence[str]) -> str:
    return "kind IN ({})".format(", ".join(f"'{kind}'" for kind in kinds))


def _replace_check(kinds: Sequence[str]) -> None:
    with op.batch_alter_table("import_batch") as batch_op:
        batch_op.drop_constraint(op.f(KIND_CHECK), type_="check")
        batch_op.create_check_constraint(op.f(KIND_CHECK), _condition(kinds))


def upgrade() -> None:
    _replace_check(NEW_KINDS)


def downgrade() -> None:
    # Observation batches written meanwhile would block the old CHECK, as they should.
    _replace_check(OLD_KINDS)
