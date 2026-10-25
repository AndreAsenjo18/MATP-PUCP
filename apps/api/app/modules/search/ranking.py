"""Search ranking and relevance engine (RF-031, RF-023, design D2).

Ranks search hits by:
1. Exact match on current identifier (weight 1.0)
2. Exact match on historical identifier (weight 0.9)
3. Text matches across denomination, author, provenance, epoch and vocabulary terms.
Provides match_reason and zero-result suggestions.
"""

from __future__ import annotations

import unicodedata
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import code_candidates
from app.modules.catalog.schemas import CodeBrief, PieceSummary
from app.modules.collections.models import Term
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.params import session_params
from app.modules.search.filters import ActiveFilter, PieceFilter
from app.modules.search.schemas import SearchHit


def strip_accents(val: str | None) -> str:
    """Normalize and strip accents/diacritics for insensitive comparison."""
    if not val:
        return ""
    nfkd = unicodedata.normalize("NFKD", val)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).casefold().strip()


def compute_match_reason(
    session: Session,
    piece: Piece,
    text: str,
) -> tuple[float, dict[str, Any], PieceIdentifier | None]:
    """Compute relevance score and match_reason for a piece and search query.

    Returns (score, match_reason_dict, matched_identifier).
    """
    clean_query = strip_accents(text)
    if not clean_query:
        return 1.0, {"kind": "text", "fields": ["denomination"]}, None

    params = session_params(session)  # read once per session (design D5 of plantillas-mapeo)
    candidates = {strip_accents(c) for c in code_candidates(text, params=params) if c}

    # 1. Check identifiers
    identifiers = session.scalars(
        select(PieceIdentifier)
        .where(
            PieceIdentifier.piece_id == piece.id,
            PieceIdentifier.deleted_at.is_(None),
        )
        .order_by(PieceIdentifier.is_current.desc(), PieceIdentifier.recorded_at.desc())
    ).all()

    for ident in identifiers:
        norm_clean = strip_accents(ident.normalized_value)
        orig_clean = strip_accents(ident.original_value)

        # Exact match of code candidates or original value
        if (norm_clean and norm_clean in candidates) or (orig_clean and orig_clean == clean_query):
            score = 100.0 if ident.is_current else 90.0
            match_reason = {
                "kind": "identifier",
                "type": ident.identifier_type_code,
                "original": ident.original_value,
                "historical": not ident.is_current,
            }
            return score, match_reason, ident

        # Substring / partial match on code
        if (norm_clean and clean_query in norm_clean) or (orig_clean and clean_query in orig_clean):
            score = 80.0 if ident.is_current else 75.0
            match_reason = {
                "kind": "identifier",
                "type": ident.identifier_type_code,
                "original": ident.original_value,
                "historical": not ident.is_current,
            }
            return score, match_reason, ident

    # 2. Check text fields
    terms = [t for t in clean_query.split() if t]
    matched_fields: list[str] = []

    denomination_clean = strip_accents(piece.denomination)
    author_clean = strip_accents(piece.author)
    provenance_clean = strip_accents(piece.provenance)
    epoch_clean = strip_accents(piece.epoch_original_text)

    # Check terms against Piece direct fields
    if any(t in denomination_clean for t in terms):
        matched_fields.append("denomination")
    if author_clean and any(t in author_clean for t in terms):
        matched_fields.append("author")
    if provenance_clean and any(t in provenance_clean for t in terms):
        matched_fields.append("provenance")
    if epoch_clean and any(t in epoch_clean for t in terms):
        matched_fields.append("epoch")

    # Check vocabulary terms (category, conservation state, materials)
    if piece.category_id:
        category = session.get(Term, piece.category_id)
        if category and any(t in strip_accents(category.label) for t in terms):
            matched_fields.append("category")

    if piece.conservation_state_id:
        state = session.get(Term, piece.conservation_state_id)
        if state and any(t in strip_accents(state.label) for t in terms):
            matched_fields.append("conservation_state")

    materials = session.scalars(
        select(Term)
        .join(PieceMaterial, PieceMaterial.term_id == Term.id)
        .where(
            PieceMaterial.piece_id == piece.id,
            PieceMaterial.deleted_at.is_(None),
        )
    ).all()
    for mat in materials:
        if any(t in strip_accents(mat.label) for t in terms):
            matched_fields.append("material")
            break

    if not matched_fields:
        matched_fields.append("denomination")

    # Scoring text match: denomination match gets higher score
    score = 50.0 + len(matched_fields) * 5.0
    if "denomination" in matched_fields:
        score += 15.0

    match_reason = {
        "kind": "text",
        "fields": matched_fields,
    }
    return score, match_reason, None


def rank_and_describe_pieces(
    session: Session,
    pieces: list[Piece],
    summaries: list[PieceSummary],
    query_text: str,
) -> list[SearchHit]:
    """Rank pieces by relevance score and construct SearchHit with match_reason."""
    if not pieces or not summaries:
        return []

    summaries_by_id = {s.id: s for s in summaries}
    ranked_items: list[tuple[float, str, SearchHit]] = []

    for piece in pieces:
        summary = summaries_by_id.get(piece.id)
        if not summary:
            continue
        score, match_reason, matched_ident = compute_match_reason(session, piece, query_text)

        hit = SearchHit(
            piece=summary,
            match_type="IDENTIFIER" if matched_ident else "TITLE",
            matched_identifier=CodeBrief(
                identifier_type_code=matched_ident.identifier_type_code,
                original_value=matched_ident.original_value,
                normalized_value=matched_ident.normalized_value,
            )
            if matched_ident
            else None,
            match_reason=match_reason,
        )
        ranked_items.append((score, piece.denomination.casefold(), hit))

    # Sort descending by score, then ascending by denomination
    ranked_items.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in ranked_items]


def generate_search_suggestions(
    piece_filter: PieceFilter | None,
    q: str | None,
    total: int,
) -> tuple[list[str], list[ActiveFilter]]:
    """Produce actionable suggestions and active filters list when 0 hits occur (RF-031)."""
    if total > 0 or piece_filter is None:
        return [], []

    active_filters = piece_filter.describe()
    suggestions: list[str] = []

    # 1. Suggest removing active filters (other than search query itself)
    for active in active_filters:
        if active.key != "q":
            suggestions.append(f"remove_filter:{active.key}")

    # 2. Check query format issues
    if q and q.strip():
        q_clean = q.strip()
        if any(c in q_clean for c in ".-/_ "):
            suggestions.append("check_code_format")
        suggestions.append("search_historical")

    return suggestions, active_filters
