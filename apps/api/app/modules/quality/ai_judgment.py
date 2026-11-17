"""AI judgment of the duplicate queue, approved by group (change ia-juicio-duplicados; RIA-02,
RF-030, RN-005, RN-009, RN-010, RNF-014).

- **Rules first** (D2): a pair whose pieces hold different current inventory codes is «distinct»
  by rule, without asking the AI.
- **What the AI receives** (D1, RNF-014): for each side, only the catalog fields of the queue
  comparison and the piece's description. A spreadsheet row uses only the whitelist of
  ``import_row_summaries``. Never the comodante, the registrar, the observations, the agreement,
  the owner or the source records.
- **A background run by batches** (D7, pattern of ``run_full_scan``): each batch that fails or
  times out is recorded and the run goes on; resuming judges only the pairs left without a
  verdict.
- **Nothing is applied by the AI** (RN-009): verdicts are append-only rows
  (``duplicate_ai_verdict``). A person approves a group, with exclusions; the «same» group needs
  its random sample confirmed (D6). Each pair resolved so is audited with origin AI, the run as
  ``origin_ref`` and the person who approved.
"""

import logging
import random
import time
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.jobs import SessionFactory, is_stale
from app.core.models_base import new_uuid, utcnow
from app.modules.ai_suggestions.client import AiServiceClient
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.imports.decisions import decide_row
from app.modules.imports.models import ImportRow
from app.modules.quality.import_rows import import_row_summaries
from app.modules.quality.merge import MERGEABLE_FIELDS, _current_inventory_codes, _is_empty
from app.modules.quality.models import (
    DuplicateAiVerdict,
    DuplicateAiVerdictSource,
    DuplicateAiVerdictValue,
    DuplicateCandidate,
    DuplicateStatus,
    QualityJob,
    QualityJobStatus,
    QualityJobType,
    QualitySetting,
)
from app.modules.quality.queue import CandidateClosed, StaleCandidate, resolve_candidate

logger = logging.getLogger(__name__)

SETTING_KEY = "duplicates.ai_judgment"
JUDGE_ACTOR = "Juicio de duplicados con IA"
RULE_REASON = "Regla: dos códigos I vigentes distintos"
GROUPS = ("same", "distinct", "unsure")
APPROVABLE_GROUPS = ("same", "distinct")
GROUP_LABELS = {"same": "misma pieza", "distinct": "distintas", "unsure": "no está seguro"}
_INVENTORY_CONFLICT = "inventory_code_conflict"

#: Sheet fields named in plain words when two pieces hold different values (D5).
_FIELD_WORDS = {
    "denomination": "denominación",
    "description": "descripción",
    "collection_id": "colección",
    "category_id": "categoría",
    "author": "autor",
    "provenance": "procedencia",
    "epoch_original_text": "época",
    "epoch_start_year": "época",
    "epoch_end_year": "época",
    "epoch_type": "época",
    "dimensions_text": "medidas",
    "dimensions": "medidas",
    "conservation_state_id": "estado de conservación",
    "notes": "observaciones",
    "entry_date": "fecha de ingreso",
    "acquisition_method_term_id": "forma de adquisición",
    "object_type_term_id": "tipo de bien",
    "availability_term_id": "disponibilidad",
    "recorded_by": "registrado por",
    "lender_name": "comodante",
    "loan_agreement_ref": "convenio",
    "temporary_inventory_number": "número temporal",
}


@dataclass(frozen=True)
class JudgmentConfig:
    """Parameters in ``quality_setting`` (key ``SETTING_KEY``); defaults when absent (RN-010)."""

    min_confidence: float = 0.85
    batch_size: int = 20
    sample_size: int = 5

    @classmethod
    def from_setting(cls, value: dict[str, Any] | None) -> "JudgmentConfig":
        value = value or {}
        defaults = cls()

        def number(key: str, low: float, high: float, fallback: float) -> float:
            try:
                return min(max(float(value.get(key, fallback)), low), high)
            except (TypeError, ValueError):
                return fallback

        return cls(
            min_confidence=number("min_confidence", 0.5, 1.0, defaults.min_confidence),
            batch_size=int(number("batch_size", 1, 50, defaults.batch_size)),
            sample_size=int(number("sample_size", 1, 50, defaults.sample_size)),
        )


def load_config(session: Session) -> JudgmentConfig:
    value = session.scalar(select(QualitySetting.value).where(QualitySetting.key == SETTING_KEY))
    return JudgmentConfig.from_setting(value)


class JudgmentInProgress(ConflictError):
    code = "ai_run_in_progress"


# ---------------------------------------------------------------------------- rules (D2)
def code_conflict(candidate: DuplicateCandidate) -> bool:
    """Both pieces hold different current inventory codes: distinct by rule, no AI (D2)."""
    if candidate.blocking_conflict:
        return True
    for signal in candidate.matched_fields or []:
        if isinstance(signal, dict) and _INVENTORY_CONFLICT in (
            signal.get("signal"),
            signal.get("field"),
        ):
            return True
    return False


# ----------------------------------------------------------------- what the AI sees (D1)
def _piece_sides(session: Session, piece_ids: set[uuid.UUID]) -> dict[uuid.UUID, dict[str, Any]]:
    if not piece_ids:
        return {}
    pieces = list(session.scalars(select(Piece).where(Piece.id.in_(piece_ids))))
    collection_ids = {p.collection_id for p in pieces if p.collection_id}
    names = (
        dict(
            session.execute(
                select(Collection.id, Collection.name).where(Collection.id.in_(collection_ids))
            ).all()
        )
        if collection_ids
        else {}
    )
    identifiers: dict[uuid.UUID, list[PieceIdentifier]] = {}
    for identifier in session.scalars(
        select(PieceIdentifier)
        .where(PieceIdentifier.piece_id.in_(piece_ids), PieceIdentifier.deleted_at.is_(None))
        .order_by(PieceIdentifier.identifier_type_code, PieceIdentifier.original_value)
    ):
        identifiers.setdefault(identifier.piece_id, []).append(identifier)
    sides: dict[uuid.UUID, dict[str, Any]] = {}
    for piece in pieces:
        own = identifiers.get(piece.id, [])
        code_i = next(
            (
                i.original_value
                for i in own
                if i.identifier_type_code == INVENTORY_CODE_TYPE and i.is_current
            ),
            None,
        )
        others = [
            f"{i.identifier_type_code} {i.original_value}"
            + ("" if i.is_current else " (histórico)")
            for i in own
            if i.identifier_type_code != INVENTORY_CODE_TYPE
        ]
        # The whitelist of RNF-014: nothing else of the piece is read here.
        sides[piece.id] = {
            "kind": "piece",
            "denomination": piece.denomination,
            "collection": names.get(piece.collection_id) if piece.collection_id else None,
            "tenure_regime": TENURE_REGIME_LABELS.get(piece.tenure_regime),
            "code_i": code_i,
            "other_codes": others,
            "author": piece.author,
            "provenance": piece.provenance,
            "period": piece.epoch_original_text,
            "dimensions": piece.dimensions_text,
            "description": piece.description,
        }
    return sides


def _row_side(summary: Any) -> dict[str, Any]:
    """A spreadsheet row through the whitelist of ``import_row_summaries`` (no description)."""
    codes = list(summary.identifiers or [])
    code_i = next((c.original_value for c in codes if c.type == INVENTORY_CODE_TYPE), None)
    return {
        "kind": "import_row",
        "denomination": summary.denomination,
        "collection": summary.collection_name,
        "tenure_regime": summary.tenure_regime,
        "code_i": code_i,
        "other_codes": [f"{c.type} {c.original_value}" for c in codes if c.type != "I"],
        "author": summary.author,
        "provenance": summary.provenance,
        "period": summary.period_text,
        "dimensions": summary.dimensions_text,
    }


def build_pairs(session: Session, candidates: Sequence[DuplicateCandidate]) -> list[dict[str, Any]]:
    """The body of ``/v1/judge-duplicates`` for these pairs, without empty values."""
    piece_ids = {c.piece_a_id for c in candidates} | {
        c.piece_b_id for c in candidates if c.piece_b_id
    }
    sides = _piece_sides(session, piece_ids)
    rows = import_row_summaries(session, candidates)
    pairs: list[dict[str, Any]] = []
    for candidate in candidates:
        side_a = sides.get(candidate.piece_a_id)
        if candidate.piece_b_id is not None:
            side_b = sides.get(candidate.piece_b_id)
        else:
            summary = rows.get(candidate.import_row_id) if candidate.import_row_id else None
            side_b = _row_side(summary) if summary is not None else None
        if side_a is None or side_b is None:
            continue
        pairs.append(
            {
                "pair_id": str(candidate.id),
                "a": {k: v for k, v in side_a.items() if v not in (None, "", [])},
                "b": {k: v for k, v in side_b.items() if v not in (None, "", [])},
            }
        )
    return pairs


def verified_verdicts(envelope: dict[str, Any], sent: Iterable[str]) -> list[dict[str, Any]]:
    """The AI's verdicts checked again here (D4): a ``pair_id`` sent in this batch, a verdict
    of the three and the confidence clipped to 0..1. One per pair; the rest is dropped."""
    sent_ids = set(sent)
    result = envelope.get("result") if isinstance(envelope, dict) else None
    items = result.get("verdicts") if isinstance(result, dict) else None
    kept: dict[str, dict[str, Any]] = {}
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        pair_id = item.get("pair_id")
        verdict = item.get("verdict")
        if pair_id not in sent_ids or pair_id in kept:
            continue
        if verdict not in {v.value for v in DuplicateAiVerdictValue}:
            continue
        try:
            confidence = min(max(float(item.get("confidence", 0)), 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = 0.0
        reason = item.get("reason")
        reason = " ".join(reason.split())[:300] if isinstance(reason, str) else ""
        kept[pair_id] = {
            "pair_id": pair_id,
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "reason": reason or "Sin motivo.",
        }
    return list(kept.values())


# -------------------------------------------------------------------------- the run (D7)
def _running(session: Session) -> QualityJob | None:
    return session.scalars(
        select(QualityJob)
        .where(
            QualityJob.job_type == QualityJobType.AI_DUPLICATE_JUDGMENT,
            QualityJob.status == QualityJobStatus.RUNNING,
        )
        .order_by(QualityJob.created_at.desc())
    ).first()


def get_run(session: Session, run_id: uuid.UUID) -> QualityJob:
    run = session.get(QualityJob, run_id)
    if run is None or run.job_type != QualityJobType.AI_DUPLICATE_JUDGMENT:
        raise NotFound("No existe ese análisis con IA.", code="ai_run_not_found")
    return run


def latest_run(session: Session) -> QualityJob | None:
    return session.scalars(
        select(QualityJob)
        .where(QualityJob.job_type == QualityJobType.AI_DUPLICATE_JUDGMENT)
        .order_by(QualityJob.created_at.desc())
    ).first()


def start_judgment(
    session: Session, user_id: uuid.UUID | None, resume_run_id: uuid.UUID | None = None
) -> QualityJob:
    """A new run, or the given one resumed; 409 while another one is running."""
    current = _running(session)
    if current is not None:
        if not is_stale(current.heartbeat_at):
            raise JudgmentInProgress(
                "Gemini ya está analizando la cola; espere a que termine.",
                details={"run_id": str(current.id)},
            )
        current.status = QualityJobStatus.FAILED
        current.finished_at = utcnow()
        current.error_message = "Análisis interrumpido: dejó de informar su avance."
    now = utcnow()
    if resume_run_id is not None:
        run = get_run(session, resume_run_id)
        run.status = QualityJobStatus.RUNNING
        run.heartbeat_at = now
        run.finished_at = None
        run.error_message = None
        run.failed_batches = 0
        session.flush()
        return run
    run = QualityJob(
        id=new_uuid(),
        job_type=QualityJobType.AI_DUPLICATE_JUDGMENT,
        status=QualityJobStatus.RUNNING,
        requested_by_id=user_id,
        started_at=now,
        heartbeat_at=now,
        total_pieces=0,
        processed_pieces=0,
        pairs_evaluated=0,
        candidates_created=0,
        candidates_reopened=0,
        total_pairs=0,
        processed_pairs=0,
        failed_batches=0,
    )
    session.add(run)
    session.flush()
    return run


def _judged_ids(session: Session, run_id: uuid.UUID) -> set[uuid.UUID]:
    return set(
        session.scalars(
            select(DuplicateAiVerdict.candidate_id).where(DuplicateAiVerdict.run_id == run_id)
        )
    )


def _verdict(run_id: uuid.UUID, candidate_id: uuid.UUID, **values: Any) -> DuplicateAiVerdict:
    return DuplicateAiVerdict(
        id=new_uuid(), run_id=run_id, candidate_id=candidate_id, created_at=utcnow(), **values
    )


def _pieces_alive(session: Session, candidate: DuplicateCandidate) -> bool:
    ids = [candidate.piece_a_id, *([candidate.piece_b_id] if candidate.piece_b_id else [])]
    alive = session.scalars(
        select(Piece.id).where(
            Piece.id.in_(ids), Piece.deleted_at.is_(None), Piece.merged_into_id.is_(None)
        )
    ).all()
    return len(set(alive)) == len(set(ids))


def run_judgment(factory: SessionFactory, client: AiServiceClient, run_id: uuid.UUID) -> None:
    """Background body of a run: rules first, then the AI by batches (D2, D7)."""
    session = factory()
    started = time.monotonic()
    try:
        run = session.get(QualityJob, run_id)
        if run is None or run.status != QualityJobStatus.RUNNING:
            return
        config = load_config(session)
        context = AuditContext(
            origin=AuditOrigin.AI,
            user_id=run.requested_by_id,
            actor_label=JUDGE_ACTOR,
            origin_ref=str(run_id),
        )
        with audit_context(session, context):
            judged = _judged_ids(session, run_id)
            pending = [
                c
                for c in session.scalars(
                    select(DuplicateCandidate)
                    .where(DuplicateCandidate.status == DuplicateStatus.PENDING)
                    .order_by(DuplicateCandidate.created_at, DuplicateCandidate.id)
                )
                if c.id not in judged
            ]
            # A pair whose piece is gone (merged or in the trash) cannot be judged: the queue
            # supersedes it when someone opens it. Left out so the run can finish (D7).
            pending = [c for c in pending if _pieces_alive(session, c)]
            run.processed_pairs = len(judged)
            run.total_pairs = len(judged) + len(pending)
            to_judge: list[DuplicateCandidate] = []
            for candidate in pending:
                if code_conflict(candidate):
                    session.add(
                        _verdict(
                            run_id,
                            candidate.id,
                            verdict=DuplicateAiVerdictValue.DISTINCT,
                            confidence=Decimal("1"),
                            reason=RULE_REASON,
                            source=DuplicateAiVerdictSource.RULE,
                        )
                    )
                    run.processed_pairs += 1
                else:
                    to_judge.append(candidate)
            run.heartbeat_at = utcnow()
            session.commit()

            batches = [
                to_judge[i : i + config.batch_size]
                for i in range(0, len(to_judge), config.batch_size)
            ]
            for batch in batches:
                try:
                    pairs = build_pairs(session, batch)
                    if pairs:
                        envelope = client.judge_duplicates({"pairs": pairs})
                        result = envelope.get("result") or {}
                        for item in verified_verdicts(envelope, [p["pair_id"] for p in pairs]):
                            session.add(
                                _verdict(
                                    run_id,
                                    uuid.UUID(item["pair_id"]),
                                    verdict=DuplicateAiVerdictValue(item["verdict"]),
                                    confidence=Decimal(str(item["confidence"])),
                                    reason=item["reason"],
                                    source=DuplicateAiVerdictSource.AI,
                                    provider=envelope.get("provider"),
                                    model=envelope.get("model"),
                                    prompt_version=result.get("prompt_version"),
                                )
                            )
                            run.processed_pairs += 1
                except Exception as exc:  # noqa: BLE001 — a failed batch never stops the run
                    session.rollback()
                    logger.warning("Lote del análisis %s sin respuesta de la IA: %s", run_id, exc)
                    run = session.get(QualityJob, run_id)  # type: ignore[assignment]
                    assert run is not None
                    run.failed_batches += 1
                run.heartbeat_at = utcnow()
                session.commit()

            all_failed = bool(batches) and run.failed_batches == len(batches)
            run.status = QualityJobStatus.FAILED if all_failed else QualityJobStatus.SUCCEEDED
            if all_failed:
                run.error_message = "La IA no respondió; puede reanudar el análisis."
            run.heartbeat_at = run.finished_at = utcnow()
            run.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
    except Exception as exc:
        logger.exception("Falló el análisis con IA de la cola de duplicados %s", run_id)
        session.rollback()
        failed = session.get(QualityJob, run_id)
        if failed is not None:
            failed.status = QualityJobStatus.FAILED
            failed.finished_at = utcnow()
            failed.error_message = f"{type(exc).__name__}: {exc}"[:1000]
            failed.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
    finally:
        session.close()


# ------------------------------------------------------------------------ groups (D4, D6)
def _latest_by_candidate(
    session: Session, run_id: uuid.UUID, *, include_review: bool = True
) -> dict[uuid.UUID, DuplicateAiVerdict]:
    latest: dict[uuid.UUID, DuplicateAiVerdict] = {}
    statement = select(DuplicateAiVerdict).where(DuplicateAiVerdict.run_id == run_id)
    if not include_review:
        statement = statement.where(DuplicateAiVerdict.source != DuplicateAiVerdictSource.REVIEW)
    rows = session.scalars(statement).all()
    # A person's review always wins over the rule or the AI; otherwise the newest verdict.
    for row in sorted(
        rows, key=lambda v: (v.source == DuplicateAiVerdictSource.REVIEW, v.created_at)
    ):
        latest[row.candidate_id] = row
    return latest


def group_of(verdict: DuplicateAiVerdict, config: JudgmentConfig) -> str:
    if verdict.source == DuplicateAiVerdictSource.REVIEW:
        return "unsure"
    if verdict.verdict != DuplicateAiVerdictValue.UNSURE and float(verdict.confidence) >= (
        config.min_confidence
    ):
        return verdict.verdict.value
    return "unsure"


@dataclass
class GroupMember:
    candidate: DuplicateCandidate
    verdict: DuplicateAiVerdict


def group_members(
    session: Session, run_id: uuid.UUID, config: JudgmentConfig
) -> dict[str, list[GroupMember]]:
    """The run's pairs still pending, by group; pairs resolved meanwhile leave their group."""
    latest = _latest_by_candidate(session, run_id)
    groups: dict[str, list[GroupMember]] = {group: [] for group in GROUPS}
    if not latest:
        return groups
    candidates = session.scalars(
        select(DuplicateCandidate)
        .where(
            DuplicateCandidate.id.in_(latest),
            DuplicateCandidate.status == DuplicateStatus.PENDING,
        )
        .order_by(DuplicateCandidate.score.desc(), DuplicateCandidate.id)
    )
    for candidate in candidates:
        verdict = latest[candidate.id]
        groups[group_of(verdict, config)].append(GroupMember(candidate, verdict))
    return groups


def sample_ids(session: Session, run_id: uuid.UUID, config: JudgmentConfig) -> list[uuid.UUID]:
    """The random sample of the «same» group (D6). The run is the seed and the population is
    what the rule or the AI judged «same», so the API recomputes the same sample on approval
    without storing it."""
    first = _latest_by_candidate(session, run_id, include_review=False)
    population = sorted(str(cid) for cid, v in first.items() if group_of(v, config) == "same")
    if not population:
        return []
    chosen = random.Random(str(run_id)).sample(population, min(config.sample_size, len(population)))
    return [uuid.UUID(value) for value in sorted(chosen)]


# --------------------------------------------------------------------- merge plan (D5)
@dataclass
class MergePlan:
    ready: bool
    surviving_id: uuid.UUID | None = None
    blocker: str | None = None


def merge_plan(session: Session, candidate: DuplicateCandidate) -> MergePlan:
    """Whether a «same» pair of two pieces is ready to merge without choosing values (D5)."""
    if candidate.piece_b_id is None:
        return MergePlan(ready=False, blocker="Es una fila de Excel: se resuelve en su lote.")
    a, b = session.get(Piece, candidate.piece_a_id), session.get(Piece, candidate.piece_b_id)
    if a is None or b is None or a.merged_into_id or b.merged_into_id:
        return MergePlan(ready=False, blocker="Una de las piezas ya no está activa.")
    if a.tenure_regime != b.tenure_regime:
        return MergePlan(ready=False, blocker="Tienen regímenes de tenencia distintos.")
    codes_a = _current_inventory_codes(session, a.id)
    codes_b = _current_inventory_codes(session, b.id)
    if codes_a and codes_b and codes_a != codes_b:
        return MergePlan(ready=False, blocker="Tienen códigos I vigentes distintos.")
    clashes = sorted(
        {
            _FIELD_WORDS.get(name, name)
            for name in MERGEABLE_FIELDS
            if not _is_empty(getattr(a, name))
            and not _is_empty(getattr(b, name))
            and getattr(a, name) != getattr(b, name)
        }
    )
    if clashes:
        return MergePlan(
            ready=False, blocker="Elija los valores: son distintos en " + ", ".join(clashes) + "."
        )
    # The piece with code I survives (a code I never changes piece, RN-002); otherwise piece A.
    surviving = b.id if codes_b and not codes_a else a.id
    return MergePlan(ready=True, surviving_id=surviving)


# ------------------------------------------------------------------------ approval (D5)
@dataclass
class ApprovalResult:
    group: str
    resolved: int = 0
    merged: int = 0
    rows_decided: int = 0
    excluded: int = 0
    needs_choice: int = 0
    skipped: list[dict[str, str]] = field(default_factory=list)


def approve_group(
    session: Session,
    run: QualityJob,
    group: str,
    *,
    user_id: uuid.UUID,
    excluded_ids: Iterable[uuid.UUID],
    confirmed_sample_ids: Iterable[uuid.UUID],
    can_decide_rows: bool,
) -> ApprovalResult:
    """Apply a group the person approved, minus the pairs taken out (RN-009)."""
    if group not in APPROVABLE_GROUPS:
        raise ValidationFailed(
            "Los pares en los que Gemini no está seguro se revisan uno por uno.",
            code="group_not_approvable",
        )
    if run.status == QualityJobStatus.RUNNING:
        raise JudgmentInProgress("Espere a que Gemini termine el análisis para aprobar un grupo.")
    config = load_config(session)
    members = group_members(session, run.id, config)[group]
    by_id = {m.candidate.id: m for m in members}
    excluded = set(excluded_ids) & set(by_id)
    if group == "same":
        confirmed = set(confirmed_sample_ids)
        missing = [
            str(cid)
            for cid in sample_ids(session, run.id, config)
            if cid in by_id and cid not in confirmed and cid not in excluded
        ]
        if missing:
            raise ValidationFailed(
                "Confirme o saque del grupo cada par de la muestra antes de aprobar.",
                code="sample_not_confirmed",
                details={"missing_sample_ids": missing},
            )
    result = ApprovalResult(group=group, excluded=len(excluded))
    context = AuditContext(origin=AuditOrigin.AI, user_id=user_id, origin_ref=str(run.id))
    with audit_context(session, context):
        for cid in sorted(excluded, key=str):
            session.add(
                _verdict(
                    run.id,
                    cid,
                    verdict=DuplicateAiVerdictValue.UNSURE,
                    confidence=Decimal("0"),
                    reason=f"Sacado del grupo «{GROUP_LABELS[group]}» al aprobar: se revisa a "
                    "mano.",
                    source=DuplicateAiVerdictSource.REVIEW,
                    created_by_id=user_id,
                )
            )
        for member in members:
            candidate, verdict = member.candidate, member.verdict
            if candidate.id in excluded:
                continue
            if candidate.status != DuplicateStatus.PENDING:  # closed by an earlier merge
                result.skipped.append(_skip(candidate, "Ya no estaba pendiente."))
                continue
            try:
                if group == "distinct":
                    resolve_candidate(
                        session,
                        candidate.id,
                        resolution=DuplicateStatus.DISTINCT,
                        reviewer_id=user_id,
                        note=f"Sugerido por IA: {verdict.reason}",
                    )
                    result.resolved += 1
                elif candidate.import_row_id is not None:
                    if not can_decide_rows:
                        result.skipped.append(
                            _skip(candidate, "La fila de Excel la decide quien prepara la carga.")
                        )
                        continue
                    row = session.get(ImportRow, candidate.import_row_id)
                    if row is None:
                        result.skipped.append(_skip(candidate, "La fila ya no existe."))
                        continue
                    decide_row(
                        session,
                        row.batch_id,
                        row.id,
                        decision=None,
                        user_id=user_id,
                        reason=f"Sugerido por IA: {verdict.reason}",
                        target_piece_id=candidate.piece_a_id,
                    )
                    result.rows_decided += 1
                else:
                    plan = merge_plan(session, candidate)
                    if not plan.ready:
                        result.needs_choice += 1
                        continue
                    resolve_candidate(
                        session,
                        candidate.id,
                        resolution=DuplicateStatus.MERGED,
                        reviewer_id=user_id,
                        note=f"Sugerido por IA y aprobado en grupo: {verdict.reason}",
                        surviving_piece_id=plan.surviving_id,
                        field_choices={},
                    )
                    result.merged += 1
            except (CandidateClosed, StaleCandidate):
                result.skipped.append(_skip(candidate, "Ya no estaba pendiente."))
            except (ValidationFailed, ConflictError, NotFound) as exc:
                result.skipped.append(_skip(candidate, exc.message))
        session.flush()
    return result


def _skip(candidate: DuplicateCandidate, reason: str) -> dict[str, str]:
    return {"candidate_id": str(candidate.id), "reason": reason}
