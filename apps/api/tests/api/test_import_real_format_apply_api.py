"""The standardized database format applied end to end (change formatos-reales-importacion,
tasks 3.2 and 5.1 to 5.3).

The fixture with the real headers and invented values goes through upload, the template «BD
estandarizada 2025», validation, approval and application on the seeded database: the new
pieces get the entry date as a date and the structured dimensions of the separate measure
columns, and the owner's columns stay only in the source data. Synthetic values (RNF-014).
"""

import uuid
from datetime import date

from sqlalchemy import select

from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.imports.models import ImportMappingTemplate
from app.seed.real_formats import FILES
from tests.api.conftest import Pipeline
from tests.api.test_import_decisions_api import confirm, summary
from tests.api.test_import_pipeline_api import get_batch, put_mapping, upload, validate


def test_the_standardized_format_creates_pieces_with_entry_date_and_dimensions(
    pipeline: Pipeline,
) -> None:
    templates = pipeline.client.get("/api/v1/import-templates").json()
    template = next(item for item in templates if item["name"] == "BD estandarizada 2025")
    name = "bd_estandarizada_44.xlsx"
    batch_id = upload(pipeline.client, name, FILES[name]())["batch_id"]

    mapped = put_mapping(pipeline.client, batch_id, {"template_id": template["id"]})
    assert mapped.status_code == 200, mapped.text
    assert validate(pipeline.client, batch_id).status_code == 202
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"
    response = confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    assert response.status_code == 200, response.text
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"

    with pipeline.session() as session:
        created = session.execute(
            select(Piece, PieceSourceRecord.payload)
            .join(PieceSourceRecord, PieceSourceRecord.piece_id == Piece.id)
            .where(PieceSourceRecord.import_batch_id == uuid.UUID(batch_id))
        ).all()
    assert created
    piece, payload = created[0]
    assert piece.entry_date == date(1998, 3, 15)
    assert piece.dimensions == [
        {"dimension": "alto", "value": 12.5, "unit": "cm"},
        {"dimension": "ancho", "value": 8.3, "unit": "cm"},
    ]
    assert piece.dimensions_text == "Alto 12,5 cm; Ancho 8,3 cm"
    assert payload["Nombre de propietario"] == "Propietario sintético"
    assert payload["Alto (cm)"] == 12.5  # the originals of the measures are kept (RF-008)


def test_the_owners_data_is_restricted_without_the_donor_data_permission(
    pipeline: Pipeline,
) -> None:
    """Spec «Datos personales del propietario en la importación» (task 6.1, design D6)."""
    templates = pipeline.client.get("/api/v1/import-templates").json()
    template = next(item for item in templates if item["name"] == "BD estandarizada 2025")
    name = "bd_estandarizada_44.xlsx"
    batch_id = upload(pipeline.client, name, FILES[name]())["batch_id"]
    put_mapping(pipeline.client, batch_id, {"template_id": template["id"]})
    validate(pipeline.client, batch_id)
    confirm(pipeline, batch_id, summary(pipeline, batch_id)["summary_token"])
    with pipeline.session() as session:
        piece_id = session.scalar(
            select(PieceSourceRecord.piece_id).where(
                PieceSourceRecord.import_batch_id == uuid.UUID(batch_id)
            )
        )

    viewer = pipeline.login("INTERNAL_VIEWER").get(f"/api/v1/pieces/{piece_id}/source-records")
    admin = pipeline.login("ADMIN").get(f"/api/v1/pieces/{piece_id}/source-records")

    assert viewer.status_code == 200, viewer.text
    (restricted,) = [item for item in viewer.json() if item["import_batch_id"] == batch_id]
    assert restricted["payload"]["Nombre de propietario"] == "(dato restringido)"
    assert restricted["payload"]["Dirección de propietario"] == "(dato restringido)"
    assert set(restricted["masked_keys"]) >= {"Nombre de propietario", "Dirección de propietario"}
    assert restricted["payload"]["Tipo de propietario"] == "Persona natural (sintética)"
    (full,) = [item for item in admin.json() if item["import_batch_id"] == batch_id]
    assert full["payload"]["Nombre de propietario"] == "Propietario sintético"
    assert full["masked_keys"] == []

    # A cataloguer exports but lacks «sensitive.donor_data».
    export = pipeline.login("CATALOGUER").post(
        "/api/v1/reports/export-excel", json={"filters": {"q": "sintético"}, "format": "csv"}
    )
    assert export.status_code in (200, 202), export.text
    assert "Propietario sintético" not in export.content.decode("utf-8", errors="ignore")
    assert "Calle Inventada" not in export.content.decode("utf-8", errors="ignore")


def test_a_real_template_survives_reading_and_saving_it_through_the_api(
    pipeline: Pipeline,
) -> None:
    """Task 7.4: ``ColumnMapping`` carries the several sources, the measures, the aliases and the
    sensitive marks, so Administration can show and save a real template without losing them."""
    client = pipeline.login("ADMIN")
    templates = client.get("/api/v1/import-templates").json()
    summary_item = next(item for item in templates if item["name"] == "Ficha de catalogación RN")
    detail = client.get(f"/api/v1/import-templates/{summary_item['id']}").json()
    with pipeline.session() as session:
        before = session.get(ImportMappingTemplate, uuid.UUID(summary_item["id"]))
        assert before is not None
        stored_before = before.mapping

    provenance = next(c for c in detail["columns"] if c["source_column"] == "Procedencia")
    assert provenance["source_columns"] == ["Procedencia", "Procedencia (2)", "Procedencia (3)"]
    assert provenance["join"] == ", "
    owner = next(c for c in detail["columns"] if c["source_column"].startswith("Propietario"))
    assert owner["sensitive"] and owner["lender_for_loans"]

    headers = [
        name
        for column in detail["columns"]
        for name in (column["source_columns"] or [column["source_column"]])
    ]
    saved = client.patch(
        f"/api/v1/import-templates/{summary_item['id']}",
        json={"headers": headers, "columns": detail["columns"]},
    )

    assert saved.status_code == 200, saved.text
    with pipeline.session() as session:
        after = session.get(ImportMappingTemplate, uuid.UUID(summary_item["id"]))
        assert after is not None
        assert after.mapping["columns"] == stored_before["columns"]
