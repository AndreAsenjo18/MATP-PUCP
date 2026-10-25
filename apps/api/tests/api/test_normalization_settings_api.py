"""Spec identificacion-piezas — Parámetros de normalización administrables, por API (RN-010,
RF-023, RF-004, RN-005).

Change plantillas-mapeo-y-normalizacion, task 2.3 (design D5): ``GET``/``PUT
/normalization-settings/{key}`` and ``GET``/``POST``/``DELETE /collection-acronym-aliases``,
with ``vocabularies.manage`` [SUPUESTO T8], audit and logical deletion. The four scenarios of the
spec: new absence marker, historical acronym alias, duplicated alias, and a separator change
with affected identifiers (409 with how many and examples: the recalculation flow of
colecciones-y-vocabularios-admin does not exist yet [SUPUESTO T10]).

Own module: the ``pipeline`` fixture gives it its own seeded database; the tests run in order
and share it. Synthetic data only (RNF-014); ``NO REGISTRA``, ``REP``, ``ANT`` and ``VIEJA`` are
illustrative [SUPUESTO A5, A3], and the codes 91xx and 88xx are not used by the seed.
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AppUser, AuditLog, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.identification.normalization import (
    ABSENCE_MARKERS,
    DEFAULT_SEPARATORS,
    DEFAULT_UNSPLIT_MARKERS,
)
from app.modules.identification.service import add_identifier
from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import ADMIN_EMAIL, collection_id, sheet
from tests.api.test_import_pipeline_api import BASE, diffs, get_batch, put_mapping, upload, validate

SETTINGS = "/api/v1/normalization-settings"
ALIASES = "/api/v1/collection-acronym-aliases"
SPLIT_MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
    ],
    "defaults": {"tenure_regime": "Propiedad"},
}


def manager(pipeline: Pipeline) -> TestClient:
    return pipeline.login("COLLECTIONS_MANAGER")


def _piece(pipeline: Pipeline, denomination: str, acronym: str = "LRM") -> str:
    created = pipeline.client.post(
        "/api/v1/pieces",
        json={
            "denomination": denomination,
            "tenure_regime": "Propiedad",
            "collection_id": collection_id(pipeline, acronym),
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _identifier(pipeline: Pipeline, piece_id: str, type_code: str, value: str) -> None:
    """``POST /pieces/{id}/identifiers`` is still a stub of ficha-pieza-crud: the service."""
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN_EMAIL))
        piece = session.get(Piece, uuid.UUID(piece_id))
        assert admin is not None and piece is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            add_identifier(session, piece, type_code, value, source="Prueba")
            session.commit()


def _audit(pipeline: Pipeline, entity_type: str, action: AuditAction) -> list[AuditLog]:
    with pipeline.session() as session:
        return list(
            session.scalars(
                select(AuditLog).where(
                    AuditLog.entity_type == entity_type, AuditLog.action == action
                )
            )
        )


def _user_id(pipeline: Pipeline, role: str) -> uuid.UUID:
    response = pipeline.login(role).get("/api/v1/auth/me")
    assert response.status_code == 200, response.text
    return uuid.UUID(response.json()["id"])


def _markers(pipeline: Pipeline) -> list[str]:
    return manager(pipeline).get(f"{SETTINGS}/absence_markers").json()["value"]


def _assert_requires_preview(response: Any, affected: int) -> dict[str, Any]:
    assert response.status_code == 409, response.text
    body = response.json()
    assert body["code"] == "normalization_change_requires_preview"
    assert body["details"]["affected"] == affected
    assert body["details"]["change"] == "colecciones-y-vocabularios-admin"
    return body


# --- permisos y lectura ------------------------------------------------------------------------


def test_only_vocabulary_managers_reach_the_operations(pipeline: Pipeline) -> None:
    catalogue = pipeline.client  # CATALOGUER: no vocabularies.manage [SUPUESTO T8]
    assert catalogue.get(f"{SETTINGS}/absence_markers").status_code == 403
    assert catalogue.put(f"{SETTINGS}/absence_markers", json={"value": []}).status_code == 403
    assert catalogue.get(ALIASES).status_code == 403
    alias = {"alias": "X", "collection_id": str(uuid.uuid4())}
    assert catalogue.post(ALIASES, json=alias).status_code == 403
    assert (
        catalogue.delete(f"{ALIASES}/{uuid.uuid4()}", params={"reason": "x" * 5}).status_code == 403
    )
    assert pipeline.login("ADMIN").get(ALIASES).status_code == 200


def test_without_stored_values_the_defaults_of_the_code_are_shown(pipeline: Pipeline) -> None:
    markers = manager(pipeline).get(f"{SETTINGS}/absence_markers").json()
    assert markers["is_default"] is True and markers["updated_at"] is None
    assert set(markers["value"]) == ABSENCE_MARKERS
    separators = manager(pipeline).get(f"{SETTINGS}/concatenation_separators").json()
    assert separators["value"] == {
        "separators": list(DEFAULT_SEPARATORS),
        "unsplit_markers": list(DEFAULT_UNSPLIT_MARKERS),
    }


def test_invalid_keys_and_values_are_rejected(pipeline: Pipeline) -> None:
    client = manager(pipeline)
    assert client.get(f"{SETTINGS}/otra_cosa").status_code == 422
    wrong = client.put(f"{SETTINGS}/concatenation_separators", json={"value": ["/"]})
    assert wrong.status_code == 422 and wrong.json()["code"] == "invalid_setting_value"
    space = client.put(
        f"{SETTINGS}/concatenation_separators", json={"value": {"separators": ["/", " "]}}
    )
    assert space.status_code == 422 and "espacio" in space.json()["message"]
    shape = client.put(f"{SETTINGS}/absence_markers", json={"value": {"separators": ["/"]}})
    assert shape.status_code == 422 and shape.json()["code"] == "invalid_setting_value"


# --- escenario «Nuevo marcador de ausencia» ----------------------------------------------------


def test_a_new_absence_marker_applies_to_manual_entry_and_import(pipeline: Pipeline) -> None:
    before = pipeline.client.post(
        "/api/v1/pieces",
        json={"denomination": "Soga", "tenure_regime": "Propiedad", "code_i": "NO REGISTRA"},
    )
    assert before.status_code == 422

    saved = manager(pipeline).put(
        f"{SETTINGS}/absence_markers", json={"value": [*sorted(ABSENCE_MARKERS), "NO REGISTRA"]}
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["is_default"] is False and "NO REGISTRA" in saved.json()["value"]
    # The next requests read the new value (``session_params`` of their session).
    created = pipeline.client.post(
        "/api/v1/pieces",
        json={"denomination": "Soga", "tenure_regime": "Propiedad", "code_i": "No registra"},
    )
    assert created.status_code == 201, created.text
    batch_id = upload(
        pipeline.client,
        "marcador.xlsx",
        sheet(["DENOMINACIÓN", "N° INV"], [["Soga", "NO REGISTRA"]]),
    )["batch_id"]
    mapping = {
        "columns": [
            {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
            {"source_column": "N° INV", "target_field": "identifier:I"},
        ],
        "defaults": {"tenure_regime": "Propiedad"},
    }
    assert put_mapping(pipeline.client, batch_id, mapping).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id, page_size=10).json()["items"]
    assert row["mapped_data"]["identifiers"][0]["is_absent"] is True
    # Audited as a manual change of the collections manager.
    [entry, *_] = _audit(pipeline, "normalization_setting", AuditAction.CREATE)
    assert entry.user_id == _user_id(pipeline, "COLLECTIONS_MANAGER")


def test_saving_the_same_value_again_changes_nothing(pipeline: Pipeline) -> None:
    updates = len(_audit(pipeline, "normalization_setting", AuditAction.UPDATE))
    again = manager(pipeline).put(f"{SETTINGS}/absence_markers", json={"value": _markers(pipeline)})
    assert again.status_code == 200
    assert len(_audit(pipeline, "normalization_setting", AuditAction.UPDATE)) == updates


# --- escenarios «Alias de sigla histórica» y «Alias duplicado» ---------------------------------


def test_a_historical_acronym_alias_is_recognized_by_the_search(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline, "Charango de prueba 4.1C")
    search = {"q": "Charango de prueba", "collection_code": "REP"}
    assert pipeline.client.get("/api/v1/search", params=search).json()["total"] == 0

    created = manager(pipeline).post(
        ALIASES, json={"alias": "R.E.P.", "collection_id": collection_id(pipeline, "LRM")}
    )

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["alias"] == "R.E.P." and body["alias_normalized"] == "REP"
    assert body["collection_acronym"] == "LRM"
    assert [a["alias_normalized"] for a in manager(pipeline).get(ALIASES).json()] == ["REP"]
    found = pipeline.client.get("/api/v1/search", params=search).json()
    assert piece_id in {hit["piece"]["id"] for hit in found["items"]}
    assert _audit(pipeline, "collection_acronym_alias", AuditAction.CREATE)


def test_an_alias_pointing_to_another_collection_is_rejected(pipeline: Pipeline) -> None:
    taken = manager(pipeline).post(
        ALIASES, json={"alias": "rep", "collection_id": collection_id(pipeline, "MMZ")}
    )
    assert taken.status_code == 409 and taken.json()["code"] == "acronym_alias_taken"
    assert taken.json()["details"]["collection_id"] == collection_id(pipeline, "LRM")
    assert "ya es un alias de la colección" in taken.json()["message"]


def test_an_alias_cannot_be_the_current_acronym_of_a_collection(pipeline: Pipeline) -> None:
    same = manager(pipeline).post(
        ALIASES, json={"alias": "M.M.Z.", "collection_id": collection_id(pipeline, "LRM")}
    )
    assert same.status_code == 409 and same.json()["code"] == "alias_is_current_acronym"
    assert same.json()["details"]["collection_id"] == collection_id(pipeline, "MMZ")
    missing = manager(pipeline).post(
        ALIASES, json={"alias": "NUEVA", "collection_id": str(uuid.uuid4())}
    )
    assert missing.status_code == 404


# --- escenario «Cambio de separador con identificadores afectados» -----------------------------


def _apply_batch(pipeline: Pipeline, rows: list[list[Any]]) -> None:
    batch_id = upload(pipeline.client, "aplicar.xlsx", sheet(["DENOMINACIÓN", "CÓDIGOS"], rows))[
        "batch_id"
    ]
    assert put_mapping(pipeline.client, batch_id, SPLIT_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    for row in diffs(pipeline.client, batch_id, page_size=50).json()["items"]:
        decided = pipeline.client.patch(
            f"{BASE}/{batch_id}/rows/{row['id']}", json={"decision": "ACCEPTED"}
        )
        assert decided.status_code == 200, decided.text
    summary = get_batch(pipeline.client, batch_id)["approval_summary"]
    confirmed = manager(pipeline).post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": summary["summary_token"], "comment": "Prueba (sintética)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert get_batch(pipeline.client, batch_id)["status"] == "APPLIED"


def test_removing_a_separator_that_split_stored_codes_requires_the_preview(
    pipeline: Pipeline,
) -> None:
    _apply_batch(pipeline, [["Quena de prueba", "I-9101, RA 9102"]])
    without_comma = [s for s in DEFAULT_SEPARATORS if s != ","]

    response = manager(pipeline).put(
        f"{SETTINGS}/concatenation_separators", json={"value": {"separators": without_comma}}
    )

    body = _assert_requires_preview(response, 2)
    examples = body["details"]["examples"]
    assert {e["original_value"] for e in examples} == {"I-9101", "RA 9102"}
    assert {e["reason"] for e in examples} == {"separation"}
    current = manager(pipeline).get(f"{SETTINGS}/concatenation_separators").json()
    assert current["is_default"] is True  # nothing was saved


def test_a_separator_change_without_affected_codes_is_saved(pipeline: Pipeline) -> None:
    response = manager(pipeline).put(
        f"{SETTINGS}/concatenation_separators",
        json={
            "value": {"separators": [*DEFAULT_SEPARATORS, "+"], "unsplit_markers": ["S/N", "S/C"]}
        },
    )
    assert response.status_code == 200, response.text
    assert "+" in response.json()["value"]["separators"]


# --- otros cambios con impacto ----------------------------------------------------------------


def test_removing_a_marker_that_marks_stored_codes_requires_the_preview(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline, "Máscara de prueba")
    _identifier(pipeline, piece_id, "PUCP", "S/N")  # stored as "no code"

    response = manager(pipeline).put(
        f"{SETTINGS}/absence_markers", json={"value": [m for m in _markers(pipeline) if m != "S/N"]}
    )

    body = _assert_requires_preview(response, 1)
    [example] = body["details"]["examples"]
    assert example["original_value"] == "S/N" and example["normalized_value"] is None
    assert example["proposed_value"] == "S/N" and example["reason"] == "normalization"
    assert "S/N" in _markers(pipeline)


def test_an_alias_that_would_change_stored_codes_requires_the_preview(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline, "Tabla de prueba")
    _identifier(pipeline, piece_id, "COLECCION", "ANT 8801")

    response = manager(pipeline).post(
        ALIASES, json={"alias": "ANT", "collection_id": collection_id(pipeline, "LRM")}
    )

    body = _assert_requires_preview(response, 1)
    [example] = body["details"]["examples"]
    assert (example["normalized_value"], example["proposed_value"]) == ("ANT 8801", "LRM 8801")
    assert "ANT" not in {a["alias_normalized"] for a in manager(pipeline).get(ALIASES).json()}


# --- borrado lógico de un alias ------------------------------------------------------------------


def test_deleting_an_alias_is_logical_with_a_reason(pipeline: Pipeline) -> None:
    created = manager(pipeline).post(
        ALIASES, json={"alias": "VIEJA", "collection_id": collection_id(pipeline, "MMZ")}
    )
    assert created.status_code == 201, created.text
    alias_id = created.json()["id"]
    assert manager(pipeline).delete(f"{ALIASES}/{alias_id}").status_code == 422  # no reason

    deleted = manager(pipeline).delete(
        f"{ALIASES}/{alias_id}", params={"reason": "Sigla registrada por error (prueba)"}
    )

    assert deleted.status_code == 204, deleted.text
    assert alias_id not in {a["id"] for a in manager(pipeline).get(ALIASES).json()}
    entries = [
        e
        for e in _audit(pipeline, "collection_acronym_alias", AuditAction.SOFT_DELETE)
        if str(e.entity_id) == alias_id
    ]
    assert entries and {e.reason for e in entries} == {"Sigla registrada por error (prueba)"}
    again = manager(pipeline).delete(f"{ALIASES}/{alias_id}", params={"reason": "Otra vez"})
    assert again.status_code == 404


def test_deleting_an_alias_used_by_stored_codes_requires_the_preview(pipeline: Pipeline) -> None:
    piece_id = _piece(pipeline, "Retablo de prueba")
    _identifier(pipeline, piece_id, "COLECCION", "REP 8802")  # stored as LRM 8802
    [rep] = [a for a in manager(pipeline).get(ALIASES).json() if a["alias_normalized"] == "REP"]

    response = manager(pipeline).delete(f"{ALIASES}/{rep['id']}", params={"reason": "Prueba"})

    body = _assert_requires_preview(response, 1)
    [example] = body["details"]["examples"]
    assert (example["normalized_value"], example["proposed_value"]) == ("LRM 8802", "REP 8802")
    assert rep["id"] in {a["id"] for a in manager(pipeline).get(ALIASES).json()}
