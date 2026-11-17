"""Juicio de duplicados con IA, aprobado por grupo (change ia-juicio-duplicados; RIA-02, RF-030,
RN-005, RN-009, RN-010, RNF-014).

Corre contra el proveedor mock real montado en /ai (sin red ni clave). Las pruebas que necesitan
otra respuesta reemplazan solo esa operación. El módulo tiene su propia base: crea y resuelve
pares, y así no cambia los conteos de otros módulos. Datos sintéticos.
"""

import json
import uuid
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

import pytest
from matp_ai.providers import MockProvider
from matp_ai.providers.base import ProviderUnavailable
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.collections.models import Collection
from app.modules.identification.models import INVENTORY_CODE_TYPE
from app.modules.identification.service import add_identifier
from app.modules.imports.mapping import MappingSpecV1
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportBatchStatus,
    ImportRow,
    RowClassification,
)
from app.modules.quality import ai_judgment
from app.modules.quality.models import (
    DuplicateAiVerdict,
    DuplicateAiVerdictSource,
    DuplicateCandidate,
    DuplicateStatus,
    QualitySetting,
)
from app.seed.synthetic import SABANA_TEMPLATE_MAPPING
from tests.api.conftest import SeededApi, build_seeded_api

RUNS = "/api/v1/quality/duplicates/ai-runs"
SENSITIVE = (
    "Comodante Sintético Ñandú",
    "Registrador Sintético",
    "Observación personal sintética",
    "CONV-SINTETICO-9",
    "Propietaria Sintética",
    "dato de origen sintético",
    "celda cruda sintética",
)


@pytest.fixture(scope="module")
def seeded_api() -> Iterator[SeededApi]:
    with build_seeded_api() as seeded:
        yield seeded


def _collection(seeded: SeededApi) -> uuid.UUID:
    with seeded.session() as db:
        return db.scalars(select(Collection.id).where(Collection.deleted_at.is_(None))).first()


def _piece(seeded: SeededApi, denomination: str, code_i: str | None = None, **values: Any) -> str:
    with seeded.system_session() as db:
        piece = Piece(
            id=new_uuid(),
            denomination=denomination,
            tenure_regime=values.pop("tenure_regime", TenureRegime.OWNED),
            collection_id=values.pop("collection_id", _collection(seeded)),
            **values,
        )
        db.add(piece)
        db.flush()
        if code_i:
            add_identifier(db, piece, INVENTORY_CODE_TYPE, code_i, source="Prueba sintética")
        db.commit()
        return str(piece.id)


def _pair(
    seeded: SeededApi,
    a: str,
    b: str | None = None,
    *,
    row_id: str | None = None,
    blocking: bool = False,
) -> str:
    signals = [{"field": "denomination", "similarity": 0.97}]
    if blocking:
        signals.append(
            {"signal": "inventory_code_conflict", "field": "identifier:I", "similarity": 0.0}
        )
    with seeded.system_session() as db:
        candidate = DuplicateCandidate(
            id=new_uuid(),
            piece_a_id=uuid.UUID(a),
            piece_b_id=uuid.UUID(b) if b else None,
            import_row_id=uuid.UUID(row_id) if row_id else None,
            score=Decimal("0.9"),
            matched_fields=signals,
            blocking_conflict=blocking,
        )
        db.add(candidate)
        db.commit()
        return str(candidate.id)


def _status(seeded: SeededApi, candidate_id: str) -> DuplicateStatus:
    with seeded.session() as db:
        candidate = db.get(DuplicateCandidate, uuid.UUID(candidate_id))
        assert candidate is not None
        return candidate.status


def _run(seeded: SeededApi, who: str = "ADMIN", **body: Any) -> dict[str, Any]:
    response = seeded.login_as(who).post(RUNS, json=body or None)
    assert response.status_code == 202, response.text
    # TestClient runs the background task before returning: the run already finished.
    finished = seeded.login_as(who).get(f"{RUNS}/{response.json()['id']}")
    assert finished.status_code == 200, finished.text
    return finished.json()


def _group(seeded: SeededApi, run_id: str, group: str) -> dict[str, dict[str, Any]]:
    response = seeded.login_as("ADMIN").get(
        f"{RUNS}/{run_id}/groups/{group}", params={"page_size": 100}
    )
    assert response.status_code == 200, response.text
    return {item["candidate"]["id"]: item for item in response.json()["items"]}


def _setting(seeded: SeededApi, value: dict[str, Any]) -> None:
    with seeded.system_session() as db:
        row = db.scalar(select(QualitySetting).where(QualitySetting.key == ai_judgment.SETTING_KEY))
        if row is None:
            db.add(QualitySetting(id=new_uuid(), key=ai_judgment.SETTING_KEY, value=value))
        else:
            row.value = value
        db.commit()


def _spy(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    """Records every request that reaches the provider; answers like the mock."""
    seen: list[Any] = []
    original = MockProvider.judge_duplicates

    def spy(self: MockProvider, request: Any) -> Any:
        seen.append(request.model_dump())
        return original(self, request)

    monkeypatch.setattr(MockProvider, "judge_duplicates", spy)
    return seen


def _sent_ids(seen: list[Any]) -> set[str]:
    return {pair["pair_id"] for request in seen for pair in request["pairs"]}


def test_nothing_is_resolved_until_a_group_is_approved(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen = _spy(monkeypatch)
    same = _pair(
        seeded_api,
        _piece(seeded_api, "Retablo de la Virgen (sintético)"),
        _piece(seeded_api, "Retablo de la Virgen (sintético)"),
    )
    codes = _pair(
        seeded_api,
        _piece(seeded_api, "Mate burilado (sintético)", code_i="I-9101"),
        _piece(seeded_api, "Mate burilado (sintético)", code_i="I-9102"),
        blocking=True,
    )
    run = _run(seeded_api)
    assert run["status"] == "SUCCEEDED"
    assert run["processed_pairs"] == run["total_pairs"] > 0
    assert run["groups"]["by_rule"] >= 1
    # Escenario «Gemini ordena la cola»: grupos con su cantidad, nada aplicado.
    assert same in _group(seeded_api, run["id"], "same")
    assert codes in _group(seeded_api, run["id"], "distinct")
    assert _status(seeded_api, same) == DuplicateStatus.PENDING
    assert _status(seeded_api, codes) == DuplicateStatus.PENDING
    # D2: el par con dos códigos I distintos se decide por regla, sin llamar a la IA.
    assert codes not in _sent_ids(seen) and same in _sent_ids(seen)
    rule = _group(seeded_api, run["id"], "distinct")[codes]["verdict"]
    assert rule == {
        "verdict": "distinct",
        "confidence": 1.0,
        "reason": ai_judgment.RULE_REASON,
        "source": "rule",
    }


def test_only_catalog_fields_reach_the_provider(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    """RNF-014: never the comodante, the registrar, the observations, the agreement, the owner
    or the source records; a spreadsheet row through its whitelist only."""
    seen = _spy(monkeypatch)
    a = _piece(
        seeded_api,
        "Charango ayacuchano (sintético)",
        tenure_regime=TenureRegime.LOAN_FOR_USE,
        lender_name=SENSITIVE[0],
        recorded_by=SENSITIVE[1],
        notes=SENSITIVE[2],
        loan_agreement_ref=SENSITIVE[3],
        legal_owner=SENSITIVE[4],
        description="Caja de resonancia de madera (sintético).",
    )
    b = _piece(seeded_api, "Charango ayacuchano (sintético)", notes=SENSITIVE[2])
    with seeded_api.system_session() as db:
        db.add(
            PieceSourceRecord(
                id=new_uuid(),
                piece_id=uuid.UUID(a),
                source_name="Excel sintético",
                payload={"OBSERVACIONES": SENSITIVE[5], "COMODANTE": SENSITIVE[0]},
            )
        )
        batch = ImportBatch(
            id=new_uuid(),
            source_name="Sábana sintética",
            kind=ImportBatchKind.SPREADSHEET,
            file_name="sabana-sintetica.xlsx",
            status=ImportBatchStatus.IN_PREVIEW,
        )
        db.add(batch)
        row = ImportRow(
            id=new_uuid(),
            batch_id=batch.id,
            source_row_number=7,
            raw_data={"COMODANTE": SENSITIVE[0], "OBS": SENSITIVE[6]},
            mapped_data={
                "fields": {
                    "denomination": "Charango ayacuchano",
                    "provenance": "Ayacucho",
                    "notes": SENSITIVE[2],
                    "recorded_by": SENSITIVE[1],
                    "lender_name": SENSITIVE[0],
                },
                "identifiers": [],
            },
            classification=RowClassification.POSSIBLE_DUPLICATE,
        )
        db.add(row)
        db.commit()
        row_id = str(row.id)
    pieces_pair = _pair(seeded_api, a, b)
    row_pair = _pair(seeded_api, a, row_id=row_id)

    _run(seeded_api)
    pairs = {pair["pair_id"]: pair for request in seen for pair in request["pairs"]}
    assert {pieces_pair, row_pair} <= set(pairs)
    sent = json.dumps([pairs[pieces_pair], pairs[row_pair]], ensure_ascii=False)
    for value in SENSITIVE:
        assert value not in sent
    allowed = {
        "kind",
        "denomination",
        "collection",
        "tenure_regime",
        "code_i",
        "other_codes",
        "author",
        "provenance",
        "period",
        "dimensions",
        "description",
    }
    for pair in (pairs[pieces_pair], pairs[row_pair]):
        assert {k for k, v in pair["a"].items() if v not in (None, [])} <= allowed
        assert {k for k, v in pair["b"].items() if v not in (None, [])} <= allowed
    assert pairs[pieces_pair]["a"]["description"] == "Caja de resonancia de madera (sintético)."
    row_side = pairs[row_pair]["b"]
    assert row_side["kind"] == "import_row" and row_side["provenance"] == "Ayacucho"
    assert row_side["description"] is None  # la fila no lleva descripción (lista blanca)


def test_distinct_group_approval_with_exclusions_is_audited_as_ai(
    seeded_api: SeededApi,
) -> None:
    codes = _pair(
        seeded_api,
        _piece(seeded_api, "Toro de Pucará (sintético)", code_i="I-9201"),
        _piece(seeded_api, "Toro de Pucará (sintético)", code_i="I-9202"),
        blocking=True,
    )
    far = _pair(
        seeded_api,
        _piece(seeded_api, "Máscara de diablo"),
        _piece(seeded_api, "Telar de cintura con urdimbre"),
    )
    run = _run(seeded_api)
    distinct = _group(seeded_api, run["id"], "distinct")
    assert {codes, far} <= set(distinct)

    response = seeded_api.login_as("ADMIN").post(
        f"{RUNS}/{run['id']}/groups/distinct/approve", json={"excluded_candidate_ids": [far]}
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["excluded"] == 1 and result["resolved"] >= 1

    # El par sacado vuelve a la revisión a mano: pendiente y en «no está seguro».
    assert _status(seeded_api, far) == DuplicateStatus.PENDING
    assert far in _group(seeded_api, run["id"], "unsure")
    assert _group(seeded_api, run["id"], "unsure")[far]["verdict"]["source"] == "review"
    # El aprobado queda distinto, con el motivo de la IA y auditado como sugerido por la IA.
    with seeded_api.session() as db:
        candidate = db.get(DuplicateCandidate, uuid.UUID(codes))
        assert candidate is not None
        assert candidate.status == DuplicateStatus.DISTINCT
        assert candidate.resolution_note == f"Sugerido por IA: {ai_judgment.RULE_REASON}"
        entries = db.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(codes), AuditLog.field == "status"
            )
        ).all()
        approver = candidate.reviewed_by_id
    assert entries
    for entry in entries:
        assert entry.origin == AuditOrigin.AI
        assert entry.origin_ref == run["id"]
        assert entry.user_id == approver is not None


def test_same_group_needs_its_sample_and_never_merges_blindly(
    seeded_api: SeededApi,
) -> None:
    keep = _piece(seeded_api, "Cajón de San Marcos (sintético)", code_i="I-9301")
    gone = _piece(seeded_api, "Cajón de San Marcos (sintético)", provenance="Ayacucho")
    ready = _pair(seeded_api, gone, keep)  # la pieza con código I se conserva
    clash = _pair(
        seeded_api,
        _piece(seeded_api, "Arpa andina (sintético)", provenance="Cusco"),
        _piece(seeded_api, "Arpa andina (sintético)", provenance="Puno"),
    )
    run = _run(seeded_api)
    same = _group(seeded_api, run["id"], "same")
    assert same[ready]["ready_to_merge"] is True
    assert same[clash]["ready_to_merge"] is False
    assert "procedencia" in same[clash]["merge_blocker"]

    admin = seeded_api.login_as("ADMIN")
    approve = f"{RUNS}/{run['id']}/groups/same/approve"
    # D6: sin confirmar la muestra, la API rechaza la aprobación.
    missing = admin.post(approve, json={})
    assert missing.status_code == 422
    assert missing.json()["code"] == "sample_not_confirmed"
    sample = [item["candidate"]["id"] for item in admin.get(f"{RUNS}/{run['id']}/sample").json()]
    assert sample and set(missing.json()["details"]["missing_sample_ids"]) == set(sample)

    response = admin.post(approve, json={"confirmed_sample_ids": sample})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["merged"] >= 1 and result["needs_choice"] >= 1

    # El listo para fusionar se fusionó en la pieza con código I; nada se borró (RN-005).
    assert _status(seeded_api, ready) == DuplicateStatus.MERGED
    with seeded_api.session() as db:
        survivor = db.get(Piece, uuid.UUID(keep))
        absorbed = db.get(Piece, uuid.UUID(gone), execution_options={INCLUDE_DELETED: True})
        assert survivor is not None and absorbed is not None
        assert absorbed.merged_into_id == survivor.id and absorbed.deleted_at is not None
        assert survivor.provenance == "Ayacucho"  # el vacío se llenó con la otra ficha
        merge_entries = db.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == survivor.id, AuditLog.field == "provenance"
            )
        ).all()
    assert merge_entries and all(e.origin == AuditOrigin.AI for e in merge_entries)
    assert all(e.origin_ref == run["id"] for e in merge_entries)
    # El que choca no se fusiona: espera la elección de valores.
    assert _status(seeded_api, clash) == DuplicateStatus.PENDING


def test_unsure_is_reviewed_one_by_one_and_permissions_hold(seeded_api: SeededApi) -> None:
    run = _run(seeded_api)
    admin = seeded_api.login_as("ADMIN")
    unsure = admin.post(f"{RUNS}/{run['id']}/groups/unsure/approve", json={})
    assert unsure.status_code == 422 and unsure.json()["code"] == "group_not_approvable"
    # El Catalogador puede pedir el juicio (ai.request) pero no aprobar (duplicates.resolve).
    cataloguer = seeded_api.login_as("CATALOGUER")
    assert cataloguer.post(f"{RUNS}/{run['id']}/groups/distinct/approve", json={}).status_code == (
        403
    )
    assert seeded_api.login_as("INTERNAL_VIEWER").post(RUNS).status_code == 403


def test_the_threshold_is_a_parameter(seeded_api: SeededApi) -> None:
    pair = _pair(
        seeded_api,
        _piece(seeded_api, "Mate con escenas de cosecha (sintético)"),
        _piece(seeded_api, "Mate con escenas de cosecha (sintético)"),
    )
    run = _run(seeded_api)
    assert pair in _group(seeded_api, run["id"], "same")  # el mock da 0,9
    _setting(seeded_api, {"min_confidence": 0.95})
    try:
        assert pair in _group(seeded_api, run["id"], "unsure")
    finally:
        _setting(seeded_api, {})


def test_a_failed_batch_is_recorded_and_the_run_resumes(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = _pair(
        seeded_api,
        _piece(seeded_api, "Huaco retrato (sintético)"),
        _piece(seeded_api, "Huaco retrato (sintético)"),
    )
    calls = {"n": 0}
    original = MockProvider.judge_duplicates

    def flaky(self: MockProvider, request: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 1:  # el primer lote no responde
            raise ProviderUnavailable("sin respuesta (prueba)")
        return original(self, request)

    monkeypatch.setattr(MockProvider, "judge_duplicates", flaky)
    _setting(seeded_api, {"batch_size": 1})
    try:
        run = _run(seeded_api)
        assert run["status"] == "SUCCEEDED"
        assert run["failed_batches"] == 1
        assert run["processed_pairs"] == run["total_pairs"] - 1
        assert run["can_resume"] is True

        resumed = _run(seeded_api, resume_run_id=run["id"])
        assert resumed["id"] == run["id"]
        assert resumed["failed_batches"] == 0
        assert resumed["processed_pairs"] == resumed["total_pairs"]
        assert resumed["can_resume"] is False
    finally:
        _setting(seeded_api, {})
    with seeded_api.session() as db:
        verdicts = db.scalars(
            select(DuplicateAiVerdict).where(DuplicateAiVerdict.run_id == uuid.UUID(run["id"]))
        ).all()
    judged = [v.candidate_id for v in verdicts if v.source != DuplicateAiVerdictSource.REVIEW]
    assert len(judged) == len(set(judged))  # cada par se juzgó una sola vez en la corrida
    assert uuid.UUID(first) in judged


def test_same_row_is_resolved_toward_its_piece(seeded_api: SeededApi) -> None:
    """D5: in a pair with a spreadsheet row, approving «same» decides the row in its batch."""
    collection = _collection(seeded_api)
    piece = _piece(seeded_api, "Retablo del Señor de Huanca", collection_id=collection)
    with seeded_api.system_session() as db:
        batch = ImportBatch(
            id=new_uuid(),
            source_name="Sábana sintética de retablos",
            kind=ImportBatchKind.SPREADSHEET,
            file_name="retablos-sinteticos.xlsx",
            status=ImportBatchStatus.IN_PREVIEW,
            mapping=MappingSpecV1.model_validate(SABANA_TEMPLATE_MAPPING).as_json(),
        )
        db.add(batch)
        row = ImportRow(
            id=new_uuid(),
            batch_id=batch.id,
            source_row_number=3,
            raw_data={"DENOMINACION": "Retablo del Señor de Huanca"},
            mapped_data={
                "fields": {"denomination": "Retablo del Señor de Huanca"},
                "collection_id": str(collection),
                "identifiers": [],
            },
            classification=RowClassification.POSSIBLE_DUPLICATE,
        )
        db.add(row)
        db.commit()
        row_id = row.id
    pair = _pair(seeded_api, piece, row_id=str(row_id))
    run = _run(seeded_api)
    assert pair in _group(seeded_api, run["id"], "same")

    admin = seeded_api.login_as("ADMIN")
    sample = [item["candidate"]["id"] for item in admin.get(f"{RUNS}/{run['id']}/sample").json()]
    response = admin.post(
        f"{RUNS}/{run['id']}/groups/same/approve", json={"confirmed_sample_ids": sample}
    )
    assert response.status_code == 200, response.text
    assert response.json()["rows_decided"] >= 1
    assert _status(seeded_api, pair) == DuplicateStatus.SUPERSEDED  # cerrado por su lote
    with seeded_api.session() as db:
        decided = db.get(ImportRow, row_id)
        assert decided is not None and str(decided.target_piece_id) == piece


def test_a_pair_with_a_piece_in_the_trash_is_left_out(seeded_api: SeededApi) -> None:
    """D7: a pair that can no longer be judged does not keep the run «resumable» forever."""
    gone = _piece(seeded_api, "Huaco sintético en la papelera")
    pair = _pair(seeded_api, _piece(seeded_api, "Huaco sintético en la papelera"), gone)
    with seeded_api.system_session() as db:
        piece = db.get(Piece, uuid.UUID(gone))
        assert piece is not None
        soft_delete(db, piece, "Prueba sintética: pieza en la papelera")
        db.commit()
    run = _run(seeded_api)
    assert run["processed_pairs"] == run["total_pairs"]
    assert run["can_resume"] is False
    for group in ("same", "distinct", "unsure"):
        assert pair not in _group(seeded_api, run["id"], group)
