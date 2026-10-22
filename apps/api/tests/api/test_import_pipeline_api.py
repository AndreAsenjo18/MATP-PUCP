"""Spec importacion-datos — ingesta, mapeo, validación y previsualización por HTTP.

Change importacion-pipeline-reconciliacion, tareas 2.1 (Req: Ingesta de hojas de cálculo con
límites), 3.1 (Req: Estados del lote con etapas reanudables; RF-022 vía change hermano) y 3.4
(Req: Decisiones por fila y por campo con resolución de conflictos; RF-024, RF-025, RF-026).

Starlette's TestClient runs background tasks before returning, so a stage launched by a request
has finished when the next request is made.
"""

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import TYPE_COLLECTION, TYPE_INVENTORY
from app.modules.imports.models import ImportBatch, ImportRow
from tests.api.conftest import Pipeline

FIXTURES = Path(__file__).resolve().parents[4] / "data" / "fixtures"
SABANA = (FIXTURES / "sabana_sintetica_v1.xlsx").read_bytes()
VARIAS_HOJAS = (FIXTURES / "ingesta_varias_hojas.xlsx").read_bytes()
BASE = "/api/v1/imports"


def upload(client: TestClient, name: str, content: bytes) -> dict[str, Any]:
    response = client.post(f"{BASE}/upload", files={"file": (name, content)})
    assert response.status_code == 202, response.text
    return response.json()


def get_batch(client: TestClient, batch_id: str) -> dict[str, Any]:
    response = client.get(f"{BASE}/{batch_id}")
    assert response.status_code == 200, response.text
    return response.json()


def put_mapping(client: TestClient, batch_id: str, body: dict[str, Any]) -> Any:
    return client.put(f"{BASE}/{batch_id}/mapping", json=body)


def validate(client: TestClient, batch_id: str) -> Any:
    return client.post(f"{BASE}/{batch_id}/validate")


def diffs(client: TestClient, batch_id: str, **params: object) -> Any:
    return client.get(f"{BASE}/{batch_id}/diffs", params=params)


SABANA_MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "PROCEDENCIA", "target_field": "provenance"},
        {"source_column": "ÉPOCA", "target_field": "epoch_original_text"},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


# --- 2.1 Ingesta -----------------------------------------------------------------------------
def test_upload_stores_the_original_and_reads_it_in_the_background(pipeline: Pipeline) -> None:
    summary = upload(pipeline.client, "sabana_sintetica_v1.xlsx", SABANA)

    assert summary["filename"] == "sabana_sintetica_v1.xlsx"
    assert summary["status"] == "UPLOADED"
    assert set(summary["summary"]) == {"new_records", "updates", "conflicts"}
    batch = get_batch(pipeline.client, summary["batch_id"])
    assert batch["status"] == "UPLOADED" and batch["processing"] is False
    assert batch["counts"]["rows"] == 40
    assert batch["sheet_name"] == "SABANA" and batch["header_row"] == 1
    assert "DENOMINACIÓN" in batch["headers"]
    assert batch["file_sha256"] == hashlib.sha256(SABANA).hexdigest()
    key = f"imports/{summary['batch_id']}/original.xlsx"
    assert pipeline.stored[key] == SABANA  # the original is kept untouched


def test_unsupported_format_leaves_the_batch_failed_in_ingestion(pipeline: Pipeline) -> None:
    summary = upload(pipeline.client, "inventario.pdf", b"%PDF-1.4 sintetico")

    assert summary["status"] == "FAILED_INGESTION"
    batch = get_batch(pipeline.client, summary["batch_id"])
    assert batch["status"] == "FAILED_INGESTION"
    assert ".pdf" in batch["status_reason"] and ".xlsx" in batch["status_reason"]


def test_row_limit_leaves_the_batch_failed_in_ingestion(pipeline: Pipeline) -> None:
    limited = pipeline.app_for(import_max_rows=5)

    summary = upload(limited, "sabana_sintetica_v1.xlsx", SABANA)

    batch = get_batch(limited, summary["batch_id"])
    assert batch["status"] == "FAILED_INGESTION"
    assert "5 filas" in batch["status_reason"]
    assert batch["processing"] is False


def test_file_over_the_size_limit_creates_no_batch(pipeline: Pipeline) -> None:
    small = pipeline.app_for(import_max_bytes=1024)
    with pipeline.session() as session:
        before = session.scalar(select(func.count()).select_from(ImportBatch))

    response = small.post(f"{BASE}/upload", files={"file": ("grande.xlsx", SABANA)})

    assert response.status_code == 422
    assert response.json()["code"] == "file_too_large"
    with pipeline.session() as session:
        assert session.scalar(select(func.count()).select_from(ImportBatch)) == before


def test_viewer_cannot_upload(pipeline: Pipeline) -> None:
    viewer = pipeline.app_for("INTERNAL_VIEWER")
    response = viewer.post(f"{BASE}/upload", files={"file": ("x.csv", b"A\n1\n")})
    assert response.status_code == 403


def test_list_filters_by_status(pipeline: Pipeline) -> None:
    failed = upload(pipeline.client, "otro.docx", b"no es una hoja")["batch_id"]

    manager = pipeline.app_for("COLLECTIONS_MANAGER")
    response = manager.get(BASE, params={"status": "FAILED_INGESTION"})

    assert response.status_code == 200
    items = response.json()["items"]
    assert failed in {item["id"] for item in items}
    assert {item["status"] for item in items} == {"FAILED_INGESTION"}


def test_unknown_batch_is_404(pipeline: Pipeline) -> None:
    response = pipeline.client.get(f"{BASE}/{uuid.uuid4()}")
    assert response.status_code == 404


# --- 3.1 Mapeo -------------------------------------------------------------------------------
def test_valid_mapping_moves_the_batch_to_mapped(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]

    response = put_mapping(pipeline.client, batch_id, SABANA_MAPPING)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "MAPPED"
    assert body["mapping"]["defaults"] == {"tenure_regime": "Propiedad"}
    assert {column["source"] for column in body["mapping"]["columns"]} >= {"DENOMINACIÓN"}


def test_mapping_without_denomination_is_422(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]

    response = put_mapping(
        pipeline.client,
        batch_id,
        {"columns": [{"source_column": "PROCEDENCIA", "target_field": "provenance"}]},
    )

    assert response.status_code == 422
    errors = response.json()["details"]["errors"]
    assert "denomination_required" in {error["code"] for error in errors}
    assert get_batch(pipeline.client, batch_id)["status"] == "UPLOADED"


def test_mapping_with_a_column_not_in_the_file_is_422(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]

    response = put_mapping(
        pipeline.client,
        batch_id,
        {"columns": [{"source_column": "NO EXISTE", "target_field": "denomination"}]},
    )

    assert response.status_code == 422
    errors = response.json()["details"]["errors"]
    assert errors[0] == {
        "code": "unknown_column",
        "message": "La columna «NO EXISTE» no está en el archivo.",
        "column": "NO EXISTE",
    }


def test_choosing_another_sheet_and_header_row_reads_the_file_again(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "varias_hojas.xlsx", VARIAS_HOJAS)["batch_id"]
    assert get_batch(pipeline.client, batch_id)["sheet_name"] == "Resumen"

    response = put_mapping(
        pipeline.client,
        batch_id,
        {
            "sheet_name": "Inventario",
            "header_row": 3,
            "columns": [{"source_column": "DENOMINACIÓN", "target_field": "denomination"}],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "MAPPED"
    assert body["sheet_name"] == "Inventario" and body["header_row"] == 3
    assert "CÓDIGOS" in body["headers"] and body["counts"]["rows"] == 4


def test_an_unknown_template_is_rejected(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]

    response = put_mapping(pipeline.client, batch_id, {"template_id": str(uuid.uuid4())})

    assert response.status_code == 404
    assert response.json()["code"] == "template_not_found"


def test_failed_batch_cannot_be_mapped(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "inventario.pdf", b"%PDF")["batch_id"]

    response = put_mapping(pipeline.client, batch_id, SABANA_MAPPING)

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_batch_transition"


# --- 3.4 Validación y previsualización -------------------------------------------------------
@dataclass
class Catalog:
    """Pieces of the seed the controlled sheet refers to."""

    target: Piece
    target_code: str
    other_collection_code: str
    third_code: str


def _catalog(session: Session) -> Catalog:
    def inventory_codes() -> list[tuple[Piece, str]]:
        rows = session.execute(
            select(Piece, PieceIdentifier.original_value)
            .join(PieceIdentifier, PieceIdentifier.piece_id == Piece.id)
            .where(
                PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
                PieceIdentifier.is_current,
                PieceIdentifier.deleted_at.is_(None),
                Piece.deleted_at.is_(None),
                Piece.tenure_regime == TenureRegime.OWNED,
            )
            .order_by(Piece.id)
        ).all()
        return [(piece, code) for piece, code in rows]

    with_author = [(p, c) for p, c in inventory_codes() if p.author and p.provenance]
    target, target_code = with_author[0]
    third_code = next(code for piece, code in inventory_codes() if piece.id != target.id)
    third_id = next(piece.id for piece, code in inventory_codes() if code == third_code)
    other_collection_code = session.scalar(
        select(PieceIdentifier.original_value)
        .where(
            PieceIdentifier.identifier_type_code == TYPE_COLLECTION,
            PieceIdentifier.is_current,
            PieceIdentifier.deleted_at.is_(None),
            PieceIdentifier.piece_id.not_in([target.id, third_id]),
        )
        .order_by(PieceIdentifier.id)
        .limit(1)
    )
    assert other_collection_code is not None
    return Catalog(target, target_code, other_collection_code, third_code)


def _controlled_sheet(catalog: Catalog) -> bytes:
    """One row per rule of the classification (design D4)."""
    lines = [
        "DENOMINACIÓN;CÓDIGOS;RÉGIMEN;PROCEDENCIA;AUTOR;OBS. CONSULTORÍA",
        f"{catalog.target.denomination};{catalog.target_code};Propiedad;Procedencia sintética "
        "nueva;;Revisado (sintético)",
        "Pieza nueva sintética zz;S/N;Propiedad;;;",
        f"Códigos contradictorios zz;{catalog.third_code} / {catalog.other_collection_code};"
        "Propiedad;;;",
        "Primera con código repetido zz;I-98761;Propiedad;;;",
        "Segunda con código repetido zz;I 98761;Propiedad;;;",
        "Comodato con código I zz;I-98762;Comodato;;;",
    ]
    return ("\n".join(lines) + "\n").encode("utf-8")


CONTROLLED_MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "RÉGIMEN", "target_field": "tenure_regime"},
        {"source_column": "PROCEDENCIA", "target_field": "provenance"},
        {"source_column": "AUTOR", "target_field": "author"},
    ]
}


@pytest.fixture(scope="module")
def controlled(pipeline: Pipeline) -> tuple[str, Catalog]:
    with pipeline.session() as session:
        catalog = _catalog(session)
        session.expunge_all()
    batch_id = upload(pipeline.client, "controlada.csv", _controlled_sheet(catalog))["batch_id"]
    assert put_mapping(pipeline.client, batch_id, CONTROLLED_MAPPING).status_code == 200
    response = validate(pipeline.client, batch_id)
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "MAPPED"  # the answer comes before the stage runs
    return batch_id, catalog


def test_validation_classifies_every_row_and_reaches_preview(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    batch = get_batch(pipeline.client, controlled[0])

    assert batch["status"] == "IN_PREVIEW" and batch["processing"] is False
    assert batch["progress"] is None
    counts = batch["counts"]
    assert {key: counts[key] for key in ("NEW", "UPDATE", "POSSIBLE_DUPLICATE", "CONFLICT")} == {
        "NEW": 2,
        "UPDATE": 1,
        "POSSIBLE_DUPLICATE": 0,
        "CONFLICT": 3,
    }
    assert counts["ERRORS"] == 1
    assert {"VALIDATED", "IN_PREVIEW"} <= set(batch["stage_timestamps"])


def test_update_row_shows_its_diff_with_the_default_actions(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    batch_id, catalog = controlled

    page = diffs(pipeline.client, batch_id, classification="UPDATE").json()

    assert page["total"] == 1
    row = page["items"][0]
    assert row["source_row_number"] == 2
    assert row["target_piece_id"] == str(catalog.target.id)
    changes = {change["field"]: change for change in row["diff"]}
    assert changes["provenance"] == {
        "field": "provenance",
        "current_value": catalog.target.provenance,
        "incoming_value": "Procedencia sintética nueva",
        "default_action": "accept",
    }
    # An empty cell never erases a current value by default [SUPUESTO B10].
    assert changes["author"]["incoming_value"] is None
    assert changes["author"]["default_action"] == "keep"
    assert "denomination" not in changes and "tenure_regime" not in changes
    # Unmapped columns are kept as source data (RF-008).
    assert row["mapped_data"]["source_payload"] == {"OBS. CONSULTORÍA": "Revisado (sintético)"}


def test_rows_sharing_a_code_i_are_conflicts_pointing_to_each_other(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    page = diffs(pipeline.client, controlled[0], classification="CONFLICT").json()

    by_row = {row["source_row_number"]: row for row in page["items"]}
    assert set(by_row) == {4, 5, 6}
    other_rows = {
        number: [m["row_number"] for m in row["matches"] if m["kind"] == "batch_row"]
        for number, row in by_row.items()
    }
    assert other_rows[5] == [6] and other_rows[6] == [5]
    # Row 4: its codes point to two different pieces (RF-024).
    pieces = [match for match in by_row[4]["matches"] if match["kind"] == "piece"]
    assert len(pieces) == 2 and all(match["contradicts"] for match in pieces)


def test_only_errors_lists_the_loan_for_use_with_code_i(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    page = diffs(pipeline.client, controlled[0], only_errors=True).json()

    assert [row["source_row_number"] for row in page["items"]] == [7]
    row = page["items"][0]
    assert row["has_validation_errors"] is True
    assert row["validation_errors"][0]["code"] == "loan_for_use_with_inventory_code"


def test_preview_shows_the_classification_rules(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    page = diffs(pipeline.client, controlled[0]).json()

    assert page["total"] == 6
    rules = page["classification_rules"]
    assert [rule["order"] for rule in rules] == [1, 2, 3, 4, 5]
    duplicate = next(rule for rule in rules if rule["result"] == "POSSIBLE_DUPLICATE")
    assert duplicate["threshold"] == 0.75


def test_validating_again_gives_the_same_rows(
    pipeline: Pipeline, controlled: tuple[str, Catalog]
) -> None:
    batch_id = controlled[0]
    before = diffs(pipeline.client, batch_id).json()["items"]
    assert put_mapping(pipeline.client, batch_id, CONTROLLED_MAPPING).status_code == 200

    assert validate(pipeline.client, batch_id).status_code == 202

    after = diffs(pipeline.client, batch_id).json()["items"]
    strip = [{k: v for k, v in row.items() if k != "id"} for row in before]
    assert [{k: v for k, v in row.items() if k != "id"} for row in after] == strip
    with pipeline.session() as session:
        rows = session.scalar(
            select(func.count())
            .select_from(ImportRow)
            .where(ImportRow.batch_id == uuid.UUID(batch_id))
        )
    assert rows == 6


def test_remapping_a_batch_in_preview_discards_its_validation(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]
    put_mapping(pipeline.client, batch_id, SABANA_MAPPING)
    validate(pipeline.client, batch_id)
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"

    response = put_mapping(pipeline.client, batch_id, SABANA_MAPPING)

    assert response.status_code == 200
    assert response.json()["status"] == "MAPPED"
    assert "UPDATE" not in response.json()["counts"]
    assert diffs(pipeline.client, batch_id).status_code == 409
    with pipeline.session() as session:
        classified = session.scalar(
            select(func.count())
            .select_from(ImportRow)
            .where(ImportRow.batch_id == uuid.UUID(batch_id), ImportRow.classification.is_not(None))
        )
    assert classified == 0


def test_validation_requires_a_mapped_batch(pipeline: Pipeline) -> None:
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]

    response = validate(pipeline.client, batch_id)

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_batch_transition"


def test_synthetic_sheet_rows_with_the_same_code_i_conflict(pipeline: Pipeline) -> None:
    """The spec scenario: `I-0236` and `I 236` in the same batch."""
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]
    put_mapping(pipeline.client, batch_id, SABANA_MAPPING)
    validate(pipeline.client, batch_id)

    batch = get_batch(pipeline.client, batch_id)
    assert batch["status"] == "IN_PREVIEW"
    counts = batch["counts"]
    classified = sum(counts[key] for key in ("NEW", "UPDATE", "POSSIBLE_DUPLICATE", "CONFLICT"))
    assert classified == counts["rows"] == 40
    rows = {
        row["source_row_number"]: row
        for row in diffs(pipeline.client, batch_id, page_size=100).json()["items"]
    }
    assert rows[2]["classification"] == rows[3]["classification"] == "CONFLICT"
    assert 3 in [m.get("row_number") for m in rows[2]["matches"] if m["kind"] == "batch_row"]
