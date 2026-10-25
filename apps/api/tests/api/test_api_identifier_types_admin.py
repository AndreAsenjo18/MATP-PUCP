"""Spec colecciones-vocabularios — vocabularios y tipos de identificador por API (RN-010).

Change colecciones-y-vocabularios-admin, tasks 2.1 to 2.4 (design D1, D2): vocabularies with a
stable code, identifier types with a validated normalization rule, protection of the system types
(RN-002, RN-003) and the controlled change of a normalization rule (preview, ``confirm_token``,
collisions, stale previews; RF-023).

Runs on the module-scoped seeded database of ``pipeline`` (the session-wide one counts pieces in
other modules); every test still creates its own types, pieces and identifiers with a unique
tag, and restores what it changes in the system types.
"""

import uuid

from sqlalchemy import select

from app.models import AuditLog, PieceIdentifier
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.identification.service import add_identifier
from app.modules.users.models import AppUser
from tests.api.conftest import ADMIN, Pipeline

BASE = "/api/v1/identifier-types"


def _tag() -> str:
    return uuid.uuid4().hex[:6].upper()


def _create_type(pipeline: Pipeline, rule: str = "GENERIC", **extra: object) -> str:
    code = f"T_{_tag()}"
    admin = pipeline.login("ADMIN")
    response = admin.post(
        BASE, json={"code": code, "label": f"Tipo sintético {code}", "normalization_rule": rule}
    )
    assert response.status_code == 201, response.text
    if extra:
        assert admin.patch(f"{BASE}/{code}", json=extra).status_code == 200
    return code


def _pieces_with(pipeline: Pipeline, type_code: str, *values: str) -> list[uuid.UUID]:
    """One owned piece per value, each with an identifier of ``type_code``."""
    with pipeline.session() as session:
        admin_id = session.scalar(select(AppUser.id).where(AppUser.email == ADMIN))
        ids = []
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)):
            for value in values:
                piece = create_piece(
                    session,
                    denomination=f"Pieza {type_code} {value} (sintética)",
                    tenure_regime=TenureRegime.OWNED,
                )
                add_identifier(session, piece, type_code, value)
                ids.append(piece.id)
        session.commit()
    return ids


def _identifiers(pipeline: Pipeline, type_code: str) -> list[PieceIdentifier]:
    with pipeline.session() as session:
        return list(
            session.scalars(
                select(PieceIdentifier).where(PieceIdentifier.identifier_type_code == type_code)
            )
        )


# --- 1.1 tipos del sistema -------------------------------------------------------------------
def test_the_inventory_and_collection_types_are_system_types(pipeline: Pipeline) -> None:
    types = {item["code"]: item for item in pipeline.login("CATALOGUER").get(BASE).json()}

    assert types["I"]["is_system"] and types["COLECCION"]["is_system"]
    assert not any(
        item["is_system"] for code, item in types.items() if code not in {"I", "COLECCION"}
    )


# --- 2.1 vocabularios ------------------------------------------------------------------------
def test_creating_a_vocabulary_is_audited(pipeline: Pipeline) -> None:
    code = f"VOC_{_tag()}"
    client = pipeline.login("COLLECTIONS_MANAGER")

    response = client.post(
        "/api/v1/vocabularies", json={"code": code, "name": "Técnicas decorativas (sintético)"}
    )

    assert response.status_code == 201, response.text
    created = response.json()
    assert created["code"] == code and created["term_count"] == 0
    with pipeline.session() as session:
        entries = session.scalars(
            select(AuditLog).where(AuditLog.entity_id == uuid.UUID(created["id"]))
        ).all()
    assert entries and {entry.origin for entry in entries} == {AuditOrigin.MANUAL}
    assert client.get(f"/api/v1/vocabularies/{code}/terms").status_code == 200


def test_a_repeated_vocabulary_code_is_409(pipeline: Pipeline) -> None:
    client = pipeline.login("ADMIN")

    response = client.post("/api/v1/vocabularies", json={"code": "MATERIAL", "name": "Otra"})

    assert response.status_code == 409 and response.json()["code"] == "vocabulary_exists"


def test_a_cataloguer_cannot_create_a_vocabulary(pipeline: Pipeline) -> None:
    client = pipeline.login("CATALOGUER")

    response = client.post("/api/v1/vocabularies", json={"code": f"V_{_tag()}", "name": "X"})

    assert response.status_code == 403


# --- 2.2 tipos de identificador ----------------------------------------------------------------
def test_a_new_identifier_type_is_available_for_identifiers(pipeline: Pipeline) -> None:
    code = _create_type(pipeline)

    _pieces_with(pipeline, code, "Prop. anterior 77")

    created = {item["code"]: item for item in pipeline.login("CATALOGUER").get(BASE).json()}[code]
    assert created["normalization_rule"] == "GENERIC" and created["is_system"] is False
    assert [identifier.original_value for identifier in _identifiers(pipeline, code)] == [
        "Prop. anterior 77"
    ]


def test_an_unknown_rule_is_422_with_the_available_rules(pipeline: Pipeline) -> None:
    client = pipeline.login("ADMIN")

    response = client.post(
        BASE, json={"code": f"T_{_tag()}", "label": "X", "normalization_rule": "SOUNDEX"}
    )

    assert response.status_code == 422
    assert "GENERIC" in response.text and "INVENTORY" in response.text


def test_a_repeated_identifier_type_code_is_409(pipeline: Pipeline) -> None:
    response = pipeline.login("ADMIN").post(BASE, json={"code": "PUCP", "label": "Otro"})

    assert response.status_code == 409 and response.json()["code"] == "identifier_type_exists"


def test_the_lock_of_the_inventory_code_cannot_be_disabled(pipeline: Pipeline) -> None:
    response = pipeline.login("ADMIN").patch(f"{BASE}/I", json={"locks_on_assignment": False})

    assert response.status_code == 409
    assert response.json()["code"] == "system_identifier_type"
    types = {item["code"]: item for item in pipeline.login("CATALOGUER").get(BASE).json()}
    assert types["I"]["locks_on_assignment"] is True


def test_the_label_of_a_system_type_can_change_and_is_audited(pipeline: Pipeline) -> None:
    admin = pipeline.login("ADMIN")
    original = {item["code"]: item for item in admin.get(BASE).json()}["I"]["label"]
    try:
        response = admin.patch(f"{BASE}/I", json={"label": "Número de inventario general (I)"})

        assert response.status_code == 200, response.text
        assert response.json()["label"] == "Número de inventario general (I)"
        with pipeline.session() as session:
            entries = session.scalars(
                select(AuditLog).where(
                    AuditLog.entity_type == "identifier_type", AuditLog.field == "label"
                )
            ).all()
        assert any(entry.new_value == "Número de inventario general (I)" for entry in entries)
    finally:
        assert admin.patch(f"{BASE}/I", json={"label": original}).status_code == 200


# --- 2.3 y 2.4 cambio de regla -------------------------------------------------------------------
def test_a_type_without_identifiers_changes_its_rule_directly(pipeline: Pipeline) -> None:
    code = _create_type(pipeline)

    response = pipeline.login("ADMIN").patch(
        f"{BASE}/{code}", json={"normalization_rule": "INC_RN"}
    )

    assert response.status_code == 200 and response.json()["normalization_rule"] == "INC_RN"


def test_a_rule_change_on_a_type_in_use_requires_the_preview(pipeline: Pipeline) -> None:
    code = _create_type(pipeline)
    _pieces_with(pipeline, code, "I-0007")

    response = pipeline.login("ADMIN").patch(
        f"{BASE}/{code}", json={"normalization_rule": "INVENTORY"}
    )

    assert response.status_code == 409
    assert response.json()["code"] == "normalization_change_requires_preview"
    types = {item["code"]: item for item in pipeline.login("CATALOGUER").get(BASE).json()}
    assert types[code]["normalization_rule"] == "GENERIC"


def test_confirming_the_preview_recalculates_the_normalized_values(pipeline: Pipeline) -> None:
    code = _create_type(pipeline)
    _pieces_with(pipeline, code, "I-0007", "I 0008", "SIN FORMATO")
    admin = pipeline.login("ADMIN")

    preview = admin.post(
        f"{BASE}/{code}/normalization-preview", json={"normalization_rule": "INVENTORY"}
    )

    assert preview.status_code == 200, preview.text
    report = preview.json()
    assert report["total_identifiers"] == 3 and report["changed_count"] == 3
    assert report["unparseable_count"] == 1 and report["collisions"] == []
    assert report["can_confirm"] is True
    assert _identifiers(pipeline, code)[0].normalization_status.value == "NORMALIZED"  # no write

    confirmed = admin.patch(
        f"{BASE}/{code}",
        json={"normalization_rule": "INVENTORY", "confirm_token": report["confirm_token"]},
    )

    assert confirmed.status_code == 200, confirmed.text
    by_original = {
        identifier.original_value: identifier for identifier in _identifiers(pipeline, code)
    }
    assert by_original["I-0007"].normalized_value == "I-7"
    assert by_original["I 0008"].normalized_value == "I-8"
    assert by_original["SIN FORMATO"].normalized_value is None
    assert by_original["SIN FORMATO"].normalization_status.value == "UNPARSEABLE"
    with pipeline.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == by_original["I-0007"].id,
                AuditLog.field == "normalized_value",
                AuditLog.origin == AuditOrigin.SYSTEM,
            )
        ).all()
    assert [(entry.origin, entry.new_value) for entry in entries] == [(AuditOrigin.SYSTEM, "I-7")]


def test_a_preview_made_before_new_identifiers_is_rejected(pipeline: Pipeline) -> None:
    code = _create_type(pipeline)
    _pieces_with(pipeline, code, "I-0011")
    admin = pipeline.login("ADMIN")
    token = admin.post(
        f"{BASE}/{code}/normalization-preview", json={"normalization_rule": "INVENTORY"}
    ).json()["confirm_token"]
    _pieces_with(pipeline, code, "I-0012")

    response = admin.patch(
        f"{BASE}/{code}", json={"normalization_rule": "INVENTORY", "confirm_token": token}
    )

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "normalization_change_requires_preview" and body["details"]["stale"]


def test_a_rule_that_collides_current_unique_codes_is_rejected(pipeline: Pipeline) -> None:
    code = _create_type(pipeline, is_unique_when_current=True)
    pieces = _pieces_with(pipeline, code, "I-0021", "I 21")
    admin = pipeline.login("ADMIN")
    report = admin.post(
        f"{BASE}/{code}/normalization-preview", json={"normalization_rule": "INVENTORY"}
    ).json()

    response = admin.patch(
        f"{BASE}/{code}",
        json={"normalization_rule": "INVENTORY", "confirm_token": report["confirm_token"]},
    )

    assert report["can_confirm"] is False
    assert report["collisions"] == [
        {"normalized_value": "I-21", "piece_ids": sorted(str(piece) for piece in pieces)}
    ]
    assert response.status_code == 409 and response.json()["code"] == "normalization_collision"
    assert {item["normalized_value"] for item in response.json()["details"]["collisions"]} == {
        "I-21"
    }


def test_only_an_administrator_recalculates_a_locked_type(pipeline: Pipeline) -> None:
    code = _create_type(pipeline, locks_on_assignment=True)
    _pieces_with(pipeline, code, "I-0031")
    manager = pipeline.login("COLLECTIONS_MANAGER")
    token = manager.post(
        f"{BASE}/{code}/normalization-preview", json={"normalization_rule": "INVENTORY"}
    ).json()["confirm_token"]

    response = manager.patch(
        f"{BASE}/{code}", json={"normalization_rule": "INVENTORY", "confirm_token": token}
    )

    assert response.status_code == 403 and response.json()["code"] == "admin_required"
    assert _identifiers(pipeline, code)[0].original_value == "I-0031"
