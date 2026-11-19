"""Valores del archivo que no están en las listas (change importacion-agregar-terminos, D2, D3).

A value of a vocabulary column that is not in its list («Escultura» in object types) is a warning of
its rows. In the review, whoever manages the vocabularies adds it to the list there (or reactivates
the inactive term with that name) and the batch goes back to «mapped» to be validated again: the
value then matches the new term, with no correspondence in the mapping.
"""

import re
import unicodedata
import uuid
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.modules.collections.models import Term, Vocabulary
from app.modules.collections.vocabulary_service import create_term, get_vocabulary, update_term
from app.modules.imports.location_map import EDITABLE_STATUSES
from app.modules.imports.mapping import (
    ACQUISITION_VOCABULARY,
    PIECE_VOCABULARIES,
    _fold,
)
from app.modules.imports.models import ImportBatch, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import ROW_KINDS, STATUS_LABELS, lock_batch, require_kind, transition

#: Lists a value can be added to from the review: the ones the record has a field for.
FIXABLE_VOCABULARIES = PIECE_VOCABULARIES | {ACQUISITION_VOCABULARY}


@dataclass(frozen=True)
class UnresolvedTerm:
    vocabulary: str
    vocabulary_name: str
    text: str
    rows: int
    inactive_term: str | None  # label of an inactive term with that name, to reactivate


def _vocabulary_names(session: Session, codes: set[str]) -> dict[str, str]:
    return dict(
        session.execute(
            select(Vocabulary.code, Vocabulary.name).where(
                Vocabulary.code.in_(codes), Vocabulary.deleted_at.is_(None)
            )
        ).all()
    )


def _inactive_terms(session: Session, codes: set[str]) -> dict[tuple[str, str], str]:
    """``(vocabulary, folded label) → label`` of the inactive terms of those lists."""
    return {
        (vocabulary, _fold(label)): label
        for vocabulary, label in session.execute(
            select(Vocabulary.code, Term.label)
            .join(Term, Term.vocabulary_id == Vocabulary.id)
            .where(
                Vocabulary.code.in_(codes),
                Term.deleted_at.is_(None),
                Term.is_active.is_(False),
            )
        )
    }


def unresolved_terms(session: Session, batch_id: uuid.UUID) -> list[UnresolvedTerm]:
    """Each value of the file not in its list, with how many rows write it. Spellings that differ
    only in case, accents or spaces are one value, shown with the first spelling found."""
    counts: Counter[tuple[str, str]] = Counter()
    shown: dict[tuple[str, str], str] = {}
    for mapped in session.scalars(
        select(ImportRow.mapped_data)
        .where(ImportRow.batch_id == batch_id)
        .order_by(ImportRow.source_row_number)
    ):
        for vocabulary, texts in ((mapped or {}).get("unmatched_terms") or {}).items():
            if vocabulary not in FIXABLE_VOCABULARIES:
                continue
            for text in {_fold(text): text for text in texts if text}.values():
                key = (vocabulary, _fold(text))
                shown.setdefault(key, text)
                counts[key] += 1
    if not counts:
        return []
    codes = {vocabulary for vocabulary, _key in counts}
    names = _vocabulary_names(session, codes)
    inactive = _inactive_terms(session, codes)
    items = [
        UnresolvedTerm(
            vocabulary=vocabulary,
            vocabulary_name=names.get(vocabulary, vocabulary),
            text=shown[(vocabulary, key)],
            rows=rows,
            inactive_term=inactive.get((vocabulary, key)),
        )
        for (vocabulary, key), rows in counts.items()
        if vocabulary in names
    ]
    return sorted(items, key=lambda item: (item.vocabulary_name, -item.rows, item.text))


def term_code(label: str) -> str:
    """Stable code from a label, as the administration proposes it: «Piedra de Huamanga» →
    ``PIEDRA_DE_HUAMANGA``."""
    folded = unicodedata.normalize("NFKD", label)
    plain = "".join(c for c in folded if not unicodedata.combining(c)).upper()
    code = re.sub(r"[^A-Z0-9]+", "_", plain).strip("_")
    if code[:1].isdigit():
        code = f"C_{code}"
    return code[:50] or "TERMINO"


def _free_code(session: Session, vocabulary: Vocabulary, base: str) -> str:
    taken = set(session.scalars(select(Term.code).where(Term.vocabulary_id == vocabulary.id)))
    code, suffix = base, 2
    while code in taken:
        code = f"{base}_{suffix}"
        suffix += 1
    return code


def add_term(session: Session, batch_id: uuid.UUID, *, vocabulary: str, text: str) -> ImportBatch:
    """Add «``text``» to the list (or reactivate the inactive term with that name) and leave the
    batch ready to validate again."""
    batch = lock_batch(session, batch_id)
    require_kind(batch, ROW_KINDS)
    if batch.processing_started_at is not None:
        raise ConflictError(
            "El lote se está procesando: espere a que termine.", code="batch_processing"
        )
    if batch.status not in EDITABLE_STATUSES:
        raise ConflictError(
            f"El lote está en «{STATUS_LABELS[batch.status]}»: ya no se cambia su mapeo.",
            code="batch_not_editable",
            details={"current_status": batch.status.value},
        )
    code = vocabulary.strip().upper()
    if code not in FIXABLE_VOCABULARIES:
        raise ValidationFailed(
            "Solo se agregan valores a las listas de la ficha.",
            code="vocabulary_not_fixable",
            details={"vocabulary_code": code},
        )
    label = " ".join(text.split())
    if not label:
        raise ValidationFailed("Escriba el valor que se agrega a la lista.", code="empty_term")
    target = get_vocabulary(session, code)
    existing = next(
        (
            term
            for term in session.scalars(
                select(Term).where(Term.vocabulary_id == target.id, Term.deleted_at.is_(None))
            )
            if _fold(term.label) == _fold(label) or _fold(term.code) == _fold(label)
        ),
        None,
    )
    if existing is None:
        new_code = _free_code(session, target, term_code(label))
        create_term(session, target, code=new_code, label=label)
    elif not existing.is_active:
        update_term(session, existing, {"is_active": True})
    # An active term with that name already (added meanwhile): validating again is enough.
    if batch.status == S.IN_PREVIEW:
        batch = transition(session, batch.id, S.MAPPED)
    session.flush()
    return batch
