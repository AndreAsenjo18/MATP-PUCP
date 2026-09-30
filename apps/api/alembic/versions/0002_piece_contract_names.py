"""Piece columns take the names of the team's interface contract.

Revision ID: 0002_piece_contract_names
Revises: 0001_core_data_model
Create Date: 2026-09-29

Change de OpenSpec: alinear-api-endpoints-v1 (tarea 2.1, decisión C4 de design.md).
Renames `title` -> `denomination`, `period_*` -> `epoch_*` and the category and conservation
state references, with their indexes and constraints. There is no `piece.code_i` column: the
code I stays in `piece_identifier` and the API derives it (D4).

Column renames keep the data and, on both PostgreSQL and SQLite (3.25+), update the indexes
and CHECK expressions that use the column. PostgreSQL also renames indexes and constraints.
SQLite cannot rename them, so its plain indexes are recreated and its constraints keep their
original names (behavior is unchanged; SQLite is only used by the test suite).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_piece_contract_names"
down_revision: str | None = "0001_core_data_model"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = (
    ("title", "denomination"),
    ("period_text", "epoch_original_text"),
    ("period_type", "epoch_type"),
    ("period_from", "epoch_start_year"),
    ("period_to", "epoch_end_year"),
    ("category_term_id", "category_id"),
    ("conservation_status_term_id", "conservation_state_id"),
)

# (old name, new name, columns) of the plain indexes, recreated on SQLite.
INDEXES = (
    ("ix_piece_title", "ix_piece_denomination", ["denomination"]),
    ("ix_piece_category_term_id", "ix_piece_category_id", ["category_id"]),
)

POSTGRES_INDEXES = (("ix_piece_title_trgm", "ix_piece_denomination_trgm"),)

POSTGRES_CONSTRAINTS = (
    ("ck_piece_period_range", "ck_piece_epoch_range"),
    ("ck_piece_period_type", "ck_piece_epoch_type"),
    ("fk_piece_category_term_id_term", "fk_piece_category_id_term"),
    ("fk_piece_conservation_status_term_id_term", "fk_piece_conservation_state_id_term"),
)


def _rename(*, reverse: bool) -> None:
    def pairs(items):  # type: ignore[no-untyped-def]
        return [(new, old) if reverse else (old, new) for old, new in items]

    for old, new in pairs(COLUMNS):
        op.execute(f"ALTER TABLE piece RENAME COLUMN {old} TO {new}")

    if op.get_bind().dialect.name == "postgresql":
        for old, new in pairs((old, new) for old, new, _ in INDEXES):
            op.execute(f"ALTER INDEX {old} RENAME TO {new}")
        for old, new in pairs(POSTGRES_INDEXES):
            op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")
        for old, new in pairs(POSTGRES_CONSTRAINTS):
            op.execute(f"ALTER TABLE piece RENAME CONSTRAINT {old} TO {new}")
        return

    columns = dict(pairs(COLUMNS))
    for old_index, new_index, new_columns in INDEXES:
        if reverse:
            old_index, new_index = new_index, old_index
            new_columns = [columns[column] for column in new_columns]
        op.drop_index(old_index, table_name="piece")
        op.create_index(new_index, "piece", new_columns, unique=False)


def upgrade() -> None:
    _rename(reverse=False)


def downgrade() -> None:
    _rename(reverse=True)
