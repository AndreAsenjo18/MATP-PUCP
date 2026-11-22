"""Vacía el catálogo de un ambiente de pruebas, conservando las personas y las listas.

Pedido del equipo (2026-11-21): dejar el ambiente sin piezas, colecciones, ubicaciones, cargas,
pendientes ni bitácora antes de cargar los datos del museo. Se conservan:

- las personas: usuarios, roles, permisos y sesiones;
- las listas y los tipos de código: vocabularios con sus términos, tipos de identificador y los
  ajustes de normalización;
- la configuración del sistema: reglas de completitud, ajustes de calidad y la versión de la base.

Las plantillas de importación se vacían: la API las vuelve a crear al arrancar.

NO es parte de la aplicación y no se usa con datos reales del museo: vacía tablas que el sistema
protege contra el borrado (RN-005). Por eso:

- sin ``--apply`` solo cuenta lo que borraría, y no toca nada;
- con ``--apply`` exige ``--base <nombre de la base>``, el de la base a la que está conectado;
- se detiene si encuentra una tabla que no conoce, o si una tabla que se conserva apunta a una que
  se vacía (para no borrar nada por arrastre);
- vacía todo en una sola transacción: o se vacía todo, o nada;
- las tablas de solo inserción (bitácora, movimientos…) tienen disparadores que impiden vaciarlas:
  se desactivan solo dentro de esa transacción y se vuelven a activar antes de confirmarla, así que
  al terminar, o si algo falla, la protección sigue igual que antes.

Uso, dentro del contenedor de la API (lee ``DATABASE_URL`` de su entorno), **después de un respaldo**:

    docker compose exec -T api python - < scripts/mantenimiento/vaciar-catalogo.py
    docker compose exec -T api python - --apply --base <nombre> < scripts/mantenimiento/vaciar-catalogo.py

Después, reinicie la API para que vuelva a crear las plantillas de importación.
"""

import argparse
import os
import sys

from sqlalchemy import create_engine, text

#: Se conservan: personas, listas y tipos de código, y configuración.
KEEP = {
    "alembic_version",
    "app_user",
    "role",
    "permission",
    "role_permission",
    "user_role",
    "user_session",
    "identifier_type",
    "vocabulary",
    "term",
    "normalization_setting",
    "completeness_rule",
    "quality_setting",
}

#: Se vacían: el catálogo y todo lo que cuelga de él.
WIPE = {
    "piece",
    "piece_identifier",
    "piece_material",
    "piece_movement",
    "piece_source_record",
    "piece_valuation",
    "conservation_assessment",
    "media_asset",
    "media_bulk_download",
    "collection",
    "collection_acronym_alias",
    "location",
    "loan",
    "loan_item",
    "import_batch",
    "import_row",
    "import_image",
    "import_photo",
    "import_mapping_template",
    "duplicate_candidate",
    "duplicate_ai_verdict",
    "ai_suggestion",
    "export_job",
    "quality_job",
    "quality_job_item",
    "completeness_snapshot",
    "audit_log",
    "audit_digest",
    "auth_event",
    "sensitive_access_log",
    "idempotency_key",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Vacía el catálogo de un ambiente de pruebas.")
    parser.add_argument("--apply", action="store_true", help="Vaciar de verdad.")
    parser.add_argument("--base", help="Nombre de la base a la que está conectado (con --apply).")
    args = parser.parse_args()

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Falta DATABASE_URL: corra el script dentro del contenedor de la API.", file=sys.stderr)
        return 2
    engine = create_engine(url)
    with engine.connect() as conn:
        database = conn.execute(text("select current_database()")).scalar_one()
        tables = set(
            conn.execute(
                text(
                    "select table_name from information_schema.tables "
                    "where table_schema = 'public' and table_type = 'BASE TABLE'"
                )
            ).scalars()
        )
        unknown = sorted(tables - KEEP - WIPE)
        if unknown:
            print(f"Tablas que el script no conoce: {', '.join(unknown)}.", file=sys.stderr)
            print("No se borró nada. Agréguelas a KEEP o a WIPE y vuelva a correrlo.", file=sys.stderr)
            return 3
        wipe = sorted(tables & WIPE)
        # A kept table that points to a wiped one would be emptied by the cascade, or would block.
        dragged = conn.execute(
            text(
                "select distinct tc.table_name, ccu.table_name "
                "from information_schema.table_constraints tc "
                "join information_schema.constraint_column_usage ccu "
                "  on ccu.constraint_name = tc.constraint_name "
                " and ccu.constraint_schema = tc.constraint_schema "
                "where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'"
            )
        ).all()
        blocking = sorted({(src, dst) for src, dst in dragged if src in KEEP and dst in WIPE})
        if blocking:
            for src, dst in blocking:
                print(f"La tabla que se conserva «{src}» apunta a «{dst}», que se vaciaría.", file=sys.stderr)
            print("No se borró nada.", file=sys.stderr)
            return 4

        print(f"Base: {database}")
        print("Se vaciarían (filas):")
        total = 0
        for table in wipe:
            count = conn.execute(text(f'select count(*) from "{table}"')).scalar_one()
            total += count
            print(f"  {table:<28} {count:>8}")
        print(f"  {'total':<28} {total:>8}")
        print("Se conservan (filas):")
        for table in sorted(tables & KEEP):
            count = conn.execute(text(f'select count(*) from "{table}"')).scalar_one()
            print(f"  {table:<28} {count:>8}")

    if not args.apply:
        print("\nNo se borró nada (ensayo). Para vaciar, después del respaldo:")
        print(f"  ... python - --apply --base {database} < scripts/mantenimiento/vaciar-catalogo.py")
        return 0
    if args.base != database:
        print(f"\n--base debe ser «{database}», la base conectada. No se borró nada.", file=sys.stderr)
        return 5

    with engine.begin() as conn:
        # The append-only tables refuse TRUNCATE too (RN-005). Their own triggers are turned off
        # only inside this transaction and on again before it commits: an exception for emptying a
        # test environment, asked by the team.
        guarded = sorted(
            conn.execute(
                text(
                    "select distinct c.relname from pg_trigger t "
                    "join pg_class c on c.oid = t.tgrelid "
                    "join pg_namespace n on n.oid = c.relnamespace "
                    "where n.nspname = 'public' and not t.tgisinternal"
                )
            ).scalars()
        )
        guarded = [table for table in guarded if table in wipe]
        for table in guarded:
            conn.execute(text(f'alter table "{table}" disable trigger user'))
        names = ", ".join(f'"{table}"' for table in wipe)
        conn.execute(text(f"truncate table {names} restart identity"))
        for table in guarded:
            conn.execute(text(f'alter table "{table}" enable trigger user'))
        disabled = conn.execute(
            text(
                "select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid "
                "join pg_namespace n on n.oid = c.relnamespace "
                "where n.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D'"
            )
        ).scalar_one()
        if disabled:
            raise RuntimeError("Quedaron disparadores desactivados: se deshace todo.")
    print(f"\nListo: se vaciaron {len(wipe)} tablas de «{database}».")
    print(f"Las protecciones de solo inserción de {len(guarded)} tablas siguen activas.")
    print("Reinicie la API para que vuelva a crear las plantillas de importación.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
