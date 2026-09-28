"""Basic search helpers (spec busqueda-reportes; RF-031). Similarity search comes later."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.queries import code_candidates
from app.modules.catalog.schemas import CodeBrief, PieceSummary
from app.modules.identification.models import PieceIdentifier
from app.modules.search.schemas import SearchHit


def describe_matches(session: Session, text: str, summaries: list[PieceSummary]) -> list[SearchHit]:
    """Explain why each piece matched: a (current or historical) code or the title."""
    if not summaries:
        return []
    candidates = code_candidates(text)
    needle = text.strip().casefold()
    ids: list[uuid.UUID] = [summary.id for summary in summaries]
    identifiers = session.scalars(
        select(PieceIdentifier)
        .where(PieceIdentifier.piece_id.in_(ids))
        .order_by(PieceIdentifier.is_current.desc(), PieceIdentifier.recorded_at)
    )
    matched: dict[uuid.UUID, PieceIdentifier] = {}
    for identifier in identifiers:
        if identifier.piece_id in matched:
            continue
        if identifier.normalized_value in candidates or (
            needle and needle in identifier.original_value.casefold()
        ):
            matched[identifier.piece_id] = identifier
    hits: list[SearchHit] = []
    for summary in summaries:
        identifier = matched.get(summary.id)
        hits.append(
            SearchHit(
                piece=summary,
                match_type="IDENTIFIER" if identifier else "TITLE",
                matched_identifier=CodeBrief(
                    identifier_type_code=identifier.identifier_type_code,
                    original_value=identifier.original_value,
                    normalized_value=identifier.normalized_value,
                )
                if identifier
                else None,
            )
        )
    return hits
