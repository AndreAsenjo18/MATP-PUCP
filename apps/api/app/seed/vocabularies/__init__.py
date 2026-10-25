"""Idempotent preload of vocabulary terms from a versioned CSV file (RF-011, RN-010, RN-005).

Change colecciones-y-vocabularios-admin, task 4.1 (design D4). Columns: ``vocabulary_code,
term_code, label, description, sort_order, external_uri, is_active`` (the first three are
required; lines starting with ``#`` are comments). The report mode (default) writes nothing.
Applying inserts the new terms and updates the label, description, order and URI of the
existing ones, audited with origin "sistema" and the file name and hash as reference. Terms
absent from the file are never deactivated nor deleted: the report lists them. An empty cell
never erases a stored value.
"""

import csv
import hashlib
import io
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.collections import vocabulary_service
from app.modules.collections.models import Term, Vocabulary

EXPECTED_COLUMNS = (
    "vocabulary_code",
    "term_code",
    "label",
    "description",
    "sort_order",
    "external_uri",
    "is_active",
)
REQUIRED_COLUMNS = ("vocabulary_code", "term_code", "label")
UPDATABLE_FIELDS = ("label", "description", "sort_order", "external_uri")
ACTOR = "precarga de vocabularios"
_TRUE = {"1", "true", "si", "sí", "s", "yes", "y", "verdadero"}
_FALSE = {"0", "false", "no", "n", "falso"}


class VocabularyFileError(ValueError):
    """The file cannot be loaded; nothing was written."""


@dataclass(frozen=True)
class TermRow:
    line: int
    vocabulary_code: str
    term_code: str
    label: str
    description: str | None
    sort_order: int | None
    external_uri: str | None
    is_active: bool


@dataclass
class LoadReport:
    applied: bool
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: int = 0
    absent: list[str] = field(default_factory=list)

    def summary(self) -> str:
        mode = "Aplicado" if self.applied else "Modo informe (no se escribió nada)"
        lines = [
            f"{mode}: {len(self.created)} términos nuevos, {len(self.updated)} actualizados, "
            f"{self.unchanged} sin cambios.",
        ]
        lines += [f"  + {item}" for item in self.created]
        lines += [f"  ~ {item}" for item in self.updated]
        if self.absent:
            lines.append(
                f"{len(self.absent)} términos existentes no están en el archivo y se conservan "
                "activos:"
            )
            lines += [f"  = {item}" for item in self.absent]
        return "\n".join(lines)


def _cell(record: dict[str, Any], name: str) -> str | None:
    value = record.get(name)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _flag(value: str | None, line: int) -> bool:
    if value is None:
        return True
    folded = value.strip().lower()
    if folded in _TRUE:
        return True
    if folded in _FALSE:
        return False
    raise VocabularyFileError(f"Línea {line}: «{value}» no es un valor válido de is_active.")


def parse_terms(text: str) -> list[TermRow]:
    """Rows of the file; rejects it when a required column is missing."""
    lines = [line for line in text.splitlines() if not line.lstrip().startswith("#")]
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    columns = [name.strip() for name in (reader.fieldnames or [])]
    missing = [name for name in REQUIRED_COLUMNS if name not in columns]
    if missing:
        raise VocabularyFileError(
            f"Faltan las columnas {', '.join(missing)}. Columnas esperadas: "
            f"{', '.join(EXPECTED_COLUMNS)}."
        )
    rows: list[TermRow] = []
    for number, raw in enumerate(reader, start=2):
        record = {(key or "").strip(): value for key, value in raw.items()}
        vocabulary_code, term_code, label = (_cell(record, name) for name in REQUIRED_COLUMNS)
        if not (vocabulary_code and term_code and label):
            raise VocabularyFileError(
                f"Línea {number}: vocabulary_code, term_code y label son obligatorios."
            )
        order = _cell(record, "sort_order")
        try:
            sort_order = int(order) if order is not None else None
        except ValueError as exc:
            raise VocabularyFileError(f"Línea {number}: sort_order debe ser un número.") from exc
        rows.append(
            TermRow(
                line=number,
                vocabulary_code=vocabulary_code.upper(),
                term_code=term_code.upper(),
                label=label,
                description=_cell(record, "description"),
                sort_order=sort_order,
                external_uri=_cell(record, "external_uri"),
                is_active=_flag(_cell(record, "is_active"), number),
            )
        )
    return rows


def _vocabularies(session: Session, rows: list[TermRow]) -> dict[str, Vocabulary]:
    codes = sorted({row.vocabulary_code for row in rows})
    found = {
        vocabulary.code: vocabulary
        for vocabulary in session.scalars(select(Vocabulary).where(Vocabulary.code.in_(codes)))
    }
    unknown = [code for code in codes if code not in found]
    if unknown:
        raise VocabularyFileError(
            f"Los vocabularios {', '.join(unknown)} no existen: créelos antes de cargar sus "
            "términos."
        )
    return found


def _changes(term: Term, row: TermRow) -> dict[str, Any]:
    incoming = {
        "label": row.label,
        "description": row.description,
        "sort_order": row.sort_order,
        "external_uri": row.external_uri,
    }
    return {
        name: value
        for name, value in incoming.items()
        if value is not None and getattr(term, name) != value
    }


def load_terms(session: Session, rows: list[TermRow], *, apply: bool, source: str) -> LoadReport:
    """Compare ``rows`` with the stored terms and, with ``apply``, write the differences.

    ``source`` (file name and hash) becomes the ``origin_ref`` of the audit entries. The caller
    owns the transaction.
    """
    vocabularies = _vocabularies(session, rows)
    stored: dict[tuple[str, str], Term] = {}
    for code, vocabulary in vocabularies.items():
        for term in session.scalars(select(Term).where(Term.vocabulary_id == vocabulary.id)):
            stored[(code, term.code)] = term
    report = LoadReport(applied=apply)
    seen = {(row.vocabulary_code, row.term_code) for row in rows}
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=ACTOR, origin_ref=source[:100])
    with audit_context(session, context):
        for row in rows:
            key = (row.vocabulary_code, row.term_code)
            name = f"{row.vocabulary_code}/{row.term_code} «{row.label}»"
            term = stored.get(key)
            if term is None:
                report.created.append(name)
                if apply:
                    created = vocabulary_service.create_term(
                        session,
                        vocabularies[row.vocabulary_code],
                        code=row.term_code,
                        label=row.label,
                        description=row.description,
                        sort_order=row.sort_order or 0,
                        external_uri=row.external_uri,
                    )
                    created.is_active = row.is_active
                    stored[key] = created
                continue
            changes = _changes(term, row)
            if not changes:
                report.unchanged += 1
                continue
            report.updated.append(f"{name}: {', '.join(sorted(changes))}")
            if apply:
                for attribute, value in changes.items():
                    setattr(term, attribute, value)
        if apply:
            session.flush()
    report.absent = sorted(
        f"{code}/{term.code} «{term.label}»"
        for (code, _term_code), term in stored.items()
        if (code, term.code) not in seen and term.deleted_at is None and term.is_active
    )
    return report


def file_reference(name: str, content: bytes) -> str:
    return f"{name}:{hashlib.sha256(content).hexdigest()[:16]}"
