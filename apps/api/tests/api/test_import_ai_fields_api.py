"""Carga masiva con IA (change carga-masiva-con-ia, tarea 2): pedir la extracción de texto libre
de una fila del lote, guardar lo elegido en la grilla y verlo aplicado al aprobar el lote.

Corre contra el proveedor mock real (``AI_PROVIDER`` no está definido en el entorno de pruebas),
sin red ni clave — mismo espíritu que ``test_api_ai_extraction_pipeline.py``, pero por fila de un
lote en vez de por una sola pieza.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline
from tests.api.test_import_pipeline_api import (
    BASE,
    Catalog,
    _catalog,
    diffs,
    put_mapping,
    upload,
    validate,
)

MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "RÉGIMEN", "target_field": "tenure_regime"},
        # "OBSERVACIONES" queda deliberadamente sin mapear (D3): es el texto libre de la fila.
    ]
}

# Caso del mapeo de columnas por IA (tarea 1): "OBSERVACIONES" sí se mapea, a "notes" — sigue
# siendo texto libre para la extracción (D3), porque notes/description son los mismos campos de
# origen que ya acepta la extracción de una sola pieza.
MAPPING_WITH_NOTES = {
    "columns": [
        *MAPPING["columns"],
        {"source_column": "OBSERVACIONES", "target_field": "notes"},
    ]
}

# Las 4 columnas de la fila mapeadas a campos estructurados (ninguna a notes/description): no
# queda texto libre para la IA (D3, tarea 2.3).
MAPPING_ALL_STRUCTURED = {
    "columns": [
        *MAPPING["columns"],
        {"source_column": "OBSERVACIONES", "target_field": "author"},
    ]
}


def _tag() -> str:
    return uuid.uuid4().hex[:8]


def _sheet(catalog: Catalog, tag: str, *, update_text: str, new_text: str) -> bytes:
    lines = [
        "DENOMINACIÓN;CÓDIGOS;RÉGIMEN;OBSERVACIONES",
        f"{catalog.target.denomination};{catalog.target_code};Propiedad;{update_text}",
        f"Pieza nueva {tag};S/N;Propiedad;{new_text}",
    ]
    return ("\n".join(lines) + "\n").encode("utf-8")


@dataclass
class Batch:
    id: str
    catalog: Catalog
    rows: dict[int, dict[str, Any]]


def _rows(pipeline: Pipeline, batch_id: str) -> dict[int, dict[str, Any]]:
    page = diffs(pipeline.client, batch_id, page_size=100).json()
    return {row["source_row_number"]: row for row in page["items"]}


def _set_dimensions_and_conservation(
    pipeline: Pipeline,
    piece_id: uuid.UUID,
    *,
    dimensions: list[dict[str, Any]],
    conservation_code: str,
) -> None:
    with pipeline.session() as db:
        admin_id = db.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
        with audit_context(db, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)):
            piece = db.get(Piece, piece_id)
            assert piece is not None
            term = db.scalars(
                select(Term)
                .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
                .where(
                    Vocabulary.code == VocabularyCode.CONSERVATION_STATUS,
                    Term.code == conservation_code,
                )
            ).one()
            piece.dimensions = dimensions
            piece.conservation_state_id = term.id
            db.commit()


def prepared(
    pipeline: Pipeline, *, update_text: str, new_text: str, mapping: dict[str, Any] = MAPPING
) -> Batch:
    with pipeline.session() as session:
        catalog = _catalog(session)
        session.expunge_all()
    tag = _tag()
    batch_id = upload(
        pipeline.client,
        f"ia-lote-{tag}.csv",
        _sheet(catalog, tag, update_text=update_text, new_text=new_text),
    )["batch_id"]
    assert put_mapping(pipeline.client, batch_id, mapping).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    return Batch(batch_id, catalog, _rows(pipeline, batch_id))


def suggest(pipeline: Pipeline, batch: Batch, row: int, role: str = "CATALOGUER") -> Any:
    row_id = batch.rows[row]["id"]
    return pipeline.login(role).post(f"{BASE}/{batch.id}/rows/{row_id}/ai-suggestion")


def set_ai_fields(
    pipeline: Pipeline, batch: Batch, row: int, fields: dict[str, Any], role: str = "CATALOGUER"
) -> Any:
    row_id = batch.rows[row]["id"]
    return pipeline.login(role).patch(
        f"{BASE}/{batch.id}/rows/{row_id}/ai-fields", json={"fields": fields}
    )


def test_suggest_for_update_row_compares_against_current_value(pipeline: Pipeline) -> None:
    batch = prepared(
        pipeline,
        update_text="Alto 95 cm. Buen estado.",
        new_text="Pieza sin observaciones medibles.",
    )
    _set_dimensions_and_conservation(
        pipeline,
        batch.catalog.target.id,
        dimensions=[{"dimension": "alto", "value": 60, "unit": "cm"}],
        conservation_code="MALO",
    )

    response = suggest(pipeline, batch, 2)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["import_batch_id"] == batch.id
    assert body["piece_id"] == str(batch.catalog.target.id)
    fields = {f["field"]: f for f in body["output_data"]["fields"]}
    assert fields["dimensions"]["value"] == {"dimension": "alto", "value": 95, "unit": "cm"}
    assert fields["dimensions"]["current_value"] == {"dimension": "alto", "value": 60, "unit": "cm"}
    assert fields["conservation_status"]["value"] == "BUENO"
    assert fields["conservation_status"]["current_value"] == "MALO"


def test_suggest_for_update_row_hides_what_already_matches(pipeline: Pipeline) -> None:
    batch = prepared(
        pipeline, update_text="Alto 95 cm. Buen estado.", new_text="Sin datos medibles."
    )
    _set_dimensions_and_conservation(
        pipeline,
        batch.catalog.target.id,
        dimensions=[{"dimension": "alto", "value": 95, "unit": "cm"}],
        conservation_code="BUENO",
    )

    response = suggest(pipeline, batch, 2)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["output_data"]["fields"] == []
    assert {f["field"] for f in body["output_data"]["unchanged_fields"]} == {
        "dimensions",
        "conservation_status",
    }
    assert body["output_data"]["message"]


def test_suggest_for_new_row_has_no_current_value(pipeline: Pipeline) -> None:
    batch = prepared(
        pipeline, update_text="Sin datos medibles.", new_text="Alto 40 cm. Mal estado."
    )

    response = suggest(pipeline, batch, 3)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["piece_id"] is None
    fields = {f["field"]: f for f in body["output_data"]["fields"]}
    assert fields["dimensions"]["value"] == {"dimension": "alto", "value": 40, "unit": "cm"}
    assert fields["dimensions"]["current_value"] is None


def test_suggest_still_works_when_the_free_text_column_was_mapped_to_notes(
    pipeline: Pipeline,
) -> None:
    """Regresión: el mapeo de columnas por IA (tarea 1) puede mapear la columna de texto libre a
    "notes" en vez de dejarla sin mapear; la extracción (tarea 2) debe seguir leyéndola (D3),
    no solo lo que haya quedado en `source_payload`."""
    batch = prepared(
        pipeline,
        update_text="Alto 95 cm. Buen estado.",
        new_text="Sin datos medibles.",
        mapping=MAPPING_WITH_NOTES,
    )
    # El mismo `catalog.target` se reutiliza entre pruebas de este módulo (`pipeline` es de
    # alcance de módulo): se deja en un estado conocido para que "alto 95 cm" sea una novedad.
    _set_dimensions_and_conservation(
        pipeline, batch.catalog.target.id, dimensions=[], conservation_code="MALO"
    )

    response = suggest(pipeline, batch, 2)

    assert response.status_code == 201, response.text
    fields = {f["field"]: f for f in response.json()["output_data"]["fields"]}
    assert fields["dimensions"]["value"] == {"dimension": "alto", "value": 95, "unit": "cm"}


def test_suggest_is_422_when_every_column_is_mapped_to_a_structured_field(
    pipeline: Pipeline,
) -> None:
    """Si el mapeo del lote asigna las 4 columnas a campos estructurados (ninguna a
    notes/description), no queda texto libre: la IA no se invoca para esa fila (D3, tarea 2.3)."""
    batch = prepared(
        pipeline,
        update_text="Alto 95 cm. Buen estado.",
        new_text="Sin datos.",
        mapping=MAPPING_ALL_STRUCTURED,
    )

    response = suggest(pipeline, batch, 2)

    assert response.status_code == 422
    assert response.json()["code"] == "row_has_no_free_text"


def test_suggest_without_free_text_is_422(pipeline: Pipeline) -> None:
    batch = prepared(pipeline, update_text="", new_text="Alto 40 cm.")

    response = suggest(pipeline, batch, 2)

    assert response.status_code == 422
    assert response.json()["code"] == "row_has_no_free_text"


def test_set_ai_fields_rejects_unknown_field(pipeline: Pipeline) -> None:
    batch = prepared(pipeline, update_text="Mide 40 cm de alto.", new_text="Sin datos.")

    response = set_ai_fields(pipeline, batch, 2, {"denomination": "Otra cosa"})

    assert response.status_code == 422
    assert response.json()["code"] == "unknown_suggestion_field"


def test_set_ai_fields_rejects_invalid_dimension_shape(pipeline: Pipeline) -> None:
    batch = prepared(pipeline, update_text="Mide 40 cm de alto.", new_text="Sin datos.")

    response = set_ai_fields(pipeline, batch, 2, {"dimensions": {"dimension": "alto"}})

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_dimension_value"


def test_ai_fields_are_applied_when_the_batch_is_approved(pipeline: Pipeline) -> None:
    batch = prepared(pipeline, update_text="Alto 95 cm. Buen estado.", new_text="Alto 40 cm.")
    _set_dimensions_and_conservation(
        pipeline,
        batch.catalog.target.id,
        dimensions=[],
        conservation_code="MALO",
    )
    assert suggest(pipeline, batch, 2).status_code == 201
    assert suggest(pipeline, batch, 3).status_code == 201

    saved = set_ai_fields(
        pipeline,
        batch,
        2,
        {
            "dimensions": {"dimension": "alto", "value": 95, "unit": "cm"},
            "conservation_status": "BUENO",
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["resolution"]["ai_fields"]["conservation_status"] == "BUENO"

    accept_update = pipeline.login("CATALOGUER").patch(
        f"{BASE}/{batch.id}/rows/{batch.rows[2]['id']}", json={"decision": "ACCEPTED"}
    )
    assert accept_update.status_code == 200, accept_update.text
    accept_new = pipeline.login("CATALOGUER").patch(
        f"{BASE}/{batch.id}/rows/{batch.rows[3]['id']}", json={"decision": "ACCEPTED"}
    )
    assert accept_new.status_code == 200, accept_new.text

    summary = pipeline.client.get(f"{BASE}/{batch.id}").json()["approval_summary"]
    confirmed = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch.id}/confirm",
        json={"summary_token": summary["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert confirmed.status_code == 200, confirmed.text

    with pipeline.session() as db:
        target = db.get(Piece, batch.catalog.target.id)
        assert target is not None
        assert {"dimension": "alto", "value": 95, "unit": "cm"} in target.dimensions
        term = db.get(Term, target.conservation_state_id)
        assert term is not None and term.code == "BUENO"
