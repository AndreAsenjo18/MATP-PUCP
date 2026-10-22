"""Provisional column mapping of an import batch (spec importacion-datos: RF-022, RF-008; D3).

The pipeline depends only on two functions, whose contract belongs to
``plantillas-mapeo-y-normalizacion``:

- ``validate_mapping(spec, headers, ctx) -> list[MappingError]``
- ``apply_mapping(raw_row, spec, ctx) -> MappedRow``

Until that change is applied, this module is the minimal implementation the design allows:
each column is copied to a record field, to an identifier type (normalized with the existing
rule of its type, optionally split with N7) or to the source payload. No transformations,
templates or vocabularies. Columns not listed in the mapping go to the source payload, so
nothing in the file is lost (RF-008).

``MappingSpecV1`` is the internal version 1 of the spec (design D1). The public form stays
``ColumnMapping``: ``from_column_mappings`` translates it, and ``read_mapping`` converts the
stored forms explicitly (pipeline v0 and the seed template) so saved batches keep working.
The sheet and the header row live in ``import_batch``, never in the spec.
"""

import unicodedata
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Annotated, Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Term, Vocabulary
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.models import (
    IdentifierType,
    NormalizationRule,
    NormalizationStatus,
)
from app.modules.identification.normalization import (
    TYPE_OTHER,
    is_absence_marker,
    propose_identifiers,
)
from app.modules.imports.classify import RowError, RowInput
from app.modules.imports.ingest import MERGED_KEY
from app.modules.imports.matching import RowIdentifier
from app.modules.imports.transforms import (
    TransformedValue,
    TransformSpecError,
    parse_transforms,
    run_transforms,
)

SPEC_VERSION = 0  # provisional; ``plantillas-mapeo-y-normalizacion`` defines version 1
IDENTIFIER_TARGET = "identifier"
PAYLOAD_TARGET = "payload"
# ``target_field: "terms:<VOCABULARIO>"`` in ``ColumnMapping`` (design D1, pending confirmation).
TERMS_TARGET = "terms"

# Record fields a column can fill, as named in the API contract.
FIELD_TARGETS: dict[str, str] = {
    "denomination": "Denominación",
    "description": "Descripción",
    "tenure_regime": "Régimen de tenencia",
    "collection": "Colección (sigla)",
    "author": "Autor",
    "provenance": "Procedencia",
    "epoch_original_text": "Época (texto original)",
    "dimensions_text": "Medidas (texto)",
    "notes": "Observaciones",
    "recorded_by": "Registrador",
    "lender_name": "Comodante",
    "loan_agreement_ref": "Referencia del contrato de comodato",
    "temporary_inventory_number": "Número de inventario temporal",
}
DEFAULT_TARGETS = frozenset({"tenure_regime", "collection"})
# In v1 ``denomination`` may come from a default too (design D2); v0 keeps DEFAULT_TARGETS.
DEFAULT_TARGETS_V1 = DEFAULT_TARGETS | {"denomination"}
# Fields compared with the catalog in the preview diff (``collection`` is compared by id).
PIECE_FIELDS = tuple(name for name in FIELD_TARGETS if name not in {"collection"})


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.strip().casefold())
    return " ".join("".join(c for c in folded if not unicodedata.combining(c)).split())


# Spanish labels of the contract and the system codes [SUPUESTO: values of the real files].
TENURE_ALIASES: dict[str, TenureRegime] = {
    **{_fold(regime.value): regime for regime in TenureRegime},
    "propiedad": TenureRegime.OWNED,
    "propio": TenureRegime.OWNED,
    "comodato": TenureRegime.LOAN_FOR_USE,
    "prestamo temporal": TenureRegime.TEMPORARY_LOAN,
}


@dataclass(frozen=True)
class ColumnSpec:
    """One column of the file. For identifiers, ``identifier_type`` is the type of the column;
    with ``split_compound`` the cell may hold several codes (N7) and each part keeps the type it
    is recognized as (e.g. ``I-0236 / M.M.Z. 015``), falling back to ``identifier_type`` and then
    to ``OTRO``. ``identifier_type=None`` requires ``split_compound`` (detect every part)."""

    source: str
    target: str  # a key of FIELD_TARGETS, "identifier" or "payload"
    identifier_type: str | None = None
    split_compound: bool = False

    def as_json(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "identifier_type": self.identifier_type,
            "split_compound": self.split_compound,
        }


@dataclass(frozen=True)
class MappingSpec:
    columns: list[ColumnSpec]
    defaults: dict[str, str] = field(default_factory=dict)
    version: int = SPEC_VERSION

    def as_json(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "columns": [column.as_json() for column in self.columns],
            "defaults": dict(self.defaults),
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "MappingSpec":
        return cls(
            columns=[ColumnSpec(**column) for column in data.get("columns", [])],
            defaults=dict(data.get("defaults") or {}),
            version=data.get("version", SPEC_VERSION),
        )


# --- MappingSpec v1 (internal, design D1) ---------------------------------------------------

SPEC_VERSION_V1 = 1
SEED_IDENTIFIERS_AUTO = "identifiers:auto"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class FieldTarget(_Strict):
    kind: Literal["field"] = "field"
    name: str


class IdentifierTarget(_Strict):
    kind: Literal["identifier"] = "identifier"
    type: str


class IdentifiersTarget(_Strict):
    """A cell with several codes (N7); each part keeps the type it is recognized as."""

    kind: Literal["identifiers"] = "identifiers"
    default_type: str | None = None


class TermsTarget(_Strict):
    kind: Literal["terms"] = "terms"
    vocabulary: str


class SourcePayloadTarget(_Strict):
    kind: Literal["source_payload"] = "source_payload"


ColumnTarget = Annotated[
    FieldTarget | IdentifierTarget | IdentifiersTarget | TermsTarget | SourcePayloadTarget,
    Field(discriminator="kind"),
]


class ColumnSpecV1(_Strict):
    source: str
    target: ColumnTarget
    transforms: list[str] = Field(default_factory=list)
    value_map: dict[str, str] | None = None

    @model_validator(mode="after")
    def _known_transforms(self) -> "ColumnSpecV1":
        try:
            parse_transforms(self.transforms, self.value_map)
        except TransformSpecError as exc:
            raise ValueError(exc.message) from exc
        return self


class MappingSpecV1(_Strict):
    """Internal spec: built from ``ColumnMapping`` and never exposed by the API. Stores internal
    codes (``OWNED``, term and identifier type codes; ADR-002)."""

    version: Literal[1] = SPEC_VERSION_V1
    columns: list[ColumnSpecV1] = Field(default_factory=list)
    defaults: dict[str, str] = Field(default_factory=dict)

    def as_json(self) -> dict[str, Any]:
        return self.model_dump(mode="json", exclude_none=True)


class MappingConversionError(ValueError):
    """A stored or received mapping cannot be read as version 1."""

    def __init__(self, code: str, message: str, column: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message  # user-facing, Spanish (ADR-002)
        self.column = column


class ColumnMappingLike(Protocol):
    """Public ``ColumnMapping`` of the API (``schemas.ColumnMapping``)."""

    source_column: str
    target_field: str | None
    identifier_type_code: str | None
    split_compound: bool
    transforms: list[str]
    value_map: dict[str, str] | None


def _target_from_v0(column: ColumnSpec) -> ColumnTarget:
    if column.target == PAYLOAD_TARGET:
        return SourcePayloadTarget()
    if column.target != IDENTIFIER_TARGET:
        return FieldTarget(name=column.target)
    if column.split_compound:
        return IdentifiersTarget(default_type=column.identifier_type)
    if column.identifier_type is None:
        raise MappingConversionError(
            "identifier_type_required",
            f"La columna «{column.source}» es de identificadores sin tipo ni separación de "
            "códigos.",
            column.source,
        )
    return IdentifierTarget(type=column.identifier_type)


def _defaults_to_codes(defaults: Mapping[str, str]) -> dict[str, str]:
    """Contract labels (``Propiedad``…) become internal codes (``OWNED``…)."""
    converted = dict(defaults)
    tenure = converted.get("tenure_regime")
    if tenure is not None:
        regime = TENURE_ALIASES.get(_fold(tenure))
        if regime is None:
            raise MappingConversionError(
                "invalid_default",
                f"«{tenure}» no es un régimen de tenencia (Propiedad, Comodato o "
                "Préstamo Temporal).",
            )
        converted["tenure_regime"] = regime.value
    return converted


def _from_v0_columns(columns: Sequence[ColumnSpec], defaults: Mapping[str, str]) -> MappingSpecV1:
    return MappingSpecV1(
        columns=[
            ColumnSpecV1(source=column.source, target=_target_from_v0(column)) for column in columns
        ],
        defaults=_defaults_to_codes(defaults),
    )


def from_column_mappings(
    columns: Sequence[ColumnMappingLike], defaults: Mapping[str, str] | None = None
) -> MappingSpecV1:
    """Translate the public ``ColumnMapping`` list (and ``MappingRequest.defaults``) into v1,
    with the same reading of ``target_field`` as ``PUT /imports/{batch_id}/mapping``, plus the
    v1 fields: ``transforms``, ``value_map`` and ``terms:<VOCABULARIO>`` targets (design D1)."""
    converted: list[ColumnSpecV1] = []
    for column in columns:
        target = column.target_field or PAYLOAD_TARGET
        column_target: ColumnTarget
        if target.startswith(f"{TERMS_TARGET}:"):
            vocabulary = target.split(":", 1)[1]
            if not vocabulary:
                raise MappingConversionError(
                    "vocabulary_required",
                    f"Indique el vocabulario de la columna «{column.source_column}» "
                    "(`terms:<VOCABULARIO>`).",
                    column.source_column,
                )
            column_target = TermsTarget(vocabulary=vocabulary)
        else:
            identifier_type = column.identifier_type_code
            if target.startswith(f"{IDENTIFIER_TARGET}:"):
                target, identifier_type = IDENTIFIER_TARGET, target.split(":", 1)[1] or None
            column_target = _target_from_v0(
                ColumnSpec(
                    source=column.source_column,
                    target=target,
                    identifier_type=identifier_type if target == IDENTIFIER_TARGET else None,
                    split_compound=column.split_compound,
                )
            )
        transforms = list(column.transforms)
        try:
            parse_transforms(transforms, column.value_map)
        except TransformSpecError as exc:
            raise MappingConversionError(
                "invalid_transform", exc.message, column.source_column
            ) from exc
        converted.append(
            ColumnSpecV1(
                source=column.source_column,
                target=column_target,
                transforms=transforms,
                value_map=column.value_map,
            )
        )
    return MappingSpecV1(columns=converted, defaults=_defaults_to_codes(defaults or {}))


def _is_seed_form(data: Mapping[str, Any]) -> bool:
    return bool(data) and all(
        isinstance(value, Mapping) and "target" in value for value in data.values()
    )


def _from_seed(data: Mapping[str, Any]) -> MappingSpecV1:
    columns: list[ColumnSpecV1] = []
    for source, column in data.items():
        target = column["target"]
        if target == SEED_IDENTIFIERS_AUTO:
            column_target: ColumnTarget = IdentifiersTarget(default_type=None)
        elif target == PAYLOAD_TARGET:
            column_target = SourcePayloadTarget()
        else:
            column_target = FieldTarget(name=target)
        columns.append(ColumnSpecV1(source=source, target=column_target))
    return MappingSpecV1(columns=columns)


def read_mapping(data: Mapping[str, Any]) -> MappingSpecV1:
    """Read a stored mapping as v1, converting older forms explicitly (design D1):

    - ``{"version": 1, ...}``: validated as is.
    - ``{"version": 0, "columns": [...], "defaults": {...}}``: what the pipeline stores.
    - ``{column: {"target": ...}}`` without ``version``: the seed template.

    Anything else, including an unknown version, is an error: the form is never guessed.
    """
    version = data.get("version")
    try:
        if version == SPEC_VERSION_V1:
            return MappingSpecV1.model_validate(data)
        if version == SPEC_VERSION:
            v0 = MappingSpec.from_json(dict(data))
            return _from_v0_columns(v0.columns, v0.defaults)
        if version is None and "columns" not in data and _is_seed_form(data):
            return _from_seed(data)
    except (ValidationError, TypeError, KeyError) as exc:
        raise MappingConversionError(
            "invalid_mapping", f"El mapeo guardado (versión {version}) no es válido: {exc}"
        ) from exc
    raise MappingConversionError(
        "unknown_mapping_version",
        f"No se reconoce la versión del mapeo guardado ({version!r}); no se adivina su forma.",
    )


@dataclass(frozen=True)
class MappingError:
    code: str
    message: str  # user-facing, Spanish (ADR-002)
    column: str | None = None

    def as_json(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "column": self.column}


class MappingContext:
    """Identifier types, collections and vocabularies, loaded once per batch."""

    def __init__(self, session: Session) -> None:
        self._session = session
        rows = session.execute(
            select(
                IdentifierType.code, IdentifierType.normalization_rule, IdentifierType.is_active
            ).where(IdentifierType.deleted_at.is_(None))
        ).all()
        self.identifier_rules: dict[str, NormalizationRule] = {code: rule for code, rule, _ in rows}
        self.inactive_identifier_types: frozenset[str] = frozenset(
            code for code, _rule, active in rows if not active
        )
        self._collections: dict[str, uuid.UUID | None] = {}
        self._vocabularies: dict[str, dict[str, VocabularyTerm] | None] = {}
        self._plans: dict[int, tuple[MappingSpec | MappingSpecV1, _Plan]] = {}

    def collection_id(self, code: str) -> uuid.UUID | None:
        key = _fold(code)
        if key not in self._collections:
            found = find_collection_by_code(self._session, code)
            self._collections[key] = found.id if found is not None else None
        return self._collections[key]

    def vocabulary_terms(self, code: str) -> "dict[str, VocabularyTerm] | None":
        """Terms of a vocabulary by code (active and inactive); None if it does not exist."""
        if code not in self._vocabularies:
            vocabulary_id = self._session.scalar(
                select(Vocabulary.id).where(
                    Vocabulary.code == code, Vocabulary.deleted_at.is_(None)
                )
            )
            if vocabulary_id is None:
                self._vocabularies[code] = None
            else:
                terms = self._session.execute(
                    select(Term.code, Term.label, Term.is_active).where(
                        Term.vocabulary_id == vocabulary_id, Term.deleted_at.is_(None)
                    )
                ).all()
                self._vocabularies[code] = {
                    term_code: VocabularyTerm(term_code, label, active)
                    for term_code, label, active in terms
                }
        return self._vocabularies[code]

    def plan(self, spec: "MappingSpec | MappingSpecV1") -> "_Plan":
        """The v1 plan of ``spec``, built once per spec (``apply_mapping`` runs once per row)."""
        cached = self._plans.get(id(spec))
        if cached is not None and cached[0] is spec:
            return cached[1]
        plan = _plan(spec)
        self._plans[id(spec)] = (spec, plan)
        return plan


@dataclass(frozen=True)
class VocabularyTerm:
    code: str
    label: str
    is_active: bool


@dataclass
class TermMatches:
    """Values of a ``terms`` column and the active term each corresponds to (preview only)."""

    vocabulary: str
    matched: list[tuple[str, str]] = field(default_factory=list)  # (value, term code)
    unmatched: list[str] = field(default_factory=list)


@dataclass
class MappedRow:
    fields: dict[str, Any] = field(default_factory=dict)
    identifiers: list[RowIdentifier] = field(default_factory=list)
    source_payload: dict[str, Any] = field(default_factory=dict)
    errors: list[RowError] = field(default_factory=list)
    collection_id: uuid.UUID | None = None
    tenure_regime: TenureRegime | None = None
    # Preview only (design D2): kept in memory, never serialized by ``as_json``.
    transformed: dict[str, TransformedValue] = field(
        default_factory=dict, compare=False, repr=False
    )
    term_matches: dict[str, TermMatches] = field(default_factory=dict, compare=False, repr=False)

    @property
    def proposals(self) -> dict[str, dict[str, Any]]:
        """Proposed fields (``epoch_*``, ``dimensions``) by source column; preview only."""
        return {
            source: value.proposals for source, value in self.transformed.items() if value.proposals
        }

    def as_json(self) -> dict[str, Any]:
        """Value stored in ``import_row.mapped_data``."""
        return {
            "fields": self.fields,
            "collection_id": str(self.collection_id) if self.collection_id else None,
            "tenure_regime": self.tenure_regime.value if self.tenure_regime else None,
            "identifiers": [
                {
                    "type": identifier.type_code,
                    "original_value": identifier.original_value,
                    "normalized_value": identifier.normalized_value,
                    "status": identifier.status.value,
                    "is_absent": identifier.is_absent,
                }
                for identifier in self.identifiers
            ],
            "source_payload": self.source_payload,
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "MappedRow":
        """Inverse of ``as_json`` (transformation errors are not stored, so they are empty)."""
        collection_id = data.get("collection_id")
        tenure = data.get("tenure_regime")
        return cls(
            fields=dict(data.get("fields") or {}),
            identifiers=[
                RowIdentifier(
                    type_code=item["type"],
                    original_value=item["original_value"],
                    normalized_value=item.get("normalized_value"),
                    status=NormalizationStatus(item["status"]),
                    is_absent=bool(item.get("is_absent")),
                )
                for item in data.get("identifiers") or []
            ],
            source_payload=dict(data.get("source_payload") or {}),
            collection_id=uuid.UUID(collection_id) if collection_id else None,
            tenure_regime=TenureRegime(tenure) if tenure else None,
        )

    def row_input(self, row_number: int) -> RowInput:
        return RowInput(
            row_number=row_number,
            denomination=self.fields.get("denomination"),
            tenure_regime=self.tenure_regime,
            identifiers=list(self.identifiers),
            collection_id=self.collection_id,
            errors=list(self.errors),
        )


# --- v0 or v1 -> one plan ------------------------------------------------------------------


@dataclass(frozen=True)
class _Plan:
    """What ``validate_mapping`` and ``apply_mapping`` work on, whatever the spec version.

    ``columns`` keeps, in order, each column as v1 or the error that prevented converting it.
    A v0 spec, as ``PUT /imports/{batch_id}/mapping`` stores it, behaves exactly as before this
    change: its defaults may carry contract labels (``Propiedad``) and the rules added for v1
    (inactive identifier type, ``denomination`` default, ``multiple_values``, vocabularies)
    do not apply to it. ``is_v1`` tells them apart.
    """

    columns: list[tuple[str, ColumnSpecV1 | MappingError]]
    defaults: dict[str, str]
    is_v1: bool


def _plan(spec: "MappingSpec | MappingSpecV1") -> _Plan:
    if isinstance(spec, MappingSpecV1):
        return _Plan([(column.source, column) for column in spec.columns], spec.defaults, True)
    columns: list[tuple[str, ColumnSpecV1 | MappingError]] = []
    for column in spec.columns:
        try:
            columns.append(
                (column.source, ColumnSpecV1(source=column.source, target=_target_from_v0(column)))
            )
        except MappingConversionError:
            columns.append(
                (
                    column.source,
                    MappingError(
                        "identifier_type_required",
                        f"Indique el tipo de identificador de la columna «{column.source}» o "
                        "marque que la celda puede tener varios códigos.",
                        column.source,
                    ),
                )
            )
    return _Plan(columns, dict(spec.defaults), False)


def _splits(column: ColumnSpecV1) -> bool:
    return any(
        name == "split_concatenated" or name.startswith("split:") for name in column.transforms
    )


# --- validation ----------------------------------------------------------------------------


def validate_mapping(
    spec: "MappingSpec | MappingSpecV1", headers: list[str], ctx: MappingContext
) -> list[MappingError]:
    """Errors of a mapping (v0 or v1) against the file headers and the reference data."""
    plan = ctx.plan(spec)
    errors: list[MappingError] = []
    known = set(headers)
    seen_sources: set[str] = set()
    scalar_targets: dict[str, str] = {}
    for source, column in plan.columns:
        if source not in known:
            errors.append(
                MappingError(
                    "unknown_column", f"La columna «{source}» no está en el archivo.", source
                )
            )
        if source in seen_sources:
            errors.append(
                MappingError(
                    "duplicate_column",
                    f"La columna «{source}» está mapeada más de una vez.",
                    source,
                )
            )
        seen_sources.add(source)
        if isinstance(column, MappingError):
            errors.append(column)
            continue
        target = column.target
        if isinstance(target, IdentifierTarget):
            errors += _identifier_type_errors(target.type, source, ctx, plan.is_v1)
        elif isinstance(target, IdentifiersTarget):
            if target.default_type is not None:
                errors += _identifier_type_errors(target.default_type, source, ctx, plan.is_v1)
        elif isinstance(target, FieldTarget):
            if target.name not in FIELD_TARGETS:
                errors.append(
                    MappingError(
                        "unknown_target",
                        f"El destino «{target.name}» no es un campo de la ficha.",
                        source,
                    )
                )
                continue
            if target.name in scalar_targets:
                errors.append(
                    MappingError(
                        "duplicate_target",
                        f"«{FIELD_TARGETS[target.name]}» ya se toma de la columna "
                        f"«{scalar_targets[target.name]}».",
                        source,
                    )
                )
            scalar_targets[target.name] = source
            if plan.is_v1 and _splits(column):
                errors.append(
                    MappingError(
                        "multiple_values",
                        f"«{FIELD_TARGETS[target.name]}» admite un solo valor: quite la "
                        f"separación de la columna «{source}».",
                        source,
                    )
                )
        elif isinstance(target, TermsTarget):  # only v1 has ``terms`` columns
            errors += _terms_errors(target.vocabulary, column.value_map or {}, source, ctx)
    errors += _defaults_errors(plan, ctx)
    if "denomination" not in scalar_targets and not _denomination_default(plan):
        errors.append(
            MappingError(
                "denomination_required",
                "Debe indicar la columna de la denominación: es obligatoria en la ficha.",
            )
        )
    return errors


def _denomination_default(plan: _Plan) -> str | None:
    """The ``denomination`` default; v1 only (v0 rejects it as ``unknown_default``)."""
    value = (plan.defaults.get("denomination") or "").strip() if plan.is_v1 else ""
    return value or None


def _identifier_type_errors(
    type_code: str, source: str, ctx: MappingContext, is_v1: bool
) -> list[MappingError]:
    if type_code not in ctx.identifier_rules:
        return [
            MappingError(
                "unknown_identifier_type",
                f"El tipo de identificador «{type_code}» no existe.",
                source,
            )
        ]
    if is_v1 and type_code in ctx.inactive_identifier_types:
        return [
            MappingError(
                "inactive_identifier_type",
                f"El tipo de identificador «{type_code}» está desactivado.",
                source,
            )
        ]
    return []


def _terms_errors(
    vocabulary: str, value_map: Mapping[str, str], source: str, ctx: MappingContext
) -> list[MappingError]:
    terms = ctx.vocabulary_terms(vocabulary)
    if terms is None:
        return [
            MappingError("unknown_vocabulary", f"El vocabulario «{vocabulary}» no existe.", source)
        ]
    errors: list[MappingError] = []
    for value, code in value_map.items():
        term = terms.get(code)
        if term is None:
            errors.append(
                MappingError(
                    "unknown_term",
                    f"«{value}» se asocia al término «{code}», que no existe en el vocabulario "
                    f"«{vocabulary}».",
                    source,
                )
            )
        elif not term.is_active:
            errors.append(
                MappingError(
                    "inactive_term",
                    f"«{value}» se asocia al término «{term.label}» ({code}), que está "
                    "desactivado.",
                    source,
                )
            )
    return errors


def _defaults_errors(plan: _Plan, ctx: MappingContext) -> list[MappingError]:
    allowed = DEFAULT_TARGETS_V1 if plan.is_v1 else DEFAULT_TARGETS
    errors = [
        MappingError("unknown_default", f"No se admite un valor por defecto para «{name}».")
        for name in plan.defaults
        if name not in allowed
    ]
    tenure_default = plan.defaults.get("tenure_regime")
    if tenure_default is not None:
        if plan.is_v1 and tenure_default not in {regime.value for regime in TenureRegime}:
            errors.append(
                MappingError(
                    "invalid_default",
                    f"«{tenure_default}» no es un código de régimen de tenencia "
                    f"({', '.join(regime.value for regime in TenureRegime)}).",
                )
            )
        elif not plan.is_v1 and _fold(tenure_default) not in TENURE_ALIASES:
            errors.append(
                MappingError(
                    "invalid_default",
                    f"«{tenure_default}» no es un régimen de tenencia (Propiedad, Comodato o "
                    "Préstamo Temporal).",
                )
            )
    collection_default = plan.defaults.get("collection")
    if collection_default is not None and ctx.collection_id(collection_default) is None:
        errors.append(
            MappingError(
                "invalid_default", f"No existe una colección con la sigla «{collection_default}»."
            )
        )
    return errors


# --- application ---------------------------------------------------------------------------


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def _parts(value: Any) -> list[Any]:
    return value if isinstance(value, list) else [value]


MAPPED_KINDS = frozenset({"field", "identifier", "identifiers"})


def apply_mapping(
    raw_row: dict[str, Any], spec: "MappingSpec | MappingSpecV1", ctx: MappingContext
) -> MappedRow:
    """Map one raw row (v0 or v1 spec). Values stored in ``mapped_data`` are always text:
    a transformed year (``1998``) or date (``1998-04-03``) is written as text, as Excel date
    cells already were. Term matches, proposals and traces stay in memory for the preview."""
    plan = ctx.plan(spec)
    columns = [column for _source, column in plan.columns if isinstance(column, ColumnSpecV1)]
    mapped = MappedRow()
    mapped_sources = {column.source for column in columns if column.target.kind in MAPPED_KINDS}
    for column in columns:
        raw = raw_row.get(column.source)
        value, is_absent = raw, False
        if column.transforms:
            transformed = run_transforms(
                raw, parse_transforms(column.transforms, column.value_map), column.value_map
            )
            mapped.transformed[column.source] = transformed
            if transformed.error is not None:
                mapped.errors.append(
                    RowError(
                        transformed.error.code,
                        f"Columna «{column.source}»: {transformed.error.message}",
                        column.target.name if isinstance(column.target, FieldTarget) else None,
                    )
                )
                continue
            value, is_absent = transformed.value, transformed.is_absent
        _map_value(mapped, column, raw, value, is_absent, ctx)
    mapped.source_payload = {
        key: value
        for key, value in raw_row.items()
        if key not in mapped_sources and key != MERGED_KEY and value not in (None, "")
    }

    denomination_default = _denomination_default(plan)
    if mapped.fields.get("denomination") is None and denomination_default:
        mapped.fields["denomination"] = denomination_default
    tenure = mapped.fields.get("tenure_regime") or plan.defaults.get("tenure_regime")
    if tenure is not None:
        mapped.tenure_regime = TENURE_ALIASES.get(_fold(tenure))
        if mapped.tenure_regime is None:
            mapped.errors.append(
                RowError(
                    "invalid_tenure_regime",
                    f"«{tenure}» no es un régimen de tenencia (Propiedad, Comodato o "
                    "Préstamo Temporal).",
                    "tenure_regime",
                )
            )
    collection = mapped.fields.get("collection") or plan.defaults.get("collection")
    if collection is not None:
        mapped.collection_id = ctx.collection_id(collection)
        if mapped.collection_id is None:
            mapped.errors.append(
                RowError(
                    "unknown_collection",
                    f"No existe una colección con la sigla «{collection}».",
                    "collection",
                )
            )
    return mapped


def _map_value(
    mapped: MappedRow,
    column: ColumnSpecV1,
    raw: Any,
    value: Any,
    is_absent: bool,
    ctx: MappingContext,
) -> None:
    target = column.target
    if isinstance(target, FieldTarget):
        if target.name not in FIELD_TARGETS:
            return
        if isinstance(value, list) and len(value) > 1:
            mapped.errors.append(
                RowError(
                    "multiple_values",
                    f"Columna «{column.source}»: «{FIELD_TARGETS[target.name]}» admite un solo "
                    "valor.",
                    target.name,
                )
            )
            return
        text = _text(value[0] if isinstance(value, list) else value)
        if text is not None:
            mapped.fields[target.name] = text
    elif isinstance(target, IdentifierTarget | IdentifiersTarget):
        split = isinstance(target, IdentifiersTarget)
        type_code = target.default_type if isinstance(target, IdentifiersTarget) else target.type
        legacy = ColumnSpec(column.source, IDENTIFIER_TARGET, type_code, split)
        if is_absent:
            # The absence marker is kept as an identifier "without code", as without transforms.
            mapped.identifiers += _identifiers(_text(raw), legacy, ctx)
        else:
            for part in _parts(value):
                mapped.identifiers += _identifiers(_text(part), legacy, ctx)
    elif isinstance(target, TermsTarget):
        mapped.term_matches[column.source] = _match_terms(target.vocabulary, value, ctx)


def _match_terms(vocabulary: str, value: Any, ctx: MappingContext) -> TermMatches:
    """An active term whose code or label equals the value, ignoring case and accents
    [SUPUESTO S6]."""
    matches = TermMatches(vocabulary)
    terms = ctx.vocabulary_terms(vocabulary) or {}
    by_key: dict[str, str] = {}
    for term in terms.values():
        if term.is_active:
            by_key.setdefault(_fold(term.code), term.code)
            by_key.setdefault(_fold(term.label), term.code)
    for part in _parts(value):
        text = _text(part)
        if text is None:
            continue
        code = by_key.get(_fold(text))
        if code is None:
            matches.unmatched.append(text)
        else:
            matches.matched.append((text, code))
    return matches


def _identifiers(value: str | None, column: ColumnSpec, ctx: MappingContext) -> list[RowIdentifier]:
    if value is None:
        return []
    if not column.split_compound or is_absence_marker(value):
        type_code = column.identifier_type or TYPE_OTHER
        return [RowIdentifier.from_raw(type_code, value, ctx.identifier_rules.get(type_code))]
    identifiers: list[RowIdentifier] = []
    for proposal in propose_identifiers(value, column.identifier_type):
        type_code = proposal.type_code or TYPE_OTHER
        identifiers.append(
            RowIdentifier.from_raw(
                type_code, proposal.result.original, ctx.identifier_rules.get(type_code)
            )
        )
    return identifiers
