"""Spec importacion-datos — Sugerencia de plantillas por cabeceras (RF-022; design D3).

Change plantillas-mapeo-y-normalizacion, task 3.2. A template's headers are the source columns
of its mapping [SUPUESTO S1]; up to 3 suggestions [SUPUESTO S2] scoring at least 0,6
[SUPUESTO S1]. Synthetic data only (RNF-014); headers are illustrative [SUPUESTO A1].

Every test uses its own header words: with no header in common the Jaccard index is 0 and the
score stays below 0,5, so templates of other tests (and the seed one) are never suggested.
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from app.modules.imports.templates import similarity
from app.seed.fixtures import HEADERS
from tests.api.conftest import Pipeline

TEMPLATES = "/api/v1/import-templates"
SUGGEST = f"{TEMPLATES}/suggest"


def create(client: TestClient, sources: list[str], headers: list[str] | None = None) -> str:
    """A template whose first source is the denomination and the rest go to the payload."""
    columns: list[dict[str, Any]] = [{"source_column": sources[0], "target_field": "denomination"}]
    columns += [{"source_column": source, "target_field": None} for source in sources[1:]]
    response = client.post(
        TEMPLATES,
        json={
            "name": f"Sugerencia {uuid.uuid4().hex[:8]} (sintética)",
            "source_name": "Fuente sintética",
            "headers": headers or sources,
            "columns": columns,
        },
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def suggest(client: TestClient, headers: list[str]) -> list[dict[str, Any]]:
    response = client.post(SUGGEST, json={"headers": headers})
    assert response.status_code == 200, response.text
    return list(response.json())


def test_same_headers_in_another_order_and_accents_match_fully(pipeline: Pipeline) -> None:
    """Scenario «Cabeceras idénticas en otro orden»."""
    template_id = create(pipeline.client, ["DENOMINACIÓN ÁNFORA", "CÓDIGO ÁNFORA", "ÉPOCA ÁNFORA"])

    [first, *_] = suggest(
        pipeline.client, ["epoca anfora", "  Código   Anfora ", "denominacion ánfora"]
    )

    assert first["template"]["id"] == template_id
    assert first["score"] == 1.0
    assert first["missing_columns"] == []
    assert first["new_columns"] == []


def test_a_new_column_is_reported(pipeline: Pipeline) -> None:
    """Scenario «Archivo con una columna nueva»: J = 4/5, S = 1 -> 0,9."""
    sources = ["NOMBRE QUIPU", "CUERDAS QUIPU", "COLOR QUIPU", "NUDOS QUIPU"]
    template_id = create(pipeline.client, sources)

    [first] = suggest(pipeline.client, [*sources, "COLUMNA NUEVA QUIPU"])

    assert first["template"]["id"] == template_id
    assert first["score"] == 0.9
    assert first["missing_columns"] == []
    assert first["new_columns"] == ["COLUMNA NUEVA QUIPU"]


def test_no_similar_template_gives_no_suggestions(pipeline: Pipeline) -> None:
    """Scenario «Ninguna plantilla parecida»."""
    create(pipeline.client, ["TÍTULO MATE BURILADO", "AUTOR MATE BURILADO"])

    assert suggest(pipeline.client, ["XQZW", "JJKK"]) == []


def test_suggestions_are_ordered_by_score_and_limited_to_three(pipeline: Pipeline) -> None:
    """Template sources against the file P1..P4: J = 1, 3/4, 2/4, 1/4 with S = 1, so scores
    1, 0,875, 0,75 and 0,625; the fourth is above 0,6 but only 3 are returned [SUPUESTO S2]."""
    file = ["P1 RETABLO", "P2 RETABLO", "P3 RETABLO", "P4 RETABLO"]
    # Created with an extra header, so its signature differs and the score comes from the formula.
    full = create(pipeline.client, file, headers=[*file, "EXTRA RETABLO"])
    three = create(pipeline.client, file[:3])
    two = create(pipeline.client, file[:2])
    create(pipeline.client, file[:1])

    suggestions = suggest(pipeline.client, file)

    assert [item["template"]["id"] for item in suggestions] == [full, three, two]
    assert [item["score"] for item in suggestions] == [1.0, 0.875, 0.75]
    assert suggestions[1]["new_columns"] == ["P4 RETABLO"]
    assert suggestions[2]["new_columns"] == ["P3 RETABLO", "P4 RETABLO"]


def test_missing_template_columns_are_reported(pipeline: Pipeline) -> None:
    sources = ["PIEZA TOTORA", "LARGO TOTORA", "ANCHO TOTORA", "ORIGEN TOTORA", "USO TOTORA"]
    template_id = create(pipeline.client, sources)

    [first] = suggest(pipeline.client, sources[:4])

    assert first["template"]["id"] == template_id
    # J = 4/5 and S = (4 × 1 + best ratio of «USO TOTORA») / 5 < 1, so between 0,8 and 0,9.
    assert first["score"] == round(similarity(set(sources), set(sources[:4])), 4)
    assert 0.8 < first["score"] < 0.9
    assert first["missing_columns"] == ["USO TOTORA"]
    assert first["new_columns"] == []


def test_a_deleted_template_is_not_suggested(pipeline: Pipeline) -> None:
    headers = ["DENOMINACIÓN CHAKANA", "SÍMBOLO CHAKANA"]
    template_id = create(pipeline.client, headers)
    assert [item["template"]["id"] for item in suggest(pipeline.client, headers)] == [template_id]

    deleted = pipeline.login("COLLECTIONS_MANAGER").delete(
        f"{TEMPLATES}/{template_id}", params={"reason": "Fuente retirada"}
    )
    assert deleted.status_code == 204, deleted.text

    assert suggest(pipeline.client, headers) == []


def test_suggesting_needs_the_prepare_permission(pipeline: Pipeline) -> None:
    """[SUPUESTO S8] ``imports.prepare``."""
    response = pipeline.login("INTERNAL_VIEWER").post(SUGGEST, json={"headers": ["A"]})
    assert response.status_code == 403


def test_similarity_formula() -> None:
    assert similarity({"A", "B"}, {"A", "B"}) == 1.0
    assert similarity({"A"}, set()) == 0.0
    # No header in common: J = 0, so the score never reaches the 0,6 threshold.
    assert similarity({"DENOMINACION ANFORA"}, {"DENOMINACION QUIPU"}) < 0.5


def test_the_seed_template_is_suggested_for_the_synthetic_sabana(pipeline: Pipeline) -> None:
    """Task 3.4: the headers of ``sabana_sintetica_v1.xlsx`` match the seed template fully."""
    [first, *_] = suggest(pipeline.client, HEADERS)

    assert first["template"]["name"] == "Plantilla sábana sintética v1"
    assert first["score"] == 1.0
    assert first["missing_columns"] == first["new_columns"] == []
