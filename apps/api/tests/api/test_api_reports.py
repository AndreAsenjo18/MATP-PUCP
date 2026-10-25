"""Spec busqueda-reportes — reportes de inventario (change reportes-inventario, tasks 1.1 to 2.2).

Closed catalog (404 with the reports of the role, 422 for invalid parameters), permanent
inventory whose totals add up to the detail (no temporary loans, deleted or merged pieces),
masking of the location column, report by location with the last time each piece was seen, and
the file export (synchronous or as a background job). Runs on the module-scoped seeded database
of ``pipeline``; the full detail is read from the CSV download because the JSON view is paged.
"""

import csv
import io
import uuid
from typing import Any

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.api.v1 import quality_reports
from app.models import AuditLog, Collection, Location, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import verify_location
from app.modules.search.models import ExportJobModel, ExportJobStatus
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline

BASE = "/api/v1/reports"


def _csv(pipeline: Pipeline, path: str, role: str = "ADMIN", **params: Any) -> list[dict[str, str]]:
    response = pipeline.login(role).get(f"{BASE}/{path}", params={"format": "csv", **params})
    assert response.status_code == 200, response.text
    return list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))


def _admin_context(session: Any) -> AuditContext:
    admin_id = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
    return AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)


def _tag() -> str:
    return uuid.uuid4().hex[:6]


# --- 1.1 catálogo cerrado ----------------------------------------------------------------------
def test_an_unknown_report_is_404_with_the_reports_of_the_role(pipeline: Pipeline) -> None:
    response = pipeline.client.get(f"{BASE}/inventario-2019")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "report_not_found"
    assert {item["type"] for item in body["details"]["available"]} >= {"inventory", "by-location"}


def test_an_invalid_parameter_is_422_naming_it(pipeline: Pipeline) -> None:
    unknown = pipeline.client.get(
        f"{BASE}/by-collection", params={"collection_id": str(uuid.uuid4())}
    )
    missing = pipeline.client.get(f"{BASE}/by-collection")

    assert unknown.status_code == 422
    assert unknown.json()["details"]["parameter"] == "collection_id"
    assert missing.status_code == 422 and missing.json()["code"] == "invalid_report_parameter"


# --- 2.1 inventario ---------------------------------------------------------------------------
def test_the_inventory_totals_add_up_and_exclude_what_is_not_permanent(pipeline: Pipeline) -> None:
    tag = _tag()
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        kept = create_piece(
            session, denomination=f"Conservada {tag}", tenure_regime=TenureRegime.OWNED
        )
        merged = create_piece(
            session, denomination=f"Fusionada {tag}", tenure_regime=TenureRegime.OWNED
        )
        deleted = create_piece(
            session, denomination=f"Eliminada {tag}", tenure_regime=TenureRegime.OWNED
        )
        loan = create_piece(
            session, denomination=f"Préstamo {tag}", tenure_regime=TenureRegime.TEMPORARY_LOAN
        )
        merged.merged_into_id = kept.id
        soft_delete(session, merged, "Fusionada en la conservada (sintético)")
        soft_delete(session, deleted, "Eliminada (sintético)")
        session.flush()
        session.commit()
        assert loan.id

    report = pipeline.client.get(f"{BASE}/inventory").json()
    rows = _csv(pipeline, "inventory")

    names = {row["Denominación"] for row in rows}
    assert f"Conservada {tag}" in names
    assert not names & {f"Fusionada {tag}", f"Eliminada {tag}", f"Préstamo {tag}"}
    assert {row["Régimen"] for row in rows} <= {"Propiedad", "Comodato"}
    total = report["totals"]["Piezas"]
    assert total == len(rows) == report["total_rows"]
    regimes = [s for s in report["subtotals"] if s["group"] == "Régimen"]
    assert sum(s["count"] for s in regimes) == total
    collections = [s for s in report["subtotals"] if s["group"] == "Colección" and s["level"] == 0]
    assert sum(s["count"] for s in collections) == total
    assert report["generated_by"] == "catalogador@matp.local"
    owned = next(row for row in rows if row["Denominación"] == f"Conservada {tag}")
    assert owned["Propietario legal"] == LEGAL_OWNER_PUCP  # RN-006


def test_loans_for_use_can_be_left_out(pipeline: Pipeline) -> None:
    rows = _csv(pipeline, "inventory", include_loans_for_use="false")

    assert rows and {row["Régimen"] for row in rows} == {"Propiedad"}


def test_an_empty_collection_reports_zero_pieces(pipeline: Pipeline) -> None:
    created = pipeline.login("COLLECTIONS_MANAGER").post(
        "/api/v1/collections", json={"name": f"Colección vacía {_tag()} (sintética)"}
    )
    assert created.status_code == 201, created.text

    report = pipeline.client.get(
        f"{BASE}/by-collection", params={"collection_id": created.json()["id"]}
    )

    assert report.status_code == 200
    assert report.json()["totals"]["Piezas"] == 0 and report.json()["rows"] == []
    assert "cero piezas" in report.json()["message"]


def test_a_collection_report_includes_its_subcollections(pipeline: Pipeline) -> None:
    with pipeline.session() as session:
        parent = session.scalar(select(Collection).where(Collection.acronym_normalized == "RA"))
        assert parent is not None
        parent_id = str(parent.id)

    report = pipeline.client.get(
        f"{BASE}/by-collection", params={"collection_id": parent_id}
    ).json()

    labels = {s["label"] for s in report["subtotals"] if s["group"] == "Colección"}
    assert any("›" in label for label in labels)  # a subcollection (RAB) under RA
    top = [s for s in report["subtotals"] if s["group"] == "Colección" and s["level"] == 0]
    assert sum(s["count"] for s in top) == report["totals"]["Piezas"]


def test_an_internal_viewer_sees_only_site_and_space(pipeline: Pipeline) -> None:
    viewer = pipeline.login("INTERNAL_VIEWER").get(f"{BASE}/inventory").json()
    rows = _csv(pipeline, "inventory", role="INTERNAL_VIEWER")
    admin = pipeline.client.get(f"{BASE}/inventory").json()

    assert viewer["masked_columns"] == ["Ubicación"]
    assert all(row["Ubicación"].count("›") <= 1 for row in rows)
    assert admin["masked_columns"] == []


# --- 2.2 por ubicación -------------------------------------------------------------------------
def _location(pipeline: Pipeline, level: LocationLevel) -> Location:
    with pipeline.session() as session:
        location = session.scalar(
            select(Location).where(Location.level == level, Location.is_active.is_(True)).limit(1)
        )
        assert location is not None
        return location


def test_by_location_marks_never_verified_pieces_and_filters_by_age(pipeline: Pipeline) -> None:
    space = _location(pipeline, LocationLevel.SPACE)
    tag = _tag()
    with pipeline.session() as session, audit_context(session, _admin_context(session)):
        never = create_piece(
            session, denomination=f"Nunca vista {tag}", tenure_regime=TenureRegime.OWNED
        )
        never.current_location_id = space.id
        seen = create_piece(
            session, denomination=f"Vista hoy {tag}", tenure_regime=TenureRegime.OWNED
        )
        seen.current_location_id = space.id
        session.flush()
        verify_location(session, seen)
        session.commit()
    client = pipeline.login("STORAGE_STAFF")

    everything = client.get(
        f"{BASE}/by-location", params={"location_id": str(space.id), "page_size": 100}
    ).json()
    stale = _csv(
        pipeline,
        "by-location",
        role="STORAGE_STAFF",
        location_id=str(space.id),
        not_verified_since_days=365,
    )

    by_name = {row[2]: row for row in everything["rows"]}
    assert by_name[f"Nunca vista {tag}"][4] == "Nunca verificada"
    assert by_name[f"Vista hoy {tag}"][5] == 0
    names = {row["Denominación"] for row in stale}
    assert f"Nunca vista {tag}" in names and f"Vista hoy {tag}" not in names
    assert everything["filters"]["location"]


def test_detail_below_the_space_needs_the_exact_location_permission(pipeline: Pipeline) -> None:
    furniture = _location(pipeline, LocationLevel.FURNITURE)
    space = _location(pipeline, LocationLevel.SPACE)
    viewer = pipeline.login("INTERNAL_VIEWER")

    denied = viewer.get(f"{BASE}/by-location", params={"location_id": str(furniture.id)})
    aggregated = viewer.get(f"{BASE}/by-location", params={"location_id": str(space.id)})

    assert denied.status_code == 403 and denied.json()["code"] == "exact_location_required"
    assert denied.json()["details"]["aggregate_available"] is True
    assert aggregated.status_code == 200 and aggregated.json()["columns"] == ["Espacio", "Piezas"]


def test_an_empty_location_says_so(pipeline: Pipeline) -> None:
    created = pipeline.login("ADMIN").post(
        "/api/v1/locations",
        json={"level": "Sede", "code": f"SEDE-{_tag()}", "name": "Sede vacía (sintética)"},
    )
    assert created.status_code == 201, created.text

    report = pipeline.client.get(
        f"{BASE}/by-location", params={"location_id": created.json()["id"]}
    )

    assert report.status_code == 200 and report.json()["message"] == "La ubicación no tiene piezas."


# --- 1.2 archivos --------------------------------------------------------------------------------
def test_the_spreadsheet_has_the_heading_and_is_audited(pipeline: Pipeline) -> None:
    response = pipeline.login("ADMIN").get(f"{BASE}/inventory", params={"format": "xlsx"})

    assert response.status_code == 200
    sheet = load_workbook(io.BytesIO(response.content))["Reporte"]
    assert sheet["A1"].value == "Inventario general"
    assert "por admin@matp.local" in sheet["A2"].value and sheet["A3"].value.startswith("Filtros")
    with pipeline.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.action == AuditAction.EXPORT, AuditLog.entity_type == "export_job"
            )
        ).all()
    assert any((entry.new_value or {}).get("report_type") == "inventory" for entry in entries)


def test_a_large_report_is_generated_in_the_background(
    pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(quality_reports, "EXPORT_SYNC_MAX_ROWS", 1)

    response = pipeline.login("ADMIN").get(f"{BASE}/inventory", params={"format": "xlsx"})

    assert response.status_code == 202, response.text
    job_id = uuid.UUID(response.json()["id"])
    with pipeline.session() as session:
        job = session.get(ExportJobModel, job_id)
        assert job is not None and job.status == ExportJobStatus.READY
        assert job.storage_key is not None and job.storage_key in pipeline.stored
        assert job.row_count == response.json()["row_count"]
        assert session.scalar(select(Piece.id).limit(1)) is not None
