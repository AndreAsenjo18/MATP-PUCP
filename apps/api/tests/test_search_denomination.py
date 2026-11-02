"""«Denominación» among the main search filters (fusion-busqueda-deposito 2.1; RF-032).

Spec busqueda-reportes, «Filtros priorizados en la búsqueda»; design D1. Synthetic data only
(RNF-014).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.search.filters import PieceFilter
from tests.conftest import ActAs


def _matching(session: Session, piece_filter: PieceFilter) -> set[str]:
    pieces = session.scalars(select(Piece).where(piece_filter.to_where(session))).all()
    return {piece.denomination for piece in pieces}


def _pieces(session: Session, act_as: ActAs, *names: str) -> None:
    with act_as("CATALOGUER"):
        for name in names:
            session.add(Piece(id=new_uuid(), denomination=name, tenure_regime=TenureRegime.OWNED))
        session.commit()


def test_the_denomination_filter_ignores_case_and_accents(session: Session, act_as: ActAs) -> None:
    _pieces(session, act_as, "Mate burilado sintético", "Máscara de diablo sintética", "Retablo")

    assert _matching(session, PieceFilter(denomination="MATE")) == {"Mate burilado sintético"}
    assert _matching(session, PieceFilter(denomination="mascara")) == {
        "Máscara de diablo sintética"
    }


def test_the_denomination_does_not_look_at_other_fields(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        session.add(
            Piece(
                id=new_uuid(),
                denomination="Calabaza sintética",
                description="Usada como mate.",
                author="Mate Huamán",
                tenure_regime=TenureRegime.OWNED,
            )
        )
        session.commit()

    assert _matching(session, PieceFilter(denomination="mate")) == set()
    assert _matching(session, PieceFilter(q="mate")) == {"Calabaza sintética"}


def test_a_denomination_without_results_is_an_active_filter(
    session: Session, act_as: ActAs
) -> None:
    _pieces(session, act_as, "Retablo sintético")
    piece_filter = PieceFilter(denomination="xyz")

    assert _matching(session, piece_filter) == set()
    (active,) = piece_filter.describe(session)
    assert (active.key, active.label, active.value_display) == (
        "denomination",
        "Denominación",
        "xyz",
    )
