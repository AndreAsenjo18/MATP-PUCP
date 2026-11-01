"""POST /pieces/{piece_id}/identifiers with concatenated codes (ficha-pieza-crud 3.1).

Spec identificacion-piezas, «Registro de identificadores con confirmación de códigos
concatenados»; design D5 (RF-002, RF-023, RN-003). Nothing is ever split automatically. Every
piece a test creates is deleted at the end. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.modules.audit.models import AuditAction, AuditLog
from tests.api.conftest import SeededApi

COMPOUND = "I 97702 / RA 97028"


def _new_piece(client: TestClient, tenure: str = "Propiedad") -> str:
    created = client.post(
        "/api/v1/pieces",
        json={"denomination": f"Pieza con códigos ({tenure}, sintética)", "tenure_regime": tenure},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _add(client: TestClient, piece_id: str, body: dict[str, Any]) -> Any:
    return client.post(f"/api/v1/pieces/{piece_id}/identifiers", json=body)


def _current(client: TestClient, piece_id: str) -> list[dict[str, Any]]:
    return client.get(f"/api/v1/pieces/{piece_id}/identifiers").json()


def _delete(seeded_api: SeededApi, piece_id: str) -> None:
    deleted = seeded_api.login_as("ADMIN").delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": "Limpieza de prueba"}
    )
    assert deleted.status_code == 204, deleted.text


def test_a_collection_code_is_registered_normalized_and_manual(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _new_piece(client)

    response = _add(client, piece_id, {"identifier_type_code": "COLECCION", "value": "M.M.Z. 15"})

    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["original_value"], body["is_current"], body["source"]) == (
        "M.M.Z. 15",
        True,
        "manual",
    )
    assert body["normalized_value"].replace("-", " ") == "MMZ 15"
    _delete(seeded_api, piece_id)


def test_a_concatenated_value_answers_the_proposal_and_registers_nothing(
    seeded_api: SeededApi,
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _new_piece(client)
    with seeded_api.session() as session:
        audited = session.scalar(select(func.count()).select_from(AuditLog))

    response = _add(client, piece_id, {"identifier_type_code": "COLECCION", "value": COMPOUND})

    assert response.status_code == 422, response.text
    error = response.json()
    assert error["code"] == "concatenated_identifier"
    proposals = [
        (item["identifier_type_code"], item["original_value"])
        for item in error["details"]["proposals"]
    ]
    assert proposals == [("I", "I 97702"), ("COLECCION", "RA 97028")]
    assert all(item["normalized_value"] for item in error["details"]["proposals"])
    assert _current(client, piece_id) == []
    with seeded_api.session() as session:
        assert session.scalar(select(func.count()).select_from(AuditLog)) == audited
    _delete(seeded_api, piece_id)


def test_the_confirmed_proposal_registers_each_code_and_audits_the_original(
    seeded_api: SeededApi,
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _new_piece(client)
    proposals = _add(client, piece_id, {"identifier_type_code": "COLECCION", "value": COMPOUND})
    assert proposals.status_code == 422

    registered = [
        _add(
            client,
            piece_id,
            {
                "identifier_type_code": item["identifier_type_code"],
                "value": item["original_value"],
                "confirmed_split": True,
                "split_from": COMPOUND,
            },
        )
        for item in proposals.json()["details"]["proposals"]
    ]

    assert [response.status_code for response in registered] == [201, 201]
    assert {item["original_value"] for item in _current(client, piece_id)} == {
        "I 97702",
        "RA 97028",
    }
    with seeded_api.session() as session:
        reasons = set(
            session.scalars(
                select(AuditLog.reason).where(
                    AuditLog.action == AuditAction.CREATE,
                    AuditLog.entity_id.in_(
                        [uuid.UUID(response.json()["id"]) for response in registered]
                    ),
                )
            )
        )
    assert reasons == {f"Separado de «{COMPOUND}»"}
    _delete(seeded_api, piece_id)


def test_a_code_i_on_a_loan_for_use_piece_is_409_citing_rn_003(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _new_piece(client, "Comodato")

    response = _add(client, piece_id, {"identifier_type_code": "I", "value": "I 97801"})

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "identifier_not_allowed_for_tenure"
    assert "RN-003" in response.json()["message"]
    assert _current(client, piece_id) == []
    _delete(seeded_api, piece_id)


def test_split_from_without_the_confirmation_is_422(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _new_piece(client)

    response = _add(
        client,
        piece_id,
        {"identifier_type_code": "COLECCION", "value": "RA 97028", "split_from": COMPOUND},
    )

    assert (response.status_code, response.json()["code"]) == (422, "split_without_confirmation")
    _delete(seeded_api, piece_id)
