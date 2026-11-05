"""Spec busqueda-reportes — valorización histórica restringida y desactivable (change
reportes-inventario, tarea 2.3; RF-037, RF-041, RNF-014).

The report only exists with ``FEATURE_VALUATION_REPORT`` (404 otherwise), needs
``sensitive.valuation`` (403 otherwise), totals by collection and currency with the most recent
valuation of each piece, and records every generation in the audit log. Valuations are loaded by
``load_valuations`` (dry-run by default, idempotent). Runs on the module-scoped database of
``pipeline``.
"""

from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Piece, PieceIdentifier
from app.modules.audit.models import AuditAction
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.normalization import TYPE_INVENTORY
from app.modules.reports.models import PieceValuation
from app.modules.reports.valuations import load_valuations
from tests.api.conftest import Pipeline

URL = "/api/v1/reports/valuation"
HEADER = "codigo,monto,moneda,fecha,fuente,notas\n"


def _owned_codes(pipeline: Pipeline, count: int) -> list[str]:
    """Current inventory codes of active owned pieces (synthetic seed)."""
    with pipeline.session() as session:
        codes = session.scalars(
            select(PieceIdentifier.normalized_value)
            .join(Piece, Piece.id == PieceIdentifier.piece_id)
            .where(
                PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
                PieceIdentifier.is_current.is_(True),
                PieceIdentifier.deleted_at.is_(None),
                Piece.deleted_at.is_(None),
                Piece.merged_into_id.is_(None),
                Piece.tenure_regime == TenureRegime.OWNED,
            )
            .order_by(PieceIdentifier.normalized_value)
            .limit(count)
        ).all()
    assert len(codes) == count
    return list(codes)


def _load(pipeline: Pipeline, content: str, *, apply: bool):
    with pipeline.session() as session:
        report = load_valuations(session, content, apply=apply, file_label="prueba.csv")
        session.commit()
    return report


def _valuations(pipeline: Pipeline) -> int:
    with pipeline.session() as session:
        return session.scalar(select(func.count(PieceValuation.id))) or 0


@pytest.fixture(scope="module")
def loaded(pipeline: Pipeline) -> list[str]:
    """Three valued pieces: the first one twice (older in USD, newer in PEN)."""
    first, second, third = _owned_codes(pipeline, 3)
    content = HEADER + (
        f"{first},1000,USD,2015-03-01,Tasación 2015 (sintética),\n"
        f"{first},4500.50,PEN,2024-06-30,Tasación 2024 (sintética),vigente\n"
        f"{second},2000,PEN,2023-01-15,Tasación 2023 (sintética),\n"
        f"{third},300,usd,2022-05-10,Tasación 2022 (sintética),\n"
    )
    report = _load(pipeline, content, apply=True)
    assert report.issues == []
    assert report.inserted == 4
    return [first, second, third]


def test_disabled_report_is_not_available(pipeline: Pipeline) -> None:
    response = pipeline.login("ADMIN").get(URL)
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "report_not_found"
    assert "valuation" not in {item["type"] for item in body["details"]["available"]}


def test_enabled_report_needs_the_valuation_permission(pipeline: Pipeline) -> None:
    cataloguer = pipeline.app_for("CATALOGUER", feature_valuation_report=True)
    response = cataloguer.get(URL)
    assert response.status_code == 403
    assert "valorización" in response.json()["message"].lower()
    listed = cataloguer.get("/api/v1/reports/no-existe").json()["details"]["available"]
    assert "valuation" not in {item["type"] for item in listed}


def test_totals_by_collection_and_currency_with_the_latest_valuation(
    pipeline: Pipeline, loaded: list[str]
) -> None:
    admin = pipeline.app_for("ADMIN", feature_valuation_report=True)
    response = admin.get(URL, params={"page_size": 100})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["report_type"] == "valuation"
    assert body["columns"] == ["Colección", "Moneda", "Piezas valorizadas", "Total"]

    # The first piece counts once, with its newer valuation in soles (not the older USD one).
    totals = body["totals"]
    assert Decimal(str(totals["Total PEN"])) == Decimal("6500.50")
    assert Decimal(str(totals["Total USD"])) == Decimal("300.00")
    assert totals["Piezas valorizadas"] == 3
    assert totals["Piezas sin valorización"] == totals["Piezas"] - 3
    assert sum(row[2] for row in body["rows"]) == 3
    for currency in ("PEN", "USD"):
        rows_total = sum(Decimal(str(row[3])) for row in body["rows"] if row[1] == currency)
        assert rows_total == Decimal(str(totals[f"Total {currency}"]))
    assert {(s["group"], s["label"], s["count"]) for s in body["subtotals"]} == {
        ("Moneda", "PEN", 2),
        ("Moneda", "USD", 1),
    }


def test_every_generation_is_audited(pipeline: Pipeline, loaded: list[str]) -> None:
    def generations() -> int:
        with pipeline.session() as session:
            entries = session.scalars(
                select(AuditLog).where(AuditLog.action == AuditAction.EXPORT)
            ).all()
            return sum(1 for e in entries if (e.new_value or {}).get("report_type") == "valuation")

    before = generations()
    admin = pipeline.app_for("ADMIN", feature_valuation_report=True)
    assert admin.get(URL).status_code == 200
    assert admin.get(URL, params={"format": "xlsx"}).status_code == 200
    assert generations() == before + 2


def test_load_is_a_dry_run_by_default_and_idempotent(pipeline: Pipeline) -> None:
    (code,) = _owned_codes(pipeline, 1)
    content = HEADER + f"{code},750,PEN,2020-02-02,Inventario 2020 (sintético),\n"
    before = _valuations(pipeline)

    dry = _load(pipeline, content, apply=False)
    assert (dry.valid, dry.inserted, dry.issues) == (1, 0, [])
    assert _valuations(pipeline) == before

    applied = _load(pipeline, content, apply=True)
    assert applied.inserted == 1
    again = _load(pipeline, content, apply=True)
    assert (again.inserted, again.already_loaded) == (0, 1)
    assert _valuations(pipeline) == before + 1


def test_load_reports_every_invalid_row(pipeline: Pipeline) -> None:
    (code,) = _owned_codes(pipeline, 1)
    content = HEADER + (
        "NO-EXISTE-999,100,PEN,2020-01-01,Fuente,\n"
        f"{code},cien,PEN,2020-01-01,Fuente,\n"
        f"{code},-5,PEN,2020-01-01,Fuente,\n"
        f"{code},100,SOLES,2020-01-01,Fuente,\n"
        f"{code},100,PEN,01/01/2020,Fuente,\n"
        f"{code},100,PEN,2020-01-01,,\n"
    )
    report = _load(pipeline, content, apply=True)
    assert report.inserted == 0
    assert [issue.row_number for issue in report.issues] == [2, 3, 4, 5, 6, 7]
    assert "Ninguna pieza" in report.issues[0].message
    assert "fuente" in report.issues[5].message

    missing = _load(pipeline, "codigo,monto\nI-1,10\n", apply=True)
    assert missing.issues[0].message == "Faltan columnas: moneda, fecha, fuente."
