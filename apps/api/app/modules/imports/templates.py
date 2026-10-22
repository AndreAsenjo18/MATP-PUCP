"""Mapping templates reusable across loads of the same source (spec importacion-datos: RF-022).

Change ``plantillas-mapeo-y-normalizacion``, task 3.1 (phase 1 of design D1): templates are
stored as ``MappingSpec`` v1 and read back with ``read_mapping``, so the seed template keeps
working. The API speaks ``ColumnMapping`` only; v1 never leaves this module. Deleting is
logical (RN-005) and the deleted template shows up in the trash (``audit/trash.py``).
"""

import hashlib
import unicodedata
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.modules.audit.context import require_audit_context
from app.modules.identification.normalization import canonical
from app.modules.imports.mapping import (
    IDENTIFIER_TARGET,
    TERMS_TARGET,
    FieldTarget,
    IdentifiersTarget,
    IdentifierTarget,
    MappingContext,
    MappingConversionError,
    MappingSpecV1,
    TermsTarget,
    from_column_mappings,
    read_mapping,
    validate_mapping,
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
    session: Session, columns: Sequence[ColumnMapping], headers: Sequence[str]
) -> MappingSpecV1:
    """``ColumnMapping`` -> v1, validated against the headers and the reference data."""
    try:
        spec = from_column_mappings(columns)
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


def column_mappings(template: ImportMappingTemplate) -> list[ColumnMapping]:
    """The stored mapping (v1, or an older form converted by ``read_mapping``) as the API sees
    it: the inverse of ``from_column_mappings``."""
    spec = read_mapping(template.mapping)
    result: list[ColumnMapping] = []
    for column in spec.columns:
        target = column.target
        identifier_type: str | None = None
        split_compound = False
        if isinstance(target, FieldTarget):
            target_field: str | None = target.name
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
            )
        )
    return result


def _check_name_free(session: Session, name: str, exclude: uuid.UUID | None = None) -> None:
    """Unique among the active templates, ignoring case and accents [SUPUESTO S9]."""
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
) -> ImportMappingTemplate:
    require_audit_context(session)
    _check_name_free(session, name)
    spec = build_spec(session, columns, headers)
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
) -> ImportMappingTemplate:
    require_audit_context(session)
    if (headers is None) != (columns is None):
        raise ValidationFailed(
            "Envíe juntas las cabeceras y las columnas: el mapeo se valida contra las cabeceras.",
            code="headers_and_columns_required",
        )
    if name is not None:
        _check_name_free(session, name, exclude=template.id)
        template.name = name.strip()
    if source_name is not None:
        template.source_name = source_name.strip()
    if headers is not None and columns is not None:
        template.mapping = build_spec(session, columns, headers).as_json()
        template.header_signature = header_signature(headers)
    if description_set:
        template.description = description
    session.flush()
    return template


def delete_template(session: Session, template: ImportMappingTemplate, reason: str | None) -> None:
    """Logical deletion with a reason (RN-005): batches keep ``template_id`` and their mapping."""
    from app.modules.audit.soft_delete import soft_delete

    require_audit_context(session)
    soft_delete(session, template, reason)
