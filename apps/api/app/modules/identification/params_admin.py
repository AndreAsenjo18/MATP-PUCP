"""Administration of the normalization parameters and acronym aliases (spec identificacion-piezas:
RN-010, RF-023; change plantillas-mapeo-y-normalizacion, task 2.3, design D5).

Every write is audited by the usual hooks (the API attaches the manual context) and deletion is
logical with a reason (RN-005). A change that would alter identifiers already stored is
rejected with ``409 normalization_change_requires_preview``: the flow of preview, confirmation
and recalculation belongs to ``colecciones-y-vocabularios-admin`` (tasks 2.3 and 2.4 there) and
does not exist yet, so nothing is recalculated here [SUPUESTO T10]. An identifier is affected
when, with the new values instead of the current ones:

- its stored text normalizes differently (value, status or absence): a marker added or
  removed, an alias added or deleted;
- its stored text would be split differently: a separator added, an unsplit marker removed;
- it came from an import cell that was split on a separator that would stop splitting it: the
  cell is read from the import row recorded in ``piece_source_record``.

After a change is saved, ``session_params`` reloads (a flush that writes a parameter drops it).
"""

import dataclasses
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.modules.audit.context import require_audit_context
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    TENURE_ALIASES_KEY,
    CollectionAcronymAlias,
    IdentifierType,
    NormalizationRule,
    NormalizationSetting,
    PieceIdentifier,
)
from app.modules.identification.normalization import (
    DEFAULT_PARAMS,
    DEFAULT_RULES,
    NormalizationParams,
    fold_label,
    normalize,
    normalize_acronym,
    split_compound,
)
from app.modules.identification.params import load_params, params_from_rows

SETTING_KEYS = (ABSENCE_MARKERS_KEY, CONCATENATION_SEPARATORS_KEY, TENURE_ALIASES_KEY)
# Regime codes by contract label or code, folded (``tenure_aliases`` values).
_REGIMES = {
    **{fold_label(regime.value): regime.value for regime in TenureRegime},
    **{fold_label(label): regime.value for regime, label in TENURE_REGIME_LABELS.items()},
}
IMPACT_EXAMPLES = 5
PREVIEW_CHANGE = "colecciones-y-vocabularios-admin"


# --- valores ------------------------------------------------------------------------------------


def default_value(key: str) -> Any:
    """The value of the code for a key, in the stored form."""
    if key == ABSENCE_MARKERS_KEY:
        return sorted(DEFAULT_PARAMS.absence_markers)
    if key == TENURE_ALIASES_KEY:
        return dict(DEFAULT_PARAMS.tenure_aliases)
    return {
        "separators": list(DEFAULT_PARAMS.separators),
        "unsplit_markers": list(DEFAULT_PARAMS.unsplit_markers),
    }


def _check_key(key: str) -> None:
    if key not in SETTING_KEYS:
        raise NotFound(
            f"No existe el parámetro de normalización «{key}».",
            code="normalization_setting_not_found",
            details={"keys": list(SETTING_KEYS)},
        )


def get_setting(session: Session, key: str) -> NormalizationSetting | None:
    _check_key(key)
    return session.scalar(
        select(NormalizationSetting).where(
            NormalizationSetting.key == key, NormalizationSetting.deleted_at.is_(None)
        )
    )


def _invalid(message: str) -> ValidationFailed:
    return ValidationFailed(message, code="invalid_setting_value")


def clean_value(key: str, value: Any) -> Any:
    """The value to store, validated for its key (422 otherwise)."""
    _check_key(key)
    if key == ABSENCE_MARKERS_KEY:
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise _invalid("Los marcadores de ausencia son una lista de textos.")
        markers = [item.strip() for item in value]
        return list(dict.fromkeys(markers))
    if key == TENURE_ALIASES_KEY:
        return _clean_tenure_aliases(value)
    if not isinstance(value, dict) or not isinstance(value.get("separators"), list):
        raise _invalid("Indique los separadores como «separators» (lista de textos).")
    separators = value["separators"]
    unsplit = value.get("unsplit_markers", [])
    if not isinstance(unsplit, list) or not all(
        isinstance(s, str) for s in [*separators, *unsplit]
    ):
        raise _invalid("Los separadores y los marcadores que no se separan son textos.")
    if any(
        not separator.strip() for separator in separators if separator not in ("\n", "\r", "\t")
    ):
        # [SUPUESTO T10] a space would split every code written with spaces (I 236, M M Z 15).
        raise _invalid("Un separador no puede ser vacío ni un espacio.")
    return {
        "separators": list(dict.fromkeys(separators)),
        "unsplit_markers": list(dict.fromkeys(item.strip() for item in unsplit if item.strip())),
    }


def _clean_tenure_aliases(value: Any) -> dict[str, str]:
    """``{forma de adquisición: régimen}`` with folded keys and regime codes (ajustes-lectura-
    importacion, design D1); a regime that does not exist is a 422 with the valid ones."""
    if not isinstance(value, dict):
        raise _invalid("Las correspondencias son pares «forma de adquisición: régimen».")
    cleaned: dict[str, str] = {}
    for alias, regime in value.items():
        if not isinstance(alias, str) or not alias.strip():
            raise _invalid("Cada correspondencia necesita una forma de adquisición.")
        code = _REGIMES.get(fold_label(regime)) if isinstance(regime, str) else None
        if code is None:
            raise _invalid(
                f"«{regime}» no es un régimen de tenencia: use Propiedad, Comodato o "
                "Préstamo Temporal."
            )
        cleaned[fold_label(alias)] = code
    return cleaned


# --- impacto en los identificadores guardados ---------------------------------------------------


@dataclass(frozen=True)
class AffectedIdentifier:
    identifier_id: uuid.UUID
    piece_id: uuid.UUID
    type_code: str
    original_value: str
    normalized_value: str | None
    proposed_value: str | None
    reason: str  # "normalization" | "separation"

    def as_json(self) -> dict[str, Any]:
        return {
            "piece_id": str(self.piece_id),
            "identifier_type_code": self.type_code,
            "original_value": self.original_value,
            "normalized_value": self.normalized_value,
            "proposed_value": self.proposed_value,
            "reason": self.reason,
        }


def _rules(session: Session) -> dict[str, NormalizationRule]:
    rows = session.execute(select(IdentifierType.code, IdentifierType.normalization_rule)).all()
    return {**DEFAULT_RULES, **dict(rows)}


def impact(
    session: Session, current: NormalizationParams, proposed: NormalizationParams
) -> list[AffectedIdentifier]:
    """Stored identifiers (not deleted) that the change from ``current`` to ``proposed`` alters."""
    if current == proposed:
        return []
    rules = _rules(session)
    identifiers = session.scalars(
        select(PieceIdentifier).where(PieceIdentifier.deleted_at.is_(None))
    ).all()
    affected: dict[uuid.UUID, AffectedIdentifier] = {}
    for identifier in identifiers:
        rule = rules.get(identifier.identifier_type_code, NormalizationRule.GENERIC)
        before = normalize(rule, identifier.original_value, params=current)
        after = normalize(rule, identifier.original_value, params=proposed)
        if (before.normalized, before.status, before.is_absent) != (
            after.normalized,
            after.status,
            after.is_absent,
        ):
            affected[identifier.id] = _affected(identifier, after.normalized, "normalization")
        elif split_compound(identifier.original_value, params=current) != split_compound(
            identifier.original_value, params=proposed
        ):
            affected[identifier.id] = _affected(identifier, after.normalized, "separation")
    if (current.separators, current.unsplit_markers) != (
        proposed.separators,
        proposed.unsplit_markers,
    ):
        for identifier in _split_import_cells(session, identifiers, current, proposed):
            affected.setdefault(
                identifier.id, _affected(identifier, identifier.normalized_value, "separation")
            )
    return list(affected.values())


def _affected(identifier: PieceIdentifier, proposed: str | None, reason: str) -> AffectedIdentifier:
    return AffectedIdentifier(
        identifier.id,
        identifier.piece_id,
        identifier.identifier_type_code,
        identifier.original_value,
        identifier.normalized_value,
        proposed,
        reason,
    )


def _split_import_cells(
    session: Session,
    identifiers: Sequence[PieceIdentifier],
    current: NormalizationParams,
    proposed: NormalizationParams,
) -> Iterable[PieceIdentifier]:
    """Identifiers that come from an import cell the current separators split and the proposed
    ones would split differently (one query over the import rows recorded with each piece)."""
    from app.modules.catalog.models import PieceSourceRecord
    from app.modules.imports.models import ImportRow

    by_piece: dict[uuid.UUID, list[PieceIdentifier]] = {}
    for identifier in identifiers:
        by_piece.setdefault(identifier.piece_id, []).append(identifier)
    rows = session.execute(
        select(PieceSourceRecord.piece_id, ImportRow.raw_data).join(
            ImportRow,
            (ImportRow.batch_id == PieceSourceRecord.import_batch_id)
            & (ImportRow.source_row_number == PieceSourceRecord.source_row_number),
        )
    ).all()
    for piece_id, raw_data in rows:
        for cell in (raw_data or {}).values():
            if not isinstance(cell, str):
                continue
            parts = split_compound(cell, params=current)
            if len(parts) < 2 or parts == split_compound(cell, params=proposed):
                continue
            for identifier in by_piece.get(piece_id, []):
                if identifier.original_value in parts:
                    yield identifier


def ensure_no_impact(
    session: Session, current: NormalizationParams, proposed: NormalizationParams
) -> None:
    affected = impact(session, current, proposed)
    if not affected:
        return
    raise ConflictError(
        f"El cambio alteraría {len(affected)} identificadores ya registrados. Hace falta revisar "
        "la vista previa del impacto y confirmar el recálculo, que todavía no está disponible "
        f"({PREVIEW_CHANGE}): no se guardó nada.",
        code="normalization_change_requires_preview",
        details={
            "affected": len(affected),
            "examples": [item.as_json() for item in affected[:IMPACT_EXAMPLES]],
            "change": PREVIEW_CHANGE,
        },
    )


# --- parámetros ----------------------------------------------------------------------------------


def _with_setting(current: NormalizationParams, key: str, value: Any) -> NormalizationParams:
    parsed = params_from_rows({key: value})
    if key == TENURE_ALIASES_KEY:
        return dataclasses.replace(current, tenure_aliases=parsed.tenure_aliases)
    if key == ABSENCE_MARKERS_KEY:
        return dataclasses.replace(current, absence_markers=parsed.absence_markers)
    return dataclasses.replace(
        current, separators=parsed.separators, unsplit_markers=parsed.unsplit_markers
    )


def save_setting(session: Session, key: str, value: Any) -> NormalizationSetting:
    """Create or replace the value of a parameter, after checking its impact."""
    require_audit_context(session)
    cleaned = clean_value(key, value)
    current = load_params(session)
    if key != TENURE_ALIASES_KEY:  # the correspondences change no stored identifier
        ensure_no_impact(session, current, _with_setting(current, key, cleaned))
    setting = get_setting(session, key)
    if setting is None:
        setting = NormalizationSetting(id=new_uuid(), key=key, value=cleaned)
        session.add(setting)
    elif setting.value != cleaned:
        setting.value = cleaned
    session.flush()
    return setting


# --- alias de siglas -----------------------------------------------------------------------------


def list_aliases(session: Session) -> list[CollectionAcronymAlias]:
    return list(
        session.scalars(
            select(CollectionAcronymAlias)
            .where(CollectionAcronymAlias.deleted_at.is_(None))
            .order_by(CollectionAcronymAlias.alias_normalized)
        )
    )


def get_alias(session: Session, alias_id: uuid.UUID) -> CollectionAcronymAlias:
    alias = session.get(CollectionAcronymAlias, alias_id)
    if alias is None or alias.deleted_at is not None:
        raise NotFound("El alias de sigla no existe.", code="acronym_alias_not_found")
    return alias


def create_alias(session: Session, alias: str, collection_id: uuid.UUID) -> CollectionAcronymAlias:
    """A historical acronym of a collection: unique among the active aliases and different from
    the current acronym of every collection."""
    require_audit_context(session)
    normalized = normalize_acronym(alias)
    if not normalized:
        raise ValidationFailed("Indique la sigla histórica.", code="alias_required")
    collection = session.get(Collection, collection_id)
    if collection is None or collection.deleted_at is not None:
        raise NotFound("La colección no existe.", code="collection_not_found")
    taken = session.scalar(
        select(CollectionAcronymAlias).where(
            CollectionAcronymAlias.alias_normalized == normalized,
            CollectionAcronymAlias.deleted_at.is_(None),
        )
    )
    if taken is not None:
        owner = session.get(Collection, taken.collection_id)
        raise ConflictError(
            f"La sigla «{normalized}» ya es un alias de la colección "
            f"{owner.name if owner else taken.collection_id}.",
            code="acronym_alias_taken",
            details={"collection_id": str(taken.collection_id), "alias_id": str(taken.id)},
        )
    same = session.scalar(
        select(Collection).where(
            Collection.acronym_normalized == normalized, Collection.deleted_at.is_(None)
        )
    )
    if same is not None:
        raise ConflictError(
            f"«{normalized}» es la sigla actual de la colección {same.name}: "
            "no puede ser un alias.",
            code="alias_is_current_acronym",
            details={"collection_id": str(same.id)},
        )
    current = load_params(session)
    aliases = dict(current.acronym_aliases)
    if collection.acronym_normalized:
        aliases[normalized] = collection.acronym_normalized
    proposed = dataclasses.replace(
        current,
        acronym_aliases=aliases,
        alias_collection_ids={**current.alias_collection_ids, normalized: collection.id},
    )
    ensure_no_impact(session, current, proposed)
    row = CollectionAcronymAlias(
        id=new_uuid(),
        alias=alias.strip(),
        alias_normalized=normalized,
        collection_id=collection.id,
    )
    session.add(row)
    session.flush()
    return row


def delete_alias(session: Session, alias: CollectionAcronymAlias, reason: str | None) -> None:
    """Logical deletion with a reason (RN-005), after checking its impact."""
    require_audit_context(session)
    current = load_params(session)
    proposed = dataclasses.replace(
        current,
        acronym_aliases={
            k: v for k, v in current.acronym_aliases.items() if k != alias.alias_normalized
        },
        alias_collection_ids={
            k: v for k, v in current.alias_collection_ids.items() if k != alias.alias_normalized
        },
    )
    ensure_no_impact(session, current, proposed)
    soft_delete(session, alias, reason)
