"""Spec importacion-datos — Los valores por defecto del mapeo no sobrescriben una pieza existente
(RF-027, RN-003, RN-008; design D1, D2).

Bug confirmed by the owner of ``importacion-pipeline-reconciliacion``: a default of the mapping
(``tenure_regime``, ``collection`` or, in v1, ``denomination``) fills the rows without that
value, and on an UPDATE row it reached the diff and overwrote the piece, e.g. turning a piece
on loan for use into an owned one. Defaults only fill new pieces. Synthetic data only
(RNF-014); every test tags its denominations and codes so its rows match only its own piece.
"""

import uuid
from typing import Any

from sqlalchemy import select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.identification.service import add_identifier
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline
from tests.api.test_import_pipeline_api import BASE, diffs, get_batch, put_mapping, upload, validate

COLUMNS = [
    {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
    {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
    {"source_column": "PROCEDENCIA", "target_field": "provenance"},
]


def _tag() -> tuple[str, int]:
    tag = uuid.uuid4().hex[:8]
    return tag, int(tag, 16) % 9000 + 1000


def _piece(pipeline: Pipeline, denomination: str, code: str, **fields: Any) -> uuid.UUID:
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin)):
            piece = create_piece(session, denomination=denomination, **fields)
            add_identifier(session, piece, TYPE_COLLECTION, code)
        session.commit()
        return piece.id


def _collection_id(pipeline: Pipeline, acronym: str) -> uuid.UUID:
    with pipeline.session() as session:
        collection = find_collection_by_code(session, acronym)
        assert collection is not None
        return collection.id


def _validated_row(pipeline: Pipeline, name: str, sheet: str, mapping: dict[str, Any]) -> Any:
    batch_id = upload(pipeline.client, name, sheet.encode("utf-8"))["batch_id"]
    mapped = put_mapping(pipeline.client, batch_id, mapping)
    assert mapped.status_code == 200, mapped.text
    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id, page_size=10).json()["items"]
    return batch_id, row


def _approve(pipeline: Pipeline, batch_id: str) -> dict[str, Any]:
    approval = get_batch(pipeline.client, batch_id)["approval_summary"]
    assert approval["update"] == 1, approval
    confirmed = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    return get_batch(pipeline.client, batch_id)


def _fields(row: dict[str, Any]) -> set[str]:
    return {change["field"] for change in row["diff"]}


def test_a_tenure_default_does_not_change_a_piece_on_loan_for_use(pipeline: Pipeline) -> None:
    tag, code = _tag()
    denomination = f"Comodato con default {tag}"
    piece_id = _piece(
        pipeline, denomination, f"AJB {code}", tenure_regime=TenureRegime.LOAN_FOR_USE
    )
    sheet = f"DENOMINACIÓN;CÓDIGOS;PROCEDENCIA\n{denomination};AJB {code};Procedencia {tag}\n"

    batch_id, row = _validated_row(
        pipeline,
        f"comodato-{tag}.csv",
        sheet,
        {"columns": COLUMNS, "defaults": {"tenure_regime": "Propiedad"}},
    )

    assert row["classification"] == "UPDATE", row
    assert "tenure_regime" not in _fields(row)
    assert _approve(pipeline, batch_id)["status"] == "APPLIED"
    with pipeline.session() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None
        assert piece.tenure_regime == TenureRegime.LOAN_FOR_USE
        assert piece.provenance == f"Procedencia {tag}"  # file data still updates the piece


def test_a_collection_default_does_not_move_an_existing_piece(pipeline: Pipeline) -> None:
    tag, code = _tag()
    denomination = f"En RA con default {tag}"
    ra = _collection_id(pipeline, "RA")
    piece_id = _piece(
        pipeline, denomination, f"RA {code}", tenure_regime=TenureRegime.OWNED, collection_id=ra
    )
    sheet = f"DENOMINACIÓN;CÓDIGOS;PROCEDENCIA\n{denomination};RA {code};Procedencia {tag}\n"

    batch_id, row = _validated_row(
        pipeline,
        f"coleccion-{tag}.csv",
        sheet,
        {"columns": COLUMNS, "defaults": {"tenure_regime": "Propiedad", "collection": "MMZ"}},
    )

    assert row["classification"] == "UPDATE", row
    assert "collection_id" not in _fields(row)
    assert _approve(pipeline, batch_id)["status"] == "APPLIED"
    with pipeline.session() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None and piece.collection_id == ra


def test_a_denomination_default_does_not_rename_an_existing_piece(pipeline: Pipeline) -> None:
    """v1 only: ``denomination`` may come from a default (design D2)."""
    tag, code = _tag()
    denomination = f"Con nombre propio {tag}"
    piece_id = _piece(pipeline, denomination, f"MMZ {code}", tenure_regime=TenureRegime.OWNED)
    sheet = f"CÓDIGOS;PROCEDENCIA\nMMZ {code};Procedencia {tag}\n"
    columns = [
        {
            "source_column": "CÓDIGOS",
            "target_field": "identifier",
            "split_compound": True,
            "transforms": ["trim"],  # makes the batch mapping v1
        },
        {"source_column": "PROCEDENCIA", "target_field": "provenance"},
    ]

    batch_id, row = _validated_row(
        pipeline,
        f"denominacion-{tag}.csv",
        sheet,
        {
            "columns": columns,
            "defaults": {"tenure_regime": "Propiedad", "denomination": "Sin título (sintético)"},
        },
    )

    assert row["classification"] == "UPDATE", row
    assert "denomination" not in _fields(row)
    assert _approve(pipeline, batch_id)["status"] == "APPLIED"
    with pipeline.session() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None and piece.denomination == denomination
