"""Reports by attribute and the description column (change reportes-por-atributo; RF-047, RF-033).

Spec busqueda-reportes, «Reporte de piezas agrupadas por atributo», «Descripción de la pieza como
columna fija» and «Vista previa del reporte fiel a la descarga». Runs on the module-scoped seeded
database of ``pipeline``. Synthetic data only (RNF-014).
"""

import csv
import io
import uuid
from typing import Any

from openpyxl import load_workbook
from sqlalchemy import select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.locations.models import Location
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
