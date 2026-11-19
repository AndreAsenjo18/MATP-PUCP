"""Agregar a la lista un valor del archivo desde la revisión (change importacion-agregar-terminos;
RF-011, RF-025, RN-005, RN-010).

A value not in its list is grouped by list with its rows; whoever manages the vocabularies adds it
there (or reactivates the inactive term with that name) and the batch, validated again, recognizes
it. A cataloguer cannot. Synthetic data (RNF-014).
"""

from sqlalchemy import select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.collections.models import Term, Vocabulary
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import diffs, get_batch, validate
from tests.api.test_import_vocabularies_location import _validated

BASE = "/api/v1/imports"


def test_values_not_in_the_list_are_grouped_by_list_with_their_rows(pipeline: Pipeline) -> None:
    batch_id, _rows = _validated(
        pipeline,
        [
            ["Ave sintética", "Madera, Piedra agrupada", "Escultura agrupada", "", "", ""],
            ["Toro sintético", "piedra  AGRUPADA", "Escultura agrupada", "", "", ""],
        ],
    )
    response = pipeline.client.get(f"{BASE}/{batch_id}/terms")
    assert response.status_code == 200, response.text
    items = {(i["vocabulary"], i["text"]): i for i in response.json()["items"]}
    assert set(items) == {
        ("MATERIAL", "Piedra agrupada"),
        ("OBJECT_TYPE", "Escultura agrupada"),
    }
    assert items[("MATERIAL", "Piedra agrupada")]["rows"] == 2  # case and spaces are one value
    assert items[("OBJECT_TYPE", "Escultura agrupada")]["vocabulary_name"] == "Tipos de bien"
    assert items[("OBJECT_TYPE", "Escultura agrupada")]["inactive_term"] is None


def test_the_manager_adds_the_value_and_validating_again_recognizes_it(
    pipeline: Pipeline,
) -> None:
    batch_id, _rows = _validated(
        pipeline, [["Músicos sintéticos", "", "Escultura nueva", "", "", ""]]
    )
    manager = pipeline.login("COLLECTIONS_MANAGER")
    response = manager.post(
        f"{BASE}/{batch_id}/terms", json={"vocabulary": "OBJECT_TYPE", "text": "Escultura nueva"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "MAPPED"
    with pipeline.session() as session:
        term = session.scalar(select(Term).where(Term.label == "Escultura nueva"))
        assert term is not None and term.code == "ESCULTURA_NUEVA" and term.is_active

    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id).json()["items"]
    assert row["preview"]["object_type"] == "Escultura nueva"
    assert row["preview"]["unmatched_terms"] == {}
    assert not [w for w in row["mapped_data"].get("warnings") or [] if "Escultura" in w["message"]]
    assert pipeline.client.get(f"{BASE}/{batch_id}/terms").json()["items"] == []


def test_an_inactive_term_with_that_name_is_reactivated(pipeline: Pipeline) -> None:
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with pipeline.session() as session, audit_context(session, context):
        vocabulary = session.scalar(select(Vocabulary).where(Vocabulary.code == "MATERIAL"))
        assert vocabulary is not None
        term = session.scalar(
            select(Term).where(Term.vocabulary_id == vocabulary.id, Term.code == "CALABAZA")
        )
        assert term is not None
        term.is_active = False
        session.commit()
    batch_id, _rows = _validated(pipeline, [["Mate sintético", "Calabaza", "", "", "", ""]])
    [item] = pipeline.client.get(f"{BASE}/{batch_id}/terms").json()["items"]
    assert item["inactive_term"] == "Calabaza"

    manager = pipeline.login("COLLECTIONS_MANAGER")
    response = manager.post(
        f"{BASE}/{batch_id}/terms", json={"vocabulary": "MATERIAL", "text": "calabaza"}
    )
    assert response.status_code == 200, response.text
    with pipeline.session() as session:
        terms = session.scalars(select(Term).where(Term.label.ilike("calabaza"))).all()
        assert [(t.code, t.is_active) for t in terms] == [("CALABAZA", True)]  # no new term


def test_a_cataloguer_cannot_add_to_a_list(pipeline: Pipeline) -> None:
    batch_id, _rows = _validated(pipeline, [["Plato sintético", "", "Vajilla", "", "", ""]])
    response = pipeline.client.post(
        f"{BASE}/{batch_id}/terms", json={"vocabulary": "OBJECT_TYPE", "text": "Vajilla"}
    )
    assert response.status_code == 403
    with pipeline.session() as session:
        assert session.scalar(select(Term).where(Term.label == "Vajilla")) is None
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"


def test_only_the_lists_of_the_record_accept_values(pipeline: Pipeline) -> None:
    batch_id, _rows = _validated(pipeline, [["Jarra sintética", "", "", "", "Soplado", ""]])
    manager = pipeline.login("COLLECTIONS_MANAGER")
    response = manager.post(
        f"{BASE}/{batch_id}/terms", json={"vocabulary": "TECHNIQUE", "text": "Soplado"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "vocabulary_not_fixable"
