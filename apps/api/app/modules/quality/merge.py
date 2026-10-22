"""Merge of two duplicate pieces into one (spec calidad-datos; RF-030, RN-002, RN-003, RN-005).

Change deteccion-duplicados-y-cola-revision, task 3.3 (design D4). Everything happens in the
caller's transaction and in a single audit change set with the ``MERGE`` action, so
``auditoria-y-soft-delete-transversal`` can revert it as one operation. Nothing is deleted:

- the chosen sheet values are written on the surviving piece with the catalogue service;
- identifiers, photos, components, materials, loans and AI suggestions move to the surviving
  piece; an identifier that repeats a normalized value of the surviving piece stays as not
  current, and no inventory code (I) ever changes piece (RN-002);
- movements, source records and conservation assessments are append-only: they stay on the
  absorbed piece, unchanged, and are reached through ``merged_into``;
- the absorbed piece is linked with ``merged_into_id`` and logically deleted with the reason.
"""

import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.modules.ai_suggestions.models import AiSuggestion
from app.modules.audit.context import refined_context
from app.modules.audit.models import AuditAction
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.service import EDITABLE_FIELDS, update_piece
from app.modules.identification.models import INVENTORY_CODE_TYPE, PieceIdentifier
from app.modules.locations.models import LoanItem
from app.modules.media.models import MediaAsset
from app.modules.quality.models import DuplicateCandidate, DuplicateStatus

#: Sheet fields whose value can be chosen; components and location are handled apart.
MERGEABLE_FIELDS = frozenset(
    (EDITABLE_FIELDS | {"denomination"}) - {"parent_piece_id", "current_location_id"}
)
SURVIVING, ABSORBED = "SURVIVING", "ABSORBED"
_CLOSED = {DuplicateStatus.MERGED, DuplicateStatus.SUPERSEDED}


def _is_empty(value: Any) -> bool:
    return value is None or value == [] or (isinstance(value, str) and not value.strip())


def _current_inventory_codes(session: Session, piece_id: uuid.UUID) -> set[str]:
    return set(
        session.scalars(
            select(PieceIdentifier.normalized_value).where(
                PieceIdentifier.piece_id == piece_id,
                PieceIdentifier.identifier_type_code == INVENTORY_CODE_TYPE,
                PieceIdentifier.is_current.is_(True),
                PieceIdentifier.normalized_value.is_not(None),
            )
        )
    )


def _validate(
    session: Session,
    candidate: DuplicateCandidate,
    surviving_id: uuid.UUID | None,
    note: str | None,
    field_choices: dict[str, str],
) -> tuple[Piece, Piece]:
    if candidate.piece_b_id is None:
        raise ValidationFailed(
            "Solo se fusionan dos piezas del catálogo; una fila de importación se resuelve en el "
            "lote.",
            code="merge_requires_two_pieces",
        )
    pair = (candidate.piece_a_id, candidate.piece_b_id)
    if surviving_id not in pair:
        raise ValidationFailed(
            "Indique cuál de las dos piezas del par se conserva.",
            code="surviving_not_in_pair",
            details={"piece_ids": [str(piece_id) for piece_id in pair]},
        )
    if not note or len(note.strip()) < 3:
        raise ValidationFailed("Indique el motivo de la fusión.", code="merge_reason_required")
    unknown = sorted(set(field_choices) - MERGEABLE_FIELDS)
    if unknown:
        raise ValidationFailed(
            f"No se puede elegir el valor de: {', '.join(unknown)}.",
            code="unknown_merge_fields",
            details={"allowed": sorted(MERGEABLE_FIELDS)},
        )
    absorbed_id = pair[1] if surviving_id == pair[0] else pair[0]
    surviving, absorbed = session.get(Piece, surviving_id), session.get(Piece, absorbed_id)
    if surviving is None or absorbed is None:  # checked before by resolve_candidate
        raise ConflictError("Una de las piezas ya no está activa.", code="stale_candidate")
    if surviving.tenure_regime != absorbed.tenure_regime:
        raise ConflictError(
            "Las piezas tienen regímenes de tenencia distintos: primero corrija el régimen de una "
            "de ellas.",
            code="merge_blocked_tenure",
            details={
                "surviving": surviving.tenure_regime.value,
                "absorbed": absorbed.tenure_regime.value,
            },
        )
    codes_surviving = _current_inventory_codes(session, surviving.id)
    codes_absorbed = _current_inventory_codes(session, absorbed.id)
    if codes_surviving and codes_absorbed and codes_surviving != codes_absorbed:
        raise ConflictError(
            "Las dos piezas tienen códigos I vigentes distintos; corrija primero el código I "
            "(RN-002).",
            code="merge_blocked_inventory_code",
            details={"surviving": sorted(codes_surviving), "absorbed": sorted(codes_absorbed)},
        )
    if codes_absorbed and not codes_surviving:
        raise ConflictError(
            "Solo la pieza absorbida tiene código I vigente: debe conservarse esa pieza, porque un "
            "código I nunca cambia de pieza (RN-002).",
            code="merge_surviving_must_hold_inventory_code",
            details={"piece_with_inventory_code": str(absorbed.id)},
        )
    return surviving, absorbed


def _merge_sheet(
    session: Session, surviving: Piece, absorbed: Piece, field_choices: dict[str, str]
) -> None:
    changes: dict[str, Any] = {}
    for name in sorted(MERGEABLE_FIELDS):
        mine, theirs = getattr(surviving, name), getattr(absorbed, name)
        choice = field_choices.get(name)
        take_theirs = choice == ABSORBED or (choice is None and _is_empty(mine))
        if take_theirs and not _is_empty(theirs) and mine != theirs:
            changes[name] = theirs
    if changes:
        update_piece(session, surviving, **changes)


def _move_identifiers(session: Session, surviving: Piece, absorbed: Piece) -> None:
    existing = {
        (identifier.identifier_type_code, identifier.normalized_value)
        for identifier in session.scalars(
            select(PieceIdentifier).where(PieceIdentifier.piece_id == surviving.id)
        )
        if identifier.normalized_value
    }
    for identifier in session.scalars(
        select(PieceIdentifier).where(PieceIdentifier.piece_id == absorbed.id)
    ):
        if identifier.identifier_type_code == INVENTORY_CODE_TYPE or identifier.is_locked:
            continue  # a code I never changes piece (RN-002): reached through merged_into
        key = (identifier.identifier_type_code, identifier.normalized_value)
        if identifier.normalized_value and key in existing:
            identifier.is_current = False
            note = f"Fusión: repetido en la pieza {surviving.id}."
            identifier.notes = f"{identifier.notes} {note}" if identifier.notes else note
        identifier.piece_id = surviving.id


def _move_photos(session: Session, surviving: Piece, absorbed: Piece) -> None:
    has_primary = bool(
        session.scalar(
            select(func.count())
            .select_from(MediaAsset)
            .where(MediaAsset.piece_id == surviving.id, MediaAsset.is_primary.is_(True))
        )
    )
    last = session.scalar(
        select(func.max(MediaAsset.sort_order)).where(MediaAsset.piece_id == surviving.id)
    )
    next_order = (last if last is not None else -1) + 1
    photos = session.scalars(
        select(MediaAsset)
        .where(MediaAsset.piece_id == absorbed.id)
        .order_by(MediaAsset.sort_order, MediaAsset.created_at)
    ).all()
    for photo in photos:
        photo.piece_id = surviving.id
        photo.sort_order = next_order
        next_order += 1
        if photo.is_primary and has_primary:
            photo.is_primary = False  # the surviving piece keeps its cover photo


def _move_components(session: Session, surviving: Piece, absorbed: Piece) -> None:
    for child in session.scalars(select(Piece).where(Piece.parent_piece_id == absorbed.id)):
        if child.id == surviving.id:  # the surviving piece was a component of the absorbed one
            child.parent_piece_id = absorbed.parent_piece_id
        else:
            child.parent_piece_id = surviving.id


def _move_materials_and_loans(session: Session, surviving: Piece, absorbed: Piece) -> None:
    terms = set(
        session.scalars(select(PieceMaterial.term_id).where(PieceMaterial.piece_id == surviving.id))
    )
    for material in session.scalars(
        select(PieceMaterial).where(PieceMaterial.piece_id == absorbed.id)
    ):
        if material.term_id not in terms:  # repeated materials stay on the absorbed piece
            material.piece_id = surviving.id
    loans = set(session.scalars(select(LoanItem.loan_id).where(LoanItem.piece_id == surviving.id)))
    for item in session.scalars(select(LoanItem).where(LoanItem.piece_id == absorbed.id)):
        if item.loan_id not in loans:  # one row per piece and loan
            item.piece_id = surviving.id
    for suggestion in session.scalars(
        select(AiSuggestion).where(AiSuggestion.piece_id == absorbed.id)
    ):
        suggestion.piece_id = surviving.id


def merge_pieces(
    session: Session,
    candidate: DuplicateCandidate,
    *,
    surviving_id: uuid.UUID | None,
    reviewer_id: uuid.UUID,
    note: str | None,
    field_choices: dict[str, str] | None = None,
) -> Piece:
    """Merge the absorbed piece of ``candidate`` into the surviving one (design D4).

    Requires a manual audit context; every write shares one change set stored in the candidate.
    """
    choices = field_choices or {}
    surviving, absorbed = _validate(session, candidate, surviving_id, note, choices)
    change_set_id = new_uuid()
    reason = (note or "").strip()
    with refined_context(
        session, change_set_id=change_set_id, action=AuditAction.MERGE, reason=reason
    ):
        _merge_sheet(session, surviving, absorbed, choices)
        _move_identifiers(session, surviving, absorbed)
        _move_photos(session, surviving, absorbed)
        _move_components(session, surviving, absorbed)
        _move_materials_and_loans(session, surviving, absorbed)
        absorbed.merged_into_id = surviving.id
        soft_delete(session, absorbed, f"Fusionada en {surviving.id}: {reason}")

        now = utcnow()
        candidate.status = DuplicateStatus.MERGED
        candidate.reviewed_by_id = reviewer_id
        candidate.reviewed_at = now
        candidate.resolution_note = reason
        candidate.change_set_id = change_set_id
        for other in session.scalars(
            select(DuplicateCandidate).where(
                DuplicateCandidate.id != candidate.id,
                or_(
                    DuplicateCandidate.piece_a_id == absorbed.id,
                    DuplicateCandidate.piece_b_id == absorbed.id,
                ),
            )
        ):
            if other.status not in _CLOSED:
                other.status = DuplicateStatus.SUPERSEDED
                other.reviewed_by_id = reviewer_id
                other.reviewed_at = now
        session.flush()
    return surviving
