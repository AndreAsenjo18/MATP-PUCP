"""Tabla de transiciones del régimen de tenencia (design D4; RF-005, RN-003, RN-004, RN-006).

La tabla es la única fuente de las reglas: ``catalog.service.change_tenure()`` delega en
:func:`check_transition` y la guarda de ``identification.service`` consulta las mismas filas, de
modo que ninguna ruta (API, importación, semilla, scripts) pueda esquivarlas.

Las transiciones son ``[SUPUESTO]`` pendientes de validar con el museo (pregunta B3 de
``docs/preguntas-contraparte.md``); cada fila declara la regla que aplica y el código de error
estable que ve el cliente.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from app.modules.catalog.models import Piece
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.normalization import TYPE_COLLECTION, TYPE_INVENTORY


@dataclass(frozen=True)
class TenureTransition:
    """Una fila de la tabla de transiciones (design D4).

    ``from_regime`` a ``None`` significa "desde cualquier régimen" (la fila ``* -> préstamo
    temporal``). ``forbidden_identifier_types`` son los tipos de identificador vigente que
    impiden el cambio; ``retires_temporary_number`` marca las filas en las que el número
    temporal de la pieza queda como identificador no vigente.
    """

    to_regime: TenureRegime
    from_regime: TenureRegime | None = None
    requires_reason: bool = False
    requires_supporting_document: bool = False
    forbidden_identifier_types: frozenset[str] = frozenset()
    retires_temporary_number: bool = False
    rule: str = ""


#: Filas de la tabla de transiciones, en el orden en que se evalúan (las filas concretas antes
#: que la fila ``*``).
TENURE_TRANSITIONS: tuple[TenureTransition, ...] = (
    TenureTransition(
        from_regime=TenureRegime.OWNED,
        to_regime=TenureRegime.LOAN_FOR_USE,
        forbidden_identifier_types=frozenset({TYPE_INVENTORY}),
        rule="Propiedad -> comodato: rechazada si tiene código I vigente (RN-003).",
    ),
    TenureTransition(
        from_regime=TenureRegime.LOAN_FOR_USE,
        to_regime=TenureRegime.OWNED,
        requires_reason=True,
        requires_supporting_document=True,
        rule="Comodato -> propiedad: exige motivo y referencia del documento de respaldo.",
    ),
    TenureTransition(
        from_regime=TenureRegime.TEMPORARY_LOAN,
        to_regime=TenureRegime.OWNED,
        requires_reason=True,
        retires_temporary_number=True,
        rule=(
            "Préstamo temporal -> propiedad: exige motivo; el número temporal queda como "
            "identificador no vigente."
        ),
    ),
    TenureTransition(
        from_regime=TenureRegime.TEMPORARY_LOAN,
        to_regime=TenureRegime.LOAN_FOR_USE,
        requires_reason=True,
        retires_temporary_number=True,
        rule=(
            "Préstamo temporal -> comodato: exige motivo; el número temporal queda como "
            "identificador no vigente."
        ),
    ),
    TenureTransition(
        from_regime=None,
        to_regime=TenureRegime.TEMPORARY_LOAN,
        forbidden_identifier_types=frozenset({TYPE_INVENTORY, TYPE_COLLECTION}),
        rule=(
            "* -> préstamo temporal: rechazada si tiene código I o código de colección vigente "
            "(RN-004)."
        ),
    ),
)


def find_transition(from_regime: TenureRegime, to_regime: TenureRegime) -> TenureTransition | None:
    """La fila de la tabla para ese cambio de régimen (``None`` si no hay ninguna)."""
    for transition in TENURE_TRANSITIONS:
        if transition.to_regime is not to_regime:
            continue
        if transition.from_regime is None or transition.from_regime is from_regime:
            return transition
    return None


def legal_owner_for(tenure_regime: TenureRegime, legal_owner: str | None = None) -> str | None:
    """La PUCP es la única propietaria legal de las piezas en propiedad (RN-006).

    En los demás regímenes no hay propietaria legal: la pieza está en custodia o prestada.
    """
    if tenure_regime is not TenureRegime.OWNED:
        return None
    if legal_owner and legal_owner.strip() != LEGAL_OWNER_PUCP:
        raise BusinessRuleViolation(
            "La PUCP es la única propietaria legal de las piezas en propiedad (RN-006).",
            code="invalid_legal_owner",
        )
    return LEGAL_OWNER_PUCP


def ensure_no_forbidden_identifiers(
    session: Session, piece: Piece, transition: TenureTransition
) -> None:
    """Rechaza el cambio si la pieza tiene un identificador vigente que la fila prohíbe."""
    if not transition.forbidden_identifier_types:
        return
    found = session.scalars(
        select(PieceIdentifier.identifier_type_code).where(
            PieceIdentifier.piece_id == piece.id,
            PieceIdentifier.is_current,
            PieceIdentifier.deleted_at.is_(None),
            PieceIdentifier.identifier_type_code.in_(transition.forbidden_identifier_types),
        )
    ).first()
    if found is None:
        return
    if found == TYPE_INVENTORY:
        raise BusinessRuleViolation(
            "La pieza tiene código I vigente y no puede pasar a comodato ni a préstamo "
            "temporal (RN-003, RN-004).",
            code="tenure_change_with_inventory_code",
        )
    raise BusinessRuleViolation(
        "La pieza tiene un código de colección vigente y no puede pasar a préstamo temporal "
        "(RN-004).",
        code="tenure_change_with_restricted_code",
    )


def check_transition(
    session: Session,
    piece: Piece,
    new_regime: TenureRegime,
    *,
    reason: str | None = None,
    supporting_document_ref: str | None = None,
) -> TenureTransition:
    """Comprueba el cambio de régimen contra la tabla y lanza el error que corresponda.

    El motivo solo es obligatorio en las filas que lo piden; el documento de respaldo solo en la
    fila comodato -> propiedad. El documento no se guarda en ninguna columna: viaja en el motivo
    de la auditoría (design D4).
    """
    transition = find_transition(piece.tenure_regime, new_regime)
    if transition is None:
        raise BusinessRuleViolation(
            f"No se permite pasar de {piece.tenure_regime} a {new_regime}.",
            code="invalid_tenure_transition",
        )
    ensure_no_forbidden_identifiers(session, piece, transition)
    if transition.requires_reason and not (reason and reason.strip()):
        raise ValidationFailed(
            "El cambio de régimen de tenencia exige motivo.", code="reason_required"
        )
    if transition.requires_supporting_document and not (
        supporting_document_ref and supporting_document_ref.strip()
    ):
        raise ValidationFailed(
            "El cambio a propiedad exige la referencia del documento de respaldo.",
            code="supporting_document_required",
        )
    return transition


def audit_reason(reason: str | None, supporting_document_ref: str | None = None) -> str | None:
    """El motivo con el que queda registrada la transición en la auditoría.

    El documento de respaldo no tiene columna propia: viaja dentro del motivo para que ambos
    datos queden en la misma entrada de ``audit_log`` (design D4).
    """
    parts: list[str] = []
    if reason and reason.strip():
        parts.append(reason.strip())
    if supporting_document_ref and supporting_document_ref.strip():
        parts.append(f"documento: {supporting_document_ref.strip()}")
    return " | ".join(parts) or None
