"""Spec importacion-datos — Una plantilla guardada aplicada a un lote, de punta a punta
(RF-022, RF-027, RF-008; design D1 phase 2, D2).

Change plantillas-mapeo-y-normalizacion, task 3.5: upload a sheet with the headers of the
synthetic sabana -> the seed template is suggested -> ``PUT /mapping`` with ``template_id``
(the batch stores v1) -> validate -> diffs -> one decision -> approve and apply. The pipeline
reads the v1 mapping through ``MappingSpec.from_json`` without changes (``field_diff``,
``decisions``, ``validate_stage``). Synthetic data only (RNF-014).

The sheet keeps only the «Retablo ayacuchano» row of the sabana: the other rows touch pieces
on loan for use, which the default tenure of this test would change.
"""

import io
import uuid
from typing import Any

from openpyxl import Workbook
from sqlalchemy import select

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.identification.models import PieceIdentifier
from app.modules.imports.models import ImportBatch
from app.seed.fixtures import HEADERS
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import BASE, diffs, get_batch, put_mapping, upload, validate

SEED_TEMPLATE = "Plantilla sábana sintética v1"
RETABLO = [
    1,
    "I 2362 / RA 28",
    "RA",
    "Retablo ayacuchano",
    "ca. 1950",
    "madera, pasta de papa",
    "alto 40 cm",
    "Ayacucho",
    "Sala 2",
    "",
    "",
]


def _sheet() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "SABANA"
    sheet.append(HEADERS)
    sheet.append(RETABLO)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _target(row: dict[str, Any]) -> str:
    [piece_id] = {match["piece_id"] for match in row["matches"] if match["kind"] == "piece"}
    return str(piece_id)


def test_the_seed_template_maps_validates_and_applies_a_batch(pipeline: Pipeline) -> None:
    client = pipeline.client
    batch_id = upload(client, "retablo.xlsx", _sheet())["batch_id"]
    headers = get_batch(client, batch_id)["headers"]

    [suggested, *_] = client.post(
        "/api/v1/import-templates/suggest", json={"headers": headers}
    ).json()
    assert suggested["template"]["name"] == SEED_TEMPLATE and suggested["score"] == 1.0
    template_id = suggested["template"]["id"]

    # 1. Mapping with the template: the batch stores v1 and remembers the template.
    mapped = put_mapping(
        client, batch_id, {"template_id": template_id, "defaults": {"tenure_regime": "Propiedad"}}
    )
    assert mapped.status_code == 200, mapped.text
    body = mapped.json()
    assert body["status"] == "MAPPED" and body["template_id"] == template_id
    assert body["mapping"]["version"] == 1
    assert body["mapping"]["defaults"] == {"tenure_regime": "OWNED"}
    assert {"kind": "terms", "vocabulary": "MATERIAL"} in [
        column["target"] for column in body["mapping"]["columns"]
    ]

    # 2. Validation and diff: ``field_diff`` finds the record fields of the v1 mapping.
    assert validate(client, batch_id).status_code == 202
    [row] = diffs(client, batch_id, page_size=10).json()["items"]
    assert row["classification"] == "UPDATE" and not row["has_validation_errors"]
    changed = {change["field"] for change in row["diff"]}
    assert {"denomination", "provenance", "epoch_original_text", "dimensions_text"} <= changed
    assert "identifier:I" in changed
    piece_id = _target(row)
    with pipeline.session() as session:
        before = session.get(Piece, uuid.UUID(piece_id))
        assert before is not None
        provenance_before, epoch_type_before = before.provenance, before.epoch_type

    # 3. One decision: accept the row but keep the current provenance.
    decided = client.patch(
        f"{BASE}/{batch_id}/rows/{row['id']}",
        json={"decision": "ACCEPTED", "field_decisions": {"provenance": "exclude"}},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["resolution"]["field_decisions"] == {"provenance": "exclude"}

    # 4. Approve and apply.
    approval = get_batch(client, batch_id)["approval_summary"]
    assert approval["update"] == 1 and approval["create"] == 0
    confirmed = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    applied = get_batch(client, batch_id)
    assert applied["status"] == "APPLIED"
    assert applied["counts"]["APPLIED_UPDATED"] == 1

    with pipeline.session() as session:
        piece = session.get(Piece, uuid.UUID(piece_id))
        assert piece is not None
        assert piece.denomination == "Retablo ayacuchano"
        assert piece.epoch_original_text == "ca. 1950"
        assert piece.dimensions_text == "alto 40 cm"
        assert piece.provenance == provenance_before  # excluded by the decision
        assert piece.tenure_regime == TenureRegime.OWNED
        # Proposals stay in the preview (design D2): the structured epoch is not written.
        assert piece.epoch_type == epoch_type_before
        codes = set(
            session.scalars(
                select(PieceIdentifier.original_value).where(
                    PieceIdentifier.piece_id == piece.id, PieceIdentifier.deleted_at.is_(None)
                )
            )
        )
        assert "I 2362" in codes
        # RF-008: the text of the ``terms`` column and the unmapped columns are kept.
        record = session.scalar(
            select(PieceSourceRecord).where(
                PieceSourceRecord.import_batch_id == uuid.UUID(batch_id)
            )
        )
        assert record is not None and record.piece_id == piece.id
        assert record.payload["MATERIAL"] == "madera, pasta de papa"
        assert record.payload["UBICACIÓN"] == "Sala 2"
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None and str(batch.template_id) == template_id
