"""Photo-only import batches matched with pieces of the catalogue.

Revision ID: 0019_photo_batches
Revises: 0018_tenure_aliases
Create Date: 2026-10-31

Change de OpenSpec: importacion-fotos-a-catalogo (tarea 1.2; design D1, D2, D3). Additive only:
- `import_batch.kind` (`SPREADSHEET` for every existing batch | `PHOTOS`) and `photo_reading`, the
  reading rules of the file names by folder (D4) and the correspondences list (D7).
- `import_photo`: proposed or assigned piece (`piece_id`, `candidate_piece_ids`, `match_reason`),
  size and dHash (D6) and `same_as_photo_id`; a CHECK keeps a photo on a row **or** on a piece.
- `photo_match_source` gains `TEMPLATE` and `LIST`: the enums are VARCHAR with a named CHECK, so
  the CHECK is replaced (as in 0016).
- `normalization_setting` row `photo_camera_patterns` with an empty list: the extra camera name
  patterns an administrator may add (D3). Inserted with SQL, without the ORM, like the rows of
  0013 and 0018; downgrade removes only the row this migration inserted.
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision: str = "0019_photo_batches"
down_revision: str | None = "0018_tenure_aliases"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCE_CHECK = "ck_import_photo_photo_match_source"
OLD_SOURCES = ("FILENAME", "FOLDER", "COLUMN", "MANUAL", "EMBEDDED")
NEW_SOURCES = (*OLD_SOURCES, "TEMPLATE", "LIST")
KEY = "photo_camera_patterns"
# Marks the row of this migration, so downgrade never touches a row an administrator created.
MIGRATION_ID = uuid.UUID("7a1d3b9f-19b2-4d7f-8c4e-0019bb0019bb")


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _sources(values: Sequence[str]) -> str:
    return "match_source IN ({})".format(", ".join(f"'{value}'" for value in values))


def upgrade() -> None:
    with op.batch_alter_table("import_batch") as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                sa.Enum(
                    "SPREADSHEET",
                    "PHOTOS",
                    name="import_batch_kind",
                    native_enum=False,
                    create_constraint=True,
                    length=40,
                ),
                server_default="SPREADSHEET",
                nullable=False,
            )
        )
        batch_op.add_column(sa.Column("photo_reading", _json(), nullable=True))

    with op.batch_alter_table("import_photo") as batch_op:
        batch_op.add_column(sa.Column("piece_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("candidate_piece_ids", _json(), nullable=True))
        batch_op.add_column(sa.Column("match_reason", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("width_px", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("height_px", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("perceptual_hash", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("same_as_photo_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            op.f("fk_import_photo_piece_id_piece"), "piece", ["piece_id"], ["id"]
        )
        batch_op.create_foreign_key(
            op.f("fk_import_photo_same_as_photo_id_import_photo"),
            "import_photo",
            ["same_as_photo_id"],
            ["id"],
        )
        batch_op.create_check_constraint(
            op.f("ck_import_photo_row_or_piece"), "row_id IS NULL OR piece_id IS NULL"
        )
        batch_op.drop_constraint(op.f(SOURCE_CHECK), type_="check")
        batch_op.create_check_constraint(op.f(SOURCE_CHECK), _sources(NEW_SOURCES))

    _insert_setting()


def _insert_setting() -> None:
    if context.is_offline_mode():
        op.execute(
            "INSERT INTO normalization_setting (id, key, value, created_at, updated_at) "
            f"SELECT '{MIGRATION_ID}', '{KEY}', '[]', now(), now() "
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
        [{"id": MIGRATION_ID, "key": KEY, "value": [], "created_at": now, "updated_at": now}],
    )


def downgrade() -> None:
    setting = sa.table("normalization_setting", sa.column("id", sa.Uuid()))
    op.execute(setting.delete().where(setting.c.id == MIGRATION_ID))

    # Rows written with the new sources or on a piece would block the old CHECK, as they should.
    with op.batch_alter_table("import_photo") as batch_op:
        batch_op.drop_constraint(op.f(SOURCE_CHECK), type_="check")
        batch_op.create_check_constraint(op.f(SOURCE_CHECK), _sources(OLD_SOURCES))
        batch_op.drop_constraint(op.f("ck_import_photo_row_or_piece"), type_="check")
        batch_op.drop_constraint(
            op.f("fk_import_photo_same_as_photo_id_import_photo"), type_="foreignkey"
        )
        batch_op.drop_constraint(op.f("fk_import_photo_piece_id_piece"), type_="foreignkey")
        batch_op.drop_column("same_as_photo_id")
        batch_op.drop_column("perceptual_hash")
        batch_op.drop_column("height_px")
        batch_op.drop_column("width_px")
        batch_op.drop_column("match_reason")
        batch_op.drop_column("candidate_piece_ids")
        batch_op.drop_column("piece_id")

    with op.batch_alter_table("import_batch") as batch_op:
        batch_op.drop_column("photo_reading")
        batch_op.drop_constraint(op.f("ck_import_batch_import_batch_kind"), type_="check")
        batch_op.drop_column("kind")
