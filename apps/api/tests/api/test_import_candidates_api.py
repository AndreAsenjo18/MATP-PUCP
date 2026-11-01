"""Spec importacion-datos — Candidatos distinguibles en conflictos y posibles duplicados.

Change rediseno-ux-importacion, tarea 5.1: la previsualización describe cada pieza candidata con
su denominación, colección y código I vigente para que una persona pueda distinguirlas.
"""

import uuid

from app.modules.imports.candidates import enrich_matches
from app.modules.imports.models import ImportRow
from tests.api.conftest import Pipeline
from tests.api.test_import_decisions_api import decide, prepared
from tests.api.test_import_pipeline_api import get_batch


def test_candidates_of_a_row_carry_the_data_of_their_piece(pipeline: Pipeline) -> None:
    batch = prepared(pipeline)

    # Row 4 brings codes of two different pieces (contradiction): two candidates to tell apart.
    candidates = [m for m in batch.rows[4]["matches"] if m["kind"] == "piece"]

    assert len(candidates) == 2
    for candidate in candidates:
        assert candidate["available"] is True
        assert candidate["denomination"]
        assert "collection_name" in candidate
    # A piece without code I says so with null; the other one shows its code.
    assert any(candidate["inventory_code"] for candidate in candidates)
    assert len({candidate["piece_id"] for candidate in candidates}) == 2


def test_a_row_without_candidates_keeps_its_empty_list(pipeline: Pipeline) -> None:
    batch = prepared(pipeline)

    assert batch.rows[3]["matches"] == []


def test_a_missing_piece_stays_in_the_list_as_not_available(pipeline: Pipeline) -> None:
    missing = str(uuid.uuid4())
    row = ImportRow(
        id=uuid.uuid4(),
        batch_id=uuid.uuid4(),
        source_row_number=2,
        raw_data={},
        matches=[
            {"kind": "piece", "piece_id": missing, "identifiers": []},
            {"kind": "batch_row", "row_number": 3},
        ],
    )

    with pipeline.session() as session:
        enriched = enrich_matches(session, [row])[row.id]

    assert enriched[0]["available"] is False
    assert enriched[0]["denomination"] is None
    assert enriched[0]["inventory_code"] is None
    # Entries that are not pieces are left as they were.
    assert enriched[1] == {"kind": "batch_row", "row_number": 3}


def test_the_batch_counts_the_rows_a_person_already_decided(pipeline: Pipeline) -> None:
    """Validating again drops the decisions, so the wizard warns with this count."""
    batch = prepared(pipeline)
    assert get_batch(pipeline.client, batch.id)["counts"]["DECIDED"] == 0

    assert decide(pipeline, batch, 3, decision="EXCLUDED").status_code == 200
    assert (
        decide(pipeline, batch, 4, decision="REJECTED", reason="Duplicada (sintética)").status_code
        == 200
    )

    assert get_batch(pipeline.client, batch.id)["counts"]["DECIDED"] == 2
