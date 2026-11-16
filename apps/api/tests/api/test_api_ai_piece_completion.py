"""«Completar ficha» con IA (change ia-completar-ficha; RIA-01, RIA-03, RN-008, RN-009, RN-010,
RNF-014).

Corre contra el proveedor mock real montado en /ai (sin red ni clave). Las pruebas que necesitan
otra respuesta del proveedor reemplazan solo esa operación. Datos sintéticos.
"""

import json
import uuid
from typing import Any

import pytest
from matp_ai.providers import MockProvider
from matp_ai.providers.base import ProviderUnavailable
from matp_ai.schemas import CompletionResult
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.modules.ai_suggestions import completion
from app.modules.ai_suggestions.client import AiServiceClient
from app.modules.ai_suggestions.models import AiSuggestion
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.catalog.service import set_materials
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.media.models import MediaAsset
from tests.api.conftest import SeededApi

DESCRIPTION = (
    "Caja de resonancia de madera de cedro, elaborada en Ayacucho. Mide 1,20 m de alto. "
    "Buen estado."
)
NOTES = "Observación de catálogo sintética."
SENSITIVE = (
    "Comodante Sintético Ñandú",
    "CONV-SINTETICO-77",
    "Registrador Sintético",
    "Propietaria Sintética",
    "dato de origen sintético",
)


def _piece(seeded: SeededApi, **values: Any) -> str:
    """A new piece missing every completable field (its own row: tests do not share it)."""
    with seeded.system_session() as db:
        piece = Piece(
            id=new_uuid(),
            denomination=values.pop("denomination", "Charango ayacuchano (sintético)"),
            tenure_regime=values.pop("tenure_regime", TenureRegime.OWNED),
            description=values.pop("description", DESCRIPTION),
            **values,
        )
        db.add(piece)
        db.commit()
        return str(piece.id)


def _suggestions_for(seeded: SeededApi, piece_id: str) -> list[AiSuggestion]:
    with seeded.session() as db:
        return list(
            db.scalars(select(AiSuggestion).where(AiSuggestion.piece_id == uuid.UUID(piece_id)))
        )


def _by_field(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {p["field"]: p for p in body["proposals"]}


def test_proposals_carry_their_quote_and_nothing_is_saved_until_approved(
    seeded_api: SeededApi,
) -> None:
    piece_id = _piece(seeded_api)
    admin = seeded_api.login_as("ADMIN")

    response = admin.post(f"/api/v1/ai/pieces/{piece_id}/completion")
    assert response.status_code == 200, response.text
    body = response.json()
    proposals = _by_field(body)
    # Escenario «Propuesta con cita».
    assert proposals["materials"]["value"] == "MADERA"
    assert proposals["materials"]["label"] == "Madera"
    assert proposals["materials"]["piece_field"] == "materials"
    assert proposals["materials"]["term_id"]
    assert proposals["materials"]["evidence"] == {
        "source": "text",
        "quote": "madera de cedro",
        "text_field": "description",
    }
    assert proposals["provenance"]["value"] == "Ayacucho"
    # Escenario «Sin dato en la ficha»: la ficha no dice la época.
    assert "epoch" not in proposals
    assert "epoch_original_text" in body["not_found"]
    # Solo lo que falta y la IA puede probar: ni colección ni descripción.
    assert "collection_id" not in body["fields"] and "description" not in body["fields"]
    assert body["prompt_version"] == "completar-ficha-v1"
    assert body["reused"] is False

    # RN-009: pedir propuestas no escribe nada en la ficha.
    piece = admin.get(f"/api/v1/pieces/{piece_id}").json()
    assert piece["materials"] == []
    assert piece["provenance"] is None
    [suggestion] = _suggestions_for(seeded_api, piece_id)
    assert suggestion.status == "PENDING"
    assert suggestion.input_data["texts"]["description"] == DESCRIPTION

    # Volver a abrir el panel sin cambios en la ficha no vuelve a llamar a la IA.
    again = admin.post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    assert again["reused"] is True
    assert again["suggestion_id"] == body["suggestion_id"]
    assert len(_suggestions_for(seeded_api, piece_id)) == 1


def test_saving_accepted_and_corrected_proposals_is_audited_as_ai(
    seeded_api: SeededApi,
) -> None:
    piece_id = _piece(seeded_api)
    admin = seeded_api.login_as("ADMIN")
    body = admin.post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    proposals = _by_field(body)
    suggestion_id = body["suggestion_id"]

    # Lo que la IA no propuso no se aprueba como si viniera de ella.
    not_proposed = admin.post(
        f"/api/v1/ai/suggestions/{suggestion_id}/approve",
        json={"approved_data": {"fields": [{"field": "epoch", "value": "siglo XX"}]}},
    )
    assert not_proposed.status_code == 422
    assert not_proposed.json()["code"] == "field_not_proposed"

    approved = admin.post(
        f"/api/v1/ai/suggestions/{suggestion_id}/approve",
        json={
            "approved_data": {
                "fields": [
                    {"field": "materials", "value": proposals["materials"]["value"]},
                    # Corregida por la persona antes de guardar.
                    {"field": "provenance", "value": "Huamanga, Ayacucho"},
                ],
                "discarded": ["dimensions_text", "category", "conservation_status"],
            }
        },
    )
    assert approved.status_code == 200, approved.text
    result = approved.json()
    assert result["status"] == "PARTIALLY_APPROVED"
    assert result["approved_data"]["discarded"] == [
        "dimensions_text",
        "category",
        "conservation_status",
    ]

    piece = admin.get(f"/api/v1/pieces/{piece_id}").json()
    assert [m["label"] for m in piece["materials"]] == ["Madera"]
    assert piece["provenance"] == "Huamanga, Ayacucho"
    assert piece["dimensions_text"] is None  # descartada: no se guarda

    with seeded_api.session() as db:
        entries = db.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(piece_id), AuditLog.field == "provenance"
            )
        ).all()
    assert entries, "el cambio de procedencia quedó auditado"
    for entry in entries:
        assert entry.origin == AuditOrigin.AI
        assert entry.origin_ref == suggestion_id
        assert str(entry.user_id) == result["reviewed_by_id"]


def test_rejecting_when_nothing_was_accepted_writes_nothing(seeded_api: SeededApi) -> None:
    piece_id = _piece(seeded_api)
    admin = seeded_api.login_as("ADMIN")
    body = admin.post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    rejected = admin.post(
        f"/api/v1/ai/suggestions/{body['suggestion_id']}/reject",
        json={"reason": completion.NO_ACCEPTED_REASON},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "REJECTED"
    piece = admin.get(f"/api/v1/pieces/{piece_id}").json()
    assert piece["materials"] == [] and piece["provenance"] is None


def test_a_cataloguer_can_ask_but_not_approve(seeded_api: SeededApi) -> None:
    piece_id = _piece(seeded_api)
    cataloguer = seeded_api.login_as("CATALOGUER")
    body = cataloguer.post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    assert body["proposals"]
    denied = cataloguer.post(
        f"/api/v1/ai/suggestions/{body['suggestion_id']}/approve",
        json={"approved_data": {"fields": [body["proposals"][0]]}},
    )
    assert denied.status_code == 403
    assert (
        seeded_api.login_as("INTERNAL_VIEWER")
        .post(f"/api/v1/ai/pieces/{piece_id}/completion")
        .status_code
        == 403
    )


def test_without_evidence_there_is_no_proposal(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The API checks again whatever the AI service returns (D2), even a provider that skipped
    the service's own verification."""

    def fake(self: AiServiceClient, body: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": "llm",
            "model": "modelo-x",
            "result": {
                "prompt_version": "completar-ficha-v1",
                "proposals": [
                    {  # cita que no está en la ficha
                        "field": "epoch",
                        "value": "siglo XIX",
                        "confidence": 0.9,
                        "evidence": {"source": "text", "quote": "de estilo del siglo XIX"},
                    },
                    {  # término que no es de la lista del museo
                        "field": "materials",
                        "value": "CEDRO",
                        "confidence": 0.9,
                        "evidence": {"source": "text", "quote": "madera de cedro"},
                    },
                    {  # «de la foto» sin foto enviada
                        "field": "category",
                        "value": "INSTRUMENTO_MUSICAL",
                        "confidence": 0.95,
                        "evidence": {"source": "image"},
                    },
                    {  # sin prueba
                        "field": "provenance",
                        "value": "Cusco",
                        "confidence": 0.9,
                        "evidence": {"source": "text", "quote": None},
                    },
                    {  # válida
                        "field": "materials",
                        "value": "MADERA",
                        "confidence": 0.9,
                        "evidence": {"source": "text", "quote": "madera de cedro"},
                    },
                ],
            },
        }

    monkeypatch.setattr(AiServiceClient, "complete_piece", fake)
    piece_id = _piece(seeded_api)
    body = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    assert [(p["field"], p["value"]) for p in body["proposals"]] == [("materials", "MADERA")]
    assert {"epoch_original_text", "category_id", "provenance"} <= set(body["not_found"])


def test_only_catalog_fields_reach_the_provider(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    """RNF-014: never the comodante, the agreement, the owner, the registrar or the source
    record — the request the provider receives is checked as it arrives."""
    received: list[Any] = []

    def spy(self: MockProvider, request: Any) -> CompletionResult:
        received.append(request.model_dump())
        return CompletionResult(proposals=[], not_found=list(request.fields))

    monkeypatch.setattr(MockProvider, "complete_piece", spy)
    piece_id = _piece(
        seeded_api,
        tenure_regime=TenureRegime.LOAN_FOR_USE,
        lender_name=SENSITIVE[0],
        loan_agreement_ref=SENSITIVE[1],
        recorded_by=SENSITIVE[2],
        legal_owner=SENSITIVE[3],
        notes=NOTES,
    )
    with seeded_api.system_session() as db:
        db.add(
            PieceSourceRecord(
                id=new_uuid(),
                piece_id=uuid.UUID(piece_id),
                source_name="Excel sintético",
                payload={"OBSERVACIONES": SENSITIVE[4], "COMODANTE": SENSITIVE[0]},
            )
        )
        db.commit()

    response = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{piece_id}/completion")
    assert response.status_code == 200, response.text
    [request] = received
    assert set(request["texts"]) == {"denomination", "description", "notes"}
    # RNF-014: las observaciones no salen por defecto (pueden tener datos personales, CF3).
    assert request["texts"]["notes"] is None
    assert NOTES not in json.dumps(request, ensure_ascii=False)
    assert request["image"] is None  # comodato: la foto no sale (RN-008)
    sent = json.dumps(request, ensure_ascii=False)
    for value in SENSITIVE:
        assert value not in sent
    # Y tampoco queda en la sugerencia guardada.
    [suggestion] = _suggestions_for(seeded_api, piece_id)
    stored = json.dumps(suggestion.input_data, ensure_ascii=False)
    for value in (*SENSITIVE, NOTES):
        assert value not in stored


def test_observations_are_sent_only_when_the_flag_allows_it(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[Any] = []

    def spy(self: MockProvider, request: Any) -> CompletionResult:
        received.append(request.model_dump())
        return CompletionResult(proposals=[], not_found=list(request.fields))

    monkeypatch.setattr(MockProvider, "complete_piece", spy)
    assert completion.SEND_NOTES_TO_AI is False  # el valor del repositorio
    monkeypatch.setattr(completion, "SEND_NOTES_TO_AI", True)
    piece_id = _piece(seeded_api, notes=NOTES)
    response = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{piece_id}/completion")
    assert response.status_code == 200, response.text
    assert received[-1]["texts"]["notes"] == NOTES


def _photo(seeded: SeededApi, piece_id: str, *, restricted: bool = False) -> str:
    with seeded.system_session() as db:
        restriction = None
        if restricted:
            restriction = db.scalars(
                select(Term.id)
                .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
                .where(Vocabulary.code == VocabularyCode.USAGE_RESTRICTION)
                .limit(1)
            ).one()
        asset_id = new_uuid()
        db.add(
            MediaAsset(
                id=asset_id,
                piece_id=uuid.UUID(piece_id),
                storage_key=f"pieces/{piece_id}/{asset_id}/original.jpg",
                original_filename="sintetica.jpg",
                content_type="image/jpeg",
                size_bytes=12,
                content_sha256="0" * 64,
                is_primary=True,
                usage_restriction_term_id=restriction,
            )
        )
        db.commit()
        return str(asset_id)


def test_the_main_photo_is_sent_only_when_allowed(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    received: list[Any] = []

    def spy(self: MockProvider, request: Any) -> CompletionResult:
        received.append(request)
        return CompletionResult(proposals=[], not_found=list(request.fields))

    monkeypatch.setattr(MockProvider, "complete_piece", spy)
    read: list[str] = []
    storage = seeded_api.app.state.storage
    monkeypatch.setattr(storage, "get_bytes", lambda key: read.append(key) or b"RIFF-sintetico")

    owned = _piece(seeded_api)
    asset_id = _photo(seeded_api, owned)
    body = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{owned}/completion").json()
    assert body["image_used"] is True
    assert received[-1].image.media_type == "image/webp"
    assert read == [f"pieces/{owned}/{asset_id}/display.webp"]  # la copia de visualización
    [suggestion] = _suggestions_for(seeded_api, owned)
    assert suggestion.input_data["image_media_id"] == asset_id
    assert "data_base64" not in json.dumps(suggestion.input_data)  # nada binario en la base

    restricted = _piece(seeded_api)
    _photo(seeded_api, restricted, restricted=True)
    body = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{restricted}/completion").json()
    assert body["image_used"] is False
    assert received[-1].image is None


def test_a_piece_with_nothing_to_ask_does_not_call_the_ai(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Any] = []
    monkeypatch.setattr(AiServiceClient, "complete_piece", lambda self, body: calls.append(body))
    with seeded_api.system_session() as db:
        terms = {
            code: db.scalars(
                select(Term.id)
                .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
                .where(Vocabulary.code == code)
                .limit(1)
            ).one()
            for code in (VocabularyCode.CATEGORY, VocabularyCode.CONSERVATION_STATUS)
        }
    piece_id = _piece(
        seeded_api,
        category_id=terms[VocabularyCode.CATEGORY],
        conservation_state_id=terms[VocabularyCode.CONSERVATION_STATUS],
        provenance="Ayacucho",
        epoch_original_text="Siglo XX",
        dimensions_text="alto 1,20 m",
    )
    with seeded_api.system_session() as db:
        piece = db.get(Piece, uuid.UUID(piece_id))
        material = db.scalars(
            select(Term)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(Vocabulary.code == VocabularyCode.MATERIAL)
            .limit(1)
        ).one()

        assert piece is not None
        set_materials(db, piece, [material.id])
        db.commit()
    body = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{piece_id}/completion").json()
    assert body["suggestion_id"] is None and body["proposals"] == []
    assert calls == []


def test_provider_failure_leaves_the_piece_untouched(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    def down(self: MockProvider, request: Any) -> CompletionResult:
        raise ProviderUnavailable("sin proveedor (prueba)")

    monkeypatch.setattr(MockProvider, "complete_piece", down)
    piece_id = _piece(seeded_api)
    response = seeded_api.login_as("ADMIN").post(f"/api/v1/ai/pieces/{piece_id}/completion")
    assert response.status_code == 503
    assert response.json()["code"] == "ai_unavailable"
    assert _suggestions_for(seeded_api, piece_id) == []
