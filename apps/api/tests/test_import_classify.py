"""Spec importacion-datos — Clasificación de filas y decisiones (RF-025, RN-002, RN-003, RN-004).

Change importacion-pipeline-reconciliacion, task 3.3. Synthetic data only (RNF-014).
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Collection
from app.modules.collections.service import create_collection
from app.modules.identification.normalization import TYPE_COLLECTION, TYPE_INC_RN, TYPE_INVENTORY
from app.modules.identification.service import add_identifier
from app.modules.imports.classify import (
    ProvisionalSimilarityScorer,
    RowInput,
    classification_rules,
    classify_batch,
    record_duplicate_candidates,
)
from app.modules.imports.matching import RowIdentifier
from app.modules.imports.models import ImportBatch, ImportRow, RowClassification
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus
from tests.conftest import ActAs

NEW, UPDATE, DUPLICATE, CONFLICT = (
    RowClassification.NEW,
    RowClassification.UPDATE,
    RowClassification.POSSIBLE_DUPLICATE,
    RowClassification.CONFLICT,
)


@pytest.fixture
def mmz(session: Session, act_as: ActAs) -> Collection:
    with act_as("COLLECTIONS_MANAGER"):
        collection = create_collection(session, name="Colección sintética MMZ", acronym="MMZ")
        session.commit()
    return collection


@pytest.fixture
def catalog(session: Session, act_as: ActAs, mmz: Collection) -> dict[str, Piece]:
    def piece(name: str, collection: Collection | None = None, **codes: str) -> Piece:
        created = create_piece(
            session,
            denomination=name,
            tenure_regime=TenureRegime.OWNED,
            collection_id=collection.id if collection else None,
        )
        for type_code, value in codes.items():
            add_identifier(session, created, type_code, value)
        return created

    with act_as("COLLECTIONS_MANAGER"):
        pieces = {
            "toro": piece("Toro de Pucará", mmz, I="I-0100", COLECCION="MMZ 15"),
            "retablo": piece("Retablo ayacuchano", I="I-2362"),
            "cantaro": piece("Cántaro decorado", mmz, COLECCION="MMZ 20"),
            "charango": piece("Charango", INC_RN="004521"),
        }
        session.commit()
    return pieces


def row(
    number: int,
    *codes: tuple[str, str],
    denomination: str | None = "Pieza sintética",
    tenure: TenureRegime | None = TenureRegime.OWNED,
    collection: Collection | None = None,
) -> RowInput:
    return RowInput(
        row_number=number,
        denomination=denomination,
        tenure_regime=tenure,
        identifiers=[RowIdentifier.from_raw(type_code, raw) for type_code, raw in codes],
        collection_id=collection.id if collection else None,
    )


def classify_one(session: Session, item: RowInput, **kwargs: object):  # type: ignore[no-untyped-def]
    [result] = classify_batch(session, [item], **kwargs)  # type: ignore[arg-type]
    return result


# --- Scenario: Fila nueva -------------------------------------------------------------------------
def test_row_without_candidates_is_new(session: Session, catalog: dict[str, Piece]) -> None:
    result = classify_one(session, row(2, (TYPE_INVENTORY, "I-9999"), denomination="Quena"))

    assert result.classification == NEW
    assert result.target_piece_id is None
    assert result.row_values()["matches"] == []


# --- Scenario: Fila de actualización --------------------------------------------------------------
def test_single_piece_by_inventory_code_is_update(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(
        session, row(2, (TYPE_INVENTORY, "I 100"), (TYPE_COLLECTION, "M.M.Z. 015"))
    )

    assert result.classification == UPDATE
    assert result.target_piece_id == catalog["toro"].id
    [entry] = result.row_values()["matches"]
    assert entry["kind"] == "piece" and entry["contradicts"] == []
    assert {i["identifier_type"] for i in entry["identifiers"]} == {TYPE_INVENTORY, TYPE_COLLECTION}


def test_single_piece_by_another_code_is_update(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(session, row(2, (TYPE_INC_RN, "RN 004521")))

    assert result.classification == UPDATE
    assert result.target_piece_id == catalog["charango"].id


def test_assigning_code_i_to_a_piece_without_one_is_update(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(session, row(2, (TYPE_COLLECTION, "MMZ 20"), (TYPE_INVENTORY, "I-0555")))

    assert result.classification == UPDATE
    assert result.target_piece_id == catalog["cantaro"].id


# --- Scenario: Conflicto --------------------------------------------------------------------------
def test_codes_matching_different_pieces_are_conflict(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(session, row(2, (TYPE_INVENTORY, "I-2362"), (TYPE_COLLECTION, "MMZ 15")))

    assert result.classification == CONFLICT
    assert result.target_piece_id is None
    contradicts = {
        entry["piece_id"]: entry["contradicts"] for entry in result.row_values()["matches"]
    }
    assert contradicts == {
        str(catalog["retablo"].id): [str(catalog["toro"].id)],
        str(catalog["toro"].id): [str(catalog["retablo"].id)],
    }


def test_changing_an_existing_code_i_is_conflict(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(session, row(2, (TYPE_COLLECTION, "MMZ 15"), (TYPE_INVENTORY, "I-0200")))

    assert result.classification == CONFLICT
    [entry] = result.row_values()["matches"]
    assert entry["inventory_code_change"] == {"current": ["I-100"], "incoming": ["I-200"]}


# --- Scenario: Dos filas con el mismo código I ----------------------------------------------------
def test_two_rows_with_the_same_code_i_are_conflict(
    session: Session, catalog: dict[str, Piece]
) -> None:
    rows = [
        row(2, (TYPE_INVENTORY, "I-0236")),
        row(3, (TYPE_INVENTORY, "I 236")),
        row(4, (TYPE_INVENTORY, "I-0237")),
    ]

    first, second, third = classify_batch(session, rows)

    assert first.classification == second.classification == CONFLICT
    assert third.classification == NEW
    assert first.row_values()["matches"] == [
        {"kind": "batch_row", "row_number": 3, "identifier_type": "I", "value": "I-236"}
    ]
    assert second.batch_conflicts[0]["row_number"] == 2


# --- Errores de validación (regla 1) --------------------------------------------------------------
def test_loan_for_use_with_code_i_is_a_validation_error(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(
        session, row(2, (TYPE_INVENTORY, "I-0999"), tenure=TenureRegime.LOAN_FOR_USE)
    )

    assert result.has_validation_errors
    assert [e.code for e in result.validation_errors] == ["loan_for_use_with_inventory_code"]
    assert result.classification == NEW  # still classified so the user sees it


def test_temporary_loan_with_collection_code_is_a_validation_error(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(
        session, row(2, (TYPE_COLLECTION, "AJB 12"), tenure=TenureRegime.TEMPORARY_LOAN)
    )

    assert [e.code for e in result.validation_errors] == ["temporary_loan_with_code"]


def test_missing_title_tenure_and_unreadable_code_i(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = classify_one(session, row(2, (TYPE_INVENTORY, "???"), denomination=" ", tenure=None))

    assert [e.code for e in result.validation_errors] == [
        "title_required",
        "tenure_required",
        "invalid_inventory_code",
    ]
    assert result.row_values()["validation_errors"][2]["field"] == "identifier:I"


def test_absence_marker_is_not_a_code(session: Session, catalog: dict[str, Piece]) -> None:
    result = classify_one(
        session, row(2, (TYPE_INVENTORY, "S/N"), tenure=TenureRegime.LOAN_FOR_USE)
    )

    assert result.validation_errors == []
    assert result.classification == NEW


# --- Scenario: Posible duplicado ------------------------------------------------------------------
def test_similar_row_without_code_is_possible_duplicate(
    session: Session, catalog: dict[str, Piece], mmz: Collection
) -> None:
    scorer = ProvisionalSimilarityScorer(session)
    rows = [
        row(2, (TYPE_INVENTORY, "S/N"), denomination="Toro de pucara", collection=mmz),
        row(3, denomination="Quena", collection=mmz),
        row(4, denomination="Toro de Pucará (3 cuernos)"),
    ]

    duplicate, new, different = classify_batch(session, rows, scorer=scorer)

    assert duplicate.classification == DUPLICATE
    [similar] = duplicate.similar
    assert similar.piece_id == catalog["toro"].id and similar.score == pytest.approx(1.0)
    assert duplicate.row_values()["matches"][0]["kind"] == "similar_piece"
    assert new.classification == NEW
    assert different.classification == NEW


def test_without_scorer_there_are_no_possible_duplicates(
    session: Session, catalog: dict[str, Piece], mmz: Collection
) -> None:
    result = classify_one(session, row(2, denomination="Toro de Pucará", collection=mmz))

    assert result.classification == NEW


def test_duplicate_candidates_are_recorded_idempotently(
    session: Session,
    act_as: ActAs,
    users: dict[str, AppUser],
    catalog: dict[str, Piece],
    mmz: Collection,
) -> None:
    scorer = ProvisionalSimilarityScorer(session)
    [result] = classify_batch(
        session, [row(2, denomination="Toro de Pucará", collection=mmz)], scorer=scorer
    )
    with act_as("CATALOGUER"):
        batch = ImportBatch(id=new_uuid(), source_name="Prueba", file_name="sabana.xlsx")
        session.add(batch)
        import_row = ImportRow(id=new_uuid(), batch_id=batch.id, source_row_number=2, raw_data={})
        session.add(import_row)
        session.flush()
        record_duplicate_candidates(session, import_row.id, result.similar)
        reviewed = record_duplicate_candidates(session, import_row.id, result.similar)[0]
        reviewed.status = DuplicateStatus.DISTINCT
        reviewed.reviewed_by_id = users["COLLECTIONS_MANAGER"].id
        reviewed.reviewed_at = datetime.now(UTC)
        session.flush()
        record_duplicate_candidates(session, import_row.id, result.similar)
        session.commit()

    stored = session.scalars(
        select(DuplicateCandidate).where(DuplicateCandidate.import_row_id == import_row.id)
    ).all()
    assert sorted(c.status for c in stored) == [DuplicateStatus.DISTINCT, DuplicateStatus.PENDING]
    assert all(c.piece_a_id == catalog["toro"].id and c.detected_by == "import" for c in stored)


# --- Scenario: Reglas de clasificación visibles ---------------------------------------------------
def test_classification_rules_are_visible(session: Session) -> None:
    rules = classification_rules(ProvisionalSimilarityScorer(session, threshold=0.8))

    assert [r["result"] for r in rules] == [
        "validation_errors",
        "CONFLICT",
        "UPDATE",
        "POSSIBLE_DUPLICATE",
        "NEW",
    ]
    assert rules[3]["threshold"] == 0.8
    assert "0.80" in rules[3]["description"]
    assert classification_rules(None)[3]["threshold"] is None
