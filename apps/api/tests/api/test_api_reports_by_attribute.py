"""Reports by attribute and the description column (change reportes-por-atributo; RF-047, RF-033).

Spec busqueda-reportes, «Reporte de piezas agrupadas por atributo», «Descripción de la pieza como
columna fija» and «Vista previa del reporte fiel a la descarga». Runs on the module-scoped seeded
database of ``pipeline``. Synthetic data only (RNF-014).
"""

import csv
import io
import uuid
from typing import Any

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.api.v1 import quality_reports
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, set_materials
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.locations.models import Location, LocationLevel
from app.modules.search.models import ExportJobModel, ExportJobStatus
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline

BASE = "/api/v1/reports"
LONG_TEXT = "Retablo de dos pisos con figuras de santos. " * 50


def _tag() -> str:
    return uuid.uuid4().hex[:6]


def _admin_context(session: Any) -> AuditContext:
    admin_id = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
    return AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)


def _piece(pipeline: Pipeline, denomination: str, **fields: Any) -> uuid.UUID:
    regime = fields.pop("tenure_regime", TenureRegime.OWNED)
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        piece = create_piece(session, denomination=denomination, tenure_regime=regime, **fields)
        session.commit()
        return piece.id


def _csv_rows(pipeline: Pipeline, path: str, **params: Any) -> list[dict[str, str]]:
    response = pipeline.login("ADMIN").get(f"{BASE}/{path}", params={"format": "csv", **params})
    assert response.status_code == 200, response.text
    lines = response.content.decode("utf-8-sig").splitlines()
    return list(csv.DictReader(io.StringIO("\n".join(lines))))


# --- 2.1 descripción como columna fija --------------------------------------------------------
def test_the_description_follows_the_denomination_in_every_report_that_lists_pieces(
    pipeline: Pipeline,
) -> None:
    client = pipeline.login("ADMIN")
    inventory = client.get(f"{BASE}/inventory").json()
    with pipeline.session() as session:
        location = session.scalar(select(Location).where(Location.is_active.is_(True)))
        assert location is not None
        location_id = str(location.id)
    by_location = client.get(f"{BASE}/by-location", params={"location_id": location_id}).json()

    for columns in (inventory["columns"], by_location["columns"]):
        assert columns[columns.index("Denominación") + 1] == "Descripción"


def test_the_excel_of_the_inventory_has_the_whole_description_wrapped(pipeline: Pipeline) -> None:
    """Escenario «Descripción en el Excel del inventario»."""
    tag = _tag()
    _piece(pipeline, f"Con descripción {tag}", description=LONG_TEXT)

    response = pipeline.login("ADMIN").get(f"{BASE}/inventory", params={"format": "xlsx"})

    assert response.status_code == 200, response.text
    sheet = load_workbook(io.BytesIO(response.content))["Reporte"]
    rows = list(sheet.iter_rows())
    heading = next(row for row in rows if row[0].value == "Código I")
    names = [cell.value for cell in heading]
    denomination, description = names.index("Denominación"), names.index("Descripción")
    assert description == denomination + 1
    row = next(r for r in rows if r[denomination].value == f"Con descripción {tag}")
    assert row[description].value == LONG_TEXT
    assert row[description].alignment.wrap_text is True
    assert sheet.column_dimensions["F"].width == 60


def test_a_piece_without_description_stays_with_an_empty_cell(pipeline: Pipeline) -> None:
    """Escenario «Pieza sin descripción»."""
    tag = _tag()
    _piece(pipeline, f"Sin descripción {tag}")

    rows = _csv_rows(pipeline, "inventory")

    row = next(r for r in rows if r["Denominación"] == f"Sin descripción {tag}")
    assert row["Descripción"] == ""


# --- 2.2 los filtros de la búsqueda -----------------------------------------------------------
def _terms(pipeline: Pipeline, vocabulary: VocabularyCode, count: int) -> list[Term]:
    with pipeline.session() as session:
        terms = list(
            session.scalars(
                select(Term)
                .join(Vocabulary)
                .where(Vocabulary.code == vocabulary, Term.is_active.is_(True))
                .order_by(Term.sort_order)
                .limit(count)
            )
        )
        assert len(terms) == count
        session.expunge_all()
        return terms


def _with_materials(pipeline: Pipeline, denomination: str, *term_ids: uuid.UUID) -> uuid.UUID:
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        piece = create_piece(session, denomination=denomination, tenure_regime=TenureRegime.OWNED)
        set_materials(session, piece, list(term_ids))
        session.commit()
        return piece.id


def test_the_inventory_respects_a_material_filter(pipeline: Pipeline) -> None:
    tag = _tag()
    wood, metal = _terms(pipeline, VocabularyCode.MATERIAL, 2)
    _with_materials(pipeline, f"De un material {tag}", wood.id)
    _with_materials(pipeline, f"De otro material {tag}", metal.id)

    rows = _csv_rows(pipeline, "inventory", material_id=str(wood.id))
    report = pipeline.login("ADMIN").get(f"{BASE}/inventory", params={"material_id": str(wood.id)})

    names = {row["Denominación"] for row in rows}
    assert f"De un material {tag}" in names
    assert f"De otro material {tag}" not in names
    assert report.json()["totals"]["Piezas"] == len(rows)


def test_a_filter_cannot_bring_back_what_a_report_excludes(pipeline: Pipeline) -> None:
    """The temporary loans stay out of the inventory even if the filter asks for them (RN-004)."""
    tag = _tag()
    _piece(pipeline, f"Prestada {tag}", tenure_regime=TenureRegime.TEMPORARY_LOAN)

    rows = _csv_rows(pipeline, "inventory", tenure_regime="Préstamo Temporal")

    assert rows == []


def test_filtering_below_the_space_needs_the_exact_location_permission(pipeline: Pipeline) -> None:
    """Filtering by a box would reveal what is inside it (RF-041)."""
    with pipeline.session() as session:
        box = session.scalar(select(Location).where(Location.level == LocationLevel.CONTAINER))
        space = session.scalar(select(Location).where(Location.level == LocationLevel.SPACE))
        assert box is not None and space is not None
        box_id, space_id = str(box.id), str(space.id)
    viewer = pipeline.login("INTERNAL_VIEWER")

    refused = viewer.get(f"{BASE}/inventory", params={"location_id": box_id})
    allowed = viewer.get(f"{BASE}/inventory", params={"location_id": space_id})

    assert refused.status_code == 403
    assert refused.json()["code"] == "exact_location_required"
    assert allowed.status_code == 200, allowed.text


def test_the_background_report_keeps_the_filters(
    pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch
) -> None:
    tag = _tag()
    wood = _terms(pipeline, VocabularyCode.MATERIAL, 1)[0]
    _with_materials(pipeline, f"Filtrada en segundo plano {tag}", wood.id)
    _with_materials(pipeline, f"Con el mismo material {tag}", wood.id)
    monkeypatch.setattr(quality_reports, "EXPORT_SYNC_MAX_ROWS", 1)

    response = pipeline.login("ADMIN").get(
        f"{BASE}/inventory", params={"format": "csv", "material_id": str(wood.id)}
    )

    assert response.status_code == 202, response.text
    with pipeline.session() as session:
        job = session.get(ExportJobModel, uuid.UUID(response.json()["id"]))
        assert job is not None and job.status == ExportJobStatus.READY
        assert job.params["piece_filter"]["material_id"] == str(wood.id)
        stored = pipeline.stored[job.storage_key]
    rows = list(csv.DictReader(io.StringIO(stored.decode("utf-8-sig"))))
    assert len(rows) == job.row_count
    assert f"Filtrada en segundo plano {tag}" in {row["Denominación"] for row in rows}
