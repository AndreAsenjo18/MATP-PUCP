"""Mapping templates reusable across loads of the same source (spec importacion-datos: RF-022).

Change ``plantillas-mapeo-y-normalizacion``, task 3.1 (phase 1 of design D1): templates are
stored as ``MappingSpec`` v1 and read back with ``read_mapping``, so the seed template keeps
working. The API speaks ``ColumnMapping`` only; v1 never leaves this module. Deleting is
logical (RN-005) and the deleted template shows up in the trash (``audit/trash.py``).
"""

import hashlib
import unicodedata
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.modules.audit.context import require_audit_context
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.normalization import canonical
from app.modules.imports.mapping import (
    IDENTIFIER_TARGET,
    MEASURES_TARGET,
    TERMS_TARGET,
    ColumnSpecV1,
    FieldTarget,
    IdentifiersTarget,
    IdentifierTarget,
    MappingContext,
    MappingConversionError,
    MappingSpec,
    MappingSpecV1,
    MeasuresTarget,
    SourcePayloadTarget,
    TermsTarget,
    from_column_mappings,
    read_mapping,
    validate_mapping,
    with_defaults,
)
from app.modules.imports.models import ImportMappingTemplate
from app.modules.imports.schemas import ColumnMapping


def header_key(text: str) -> str:
    """N1 (``canonical``) without accents: how headers and names are compared (design D3)."""
    decomposed = unicodedata.normalize("NFKD", canonical(text))
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def header_signature(headers: Sequence[str]) -> str:
    """SHA-256 of the normalized, sorted headers: same headers in another order or with other
    accents give the same signature (design D3)."""
    keys = sorted({header_key(header) for header in headers if header_key(header)})
    return hashlib.sha256("\n".join(keys).encode("utf-8")).hexdigest()


def build_spec(
    session: Session,
    columns: Sequence[ColumnMapping],
    headers: Sequence[str],
    defaults: Mapping[str, str] | None = None,
) -> MappingSpecV1:
    """``ColumnMapping`` and ``defaults`` (contract labels, ADR-002) -> v1 with internal codes,
    validated against the headers and the reference data."""
    try:
        spec = from_column_mappings(columns, defaults)
    except MappingConversionError as exc:
        raise ValidationFailed(
            "El mapeo de la plantilla tiene errores; corríjalos y vuelva a enviarlo.",
            code="invalid_mapping",
            details={"errors": [{"code": exc.code, "message": exc.message, "column": exc.column}]},
        ) from exc
    errors = validate_mapping(spec, list(headers), MappingContext(session))
    if errors:
        raise ValidationFailed(
            "El mapeo de la plantilla tiene errores; corríjalos y vuelva a enviarlo.",
            code="invalid_mapping",
            details={"errors": [error.as_json() for error in errors]},
        )
    return spec


def api_defaults(template: ImportMappingTemplate) -> dict[str, str]:
    """The stored defaults with the contract labels (``OWNED`` -> ``Propiedad``; ADR-002)."""
    defaults = dict(read_mapping(template.mapping).defaults)
    tenure = defaults.get("tenure_regime")
    if tenure is not None:
        defaults["tenure_regime"] = TENURE_REGIME_LABELS.get(TenureRegime(tenure), tenure)
    return defaults


def column_mappings(template: ImportMappingTemplate) -> list[ColumnMapping]:
    """The stored mapping (v1, or an older form converted by ``read_mapping``) as the API sees
    it: the inverse of ``from_column_mappings``."""
    spec = read_mapping(template.mapping)
    result: list[ColumnMapping] = []
    for column in spec.columns:
        target = column.target
        identifier_type: str | None = None
        split_compound = False
        magnitudes: list[str] | None = None
        if isinstance(target, MeasuresTarget):
            target_field: str | None = MEASURES_TARGET
            magnitudes = list(target.magnitudes)
        elif isinstance(target, FieldTarget):
            target_field = target.name
        elif isinstance(target, IdentifierTarget):
            target_field, identifier_type = IDENTIFIER_TARGET, target.type
        elif isinstance(target, IdentifiersTarget):
            target_field, identifier_type = IDENTIFIER_TARGET, target.default_type
            split_compound = True
        elif isinstance(target, TermsTarget):
            target_field = f"{TERMS_TARGET}:{target.vocabulary}"
        else:
            target_field = None
        result.append(
            ColumnMapping(
                source_column=column.source,
                target_field=target_field,
                identifier_type_code=identifier_type,
                split_compound=split_compound,
                transforms=list(column.transforms),
                value_map=column.value_map,
                source_columns=list(column.sources) if column.sources else None,
                join=column.join,
                measure_magnitudes=magnitudes,
                aliases=list(column.aliases) if column.aliases else None,
                optional=column.optional or None,
                sensitive=(target.sensitive or None)
                if isinstance(target, SourcePayloadTarget)
                else None,
                lender_for_loans=(target.lender_for_loans or None)
                if isinstance(target, SourcePayloadTarget)
                else None,
            )
        )
    return result


def _check_name_free(session: Session, name: str, exclude: uuid.UUID | None = None) -> None:
    """Unique among the active templates, ignoring case and accents [SUPUESTO T9]."""
    key = header_key(name)
    for template_id, other in session.execute(
        select(ImportMappingTemplate.id, ImportMappingTemplate.name)
    ):
        if template_id != exclude and header_key(other) == key:
            raise ConflictError(
                f"Ya existe una plantilla activa llamada «{other}».",
                code="template_name_taken",
                details={"template_id": str(template_id)},
            )


def list_templates(session: Session, source_name: str | None = None) -> list[ImportMappingTemplate]:
    query = select(ImportMappingTemplate).order_by(ImportMappingTemplate.name)
    if source_name is not None:
        query = query.where(ImportMappingTemplate.source_name == source_name)
    return list(session.scalars(query))


def get_template(session: Session, template_id: uuid.UUID) -> ImportMappingTemplate:
    template = session.get(ImportMappingTemplate, template_id)
    if template is None or template.deleted_at is not None:
        raise NotFound("La plantilla de mapeo no existe.", code="template_not_found")
    return template


def create_template(
    session: Session,
    *,
    name: str,
    source_name: str,
    headers: Sequence[str],
    columns: Sequence[ColumnMapping],
    description: str | None = None,
    defaults: Mapping[str, str] | None = None,
) -> ImportMappingTemplate:
    require_audit_context(session)
    _check_name_free(session, name)
    spec = build_spec(session, columns, headers, defaults)
    template = ImportMappingTemplate(
        name=name.strip(),
        source_name=source_name.strip(),
        header_signature=header_signature(headers),
        mapping=spec.as_json(),
        description=description,
    )
    session.add(template)
    session.flush()
    return template


def update_template(
    session: Session,
    template: ImportMappingTemplate,
    *,
    name: str | None = None,
    source_name: str | None = None,
    headers: Sequence[str] | None = None,
    columns: Sequence[ColumnMapping] | None = None,
    description: str | None = None,
    description_set: bool = False,
    defaults: Mapping[str, str] | None = None,
) -> ImportMappingTemplate:
    require_audit_context(session)
    if (headers is None) != (columns is None) or (defaults is not None and headers is None):
        raise ValidationFailed(
            "Envíe juntas las cabeceras y las columnas (y los valores por defecto, si los "
            "cambia): el mapeo se valida contra las cabeceras.",
            code="headers_and_columns_required",
        )
    if name is not None:
        _check_name_free(session, name, exclude=template.id)
        template.name = name.strip()
    if source_name is not None:
        template.source_name = source_name.strip()
    if headers is not None and columns is not None:
        kept = read_mapping(template.mapping).defaults if defaults is None else defaults
        template.mapping = build_spec(session, columns, headers, kept).as_json()
        template.header_signature = header_signature(headers)
    if description_set:
        template.description = description
    session.flush()
    return template


def column_keys(column: ColumnSpecV1) -> list[str]:
    """``header_key`` of the source and the aliases of a template column, in order."""
    keys = [header_key(column.source)]
    for alias in column.aliases or ():
        if (key := header_key(alias)) and key not in keys:
            keys.append(key)
    return keys


def resolve_columns(spec: MappingSpecV1, headers: Sequence[str]) -> MappingSpecV1:
    """A template spec linked to a file (change formatos-reales-importacion, design D1): each
    column takes the first file header that matches its source or an alias; an optional column
    the file lacks is left out. Other missing columns stay, so validation reports them."""
    by_key: dict[str, str] = {}
    for header in headers:
        by_key.setdefault(header_key(header), header)
    columns = []
    taken: set[str] = set()
    for column in spec.columns:
        if column.sources:  # several columns: each one by its own name (design D3)
            present = [by_key[k] for name in column.sources if (k := header_key(name)) in by_key]
            if not present and column.optional:
                continue
            if present:
                taken.update(present)
                linked_many = {
                    "source": present[0],
                    "sources": present,
                    "aliases": None,
                    "optional": None,
                }
                if isinstance(column.target, MeasuresTarget):
                    magnitudes = [
                        magnitude
                        for magnitude, name in zip(
                            column.target.magnitudes, column.sources, strict=False
                        )
                        if header_key(name) in by_key
                    ]
                    linked_many["target"] = MeasuresTarget(magnitudes=magnitudes)
                columns.append(column.model_copy(update=linked_many))
            else:
                columns.append(column)
            continue
        found = next(
            (
                by_key[key]
                for key in column_keys(column)
                if key in by_key and by_key[key] not in taken
            ),
            None,
        )
        if found is None:
            if not column.optional:
                columns.append(column)
            continue
        taken.add(found)
        linked = {"source": found, "aliases": None, "optional": None}
        columns.append(column.model_copy(update=linked))
    return spec.model_copy(update={"columns": columns})


def batch_spec(
    session: Session,
    template_id: uuid.UUID,
    defaults: Mapping[str, str] | None = None,
    headers: Sequence[str] | None = None,
) -> MappingSpec:
    """Phase 2 of design D1: the active template as the v1 mapping of a batch, with the
    defaults of the request over its own, linked to the headers of the file when given."""
    template = get_template(session, template_id)
    try:
        spec = with_defaults(read_mapping(template.mapping), defaults or {})
        if headers is not None:
            spec = resolve_columns(spec, headers)
    except MappingConversionError as exc:
        raise ValidationFailed(
            exc.message,
            code="invalid_mapping",
            details={"errors": [{"code": exc.code, "message": exc.message, "column": exc.column}]},
        ) from exc
    return MappingSpec.from_v1(spec)


def delete_template(session: Session, template: ImportMappingTemplate, reason: str | None) -> None:
    """Logical deletion with a reason (RN-005): batches keep ``template_id`` and their mapping."""
    from app.modules.audit.soft_delete import soft_delete

    require_audit_context(session)
    soft_delete(session, template, reason)


# --- suggestion by headers (design D3) -----------------------------------------------------

SUGGEST_THRESHOLD = 0.6  # [SUPUESTO T1]
SUGGEST_LIMIT = 3  # [SUPUESTO T2]


@dataclass(frozen=True)
class Suggestion:
    template: ImportMappingTemplate
    score: float
    missing_columns: list[str]  # template columns absent from the file
    new_columns: list[str]  # file headers the template does not map


def _by_key(headers: Sequence[str]) -> dict[str, str]:
    """Normalized header -> first spelling seen, skipping empty headers."""
    keyed: dict[str, str] = {}
    for header in headers:
        key = header_key(header)
        if key:
            keyed.setdefault(key, header)
    return keyed


def similarity(template_keys: set[str], file_keys: set[str]) -> float:
    """``0,5 × J + 0,5 × S`` (design D3, [SUPUESTO T1]): ``J`` is the Jaccard index of both sets
    and ``S`` the mean, over the template headers, of the best ``SequenceMatcher`` ratio
    against the file headers."""
    if not template_keys or not file_keys:
        return 0.0
    jaccard = len(template_keys & file_keys) / len(template_keys | file_keys)
    best = [
        max(SequenceMatcher(None, header, other).ratio() for other in file_keys)
        for header in template_keys
    ]
    return 0.5 * jaccard + 0.5 * sum(best) / len(best)


def aliased(template: ImportMappingTemplate) -> set[str]:
    """Every header key a template column answers to: sources and aliases."""
    keys = set()
    for column in read_mapping(template.mapping).columns:
        keys.update(column_keys(column))
        keys.update(header_key(name) for name in column.sources or ())
    return keys


def _template_view(
    columns: Sequence[ColumnSpecV1], file_headers: Mapping[str, str]
) -> tuple[dict[str, str], set[str]]:
    """The template headers to score against a file and the file keys as the template sees
    them (design D1): a file header that matches an alias counts as the column's source, and an
    optional column the file lacks does not count against the template."""
    template_headers: dict[str, str] = {}
    file_keys = set(file_headers)
    for column in columns:
        if column.sources:
            keys_of = [header_key(name) for name in column.sources]
            if column.optional and not any(key in file_headers for key in keys_of):
                continue
            for key, name in zip(keys_of, column.sources, strict=True):
                template_headers.setdefault(key, name)
            continue
        keys = column_keys(column)
        present = next((key for key in keys if key in file_headers), None)
        if present is None and column.optional:
            continue
        template_headers.setdefault(keys[0], column.source)
        if present is not None:
            file_keys.discard(present)
            file_keys.add(keys[0])
    return template_headers, file_keys


def suggest_templates(session: Session, headers: Sequence[str]) -> list[Suggestion]:
    """Up to ``SUGGEST_LIMIT`` active templates scoring at least ``SUGGEST_THRESHOLD``, best
    first. A template's headers are the source columns of its mapping [SUPUESTO T1]; the same
    signature as the file is a full match (score 1, nothing missing or new)."""
    signature = header_signature(headers)
    file_headers = _by_key(headers)
    suggestions: list[Suggestion] = []
    for template in list_templates(session):
        if template.header_signature == signature:
            suggestions.append(Suggestion(template, 1.0, [], []))
            continue
        template_headers, file_keys = _template_view(
            read_mapping(template.mapping).columns, file_headers
        )
        score = similarity(set(template_headers), file_keys)
        if score >= SUGGEST_THRESHOLD:
            suggestions.append(
                Suggestion(
                    template,
                    round(score, 4),
                    [name for key, name in template_headers.items() if key not in file_keys],
                    [
                        name
                        for key, name in file_headers.items()
                        if key not in template_headers and key not in aliased(template)
                    ],
                )
            )
    suggestions.sort(key=lambda item: (-item.score, header_key(item.template.name)))
    return suggestions[:SUGGEST_LIMIT]
