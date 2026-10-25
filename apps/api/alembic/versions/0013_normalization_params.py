"""Normalization parameters and collection acronym aliases as data.

Revision ID: 0013_normalization_params
Revises: 0012_completeness_rules
Create Date: 2026-10-24

Change de OpenSpec: plantillas-mapeo-y-normalizacion (tarea 2.1, design D5). Additive only:
- `normalization_setting`: parámetro de normalización por clave, con valor JSON; borrado lógico
  y auditado como cualquier otra entidad. La clave es única entre los parámetros activos.
- `collection_acronym_alias`: otra sigla de una colección (alias normalizado → colección), única
  entre los alias activos; borrado lógico y auditado. Empieza vacía: ningún alias se supone.

Valores iniciales: los de las constantes de `app/modules/identification/normalization.py` al
crear esta migración, copiados aquí para que la migración no cambie si el código cambia
(`tests/test_migrations_normalization_params.py` comprueba que coinciden):
- `absence_markers`: el contenido completo de `ABSENCE_MARKERS` (N2) [SUPUESTO A5].
- `concatenation_separators`: los separadores de `_SPLIT_RE` (N7) y los marcadores que no se
  separan aunque lleven `/` (`S/N`, `S/C`) [SUPUESTO A8].
Se insertan con SQL, sin pasar por el ORM: como el esquema, no generan entradas en `audit_log`.
"""

import base64
import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import SchemaItem

revision: str = "0013_normalization_params"
down_revision: str | None = "0012_completeness_rules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ABSENCE_MARKERS = [
    "",
    "-",
    "--",
    "---",
    "0",
    "N/A",
    "NA",
    "S.C.",
    "S.N.",
    "S/C",
    "S/N",
    "SC",
    "SINCODIGO",
    "SINCÓDIGO",
    "SINNUMERO",
    "SINNÚMERO",
    "SN",
    "—",
]
CONCATENATION_SEPARATORS = {
    "separators": ["/", ";", "|", ",", "\n", "\r"],
    "unsplit_markers": ["S/N", "S/C"],
}

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _soft_delete_columns(table: str) -> list[SchemaItem]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["deleted_by_id"], ["app_user.id"], name=op.f(f"fk_{table}_deleted_by_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{table}")),
    ]


def upgrade() -> None:
    setting = op.create_table(
        "normalization_setting",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("value", JSON, nullable=False),
        *_soft_delete_columns("normalization_setting"),
    )
    op.create_index(
        op.f("ix_normalization_setting_deleted_at"), "normalization_setting", ["deleted_at"]
    )
    op.create_index(
        "uq_normalization_setting_key_active",
        "normalization_setting",
        ["key"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "collection_acronym_alias",
        sa.Column("alias", sa.String(length=40), nullable=False),
        sa.Column("alias_normalized", sa.String(length=40), nullable=False),
        sa.Column("collection_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["collection_id"],
            ["collection.id"],
            name=op.f("fk_collection_acronym_alias_collection_id_collection"),
        ),
        *_soft_delete_columns("collection_acronym_alias"),
    )
    op.create_index(
        op.f("ix_collection_acronym_alias_collection_id"),
        "collection_acronym_alias",
        ["collection_id"],
    )
    op.create_index(
        op.f("ix_collection_acronym_alias_deleted_at"), "collection_acronym_alias", ["deleted_at"]
    )
    op.create_index(
        "uq_collection_acronym_alias_active",
        "collection_acronym_alias",
        ["alias_normalized"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    initial = (
        ("absence_markers", ABSENCE_MARKERS),
        ("concatenation_separators", CONCATENATION_SEPARATORS),
    )
    if context.is_offline_mode():
        _insert_offline(initial)
        return
    now = datetime.now(UTC)
    op.bulk_insert(
        setting,
        [
            {"id": uuid.uuid4(), "key": key, "value": value, "created_at": now, "updated_at": now}
            for key, value in initial
        ],
    )


def _insert_offline(initial: Sequence[tuple[str, object]]) -> None:
    """``alembic upgrade --sql``: SQLAlchemy cannot render a JSON literal, and a text literal
    would double the backslashes of ``\\n`` and ``\\r`` (wrong with PostgreSQL's
    ``standard_conforming_strings``), so the JSON travels as base64 of its UTF-8 bytes."""
    if op.get_context().dialect.name != "postgresql":
        raise NotImplementedError("El SQL sin conexión de esta migración es solo para PostgreSQL.")
    for key, value in initial:
        encoded = base64.b64encode(json.dumps(value, ensure_ascii=False).encode()).decode()
        op.execute(
            "INSERT INTO normalization_setting (id, key, value, created_at, updated_at) "
            f"VALUES ('{uuid.uuid4()}', '{key}', "
            f"convert_from(decode('{encoded}', 'base64'), 'UTF8')::jsonb, now(), now())"
        )


def downgrade() -> None:
    op.drop_index("uq_collection_acronym_alias_active", table_name="collection_acronym_alias")
    op.drop_index(
        op.f("ix_collection_acronym_alias_deleted_at"), table_name="collection_acronym_alias"
    )
    op.drop_index(
        op.f("ix_collection_acronym_alias_collection_id"), table_name="collection_acronym_alias"
    )
    op.drop_table("collection_acronym_alias")
    op.drop_index("uq_normalization_setting_key_active", table_name="normalization_setting")
    op.drop_index(op.f("ix_normalization_setting_deleted_at"), table_name="normalization_setting")
    op.drop_table("normalization_setting")
