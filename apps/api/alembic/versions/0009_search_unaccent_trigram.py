"""Search unaccent extension, immutable_unaccent function and functional GIN trigram indexes.

Revision ID: 0009_search_unaccent_trigram
Revises: 0008_locations_idempotency
Create Date: 2026-10-22

Change de OpenSpec: busqueda-avanzada-y-exportacion (tarea 1.3, RF-031).
- Habilita la extension `unaccent` en PostgreSQL (detectando permisos de superusuario).
- Crea la funcion SQL `immutable_unaccent(text)` para permitir indices funcionales en PostgreSQL.
- Crea indices funcionales GIN trigram sobre `denomination`, `author` y `provenance` para acelerar
  busquedas insensibles a mayusculas y acentos.
- En SQLite no aplica DDL (las funciones equivalentes se registran en Python en app/core/db.py).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009_search_unaccent_trigram"
down_revision: str | None = "0008_locations_idempotency"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    except Exception as exc:
        msg = str(exc).lower()
        if (
            "permission denied" in msg
            or "superuser" in msg
            or "insufficient_privilege" in msg
            or getattr(exc, "pgcode", None) == "42501"
        ):
            raise RuntimeError(
                "La extension PostgreSQL 'unaccent' requiere permisos de superusuario "
                "o de administracion en la base de datos. Por favor solicite al administrador "
                "ejecutar: CREATE EXTENSION IF NOT EXISTS unaccent;"
            ) from exc
        raise

    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS 'SELECT public.unaccent($1)';
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_piece_denomination_unaccent_trgm "
        "ON piece USING gin (immutable_unaccent(lower(denomination)) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_piece_author_unaccent_trgm "
        "ON piece USING gin (immutable_unaccent(lower(author)) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_piece_provenance_unaccent_trgm "
        "ON piece USING gin (immutable_unaccent(lower(provenance)) gin_trgm_ops)"
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS ix_piece_provenance_unaccent_trgm")
    op.execute("DROP INDEX IF EXISTS ix_piece_author_unaccent_trgm")
    op.execute("DROP INDEX IF EXISTS ix_piece_denomination_unaccent_trgm")
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text)")
