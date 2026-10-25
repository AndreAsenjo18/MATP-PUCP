"""Throwaway EXPLAIN ANALYZE measurement for task 4.1 (alertas-y-reporte-incompletas).

Not part of the app: run once with `docker compose exec api python scratch_explain.py`
and delete afterwards.
"""

import time

from sqlalchemy import text

from app.core.config import load_settings
from app.core.db import make_engine, make_session_factory
from app.modules.quality.incomplete_report import build_incomplete_query
from app.modules.quality.kpis import compute_dashboard_kpis
from app.modules.quality.completeness import load_active_rules


def timed(label, fn):
    start = time.perf_counter()
    result = fn()
    elapsed = time.perf_counter() - start
    print(f"\n=== {label}: {elapsed * 1000:.1f} ms (Python-side timing) ===")
    return result


def explain(session, statement, label):
    compiled = statement.compile(
        session.bind, compile_kwargs={"literal_binds": True}
    )
    plan = session.execute(
        text(f"EXPLAIN (ANALYZE, BUFFERS) {compiled}")
    ).scalars().all()
    print(f"\n--- EXPLAIN ANALYZE: {label} ---")
    for line in plan:
        print(line)


def main():
    settings = load_settings()
    engine = make_engine(settings.database_url)
    factory = make_session_factory(engine)
    with factory() as session:
        rules = load_active_rules(session)

        timed("KPI global", lambda: compute_dashboard_kpis(session, by_collection=False))
        timed(
            "KPI global + by_collection",
            lambda: compute_dashboard_kpis(session, by_collection=True),
        )
        timed(
            "Reporte de incompletas (sin filtros)",
            lambda: list(session.scalars(build_incomplete_query(session, rules)).all()),
        )

        from app.modules.quality.kpis import _alert_kpis, BASE_CONDITIONS

        kpi_stmt = None
        # Build the raw SQLAlchemy select used inside _alert_kpis for EXPLAIN purposes.
        from sqlalchemy import select, case
        from app.modules.catalog.models import Piece
        from app.modules.quality.completeness import ALERTS, alert_condition

        columns = []
        for definition in ALERTS.values():
            applies = definition.applies_to(rules)
            matches = definition.predicate(rules)
            from sqlalchemy import func

            columns.append(func.sum(case((applies, 1), else_=0)))
            columns.append(func.sum(case((applies & matches, 1), else_=0)))
        kpi_stmt = select(*columns).select_from(Piece).where(*BASE_CONDITIONS)
        explain(session, kpi_stmt, "KPI global (SUM CASE por alerta)")

        incomplete_stmt = build_incomplete_query(session, rules)
        explain(session, incomplete_stmt.limit(20), "Reporte de incompletas (página 1, limit 20)")


if __name__ == "__main__":
    main()
