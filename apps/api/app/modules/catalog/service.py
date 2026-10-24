"""Domain rules of the piece record sheet (spec catalogo-piezas; RF-005..009, RN-003, RN-006)."""

import uuid
from contextlib import nullcontext
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, DomainError, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import refined_context, require_audit_context
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.schemas import FieldIssue
from app.modules.catalog.tenure import audit_reason, check_transition, legal_owner_for
from app.modules.identification.models import NormalizationStatus
from app.modules.identification.normalization import TYPE_INVENTORY, TYPE_OTHER, is_absence_marker
from app.modules.identification.normalization import normalize as normalize_value
from app.modules.identification.service import add_identifier, find_code_owner, get_identifier_type

EDITABLE_FIELDS = frozenset(
    {
        "description",
        "collection_id",
        "lender_name",
        "loan_agreement_ref",
        "temporary_inventory_number",
        "acquisition_method_term_id",
        "entry_date",
        "author",
        "provenance",
        "epoch_original_text",
        "epoch_type",
        "epoch_start_year",
        "epoch_end_year",
        "object_type_term_id",
        "category_id",
        "dimensions_text",
        "dimensions",
        "conservation_state_id",
        "recorded_by",
        "notes",
        "parent_piece_id",
        "availability_term_id",
        "current_location_id",
    }
)


@dataclass(frozen=True)
class _Finding:
    """Una incidencia de la validación de la ficha.

    ``issue`` es lo que ve el cliente (``field``, ``code``, ``message``, ``severity``) y ``error``
    es el error de dominio que lanzaría el guardado, con su código estable y sus detalles.
    """

    issue: FieldIssue
    error: DomainError | None = None


def validate_epoch(start_year: int | None, end_year: int | None) -> list[FieldIssue]:
    """Structured epoch must be coherent; the original text is always kept (RF-007)."""
    if start_year is not None and end_year is not None and start_year > end_year:
        return [
            FieldIssue(
                field="period.text",
                code="invalid_period_range",
                message=(
                    "La época estructurada es incoherente: el año desde es mayor que el año "
                    "hasta. El texto original se conserva."
                ),
                severity="error",
            )
        ]
    return []


def validate_dimensions(dimensions: list[Any] | None) -> list[FieldIssue]:
    """Each structured measurement needs a non-negative number; the free text is always kept."""
    issues: list[FieldIssue] = []
    for item in dimensions or []:
        value = item.get("value") if isinstance(item, dict) else None
        if not isinstance(value, int | float) or isinstance(value, bool) or value < 0:
            issues.append(
                FieldIssue(
                    field="dimensions_text",
                    code="invalid_dimension",
                    message=(
                        "Cada medida estructurada debe tener un valor numérico no negativo; "
                        "el texto original de medidas se conserva."
                    ),
                    severity="error",
                )
            )
    return issues


def validate_piece_payload(
    session: Session,
    *,
    denomination: str | None = None,
    tenure_regime: TenureRegime | None = None,
    code_i: str | None = None,
    epoch_start_year: int | None = None,
    epoch_end_year: int | None = None,
    dimensions: list[Any] | None = None,
    parent_piece_id: uuid.UUID | None = None,
    piece: Piece | None = None,
) -> list[FieldIssue]:
    """Rules of the sheet in a single source (design D1).

    The same function validates the creation (``POST /pieces``), the edition
    (``PUT /pieces/{id}``) and the validation without persistence (``POST /pieces/validate``):
    it returns the issues with their severity and writes nothing.
    """
    findings = _collect_findings(
        session,
        denomination=denomination,
        tenure_regime=tenure_regime,
        code_i=code_i,
        epoch_start_year=epoch_start_year,
        epoch_end_year=epoch_end_year,
        dimensions=dimensions,
        parent_piece_id=parent_piece_id,
        piece=piece,
    )
    return [finding.issue for finding in findings]


def _collect_findings(
    session: Session,
    *,
    denomination: str | None,
    tenure_regime: TenureRegime | None,
    code_i: str | None,
    epoch_start_year: int | None,
    epoch_end_year: int | None,
    dimensions: list[Any] | None,
    parent_piece_id: uuid.UUID | None,
    piece: Piece | None = None,
) -> list[_Finding]:
    """Collects the issues of the sheet instead of raising them (design D1)."""
    findings: list[_Finding] = []
    if not denomination or not denomination.strip():
        message = "La denominación es obligatoria."
        findings.append(
            _Finding(
                issue=FieldIssue(
                    field="denomination",
                    code="denomination_required",
                    message=message,
                    severity="error",
                ),
                error=ValidationFailed(message, code="title_required"),
            )
        )
    if tenure_regime is None:
        message = "El régimen de tenencia es obligatorio."
        findings.append(
            _Finding(
                issue=FieldIssue(
                    field="tenure_regime",
                    code="tenure_required",
                    message=message,
                    severity="error",
                ),
                error=ValidationFailed(message, code="tenure_required"),
            )
        )
    for issue in validate_epoch(epoch_start_year, epoch_end_year):
        findings.append(
            _Finding(
                issue=issue,
                error=ValidationFailed(issue.message, code="invalid_period_range"),
            )
        )
    for issue in validate_dimensions(dimensions):
        findings.append(
            _Finding(
                issue=issue,
                error=ValidationFailed(issue.message, code="invalid_dimension"),
            )
        )
    findings.extend(_inventory_code_findings(session, code_i, piece))
    if (
        parent_piece_id is not None
        and piece is not None
        and _creates_cycle(session, piece.id, parent_piece_id)
    ):
        message = "Un conjunto no puede tener como padre a uno de sus componentes."
        findings.append(
            _Finding(
                issue=FieldIssue(
                    field="parent_piece_id",
                    code="parent_cycle",
                    message=message,
                    severity="error",
                ),
                error=BusinessRuleViolation(message, code="piece_hierarchy_cycle"),
            )
        )
    return findings


def _inventory_code_findings(
    session: Session, code_i: str | None, piece: Piece | None
) -> list[_Finding]:
    """Rules of the code I of the sheet: absence marker, format and duplicate (RN-002, RN-003)."""
    if code_i is None or not code_i.strip():
        return []
    raw = code_i.strip()
    if is_absence_marker(raw):
        message = f"'{raw}' indica ausencia de código: la pieza se registra sin código I."
        return [
            _Finding(
                issue=FieldIssue(
                    field="code_i",
                    code="absence_marker",
                    message=message,
                    severity="warning",
                )
            )
        ]
    identifier_type = get_identifier_type(session, TYPE_INVENTORY)
    result = normalize_value(identifier_type.normalization_rule, raw)
    if result.status is NormalizationStatus.UNPARSEABLE or not result.normalized:
        message = f"El formato de '{raw}' no se reconoce como {identifier_type.label}."
        return [
            _Finding(
                issue=FieldIssue(
                    field="code_i",
                    code="unrecognized_format",
                    message=message,
                    severity="error",
                ),
                error=ValidationFailed(message, code="unrecognized_format"),
            )
        ]
    owner = find_code_owner(
        session,
        identifier_type,
        result.normalized,
        exclude_piece_id=piece.id if piece is not None else None,
    )
    if owner is None:
        return []
    _identifier, holder = owner
    if holder.deleted_at is not None:
        message = (
            f"El código {result.normalized} pertenece a una pieza eliminada ({holder.id}); solo un "
            "Administrador puede reasignarlo mediante el procedimiento de corrección."
        )
        return [
            _Finding(
                issue=FieldIssue(
                    field="code_i",
                    code="inventory_code_of_deleted_piece",
                    message=message,
                    severity="warning",
                )
            )
        ]
    return [
        _Finding(
            issue=FieldIssue(
                field="code_i",
                code="duplicate_inventory_code",
                message=(
                    f"El código {result.normalized} ya está asignado a otra pieza activa "
                    f"({holder.id})."
                ),
                severity="error",
            ),
            error=BusinessRuleViolation(
                f"El código {result.normalized} ya está asignado a otra pieza activa.",
                code="duplicate_identifier",
                details={"piece_id": str(holder.id)},
            ),
        )
    ]


def _raise_blocking(findings: list[_Finding]) -> None:
    """Raise the first blocking finding with the domain error the API already returns."""
    for finding in findings:
        if finding.issue.severity == "error" and finding.error is not None:
            raise finding.error


def create_piece(
    session: Session,
    *,
    denomination: str | None,
    tenure_regime: TenureRegime | None,
    legal_owner: str | None = None,
    code_i: str | None = None,
    **fields: Any,
) -> Piece:
    """Create a piece applying the minimum sheet and tenure rules."""
    require_audit_context(session)
    unknown = set(fields) - EDITABLE_FIELDS
    if unknown:
        raise ValidationFailed(f"Campos desconocidos: {', '.join(sorted(unknown))}.")
    _raise_blocking(
        _collect_findings(
            session,
            denomination=denomination,
            tenure_regime=tenure_regime,
            code_i=code_i,
            epoch_start_year=fields.get("epoch_start_year"),
            epoch_end_year=fields.get("epoch_end_year"),
            dimensions=fields.get("dimensions"),
            parent_piece_id=fields.get("parent_piece_id"),
        )
    )
    owner = legal_owner_for(tenure_regime, legal_owner)
    if fields.get("parent_piece_id") is not None:
        _ensure_exists(session, fields["parent_piece_id"])

    piece = Piece(
        id=new_uuid(), denomination=denomination.strip(), tenure_regime=tenure_regime, **fields
    )
    piece.legal_owner = owner
    session.add(piece)
    session.flush()
    return piece


def change_tenure(
    session: Session,
    piece: Piece,
    new_regime: TenureRegime,
    reason: str | None,
    supporting_document_ref: str | None = None,
) -> None:
    """Change the tenure regime following the transition table (design D4).

    The reason is only mandatory in the rows that ask for it and the supporting document only in
    the loan-for-use -> owned row; both travel in the reason of the audit entry.
    """
    require_audit_context(session)
    if new_regime is piece.tenure_regime:
        return
    transition = check_transition(
        session,
        piece,
        new_regime,
        reason=reason,
        supporting_document_ref=supporting_document_ref,
    )
    piece.tenure_regime = new_regime
    piece.legal_owner = legal_owner_for(new_regime)
    entry_reason = audit_reason(reason, supporting_document_ref)
    scope = refined_context(session, reason=entry_reason) if entry_reason else nullcontext()
    with scope:
        if transition.retires_temporary_number:
            _retire_temporary_number(session, piece)
        session.flush()  # the flush guard rejects leaving OWNED while holding a code I


def _retire_temporary_number(session: Session, piece: Piece) -> None:
    """The temporary number becomes a not current identifier (design D4)."""
    number = (piece.temporary_inventory_number or "").strip()
    if not number:
        return
    add_identifier(
        session,
        piece,
        TYPE_OTHER,
        number,
        source="Cambio de régimen de tenencia",
        is_current=False,
    )


def _ensure_exists(session: Session, piece_id: uuid.UUID) -> Piece:
    piece = session.get(Piece, piece_id)
    if piece is None:
        raise NotFound("La pieza indicada no existe o está eliminada.")
    return piece


def _creates_cycle(session: Session, piece_id: uuid.UUID, parent_id: uuid.UUID) -> bool:
    """Whether that parent would make the piece an ancestor of itself (RF-009)."""
    cursor: uuid.UUID | None = parent_id
    visited: set[uuid.UUID] = set()
    while cursor is not None and cursor not in visited:
        if cursor == piece_id:
            return True
        visited.add(cursor)
        ancestor = session.get(Piece, cursor, execution_options={INCLUDE_DELETED: True})
        cursor = ancestor.parent_piece_id if ancestor else None
    return False


def set_parent(session: Session, piece: Piece, parent_id: uuid.UUID | None) -> None:
    """Attach a piece to a set, rejecting cycles (RF-009)."""
    require_audit_context(session)
    if parent_id is not None:
        _ensure_exists(session, parent_id)
        if _creates_cycle(session, piece.id, parent_id):
            raise BusinessRuleViolation(
                "Un conjunto no puede tener como padre a uno de sus componentes.",
                code="piece_hierarchy_cycle",
            )
    piece.parent_piece_id = parent_id
    session.flush()


def update_piece(
    session: Session, piece: Piece, *, code_i: str | None = None, **changes: Any
) -> Piece:
    """Generic sheet update. Audit entries are generated automatically, only for real changes."""
    require_audit_context(session)
    unknown = set(changes) - EDITABLE_FIELDS - {"denomination"}
    if unknown:
        raise ValidationFailed(f"Campos no editables: {', '.join(sorted(unknown))}.")
    _raise_blocking(
        _collect_findings(
            session,
            denomination=changes.get("denomination", piece.denomination),
            tenure_regime=piece.tenure_regime,
            code_i=code_i,
            epoch_start_year=changes.get("epoch_start_year", piece.epoch_start_year),
            epoch_end_year=changes.get("epoch_end_year", piece.epoch_end_year),
            dimensions=changes.get("dimensions") if "dimensions" in changes else None,
            parent_piece_id=changes.get("parent_piece_id", piece.parent_piece_id),
            piece=piece,
        )
    )
    if "parent_piece_id" in changes:
        set_parent(session, piece, changes.pop("parent_piece_id"))
    for key, value in changes.items():
        setattr(piece, key, value)
    session.flush()
    return piece
