"""Spec importacion-datos — Hojas de errores de la consultoría como observaciones (RF-028, RN-005;
change formatos-reales-importacion, task 6.2, design D8, [SUPUESTO L8]).

A sheet «Errores pendientes» is loaded as observations of the pieces it identifies by their codes:
each found piece gets the text of the row in its notes, with the source; a row whose piece is not
in the catalogue stays in the log as «pieza no encontrada» with its code; no piece is created.
Synthetic data only (RNF-014): every test tags its codes so its rows match only its own pieces.
"""

import io
import uuid
from typing import Any

from openpyxl import Workbook
from sqlalchemy import func, select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.identification.service import add_identifier
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline
from tests.api.test_import_pipeline_api import BASE, diffs, get_batch, put_mapping, upload, validate

SHEET = "Errores pendientes"
HEADERS = ["Código de la colección", "Error identificado", "Acción sugerida"]
COLUMNS = [
    {
        "source_column": "Código de la colección",
        "target_field": "identifier",
        "split_compound": True,
    }
]
SOURCE = "[Consultoría 2024/25 — errores pendientes]"


def _tag() -> tuple[str, int]:
    tag = uuid.uuid4().hex[:8]
    return tag, int(tag, 16) % 9000 + 1000


def _piece(pipeline: Pipeline, denomination: str, code: str, notes: str | None = None) -> uuid.UUID:
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin)):
            piece = create_piece(
                session,
                denomination=denomination,
                tenure_regime=TenureRegime.OWNED,
                notes=notes,
            )
            add_identifier(session, piece, TYPE_COLLECTION, code)
        session.commit()
        return piece.id


def _workbook(rows: list[list[str]]) -> bytes:
    """A workbook with an inventory sheet first and the sheet of errors after it."""
    workbook = Workbook()
    inventory = workbook.active
    assert inventory is not None
    inventory.title = "Inventario"
    inventory.append(["Denominación", "Código de la colección"])
    errors = workbook.create_sheet(SHEET)
    errors.append(HEADERS)
    for row in rows:
        errors.append(row)
    stream = io.BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def _validated(pipeline: Pipeline, tag: str, rows: list[list[str]]) -> tuple[str, list[Any]]:
    batch_id = upload(pipeline.client, f"errores-{tag}.xlsx", _workbook(rows))["batch_id"]
    mapped = put_mapping(
        pipeline.client, batch_id, {"sheet_name": SHEET, "observations": True, "columns": COLUMNS}
    )
    assert mapped.status_code == 200, mapped.text
    assert mapped.json()["kind"] == "OBSERVATIONS"
    assert validate(pipeline.client, batch_id).status_code == 202
    return batch_id, diffs(pipeline.client, batch_id, page_size=20).json()["items"]


def _confirm(pipeline: Pipeline, batch_id: str) -> dict[str, Any]:
    approval = get_batch(pipeline.client, batch_id)["approval_summary"]
    confirmed = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    return get_batch(pipeline.client, batch_id)


def _pieces(pipeline: Pipeline) -> int:
    with pipeline.session() as session:
        return session.scalar(select(func.count(Piece.id))) or 0


def test_errors_sheet_adds_observations_to_found_pieces_and_creates_none(
    pipeline: Pipeline,
) -> None:
    tag, code = _tag()
    piece_id = _piece(pipeline, f"Mate burilado {tag}", f"MMZ {code}", notes="Nota previa")
    rows = [
        [f"MMZ {code}", "Número de inventario repetido", "Revisar ficha"],
        [f"MMZ {code + 1}", "Pieza sin foto", ""],
    ]

    batch_id, items = _validated(pipeline, tag, rows)

    found, missing = sorted(items, key=lambda item: item["source_row_number"])
    assert found["classification"] == "UPDATE" and found["target_piece_id"] == str(piece_id)
    [change] = found["diff"]
    assert change["field"] == "notes"
    line = (
        f"{SOURCE} Error identificado: Número de inventario repetido; "
        "Acción sugerida: Revisar ficha"
    )
    assert change["current_value"] == "Nota previa"
    assert change["incoming_value"] == f"Nota previa\n{line}"
    assert missing["has_validation_errors"]
    assert [error["code"] for error in missing["validation_errors"]] == ["piece_not_found"]
    assert f"MMZ {code + 1}" in missing["validation_errors"][0]["message"]

    before = _pieces(pipeline)
    assert _confirm(pipeline, batch_id)["status"] == "APPLIED"

    assert _pieces(pipeline) == before  # an observation never creates a piece
    with pipeline.session() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None
        assert piece.notes == f"Nota previa\n{line}"
    log = pipeline.client.get(f"{BASE}/{batch_id}/log").json()
    [entry] = [entry for entry in log["entries"] if entry["action"] == "SKIP"]
    assert entry["source_row_number"] == missing["source_row_number"]
    assert "Pieza no encontrada" in entry["reason"] and f"MMZ {code + 1}" in entry["reason"]


def test_a_sheet_of_observations_needs_a_code_column_not_a_denomination(
    pipeline: Pipeline,
) -> None:
    tag, code = _tag()
    batch_id = upload(
        pipeline.client, f"errores-{tag}.xlsx", _workbook([[f"MMZ {code}", "Error", ""]])
    )["batch_id"]

    response = put_mapping(
        pipeline.client,
        batch_id,
        {
            "sheet_name": SHEET,
            "observations": True,
            "columns": [{"source_column": "Error identificado", "target_field": "notes"}],
        },
    )

    assert response.status_code == 422
    codes = {error["code"] for error in response.json()["details"]["errors"]}
    assert codes == {"identifier_required"}
    assert get_batch(pipeline.client, batch_id)["kind"] == "SPREADSHEET"


def test_a_row_of_two_pieces_is_resolved_to_one_never_to_a_new_piece(pipeline: Pipeline) -> None:
    tag, code = _tag()
    first = _piece(pipeline, f"Retablo {tag}", f"RA {code}")
    _piece(pipeline, f"Retablo gemelo {tag}", f"RA {code + 1}")
    batch_id, [row] = _validated(
        pipeline, tag, [[f"RA {code} / RA {code + 1}", "Dos piezas con la misma ficha", ""]]
    )
    assert row["classification"] == "CONFLICT" and not row["has_validation_errors"]
    path = f"{BASE}/{batch_id}/rows/{row['id']}"

    as_new = pipeline.login("CATALOGUER").patch(path, json={"decision": "ACCEPTED", "as_new": True})
    chosen = pipeline.login("CATALOGUER").patch(
        path, json={"decision": "ACCEPTED", "target_piece_id": str(first)}
    )

    assert as_new.status_code == 422
    assert as_new.json()["code"] == "observation_creates_no_piece"
    assert chosen.status_code == 200, chosen.text
    [change] = chosen.json()["diff"]
    assert change["field"] == "notes"
    assert change["incoming_value"].endswith("Error identificado: Dos piezas con la misma ficha")
    assert _confirm(pipeline, batch_id)["status"] == "APPLIED"
    with pipeline.session() as session:
        piece = session.get(Piece, first)
        assert piece is not None and "Dos piezas con la misma ficha" in (piece.notes or "")


def test_the_same_sheet_can_be_loaded_as_pieces_again(pipeline: Pipeline) -> None:
    tag, code = _tag()
    batch_id = upload(
        pipeline.client, f"errores-{tag}.xlsx", _workbook([[f"MMZ {code}", "Error", ""]])
    )["batch_id"]
    assert (
        put_mapping(
            pipeline.client,
            batch_id,
            {"sheet_name": SHEET, "observations": True, "columns": COLUMNS},
        ).json()["kind"]
        == "OBSERVATIONS"
    )

    response = put_mapping(
        pipeline.client,
        batch_id,
        {
            "observations": False,
            "columns": [
                *COLUMNS,
                {"source_column": "Error identificado", "target_field": "denomination"},
            ],
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["kind"] == "SPREADSHEET"
