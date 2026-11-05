"""Spec identificacion-piezas — Escenario «Alias de sigla histórica», de punta a punta (RN-010,
RF-023, RF-024, RF-031).

Change plantillas-mapeo-y-normalizacion, task 2.2 step E (design D5): once an administrator
registers the historical acronym ``REP`` for the collection ``LRM``, the search (``GET /search``
by code and by ``collection_code``) and the matching of an import recognize ``REP 9871`` as the
collection code ``LRM 9871``. Before, they do not. Own module: the ``pipeline`` fixture gives it
its own seeded database. Synthetic data only (RNF-014); ``REP`` -> ``LRM`` is illustrative
[SUPUESTO A3], and the number 9871 is not used by the seed.
"""

from typing import Any

from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import (
    add_identifier_as_admin,
    collection_id,
    set_params,
    sheet,
)
from tests.api.test_import_pipeline_api import diffs, put_mapping, upload, validate

HEADERS = ["DENOMINACIÓN", "CÓDIGOS"]
MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def _piece(pipeline: Pipeline) -> str:
    created = pipeline.client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Charango (sintético)",
            "tenure_regime": "Propiedad",
            "collection_id": collection_id(pipeline, "LRM"),
        },
    )
    assert created.status_code == 201, created.text
    piece_id = created.json()["id"]
    assert add_identifier_as_admin(pipeline, piece_id, "COLECCION", "LRM 9871") == "LRM 9871"
    return piece_id


def _search(pipeline: Pipeline, **params: str) -> dict[str, Any]:
    response = pipeline.client.get("/api/v1/search", params={"limit": "100", **params})
    assert response.status_code == 200, response.text
    return response.json()


def _found(pipeline: Pipeline, piece_id: str, **params: str) -> bool:
    return piece_id in {hit["piece"]["id"] for hit in _search(pipeline, **params)["items"]}


def _matched_pieces(pipeline: Pipeline) -> set[str]:
    batch_id = upload(pipeline.client, "rep.xlsx", sheet(HEADERS, [["Charango", "REP 9871"]]))[
        "batch_id"
    ]
    assert put_mapping(pipeline.client, batch_id, MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id, page_size=10).json()["items"]
    return {match["piece_id"] for match in row["matches"] if match["kind"] == "piece"}


def test_rep_is_recognized_as_lrm_in_search_and_matching(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline)
    assert _found(pipeline, piece_id, q="Charango", collection_code="LRM")

    # Before: REP is an unknown acronym.
    assert not _found(pipeline, piece_id, q="REP 9871")
    assert _search(pipeline, q="Charango", collection_code="REP")["total"] == 0
    assert piece_id not in _matched_pieces(pipeline)

    set_params(pipeline, aliases=[("REP", "LRM")])

    # Search by code: the piece is found through its identifier.
    [hit] = [h for h in _search(pipeline, q="REP 9871")["items"] if h["piece"]["id"] == piece_id]
    assert hit["match_type"] == "IDENTIFIER"
    # Search by collection: REP filters by LRM.
    by_alias = _search(pipeline, q="Charango", collection_code="r.e.p.")
    assert by_alias["total"] == _search(pipeline, q="Charango", collection_code="LRM")["total"]
    assert piece_id in {hit["piece"]["id"] for hit in by_alias["items"]}
    # Matching of the import: the row with REP 9871 points to the piece with LRM 9871.
    assert piece_id in _matched_pieces(pipeline)
