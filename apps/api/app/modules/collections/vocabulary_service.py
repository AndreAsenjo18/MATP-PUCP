"""Controlled vocabulary rules (spec colecciones-vocabularios; RF-011, RF-012, RN-010)."""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import require_audit_context
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.models import ConservationAssessment, Piece, PieceMaterial
from app.modules.collections.models import Term, Vocabulary
from app.modules.media.models import MediaAsset


def get_vocabulary(session: Session, code: str) -> Vocabulary:
    vocabulary = session.scalar(select(Vocabulary).where(Vocabulary.code == code.upper()))
    if vocabulary is None:
        raise NotFound(f"El vocabulario '{code}' no existe.", details={"vocabulary_code": code})
    return vocabulary


def get_term(session: Session, vocabulary: Vocabulary, term_id: uuid.UUID) -> Term:
    term = session.get(Term, term_id)
    if term is None or term.deleted_at is not None or term.vocabulary_id != vocabulary.id:
        raise NotFound(
            "El término no existe en este vocabulario o fue eliminado.",
            details={"term_id": str(term_id), "vocabulary_code": vocabulary.code},
        )
    return term


def create_term(
    session: Session,
    vocabulary: Vocabulary,
    *,
    code: str,
    label: str,
    description: str | None = None,
    sort_order: int = 0,
    external_uri: str | None = None,
) -> Term:
    require_audit_context(session)
    normalized_code = code.strip().upper()
    duplicate = session.scalar(
        select(Term).where(
            Term.vocabulary_id == vocabulary.id,
            or_(Term.code == normalized_code, func.lower(Term.label) == label.strip().lower()),
        )
    )
    if duplicate is not None:
        raise ValidationFailed(
            f"Ya existe el término '{duplicate.label}' ({duplicate.code}) en {vocabulary.name}.",
            code="duplicate_term",
            details={"term_id": str(duplicate.id)},
        )
    term = Term(
        id=new_uuid(),
        vocabulary_id=vocabulary.id,
        code=normalized_code,
        label=label.strip(),
        description=description,
        sort_order=sort_order,
        external_uri=external_uri,
        is_active=True,
    )
    session.add(term)
    session.flush()
    return term


def update_term(session: Session, term: Term, changes: dict[str, object]) -> None:
    require_audit_context(session)
    if "label" in changes:
        label = changes["label"]
        if not isinstance(label, str) or not label.strip():
            raise ValidationFailed("La etiqueta del término es obligatoria.", code="label_required")
        duplicate = session.scalar(
            select(Term).where(
                Term.vocabulary_id == term.vocabulary_id,
                Term.id != term.id,
                func.lower(Term.label) == label.strip().lower(),
            )
        )
        if duplicate is not None:
            raise ValidationFailed(
                f"Ya existe otro término con la etiqueta '{duplicate.label}'.",
                code="duplicate_term",
                details={"term_id": str(duplicate.id)},
            )
        term.label = label.strip()
    for key in ("description", "sort_order", "is_active", "external_uri"):
        if key in changes and changes[key] is not None:
            setattr(term, key, changes[key])
    session.flush()


def term_usage(session: Session, term_id: uuid.UUID) -> int:
    piece_columns = (
        Piece.category_term_id,
        Piece.conservation_status_term_id,
        Piece.acquisition_method_term_id,
        Piece.object_type_term_id,
        Piece.availability_term_id,
    )
    total = (
        session.scalar(
            select(func.count())
            .select_from(Piece)
            .where(or_(*(col == term_id for col in piece_columns)))
        )
        or 0
    )
    total += (
        session.scalar(
            select(func.count()).select_from(PieceMaterial).where(PieceMaterial.term_id == term_id)
        )
        or 0
    )
    total += (
        session.scalar(
            select(func.count())
            .select_from(MediaAsset)
            .where(
                or_(
                    MediaAsset.view_type_term_id == term_id,
                    MediaAsset.usage_restriction_term_id == term_id,
                )
            )
        )
        or 0
    )
    total += (
        session.scalar(
            select(func.count())
            .select_from(ConservationAssessment)
            .where(ConservationAssessment.status_term_id == term_id)
        )
        or 0
    )
    return total


def delete_term(session: Session, term: Term, reason: str | None) -> None:
    """Logical deletion only for unused terms; used terms must be deactivated (RN-005, RF-011)."""
    require_audit_context(session)
    usage = term_usage(session, term.id)
    if usage:
        raise ConflictError(
            f"El término '{term.label}' está asignado a {usage} registros; desactívelo en lugar "
            "de eliminarlo para conservar la información existente.",
            code="term_in_use",
            details={"usage": usage},
        )
    soft_delete(session, term, reason)
