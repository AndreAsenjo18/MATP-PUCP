"""The vocabularies and the location of a row reach the new piece (change
importacion-aplicar-vocabularios; RF-006, RF-012, RN-005, RN-010).

Before, only the acquisition method was written: materials, the object type and the conservation
state were matched while validating and then lost, and the location had no target. Synthetic data
(RNF-014): the seed has «Madera», «Regular» and the space «Depósito 1».
"""

import io
from typing import Any

from openpyxl import Workbook
from sqlalchemy import select

from app.modules.catalog.models import ConservationAssessment, Piece, PieceMaterial
from app.modules.collections.models import Term
from app.modules.locations.models import Location, PieceMovement
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import diffs, get_batch, put_mapping, upload, validate

BASE = "/api/v1/imports"
MAPPING = {
    "columns": [
        {"source_column": "Denominación", "target_field": "denomination"},
        {"source_column": "Material", "target_field": "terms:MATERIAL", "transforms": ["trim"]},
        {"source_column": "Tipo de bien", "target_field": "terms:OBJECT_TYPE"},
        {"source_column": "Estado", "target_field": "terms:CONSERVATION_STATUS"},
        {"source_column": "Técnica", "target_field": "terms:TECHNIQUE"},
        {"source_column": "Ubicación", "target_field": "location"},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def _workbook(rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _validated(pipeline: Pipeline, rows: list[list[Any]]) -> tuple[str, list[dict]]:
    header = ["Denominación", "Material", "Tipo de bien", "Estado", "Técnica", "Ubicación"]
    batch_id = upload(pipeline.client, "vocabularios.xlsx", _workbook([header, *rows]))["batch_id"]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return batch_id, diffs(pipeline.client, batch_id).json()["items"]


def test_terms_and_location_reach_the_new_piece(pipeline: Pipeline) -> None:
    batch_id, rows = _validated(
        pipeline,
        [
            [
                "Taza sintética",
                "Madera, Cuerno",
                "Bien mueble",
                "Regular",
                "Tallado",
                "Deposito N° 1",
            ]
        ],
    )
    [row] = rows
    warnings = [w["code"] for w in row["mapped_data"]["warnings"]]
    assert warnings == ["term_not_in_vocabulary"]  # «Cuerno» is not in the list of materials
    assert "Cuerno" in row["mapped_data"]["warnings"][0]["message"]
    payload = row["mapped_data"]["source_payload"]
    assert payload["Material"] == "Madera, Cuerno"  # the unmatched text is kept
    assert payload["Técnica"] == "Tallado"  # a vocabulary the record has no field for

    approval = get_batch(pipeline.client, batch_id)["approval_summary"]
    confirm = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert confirm.status_code == 200, confirm.text
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"

    with pipeline.session() as session:
        piece = session.scalar(select(Piece).where(Piece.denomination == "Taza sintética"))
        assert piece is not None
        materials = session.scalars(
            select(Term.label)
            .join(PieceMaterial, PieceMaterial.term_id == Term.id)
            .where(PieceMaterial.piece_id == piece.id, PieceMaterial.deleted_at.is_(None))
        ).all()
        assert materials == ["Madera"]
        assert session.get(Term, piece.object_type_term_id).label == "Bien mueble"
        assessment = session.scalar(
            select(ConservationAssessment).where(ConservationAssessment.piece_id == piece.id)
        )
        assert assessment is not None
        assert session.get(Term, assessment.status_term_id).label == "Regular"
        location = session.get(Location, piece.current_location_id)
        assert location is not None and location.name == "Depósito 1"
        assert session.scalar(select(PieceMovement).where(PieceMovement.piece_id == piece.id))


def test_an_unknown_location_is_a_warning_and_is_kept(pipeline: Pipeline) -> None:
    _batch_id, rows = _validated(
        pipeline, [["Plato sintético", "Madera", "Bien mueble", "Bueno", None, "Sótano 9"]]
    )
    [row] = rows
    warning = next(w for w in row["mapped_data"]["warnings"] if w["code"] == "location_not_found")
    assert "«Sótano 9»" in warning["message"]
    assert row["mapped_data"]["source_payload"]["Ubicación"] == "Sótano 9"
    assert not row["has_validation_errors"]


def test_an_unknown_location_is_pointed_to_an_existing_one(pipeline: Pipeline) -> None:
    batch_id, _rows = _validated(
        pipeline,
        [
            ["Jarra sintética", "Madera", "Bien mueble", "Bueno", None, "Almacén viejo"],
            ["Vaso sintético", "Madera", "Bien mueble", "Bueno", None, "almacen  VIEJO"],
        ],
    )
    unresolved = pipeline.client.get(f"{BASE}/{batch_id}/locations").json()["items"]
    assert unresolved == [{"text": "Almacén viejo", "rows": 2}]

    with pipeline.session() as session:
        rack = session.scalar(select(Location).where(Location.code == "SC-DEP1-RA"))
        assert rack is not None
        rack_id = str(rack.id)
    response = pipeline.client.put(
        f"{BASE}/{batch_id}/locations", json={"text": "Almacén viejo", "location_id": rack_id}
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MAPPED"
    assert validate(pipeline.client, batch_id).status_code == 202

    # The correspondence ignores case, accents and spaces: both rows now have the location.
    assert pipeline.client.get(f"{BASE}/{batch_id}/locations").json()["items"] == []
    rows = diffs(pipeline.client, batch_id).json()["items"]
    assert {row["mapped_data"].get("location_id") for row in rows} == {rack_id}


def test_a_site_is_not_a_valid_location(pipeline: Pipeline) -> None:
    batch_id, _rows = _validated(
        pipeline, [["Cuenco sintético", "Madera", "Bien mueble", "Bueno", None, "Galpón"]]
    )
    with pipeline.session() as session:
        site = session.scalar(select(Location).where(Location.code == "SC"))
        assert site is not None
        site_id = str(site.id)

    response = pipeline.client.put(
        f"{BASE}/{batch_id}/locations", json={"text": "Galpón", "location_id": site_id}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "space_required"


def test_each_row_shows_how_the_sheet_would_look(pipeline: Pipeline) -> None:
    """«Así quedaría la ficha» (change importacion-vista-previa-ficha): names, not codes."""
    _batch_id, rows = _validated(
        pipeline,
        [["Cántaro sintético", "Madera", "Bien mueble", "Regular", "Tallado", "Deposito N° 1"]],
    )
    [row] = rows
    preview = row["preview"]
    assert preview["denomination"] == "Cántaro sintético"
    assert preview["materials"] == ["Madera"]
    assert preview["object_type"] == "Bien mueble"
    assert preview["conservation_status"] == "Regular"
    assert preview["tenure_regime"] == "Propiedad"
    assert preview["location"] == "Sede central (sintética) › Depósito 1"
    assert preview["location_text"] is None
