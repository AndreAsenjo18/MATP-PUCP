"""Spec identificacion-piezas — ``POST /identifiers/normalize`` con los parámetros vigentes
(RN-010, RF-023).

Change plantillas-mapeo-y-normalizacion, task 2.2 step C (design D5): the preview of a cell
uses the current markers, separators and aliases, as the import does. Own module: the
``pipeline`` fixture gives it its own seeded database, so the parameters written here do not
reach other modules. Synthetic data only (RNF-014); ``NO REGISTRA`` and ``REP`` are
illustrative [SUPUESTO A5, A3].
"""

from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser, Collection
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    CollectionAcronymAlias,
    NormalizationSetting,
)
from app.modules.identification.normalization import ABSENCE_MARKERS
from tests.api.conftest import Pipeline

URL = "/api/v1/identifiers/normalize"


def _normalize(pipeline: Pipeline, value: str) -> dict:  # type: ignore[type-arg]
    response = pipeline.client.post(URL, json={"value": value})
    assert response.status_code == 200, response.text
    return response.json()


def test_the_preview_follows_the_current_parameters(pipeline: Pipeline) -> None:
    before = _normalize(pipeline, "NO REGISTRA")
    assert before["is_absence_marker"] is False
    assert [p["normalized"] for p in _normalize(pipeline, "REP 12, I-3")["proposals"]] == [
        "REP 12",
        "I-3",
    ]

    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == "admin@matp.local"))
        assert admin is not None
        lrm = session.scalar(select(Collection).where(Collection.acronym_normalized == "LRM"))
        assert lrm is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            session.add_all(
                [
                    NormalizationSetting(
                        id=new_uuid(),
                        key=ABSENCE_MARKERS_KEY,
                        value=[*ABSENCE_MARKERS, "NO REGISTRA"],
                    ),
                    NormalizationSetting(
                        id=new_uuid(),
                        key=CONCATENATION_SEPARATORS_KEY,
                        value={"separators": ["/", ";"], "unsplit_markers": ["S/N", "S/C"]},
                    ),
                    CollectionAcronymAlias(
                        id=new_uuid(), alias="REP", alias_normalized="REP", collection_id=lrm.id
                    ),
                ]
            )
            session.commit()

    after = _normalize(pipeline, "no registra")
    assert after["is_absence_marker"] is True
    assert after["proposals"] == []
    [proposal] = _normalize(pipeline, "REP 12, I-3")["proposals"]  # the comma no longer splits
    assert proposal["original"] == "REP 12, I-3"
    split = _normalize(pipeline, "REP 12 / I-3")["proposals"]
    assert [(p["type_code"], p["normalized"]) for p in split] == [
        ("COLECCION", "LRM 12"),
        ("I", "I-3"),
    ]
