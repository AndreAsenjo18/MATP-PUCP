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
"""

import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.models import IdentifierType, NormalizationRule
from app.modules.identification.normalization import (
    TYPE_OTHER,
    is_absence_marker,
    propose_identifiers,
)
from app.modules.imports.classify import RowError, RowInput
from app.modules.imports.ingest import MERGED_KEY
from app.modules.imports.matching import RowIdentifier

SPEC_VERSION = 0  # provisional; ``plantillas-mapeo-y-normalizacion`` defines version 1
IDENTIFIER_TARGET = "identifier"
PAYLOAD_TARGET = "payload"

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


@dataclass(frozen=True)
class MappingError:
    code: str
    message: str  # user-facing, Spanish (ADR-002)
    column: str | None = None

    def as_json(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "column": self.column}


class MappingContext:
    """Identifier types and collections, loaded once per batch."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self.identifier_rules: dict[str, NormalizationRule] = dict(
            session.execute(
                select(IdentifierType.code, IdentifierType.normalization_rule).where(
                    IdentifierType.deleted_at.is_(None)
                )
            ).all()
        )
        self._collections: dict[str, uuid.UUID | None] = {}

    def collection_id(self, code: str) -> uuid.UUID | None:
        key = _fold(code)
        if key not in self._collections:
            found = find_collection_by_code(self._session, code)
            self._collections[key] = found.id if found is not None else None
        return self._collections[key]


@dataclass
class MappedRow:
    fields: dict[str, Any] = field(default_factory=dict)
    identifiers: list[RowIdentifier] = field(default_factory=list)
    source_payload: dict[str, Any] = field(default_factory=dict)
    errors: list[RowError] = field(default_factory=list)
    collection_id: uuid.UUID | None = None
    tenure_regime: TenureRegime | None = None

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

    def row_input(self, row_number: int) -> RowInput:
        return RowInput(
            row_number=row_number,
            denomination=self.fields.get("denomination"),
            tenure_regime=self.tenure_regime,
            identifiers=list(self.identifiers),
            collection_id=self.collection_id,
            errors=list(self.errors),
        )


def validate_mapping(
    spec: MappingSpec, headers: list[str], ctx: MappingContext
) -> list[MappingError]:
    errors: list[MappingError] = []
    known = set(headers)
    seen_sources: set[str] = set()
    scalar_targets: dict[str, str] = {}
    for column in spec.columns:
        if column.source not in known:
            errors.append(
                MappingError(
                    "unknown_column",
                    f"La columna «{column.source}» no está en el archivo.",
                    column.source,
                )
            )
        if column.source in seen_sources:
            errors.append(
                MappingError(
                    "duplicate_column",
                    f"La columna «{column.source}» está mapeada más de una vez.",
                    column.source,
                )
            )
        seen_sources.add(column.source)
        if column.target == IDENTIFIER_TARGET:
            if column.identifier_type is None and not column.split_compound:
                errors.append(
                    MappingError(
                        "identifier_type_required",
                        f"Indique el tipo de identificador de la columna «{column.source}» o "
                        "marque que la celda puede tener varios códigos.",
                        column.source,
                    )
                )
            elif (
                column.identifier_type is not None
                and column.identifier_type not in ctx.identifier_rules
            ):
                errors.append(
                    MappingError(
                        "unknown_identifier_type",
                        f"El tipo de identificador «{column.identifier_type}» no existe.",
                        column.source,
                    )
                )
        elif column.target in FIELD_TARGETS:
            if column.target in scalar_targets:
                errors.append(
                    MappingError(
                        "duplicate_target",
                        f"«{FIELD_TARGETS[column.target]}» ya se toma de la columna "
                        f"«{scalar_targets[column.target]}».",
                        column.source,
                    )
                )
            scalar_targets[column.target] = column.source
        elif column.target != PAYLOAD_TARGET:
            errors.append(
                MappingError(
                    "unknown_target",
                    f"El destino «{column.target}» no es un campo de la ficha.",
                    column.source,
                )
            )
    for name in spec.defaults:
        if name not in DEFAULT_TARGETS:
            errors.append(
                MappingError(
                    "unknown_default",
                    f"No se admite un valor por defecto para «{name}».",
                )
            )
    tenure_default = spec.defaults.get("tenure_regime")
    if tenure_default is not None and _fold(tenure_default) not in TENURE_ALIASES:
        errors.append(
            MappingError(
                "invalid_default",
                f"«{tenure_default}» no es un régimen de tenencia (Propiedad, Comodato o "
                "Préstamo Temporal).",
            )
        )
    collection_default = spec.defaults.get("collection")
    if collection_default is not None and ctx.collection_id(collection_default) is None:
        errors.append(
            MappingError(
                "invalid_default", f"No existe una colección con la sigla «{collection_default}»."
            )
        )
    if "denomination" not in scalar_targets:
        errors.append(
            MappingError(
                "denomination_required",
                "Debe indicar la columna de la denominación: es obligatoria en la ficha.",
            )
        )
    return errors


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def apply_mapping(raw_row: dict[str, Any], spec: MappingSpec, ctx: MappingContext) -> MappedRow:
    mapped = MappedRow()
    mapped_sources = {column.source for column in spec.columns if column.target != PAYLOAD_TARGET}
    for column in spec.columns:
        value = _text(raw_row.get(column.source))
        if column.target == IDENTIFIER_TARGET:
            mapped.identifiers += _identifiers(value, column, ctx)
        elif column.target in FIELD_TARGETS and value is not None:
            mapped.fields[column.target] = value
    mapped.source_payload = {
        key: value
        for key, value in raw_row.items()
        if key not in mapped_sources and key != MERGED_KEY and value not in (None, "")
    }

    tenure = mapped.fields.get("tenure_regime") or spec.defaults.get("tenure_regime")
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
    collection = mapped.fields.get("collection") or spec.defaults.get("collection")
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
