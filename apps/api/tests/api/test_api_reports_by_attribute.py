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
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import Viewer
from app.modules.catalog.service import create_piece, set_materials
from app.modules.collections.models import Collection, Term, Vocabulary, VocabularyCode
from app.modules.locations.models import Location, LocationLevel
from app.modules.reports.builders import INVENTORY_COLUMNS, by_attribute
from app.modules.search.filters import PieceFilter
from app.modules.search.models import ExportJobModel, ExportJobStatus
from app.modules.search.schemas import GroupBy
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


def _detail(content: bytes) -> list[dict[str, str]]:
    """The rows of a report CSV: under the heading and above the subtotals."""
    return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig").split("\r\n\r\n")[1])))


def _csv_rows(pipeline: Pipeline, path: str, **params: Any) -> list[dict[str, str]]:
    response = pipeline.login("ADMIN").get(f"{BASE}/{path}", params={"format": "csv", **params})
    assert response.status_code == 200, response.text
    return _detail(response.content)


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
    rows = _detail(stored)
    assert len(rows) == job.row_count
    assert f"Filtrada en segundo plano {tag}" in {row["Denominación"] for row in rows}


# --- 2.3 agrupar por un atributo --------------------------------------------------------------
ALL_PERMISSIONS = Viewer(frozenset({"sensitive.exact_location"}))


def _grouped(pipeline: Pipeline, group_by: GroupBy, tag: str, **filters: Any) -> Any:
    with pipeline.session() as session:
        return by_attribute(
            session,
            ALL_PERMISSIONS,
            group_by=group_by,
            piece_filter=PieceFilter(denomination=tag, **filters),
        )


def _subtotals(report: Any) -> dict[str, int]:
    return {subtotal.label: subtotal.count for subtotal in report.subtotals}


def test_grouping_by_conservation_state_within_a_collection(pipeline: Pipeline) -> None:
    """Escenario «Agrupar por estado de conservación con un filtro de colección»."""
    tag = _tag()
    with pipeline.session() as session:
        collection_id = session.scalar(select(Collection.id).limit(1))
    good, regular = _terms(pipeline, VocabularyCode.CONSERVATION_STATUS, 2)
    for name, state in (("uno", good), ("dos", good), ("tres", regular), ("cuatro", None)):
        _piece(
            pipeline,
            f"{tag} {name}",
            collection_id=collection_id,
            conservation_state_id=state.id if state else None,
        )
    _piece(pipeline, f"{tag} de otra colección", conservation_state_id=good.id)

    report = _grouped(pipeline, GroupBy.CONSERVATION_STATE, tag, collection_id=collection_id)

    assert _subtotals(report) == {good.label: 2, regular.label: 1, "Sin dato": 1}
    assert [s.label for s in report.subtotals] == [good.label, regular.label, "Sin dato"]
    assert report.totals["Piezas"] == 4 == sum(s.count for s in report.subtotals)
    assert report.title == "Piezas agrupadas por estado de conservación"
    assert "Apariciones en grupos" not in report.totals


def test_a_piece_with_two_materials_counts_once_in_the_total(pipeline: Pipeline) -> None:
    """Escenario «Pieza con dos materiales»."""
    tag = _tag()
    wood, metal = _terms(pipeline, VocabularyCode.MATERIAL, 2)
    _with_materials(pipeline, f"{tag} con los dos", wood.id, metal.id)
    _with_materials(pipeline, f"{tag} solo uno", wood.id)
    _piece(pipeline, f"{tag} sin material")

    report = _grouped(pipeline, GroupBy.MATERIAL, tag)

    assert _subtotals(report) == {wood.label: 2, metal.label: 1, "Sin dato": 1}
    assert report.totals == {"Piezas": 3, "Apariciones en grupos": 4}
    assert len(report.rows) == 4
    assert "cuenta una sola vez" in report.message
    both = [row for row in report.rows if row[report.columns.index("Denominación")].endswith("dos")]
    assert {row[0] for row in both} == {wood.label, metal.label}


def test_provenances_written_differently_form_one_group(pipeline: Pipeline) -> None:
    """Escenario «Procedencias escritas de distinta forma»."""
    tag = _tag()
    for index, text in enumerate(("Ayacucho", "ayacucho ", "AYACUCHO")):
        _piece(pipeline, f"{tag} {index}", provenance=text)

    report = _grouped(pipeline, GroupBy.PROVENANCE, tag)

    assert _subtotals(report) == {"Ayacucho": 3}
    assert {row[0] for row in report.rows} == {"Ayacucho"}
    provenance = report.columns.index("Procedencia")
    assert {row[provenance] for row in report.rows} == {"Ayacucho", "ayacucho ", "AYACUCHO"}


def test_free_text_ignores_accents_and_inner_spaces_and_shows_the_most_used_form(
    pipeline: Pipeline,
) -> None:
    tag = _tag()
    for index, text in enumerate(("HUÁNUCO", "HUÁNUCO", "Huanuco", "  huánuco ", "San  Pedro")):
        _piece(pipeline, f"{tag} {index}", author=text)

    report = _grouped(pipeline, GroupBy.AUTHOR, tag)

    assert _subtotals(report) == {"HUÁNUCO": 4, "San Pedro": 1}


def test_grouping_by_denomination_and_by_category_and_collection(pipeline: Pipeline) -> None:
    tag = _tag()
    category = _terms(pipeline, VocabularyCode.CATEGORY, 1)[0]
    with pipeline.session() as session:
        collection = session.scalar(select(Collection).order_by(Collection.name).limit(1))
        assert collection is not None
        collection_id, collection_name = collection.id, collection.name
    _piece(pipeline, f"{tag} mate", category_id=category.id, collection_id=collection_id)
    _piece(pipeline, f"{tag} MATE")

    by_name = _grouped(pipeline, GroupBy.DENOMINATION, tag)
    by_category = _grouped(pipeline, GroupBy.CATEGORY, tag)
    by_collection = _grouped(pipeline, GroupBy.COLLECTION, tag)

    assert list(_subtotals(by_name).values()) == [2]
    assert _subtotals(by_category) == {category.label: 1, "Sin dato": 1}
    assert by_collection.subtotals[-1].label == "Sin dato"
    assert by_collection.subtotals[0].label.endswith(collection_name)
    assert by_collection.subtotals[0].count == 1


def test_the_groups_keep_the_inventory_columns_led_by_the_group(pipeline: Pipeline) -> None:
    tag = _tag()
    _piece(pipeline, f"{tag} pieza", provenance="Puno", description="Texto de la pieza")

    report = _grouped(pipeline, GroupBy.PROVENANCE, tag)

    assert report.columns[0] == "Grupo"
    assert report.columns[1:] == INVENTORY_COLUMNS
    row = dict(zip(report.columns, report.rows[0], strict=True))
    assert row["Grupo"] == "Puno"
    assert row["Descripción"] == "Texto de la pieza"
    assert report.columns.index("Descripción") == report.columns.index("Denominación") + 1


def test_the_grouped_report_excludes_what_the_inventory_excludes(pipeline: Pipeline) -> None:
    tag = _tag()
    _piece(pipeline, f"{tag} propia", provenance="Puno")
    _piece(
        pipeline, f"{tag} prestada", provenance="Puno", tenure_regime=TenureRegime.TEMPORARY_LOAN
    )
    gone = _piece(pipeline, f"{tag} eliminada", provenance="Puno")
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        piece = session.get(Piece, gone)
        assert piece is not None
        soft_delete(session, piece, "Eliminada (sintético)")
        session.commit()

    report = _grouped(pipeline, GroupBy.PROVENANCE, tag)

    assert report.totals["Piezas"] == 1
    assert _subtotals(report) == {"Puno": 1}


def test_without_pieces_the_report_is_empty_with_its_message(pipeline: Pipeline) -> None:
    """Escenario «Sin piezas con esos filtros»."""
    report = _grouped(pipeline, GroupBy.MATERIAL, f"sin-coincidencias-{_tag()}")

    assert report.rows == []
    assert report.subtotals == []
    assert report.totals["Piezas"] == 0
    assert report.message == "No hay piezas con estos filtros"


# --- 2.4 el reporte en la API -----------------------------------------------------------------
def test_the_report_is_available_with_its_attribute(pipeline: Pipeline) -> None:
    tag = _tag()
    _piece(pipeline, f"{tag} pieza", provenance=f"Procedencia {tag}")

    response = pipeline.login("ADMIN").get(
        f"{BASE}/by-attribute", params={"group_by": "provenance", "denomination": tag}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["report_type"] == "by-attribute"
    assert body["title"] == "Piezas agrupadas por procedencia"
    assert body["rows"][0][0] == f"Procedencia {tag}"
    assert body["subtotals"] == [
        {"group": "Procedencia", "label": f"Procedencia {tag}", "count": 1, "level": 0}
    ]


@pytest.mark.parametrize("attribute", [item.value for item in GroupBy])
def test_every_attribute_answers(pipeline: Pipeline, attribute: str) -> None:
    response = pipeline.login("ADMIN").get(f"{BASE}/by-attribute", params={"group_by": attribute})

    assert response.status_code == 200, response.text
    assert response.json()["columns"][0] == "Grupo"


def test_an_attribute_that_is_not_admitted_is_422_with_the_admitted_ones(
    pipeline: Pipeline,
) -> None:
    """Escenario «Atributo no admitido»."""
    client = pipeline.login("ADMIN")

    wrong = client.get(f"{BASE}/by-attribute", params={"group_by": "valorizacion"})
    missing = client.get(f"{BASE}/by-attribute")

    for response in (wrong, missing):
        assert response.status_code == 422, response.text
        body = response.json()
        assert body["code"] == "invalid_report_parameter"
        assert body["details"]["parameter"] == "group_by"
        assert set(body["details"]["allowed"]) == {item.value for item in GroupBy}
        assert "procedencia" in body["message"]


def test_a_role_without_exact_location_sees_only_site_and_space(pipeline: Pipeline) -> None:
    tag = _tag()
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        box = session.scalar(select(Location).where(Location.level == LocationLevel.CONTAINER))
        assert box is not None
        box_name = box.name
        piece = create_piece(
            session, denomination=f"{tag} en caja", tenure_regime=TenureRegime.OWNED
        )
        piece.current_location_id = box.id
        session.commit()
    params = {"group_by": "author", "denomination": tag}

    viewer = pipeline.login("INTERNAL_VIEWER").get(f"{BASE}/by-attribute", params=params).json()
    admin = pipeline.login("ADMIN").get(f"{BASE}/by-attribute", params=params).json()

    location = viewer["columns"].index("Ubicación")
    assert viewer["masked_columns"] == ["Ubicación"]
    assert box_name not in viewer["rows"][0][location]
    assert admin["masked_columns"] == []
    assert box_name in admin["rows"][0][location]


def test_the_grouped_report_can_be_built_in_the_background(
    pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch
) -> None:
    tag = _tag()
    _piece(pipeline, f"{tag} uno", provenance="Puno")
    _piece(pipeline, f"{tag} dos", provenance="Puno")
    monkeypatch.setattr(quality_reports, "EXPORT_SYNC_MAX_ROWS", 1)

    response = pipeline.login("ADMIN").get(
        f"{BASE}/by-attribute",
        params={"format": "xlsx", "group_by": "provenance", "denomination": tag},
    )

    assert response.status_code == 202, response.text
    with pipeline.session() as session:
        job = session.get(ExportJobModel, uuid.UUID(response.json()["id"]))
        assert job is not None and job.status == ExportJobStatus.READY
        assert job.params["group_by"] == "provenance"
        sheet = load_workbook(io.BytesIO(pipeline.stored[job.storage_key]))["Reporte"]
    assert sheet["A1"].value == "Piezas agrupadas por procedencia"


# --- 2.5 la vista previa es igual a la descarga ------------------------------------------------
def _whole_preview(pipeline: Pipeline, path: str, **params: Any) -> dict[str, Any]:
    client = pipeline.login("ADMIN")
    first = client.get(f"{BASE}/{path}", params={**params, "page_size": 100}).json()
    rows = list(first["rows"])
    page = 2
    while len(rows) < first["total_rows"]:
        rows += client.get(
            f"{BASE}/{path}", params={**params, "page": page, "page_size": 100}
        ).json()["rows"]
        page += 1
    return {**first, "rows": rows}


def _as_text(row: list[Any]) -> list[str]:
    return ["" if value is None else str(value) for value in row]


def test_the_preview_and_the_excel_have_the_same_data_and_heading(pipeline: Pipeline) -> None:
    """Escenario «Vista previa y Excel coinciden»."""
    tag = _tag()
    for index, author in enumerate(("Persona A", "persona a", "Persona B", None)):
        _piece(pipeline, f"{tag} {index}", author=author, description=f"Descripción {index}")
    params = {"group_by": "author", "denomination": tag}

    preview = _whole_preview(pipeline, "by-attribute", **params)
    response = pipeline.login("ADMIN").get(
        f"{BASE}/by-attribute", params={**params, "format": "xlsx"}
    )

    book = load_workbook(io.BytesIO(response.content))
    cells = [[cell.value for cell in row] for row in book["Reporte"].iter_rows()]
    heading = cells.index(preview["columns"])
    assert [_as_text(row) for row in cells[heading + 1 :]] == [_as_text(r) for r in preview["rows"]]
    assert cells[0][0] == preview["title"]
    assert preview["generated_by"] in cells[1][0]
    for label, value in preview["filters"].items():
        assert f"{label}: {value}" in cells[2][0]
    summary = [[cell.value for cell in row] for row in book["Subtotales"].iter_rows()]
    assert [row for row in summary if row[0] == "Autor"] == [
        [s["group"], s["label"], s["count"]] for s in preview["subtotals"]
    ]
    assert ["Total", "Piezas", preview["totals"]["Piezas"]] in summary


def test_the_preview_and_the_csv_have_the_same_data_and_heading(pipeline: Pipeline) -> None:
    tag = _tag()
    wood, metal = _terms(pipeline, VocabularyCode.MATERIAL, 2)
    _with_materials(pipeline, f"{tag} con los dos", wood.id, metal.id)
    params = {"group_by": "material", "denomination": tag}

    preview = _whole_preview(pipeline, "by-attribute", **params)
    response = pipeline.login("ADMIN").get(
        f"{BASE}/by-attribute", params={**params, "format": "csv"}
    )

    heading, detail, summary = response.content.decode("utf-8-sig").split("\r\n\r\n")
    assert heading.splitlines()[0] == preview["title"]
    assert "Agrupado por: Material" in heading
    rows = list(csv.reader(io.StringIO(detail)))
    assert rows[0] == preview["columns"]
    assert rows[1:] == [_as_text(row) for row in preview["rows"]]
    lines = list(csv.reader(io.StringIO(summary)))
    assert ["Material", wood.label, "1"] in lines and ["Material", metal.label, "1"] in lines
    assert ["Total", "Piezas", "1"] in lines and ["Total", "Apariciones en grupos", "2"] in lines


def test_the_filters_are_readable_in_the_preview(pipeline: Pipeline) -> None:
    wood = _terms(pipeline, VocabularyCode.MATERIAL, 1)[0]

    body = (
        pipeline.login("ADMIN")
        .get(f"{BASE}/by-attribute", params={"group_by": "author", "material_id": str(wood.id)})
        .json()
    )

    assert body["filters"] == {
        "Agrupado por": "Autor",
        "Comodatos": "Incluidos",
        "Material": wood.label,
    }
    assert body["generated_at"] and body["generated_by"]


def test_the_notice_of_the_limited_location_is_the_same_in_the_file(pipeline: Pipeline) -> None:
    """Escenario «Columna oculta por permisos»."""
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        box = session.scalar(select(Location).where(Location.level == LocationLevel.CONTAINER))
        assert box is not None
        piece = create_piece(
            session, denomination=f"{_tag()} en caja", tenure_regime=TenureRegime.OWNED
        )
        piece.current_location_id = box.id
        session.commit()
    viewer = pipeline.login("INTERNAL_VIEWER")

    response = viewer.get(f"{BASE}/inventory", params={"format": "csv"})

    assert response.status_code == 200, response.text
    heading = response.content.decode("utf-8-sig").split("\r\n\r\n")[0]
    assert "Ubicación limitada a sede y espacio por tus permisos" in heading
