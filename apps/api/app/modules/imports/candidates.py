"""Candidate pieces of a preview row, described so a person can tell them apart (change
``rediseno-ux-importacion``; spec importacion-datos, "Candidatos distinguibles").

``import_row.matches`` only stores the piece id and why it matched. When the preview is served,
each candidate gets the current denomination, collection and code I of its piece. Nothing is
written back: the data is always the current one and needs no migration. A piece deleted or
missing after the batch was validated keeps its entry with ``available: false``.
"""

import uuid
from collections.abc import Iterable, Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.imports.models import ImportRow


def _piece_ids(rows: Iterable[ImportRow]) -> set[uuid.UUID]:
    ids: set[uuid.UUID] = set()
    for row in rows:
        for match in row.matches or []:
            raw = match.get("piece_id")
            if isinstance(raw, str):
                try:
                    ids.add(uuid.UUID(raw))
                except ValueError:
                    continue
    return ids


def _describe(session: Session, piece_ids: set[uuid.UUID]) -> dict[uuid.UUID, dict[str, Any]]:
    """Denomination, collection and current code I of the pieces that still exist."""
    if not piece_ids:
        return {}
    pieces = session.execute(
        select(Piece.id, Piece.denomination, Collection.name, Collection.acronym)
        .outerjoin(Collection, Collection.id == Piece.collection_id)
        .where(Piece.id.in_(piece_ids), Piece.deleted_at.is_(None))
    )
    described: dict[uuid.UUID, dict[str, Any]] = {
        piece_id: {
            "denomination": denomination,
            "collection_name": name,
            "collection_acronym": acronym,
            "inventory_code": None,
            "available": True,
        }
        for piece_id, denomination, name, acronym in pieces
    }
    codes = session.execute(
        select(
            PieceIdentifier.piece_id,
            PieceIdentifier.normalized_value,
            PieceIdentifier.original_value,
        )
        .where(
            PieceIdentifier.piece_id.in_(described),
            PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
            PieceIdentifier.is_current,
            PieceIdentifier.deleted_at.is_(None),
        )
        .order_by(PieceIdentifier.recorded_at)
    )
    for piece_id, normalized, original in codes:
        described[piece_id]["inventory_code"] = normalized or original
    return described


def enrich_matches(
    session: Session, rows: Sequence[ImportRow]
) -> dict[uuid.UUID, list[dict[str, Any]]]:
    """``row.id`` → its ``matches`` with the description of each candidate piece."""
    described = _describe(session, _piece_ids(rows))
    enriched: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for row in rows:
        entries: list[dict[str, Any]] = []
        for match in row.matches or []:
            entry = dict(match)
            raw = match.get("piece_id")
            if isinstance(raw, str):
                try:
                    piece_id = uuid.UUID(raw)
                except ValueError:
                    piece_id = None
                if piece_id is not None:
                    entry.update(
                        described.get(
                            piece_id,
                            {
                                "denomination": None,
                                "collection_name": None,
                                "collection_acronym": None,
                                "inventory_code": None,
                                "available": False,
                            },
                        )
                    )
            entries.append(entry)
        enriched[row.id] = entries
    return enriched
