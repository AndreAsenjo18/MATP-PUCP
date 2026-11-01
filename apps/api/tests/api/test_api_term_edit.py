"""Editing the label of a list-of-values term (crud-manual-completo 1.2; RF-011, RN-010).

Spec colecciones-vocabularios, «Edición de términos de las listas de valores»: the term keeps its
identity, so the sheets show the new label; the edit is audited; two active terms of a list never
share a label. Synthetic data only (RNF-014).
"""

import uuid

from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AuditLog, Term
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.catalog.models import PieceMaterial
from tests.api.conftest import SeededApi

MATERIALS = "/api/v1/vocabularies/MATERIAL/terms"


def _term(client, label: str) -> dict:  # type: ignore[no-untyped-def]
    code = f"T{uuid.uuid4().hex[:8].upper()}"
    created = client.post(MATERIALS, json={"code": code, "label": label})
    assert created.status_code == 201, created.text
    return created.json()


def test_fixing_a_typo_shows_in_every_sheet_and_is_audited(seeded_api: SeededApi) -> None:
    """Escenario «Corregir una errata»."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    term = _term(client, "Ceramica (sintética)")
    piece = client.post(
        "/api/v1/pieces",
        json={"denomination": "Cuenco con errata (sintético)", "tenure_regime": "Propiedad"},
    )
    assert piece.status_code == 201, piece.text
    # The material goes straight to the database: the API does not save `material_term_ids` yet.
    system = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with seeded_api.session() as session, audit_context(session, system):
        session.add(
            PieceMaterial(
                id=new_uuid(),
                piece_id=uuid.UUID(piece.json()["id"]),
                term_id=uuid.UUID(term["id"]),
            )
        )
        session.commit()
    before = client.get(f"/api/v1/pieces/{piece.json()['id']}").json()
    assert [material["label"] for material in before["materials"]] == ["Ceramica (sintética)"]

    fixed = client.patch(f"{MATERIALS}/{term['id']}", json={"label": "Cerámica (sintética)"})

    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["id"] == term["id"]
    sheet = client.get(f"/api/v1/pieces/{piece.json()['id']}").json()
    assert [material["label"] for material in sheet["materials"]] == ["Cerámica (sintética)"]
    with seeded_api.session() as session:
        entry = session.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(term["id"]),
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.field == "label",
            )
        )
    assert entry is not None
    assert (entry.old_value, entry.new_value) == ("Ceramica (sintética)", "Cerámica (sintética)")


def test_a_label_already_active_in_the_list_is_rejected(seeded_api: SeededApi) -> None:
    """Escenario «Etiqueta repetida»: nothing changes and it suggests deactivating one."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    _term(client, "Madera de prueba (sintética)")
    other = _term(client, "Pino de prueba (sintético)")

    repeated = client.patch(
        f"{MATERIALS}/{other['id']}", json={"label": "MADERA de prueba (sintética)"}
    )

    assert repeated.status_code == 422, repeated.text
    body = repeated.json()
    assert body["code"] == "duplicate_term"
    assert "desactive uno de los dos" in body["message"]
    labels = {item["id"]: item["label"] for item in client.get(MATERIALS).json()}
    assert labels[other["id"]] == "Pino de prueba (sintético)"


def test_a_label_of_an_inactive_term_suggests_reactivating_it(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    old = _term(client, "Lana de prueba (sintética)")
    client.patch(f"{MATERIALS}/{old['id']}", json={"is_active": False})
    other = _term(client, "Algodón de prueba (sintético)")

    repeated = client.patch(
        f"{MATERIALS}/{other['id']}", json={"label": "Lana de prueba (sintética)"}
    )

    assert repeated.status_code == 422, repeated.text
    assert "reactívelo" in repeated.json()["message"]


def test_reactivating_a_term_never_leaves_two_active_with_the_same_label(
    seeded_api: SeededApi,
) -> None:
    """A duplicate that only old data can have: an inactive term with an active one's label."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    active = _term(client, "Junco de prueba (sintético)")
    system = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with seeded_api.session() as session, audit_context(session, system):
        vocabulary_id = session.get(Term, uuid.UUID(active["id"])).vocabulary_id  # type: ignore[union-attr]
        legacy = Term(
            id=new_uuid(),
            vocabulary_id=vocabulary_id,
            code=f"LEG{uuid.uuid4().hex[:6].upper()}",
            label="Junco de prueba (sintético)",
            is_active=False,
        )
        session.add(legacy)
        session.commit()
        legacy_id = str(legacy.id)

    reactivated = client.patch(f"{MATERIALS}/{legacy_id}", json={"is_active": True})

    assert reactivated.status_code == 422, reactivated.text
    assert reactivated.json()["details"]["term_id"] == active["id"]
