"""«Completar ficha» con IA (change ia-completar-ficha; RIA-01, RIA-03, RN-008, RN-009, RN-010,
RNF-014).

Builds what is sent to the AI service for one piece and checks what comes back:

- **What leaves the catalog** (D1): the piece's denomination and description, the active terms
  of three lists and, if allowed, its main photo. Not its observations unless
  ``SEND_NOTES_TO_AI`` says so (RNF-014), and never the comodante, the agreement, the legal
  owner, the registrar or the source records.
- **What comes back** (D2): verified again here, whatever the provider and without importing
  the AI package (it may be deployed apart, ADR-008): a requested field, a literal quote or an
  allowed photo reading, and an active term of the museum's lists, resolved to its id.
- **Nothing is written** (D3): the result is a PENDING ``AiSuggestion``. The person accepts or
  corrects each proposal and saving approves it (``POST /ai/suggestions/{id}/approve``).
"""

import base64
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.ai_suggestions.models import AiFunction, AiSuggestion, SuggestionStatus
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.media.derivatives import derivative_keys
from app.modules.media.models import MediaAsset
from app.modules.quality.completeness import missing_fields_for_pieces

COMPLETION_KIND = "piece_completion"
#: Completeness field (``missing_fields``) -> field of the AI request (D1). The collection and the
#: description are not asked for: neither can be quoted from the piece's own text.
AI_FIELDS: dict[str, str] = {
    "category_id": "category",
    "materials": "materials",
    "provenance": "provenance",
    "epoch_original_text": "epoch",
    "dimensions_text": "dimensions_text",
    "conservation_state_id": "conservation_status",
}
PIECE_FIELDS = {ai: piece for piece, ai in AI_FIELDS.items()}
#: RNF-014 (Ley 29733): the observations may hold personal data (names, documents), so they are
#: not sent by default. Turn this on only once the museum confirms they do not (question CF3 in
#: docs/preguntas-contraparte.md, [SUPUESTO] pendiente). The AI service accepts them either way.
SEND_NOTES_TO_AI = False
#: The text fields of the piece that may reach the provider; ``notes`` only with the flag above.
_TEXT_FIELDS = ("denomination", "description")


def sent_text_fields() -> tuple[str, ...]:
    """The text fields of the piece sent to the provider (RNF-014, D1)."""
    return (*_TEXT_FIELDS, "notes") if SEND_NOTES_TO_AI else _TEXT_FIELDS


_VOCABULARIES = {
    "category": VocabularyCode.CATEGORY,
    "materials": VocabularyCode.MATERIAL,
    "conservation_status": VocabularyCode.CONSERVATION_STATUS,
}
#: The display copy is at most 1600 px; a larger object is not sent [SUPUESTO].
MAX_IMAGE_BYTES = 4_000_000
_IMAGE_TYPES = {"image/webp", "image/jpeg", "image/png"}
NO_ACCEPTED_REASON = "Ninguna propuesta aceptada al completar la ficha"
#: Same limits as the AI service (``matp_ai.schemas``), repeated on purpose (D2).
IMAGE_EVIDENCE_FIELDS = frozenset({"category", "materials", "conservation_status"})
IMAGE_MIN_CONFIDENCE = 0.8


def completable_fields(session: Session, piece: Piece) -> list[str]:
    """The AI fields this piece is missing, in the order of the completeness rules."""
    missing = missing_fields_for_pieces(session, [piece.id]).get(piece.id, [])
    return [AI_FIELDS[field] for field in missing if field in AI_FIELDS]


def _active_terms(session: Session, vocabulary: VocabularyCode) -> list[Term]:
    return list(
        session.scalars(
            select(Term)
            .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
            .where(
                Vocabulary.code == vocabulary,
                Term.is_active.is_(True),
                Term.deleted_at.is_(None),
            )
            .order_by(Term.sort_order, Term.label)
        )
    )


def main_photo(session: Session, piece: Piece) -> MediaAsset | None:
    """The photo that may be sent (D1): the main one, only of a piece the PUCP owns and only
    without a usage restriction (RN-008). Comodato and temporary loans may carry contractual
    limits on their images, so they are never sent [SUPUESTO]."""
    if piece.tenure_regime != TenureRegime.OWNED:
        return None
    asset = session.scalars(
        select(MediaAsset)
        .where(MediaAsset.piece_id == piece.id, MediaAsset.deleted_at.is_(None))
        .order_by(MediaAsset.is_primary.desc(), MediaAsset.sort_order, MediaAsset.created_at)
        .limit(1)
    ).first()
    if asset is None or asset.usage_restriction_term_id is not None:
        return None
    return asset


def _image_payload(storage: ObjectStorage | None, asset: MediaAsset) -> dict[str, str] | None:
    if storage is None:
        return None
    _thumb, display_key = derivative_keys(asset)
    media_type = "image/webp" if display_key.endswith(".webp") else asset.content_type
    if media_type not in _IMAGE_TYPES:
        return None
    try:
        data = storage.get_bytes(display_key)
    except Exception:  # noqa: BLE001 — without the photo the text is still read (D5)
        return None
    if not data or len(data) > MAX_IMAGE_BYTES:
        return None
    return {"media_type": media_type, "data_base64": base64.b64encode(data).decode("ascii")}


def build_request(
    session: Session, storage: ObjectStorage | None, piece: Piece, fields: list[str]
) -> tuple[dict[str, Any], MediaAsset | None]:
    """The body of ``/v1/complete-piece`` and the photo it carries, if any."""
    vocabularies = {
        ai_field: [{"code": t.code, "label": t.label} for t in _active_terms(session, code)]
        for ai_field, code in _VOCABULARIES.items()
        if ai_field in fields
    }
    asset = main_photo(session, piece)
    image = _image_payload(storage, asset) if asset is not None else None
    body = {
        "texts": {name: getattr(piece, name) for name in sent_text_fields()},
        "fields": fields,
        "vocabularies": vocabularies,
        "image": image,
    }
    return body, (asset if image is not None else None)


def _quote_field(texts: dict[str, Any], quote: str) -> str | None:
    for name in ("description", "notes", "denomination"):
        value = texts.get(name)
        if isinstance(value, str) and quote in value:
            return name
    return None


def verified_fields(
    session: Session, body: dict[str, Any], proposals: list[Any]
) -> tuple[list[dict[str, Any]], list[str]]:
    """``(fields, not_found)``: the provider's proposals checked again against what was sent
    (D2), each with its term id and the piece field it fills. Without evidence, no proposal."""
    requested = list(dict.fromkeys(body["fields"]))
    terms = {
        (ai_field, t.code): t
        for ai_field, code in _VOCABULARIES.items()
        if ai_field in requested
        for t in _active_terms(session, code)
    }
    fields: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in proposals:
        if not isinstance(item, dict) or item.get("field") not in requested:
            continue
        field = item["field"]
        evidence = item.get("evidence") if isinstance(item.get("evidence"), dict) else {}
        try:
            confidence = min(max(float(item.get("confidence", 0)), 0.0), 1.0)
        except (TypeError, ValueError):
            continue
        quote = evidence.get("quote") if isinstance(evidence.get("quote"), str) else None
        if evidence.get("source") == "text" and quote and quote.strip():
            where = _quote_field(body["texts"], quote.strip())
            if where is None:
                continue
            checked = {"source": "text", "quote": quote.strip(), "text_field": where}
        elif (
            evidence.get("source") == "image"
            and body.get("image") is not None
            and field in IMAGE_EVIDENCE_FIELDS
            and confidence >= IMAGE_MIN_CONFIDENCE
        ):
            checked = {"source": "image", "quote": None, "text_field": None}
        else:
            continue
        value = item.get("value")
        term_id = None
        label = value
        if field in _VOCABULARIES:
            term = terms.get((field, value)) if isinstance(value, str) else None
            if term is None:
                continue
            term_id, label = str(term.id), term.label
        elif not isinstance(value, str) or not value.strip():
            continue
        else:
            value = label = value.strip()
        key = (field, value if field == "materials" else "")
        if key in seen:
            continue
        seen.add(key)
        fields.append(
            {
                "field": field,
                "piece_field": PIECE_FIELDS[field],
                "value": value,
                "label": label,
                "term_id": term_id,
                "confidence": confidence,
                "evidence": checked,
                # Same key as RIA-01, so other screens show the quote the same way.
                "source_fragment": checked["quote"],
            }
        )
    found = {f["field"] for f in fields}
    return fields, [f for f in requested if f not in found]


def reusable_suggestion(session: Session, piece: Piece, fields: list[str]) -> AiSuggestion | None:
    """A pending proposal for this same version of the piece and the same fields: reopening the
    panel shows it again instead of calling the model again (D3)."""
    candidates = session.scalars(
        select(AiSuggestion)
        .where(
            AiSuggestion.piece_id == piece.id,
            AiSuggestion.status == SuggestionStatus.PENDING,
            AiSuggestion.function_code == AiFunction.RIA_01_EXTRACT_STRUCTURED,
        )
        .order_by(AiSuggestion.created_at.desc())
    )
    for suggestion in candidates:
        data = suggestion.input_data or {}
        if (
            data.get("kind") == COMPLETION_KIND
            and data.get("piece_version") == piece.version
            and data.get("fields") == fields
        ):
            return suggestion
    return None


def input_data(
    piece: Piece, body: dict[str, Any], asset: MediaAsset | None, prompt_version: str | None
) -> dict[str, Any]:
    """What is kept of the request: the texts that were read and a reference to the photo,
    never its bytes (no binaries in the database)."""
    return {
        "kind": COMPLETION_KIND,
        "piece_version": piece.version,
        "fields": body["fields"],
        "texts": body["texts"],
        "image_media_id": str(asset.id) if asset is not None else None,
        "image_sha256": asset.content_sha256 if asset is not None else None,
        "prompt_version": prompt_version,
    }


def is_completion(suggestion: AiSuggestion) -> bool:
    return (suggestion.input_data or {}).get("kind") == COMPLETION_KIND


def check_approval(suggestion: AiSuggestion, approved: list[dict[str, Any]]) -> None:
    """Only fields the AI actually proposed can be approved as coming from it (RN-009): a value
    the person typed for another field is a manual edit and goes through ``PUT /pieces``."""
    proposed = {f.get("field") for f in (suggestion.output_data or {}).get("fields", [])}
    for item in approved:
        if item.get("field") not in proposed:
            raise ValidationFailed(
                "Solo se aprueban datos que la IA propuso para esta pieza.",
                code="field_not_proposed",
                details={"field": item.get("field")},
            )
