"""Helpers for the end-to-end tests of the normalization parameters (change
plantillas-mapeo-y-normalizacion, task 2.2 step E; design D5).

Until the administration operations exist (task 2.3) the parameters are written with the ORM,
under the audit context of the synthetic administrator, into the database of the ``pipeline``
fixture of each module. Synthetic data only (RNF-014).
"""

import io
import uuid
from collections.abc import Sequence
from typing import Any

from openpyxl import Workbook
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser, Collection, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    CollectionAcronymAlias,
    NormalizationSetting,
)
from app.modules.identification.service import add_identifier
from tests.api.conftest import Pipeline

ADMIN_EMAIL = "admin@matp.local"


def set_params(
    pipeline: Pipeline,
    *,
    absence_markers: Sequence[str] | None = None,
    separators: Sequence[str] | None = None,
    unsplit_markers: Sequence[str] = ("S/N", "S/C"),
    aliases: Sequence[tuple[str, str]] = (),
) -> None:
    """Store parameter rows and ``(alias, collection acronym)`` aliases, as task 2.3 will."""
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN_EMAIL))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            if absence_markers is not None:
                session.add(
                    NormalizationSetting(
                        id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=list(absence_markers)
                    )
                )
            if separators is not None:
                session.add(
                    NormalizationSetting(
                        id=new_uuid(),
                        key=CONCATENATION_SEPARATORS_KEY,
                        value={
                            "separators": list(separators),
                            "unsplit_markers": list(unsplit_markers),
                        },
                    )
                )
            for alias, acronym in aliases:
                collection = session.scalar(
                    select(Collection).where(Collection.acronym_normalized == acronym)
                )
                assert collection is not None, acronym
                session.add(
                    CollectionAcronymAlias(
                        id=new_uuid(),
                        alias=alias,
                        alias_normalized=alias,
                        collection_id=collection.id,
                    )
                )
            session.commit()


def sheet(headers: list[str], rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    assert worksheet is not None
    worksheet.append(headers)
    for row in rows:
        worksheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def collection_id(pipeline: Pipeline, acronym: str) -> str:
    with pipeline.session() as session:
        found = session.scalar(
            select(Collection.id).where(Collection.acronym_normalized == acronym)
        )
        assert found is not None, acronym
        return str(found)


def add_identifier_as_admin(pipeline: Pipeline, piece_id: str, type_code: str, value: str) -> str:
    """``POST /pieces/{id}/identifiers`` is still a stub of ``ficha-pieza-crud``: the service."""
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN_EMAIL))
        assert admin is not None
        piece = session.get(Piece, uuid.UUID(piece_id))
        assert piece is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            identifier = add_identifier(session, piece, type_code, value, source="Prueba")
            normalized = identifier.normalized_value
            session.commit()
    assert normalized is not None
    return normalized
