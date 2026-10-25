"""Spec identificacion-piezas — Parámetros de normalización administrables, en la búsqueda y las
siglas (RN-010, RF-023, RF-031).

Change plantillas-mapeo-y-normalizacion, task 2.2 step D (design D5): ``code_candidates`` and
the search filters use the current aliases, and ``find_collection_by_code`` resolves a
historical acronym. Synthetic data only (RNF-014); ``REP`` -> ``LRM`` is illustrative
[SUPUESTO A3].
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import code_candidates, identifier_match_condition
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Collection
from app.modules.collections.service import find_collection_by_code
from app.modules.identification.models import CollectionAcronymAlias
from app.modules.identification.normalization import DEFAULT_PARAMS, NormalizationParams
from app.modules.identification.service import add_identifier
from app.modules.search.filters import PieceFilter
from tests.conftest import ActAs

REP_LRM = NormalizationParams(acronym_aliases={"REP": "LRM"})


def _collection(session: Session, acronym: str) -> Collection:
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


def _alias(session: Session, alias: str, collection: Collection) -> CollectionAcronymAlias:
    row = CollectionAcronymAlias(
        id=new_uuid(), alias=alias, alias_normalized=alias, collection_id=collection.id
    )
    session.add(row)
    session.flush()
    return row


# --- candidatos de código ------------------------------------------------------------------


def test_candidates_add_the_alias_form_to_the_default_ones() -> None:
    default = code_candidates("REP 12")
    assert "REP 12" in default and "LRM 12" not in default
    with_alias = code_candidates("R.E.P. 012", params=REP_LRM)
    assert {"LRM 12", "REP 12"} <= with_alias
    assert code_candidates("REP 12", params=DEFAULT_PARAMS) == default


# --- sigla histórica en find_collection_by_code ----------------------------------------------


def test_a_historical_acronym_resolves_to_its_collection(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        assert find_collection_by_code(session, "REP") is None
        _alias(session, "REP", lrm)
    assert find_collection_by_code(session, "r.e.p.") is lrm
    assert find_collection_by_code(session, "LRM") is lrm


def test_a_current_acronym_wins_over_an_alias(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        rep = _collection(session, "REP")
        _alias(session, "REP", lrm)
    assert find_collection_by_code(session, "REP") is rep


def test_a_deleted_alias_no_longer_resolves(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        alias = _alias(session, "REP", lrm)
        assert find_collection_by_code(session, "REP") is lrm
        soft_delete(session, alias, "Alias de prueba (sintético)")
        session.flush()
    assert find_collection_by_code(session, "REP") is None


# --- filtros de la búsqueda ----------------------------------------------------------------


def _ids(session: Session, condition) -> set:  # type: ignore[no-untyped-def,type-arg]
    return set(session.scalars(select(Piece.id).where(condition)))


def test_the_search_finds_current_and_older_codes_through_the_alias(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        before = create_piece(session, denomination="Charango", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, before, "COLECCION", "REP 12")  # stored before the alias
        after = create_piece(session, denomination="Quena", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, after, "COLECCION", "LRM 12")
        session.flush()
        assert _ids(session, PieceFilter(q="REP 12").to_where(session)) == {before.id}
        _alias(session, "REP", lrm)
        session.flush()

    assert _ids(session, PieceFilter(q="REP 12").to_where(session)) == {before.id, after.id}
    assert _ids(session, identifier_match_condition("REP 12")) == {before.id}


def test_the_collection_code_filter_accepts_a_historical_acronym(
    session: Session, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session, "LRM")
        piece = create_piece(
            session, denomination="Tabla", tenure_regime=TenureRegime.OWNED, collection_id=lrm.id
        )
        session.flush()
        assert _ids(session, PieceFilter(collection_code="REP").to_where(session)) == set()
        _alias(session, "REP", lrm)
    assert _ids(session, PieceFilter(collection_code="REP").to_where(session)) == {piece.id}
