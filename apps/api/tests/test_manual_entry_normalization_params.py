"""Spec identificacion-piezas — Parámetros de normalización administrables, en el ingreso manual
(RN-010, RF-023, RF-004, RN-002).

Change plantillas-mapeo-y-normalizacion, task 2.2 step C (design D5): the sheet validation, the
identifier services and ``POST /identifiers/normalize`` use the current parameters of the
session. Synthetic data only (RNF-014); ``NO REGISTRA`` and ``REP`` are illustrative
[SUPUESTO A5, A3].
"""

from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, validate_piece_payload
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CollectionAcronymAlias,
    NormalizationSetting,
)
from app.modules.identification.normalization import ABSENCE_MARKERS
from app.modules.identification.service import (
    add_identifier,
    current_identifiers,
    set_inventory_code,
)
from tests.conftest import ActAs


def _store_params(session: Session) -> None:
    lrm = Collection(
        id=new_uuid(),
        name="Colección sintética",
        acronym="LRM",
        acronym_normalized="LRM",
        default_tenure_regime=TenureRegime.OWNED,
    )
    session.add(lrm)
    session.add_all(
        [
            NormalizationSetting(
                id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=[*ABSENCE_MARKERS, "NO REGISTRA"]
            ),
            CollectionAcronymAlias(
                id=new_uuid(), alias="REP", alias_normalized="REP", collection_id=lrm.id
            ),
        ]
    )
    session.flush()


def _codes(issues: list) -> list[str]:  # type: ignore[type-arg]
    return [issue.code for issue in issues if issue.field == "code_i"]


def test_the_sheet_treats_a_new_marker_as_no_code_i(session: Session, act_as: ActAs) -> None:
    before = validate_piece_payload(
        session, denomination="Soga", tenure_regime=TenureRegime.OWNED, code_i="NO REGISTRA"
    )
    assert "absence_marker" not in _codes(before)
    with act_as("ADMIN"):
        _store_params(session)

    after = validate_piece_payload(
        session, denomination="Soga", tenure_regime=TenureRegime.OWNED, code_i="No registra"
    )
    assert _codes(after) == ["absence_marker"]


def test_creating_a_piece_with_the_new_marker_registers_no_code_i(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        _store_params(session)
        piece = create_piece(
            session, denomination="Soga", tenure_regime=TenureRegime.OWNED, code_i="NO REGISTRA"
        )
        assert set_inventory_code(session, piece, "no registra") is None
    assert current_identifiers(session, piece, "I") == []


def test_a_collection_code_with_an_alias_is_stored_with_the_current_acronym(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        piece = create_piece(session, denomination="Charango", tenure_regime=TenureRegime.OWNED)
        before = add_identifier(session, piece, "COLECCION", "REP 11")
        _store_params(session)
        after = add_identifier(session, piece, "COLECCION", "R.E.P. 012")
    assert before.normalized_value == "REP 11"
    assert after.original_value == "R.E.P. 012" and after.normalized_value == "LRM 12"
