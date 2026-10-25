"""Spec identificacion-piezas — Parámetros de normalización administrables, servicio (RN-010,
RF-023).

Change plantillas-mapeo-y-normalizacion, task 2.3 (design D5): after a parameter or an alias is
saved, ``session_params`` of the same session sees it (the flush drops the cached copy), and
the impact of a change only counts stored identifiers that would change. Synthetic data only
(RNF-014); ``NO REGISTRA`` and ``REP`` are illustrative [SUPUESTO A5, A3].
"""

import pytest
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Collection
from app.modules.identification.models import ABSENCE_MARKERS_KEY
from app.modules.identification.normalization import ABSENCE_MARKERS, normalize_for_type
from app.modules.identification.params import session_params
from app.modules.identification.params_admin import create_alias, delete_alias, save_setting
from app.modules.identification.service import add_identifier
from tests.conftest import ActAs


def _collection(session: Session, acronym: str | None) -> Collection:
    collection = Collection(
        id=new_uuid(),
        name=f"Colección sintética {acronym}",
        acronym=acronym,
        acronym_normalized=acronym,
        default_tenure_regime=TenureRegime.OWNED,
    )
    session.add(collection)
    session.flush()
    return collection


def test_session_params_see_a_saved_marker_in_the_same_session(
    session: Session, act_as: ActAs
) -> None:
    assert "NOREGISTRA" not in session_params(session).absence_markers
    with act_as("ADMIN"):
        save_setting(session, ABSENCE_MARKERS_KEY, [*ABSENCE_MARKERS, "NO REGISTRA"])
    assert "NOREGISTRA" in session_params(session).absence_markers


def test_session_params_see_a_saved_and_a_deleted_alias(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        alias = create_alias(session, "R.E.P.", lrm.id)
    params = session_params(session)
    assert normalize_for_type("COLECCION", "REP 12", params=params).normalized == "LRM 12"
    with act_as("ADMIN"):
        delete_alias(session, alias, "Prueba (sintética)")
        session.flush()
    assert "REP" not in session_params(session).acronym_aliases


def test_an_alias_of_a_collection_without_acronym_does_not_touch_codes(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        plain = _collection(session, None)
        piece = create_piece(session, denomination="Tabla", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, piece, "COLECCION", "XYZ 3")
        create_alias(session, "XYZ", plain.id)  # no 409: the code XYZ 3 does not change
    assert session_params(session).alias_collection_ids == {"XYZ": plain.id}


def test_nothing_is_saved_when_the_change_requires_the_preview(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        piece = create_piece(session, denomination="Charango", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, piece, "COLECCION", "REP 4")
        with pytest.raises(ConflictError) as raised:
            create_alias(session, "REP", lrm.id)
    assert raised.value.code == "normalization_change_requires_preview"
    assert raised.value.details["affected"] == 1
    assert session_params(session).acronym_aliases == {}
