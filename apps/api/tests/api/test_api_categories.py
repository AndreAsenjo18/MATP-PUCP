"""Categorías y estados de conservación como fachada sobre `vocabulary`/`term` (tarea 2.2).

Change alinear-api-endpoints-v1, decisión C4d; RF-011, RF-012, RN-010.
"""

from sqlalchemy import select

from app.models import Piece, Term, Vocabulary
from app.modules.collections.models import VocabularyCode
from tests.api.conftest import CATALOGUER, MANAGER, SeededApi, as_user

H = as_user(MANAGER)


def _vocabulary_term_ids(seeded_api: SeededApi, code: str) -> set[str]:
    with seeded_api.session() as session:
        return {
            str(term_id)
            for term_id in session.scalars(
                select(Term.id).join(Vocabulary).where(Vocabulary.code == code)
            )
        }


def test_categories_form_a_hierarchy(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    line = client.post(
        "/api/v1/categories", json={"code": "LINEA_TEXTIL", "label": "Línea textil"}, headers=H
    )
    assert line.status_code == 201
    assert line.json()["parent_id"] is None
    category = client.post(
        "/api/v1/categories",
        json={"code": "TAPIZ", "label": "Tapiz", "parent_id": line.json()["id"]},
        headers=H,
    )
    assert category.status_code == 201
    assert category.json()["parent_id"] == line.json()["id"]
    assert category.json()["vocabulary_code"] == VocabularyCode.CATEGORY

    listed = {item["id"]: item for item in client.get("/api/v1/categories", headers=H).json()}
    assert listed[category.json()["id"]]["parent_id"] == line.json()["id"]
    assert listed[line.json()["id"]]["parent_id"] is None


def test_category_parent_must_be_a_live_category(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    regular = next(
        state
        for state in client.get("/api/v1/conservation-states", headers=H).json()
        if state["code"] == "REGULAR"
    )
    other_vocabulary = client.post(
        "/api/v1/categories",
        json={"code": "HIJO_DE_ESTADO", "label": "Hijo de estado", "parent_id": regular["id"]},
        headers=H,
    )
    assert other_vocabulary.status_code == 422
    assert other_vocabulary.json()["code"] == "invalid_parent_term"

    root = client.post(
        "/api/v1/categories", json={"code": "LINEA_EFIMERA", "label": "Línea efímera"}, headers=H
    ).json()
    deleted = client.delete(
        f"/api/v1/vocabularies/CATEGORY/terms/{root['id']}",
        params={"reason": "Categoría de prueba"},
        headers=H,
    )
    assert deleted.status_code == 204
    orphan = client.post(
        "/api/v1/categories",
        json={"code": "HIJO_HUERFANO", "label": "Hijo huérfano", "parent_id": root["id"]},
        headers=H,
    )
    assert orphan.status_code == 422
    assert orphan.json()["code"] == "invalid_parent_term"


def test_facade_returns_term_ids(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    categories = client.get("/api/v1/categories", headers=H).json()
    states = client.get("/api/v1/conservation-states", headers=H).json()

    assert categories and states
    assert {c["id"] for c in categories} <= _vocabulary_term_ids(seeded_api, "CATEGORY")
    assert {s["id"] for s in states} <= _vocabulary_term_ids(seeded_api, "CONSERVATION_STATUS")
    assert {s["code"] for s in states} >= {"BUENO", "REGULAR", "MALO"}
    assert {s["vocabulary_code"] for s in states} == {VocabularyCode.CONSERVATION_STATUS}


def test_no_piece_loses_its_classification(seeded_api: SeededApi) -> None:
    """Every classified piece points at a term the facade still exposes."""
    client = seeded_api.client
    category_ids = {
        item["id"]
        for item in client.get("/api/v1/categories?include_inactive=true", headers=H).json()
    }
    state_ids = {
        item["id"]
        for item in client.get(
            "/api/v1/conservation-states?include_inactive=true", headers=H
        ).json()
    }
    with seeded_api.session() as session:
        pieces = session.execute(select(Piece.category_id, Piece.conservation_state_id)).all()

    classified = [str(category) for category, _ in pieces if category is not None]
    assessed = [str(state) for _, state in pieces if state is not None]
    assert classified and assessed, "El seed debe tener piezas clasificadas y evaluadas"
    assert set(classified) <= category_ids
    assert set(assessed) <= state_ids


def test_only_vocabulary_managers_create_categories(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    forbidden = client.post(
        "/api/v1/categories",
        json={"code": "SIN_PERMISO", "label": "Sin permiso"},
        headers=as_user(CATALOGUER),
    )
    assert forbidden.status_code == 403
    assert client.get("/api/v1/categories", headers=as_user(CATALOGUER)).status_code == 200
