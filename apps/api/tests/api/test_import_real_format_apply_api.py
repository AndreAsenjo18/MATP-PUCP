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
