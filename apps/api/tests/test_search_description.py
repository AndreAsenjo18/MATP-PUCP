"""Search in the description of a piece (fusion-busqueda-deposito 1.1 and 1.2; RF-031, RF-032).

Spec busqueda-reportes, «Búsqueda en la descripción de la pieza»; design D1. The filter runs on the
SQLite test database with the accent-free comparison of the free text. Synthetic data only
(RNF-014).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceMaterial
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.search.filters import PieceFilter
from app.modules.search.ranking import rank_and_describe_pieces
from tests.conftest import ActAs


def _piece(
    session: Session, denomination: str, description: str | None = None, **fields: object
) -> Piece:
    piece = Piece(
        id=new_uuid(),
        denomination=denomination,
        description=description,
        tenure_regime=TenureRegime.OWNED,
        **fields,
    )
    session.add(piece)
    session.flush()
    return piece


def _material(session: Session, label: str) -> Term:
    vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.MATERIAL)
    )
    assert vocabulary is not None
    term = Term(id=new_uuid(), vocabulary_id=vocabulary.id, code=label.upper(), label=label)
    session.add(term)
    session.flush()
    return term


def _matching(session: Session, piece_filter: PieceFilter) -> set[str]:
    pieces = session.scalars(select(Piece).where(piece_filter.to_where(session))).all()
    return {piece.denomination for piece in pieces}


# ------------------------------------------------------------- task 1.1: the filter
def test_a_word_only_in_the_description_is_found_by_the_free_text(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        _piece(session, "Sombrero sintético", "Tejido en paja toquilla, ala ancha.")
        _piece(session, "Sombrero de fieltro sintético", "Copa alta y cinta negra.")
        session.commit()

    assert _matching(session, PieceFilter(q="PAJA toquilla")) == {"Sombrero sintético"}


def test_the_description_filter_combines_with_the_material(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        ceramica, textil = _material(session, "Cerámica"), _material(session, "Textil")
        jarra = _piece(session, "Jarra sintética", "Cuerpo globular con asa lateral.")
        manta = _piece(session, "Manta sintética", "Borde con asa de hilo.")
        cuenco = _piece(session, "Cuenco sintético", "Cuerpo globular sin decoración.")
        for piece, term in ((jarra, ceramica), (manta, textil), (cuenco, ceramica)):
            session.add(PieceMaterial(id=new_uuid(), piece_id=piece.id, term_id=term.id))
        session.commit()

    piece_filter = PieceFilter(material_id=ceramica.id, description="ASA")

    assert _matching(session, piece_filter) == {"Jarra sintética"}
    active = {item.key: item for item in piece_filter.describe(session)}
    assert set(active) == {"material_id", "description"}
    assert (active["description"].label, active["description"].value_display) == (
        "Descripción",
        "ASA",
    )


def test_pieces_without_description_are_left_out_without_error(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        _piece(session, "Plato sin descripción sintético")
        _piece(session, "Plato con descripción vacía sintético", "")
        _piece(session, "Plato con asa sintético", "Plato hondo con asa.")
        session.commit()

    assert _matching(session, PieceFilter(description="asa")) == {"Plato con asa sintético"}


def test_the_description_filter_ignores_accents_and_treats_wildcards_as_text(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        _piece(session, "Retablo sintético", "Escena de la cosecha, policromía.")
        _piece(session, "Mate sintético", "Burilado al 100% en la superficie.")
        session.commit()

    assert _matching(session, PieceFilter(description="policromia")) == {"Retablo sintético"}
    assert _matching(session, PieceFilter(description="100%")) == {"Mate sintético"}
    assert _matching(session, PieceFilter(description="_")) == set()


# ------------------------------------------------------------ task 1.2: the ranking
def _ranked(session: Session, q: str) -> list[tuple[str, list[str]]]:
    """The hits of the free text ``q`` in order, with the fields each one matched."""
    viewer = Viewer(permissions=frozenset({"pieces.read"}))
    pieces = list(session.scalars(select(Piece).where(PieceFilter(q=q).to_where(session, viewer))))
    summaries = CatalogReader(session, viewer).summaries(pieces)
    hits = rank_and_describe_pieces(session, pieces, summaries, q)
    return [(hit.piece.denomination, hit.match_reason["fields"]) for hit in hits]


def test_a_match_only_in_the_description_says_so(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        _piece(session, "Sombrero sintético", "Tejido en paja toquilla, ala ancha.")
        session.commit()

    assert _ranked(session, "paja toquilla") == [("Sombrero sintético", ["description"])]


def test_the_denomination_goes_before_a_match_only_in_the_description(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        # Alphabetically the description-only piece comes first: the order is the ranking's.
        _piece(session, "Calabaza sintética", "Usada como mate para servir bebidas.")
        _piece(session, "Mate burilado sintético", "Escenas de la vida en el campo.")
        session.commit()

    assert _ranked(session, "mate") == [
        ("Mate burilado sintético", ["denomination"]),
        ("Calabaza sintética", ["description"]),
    ]


def test_a_match_only_in_the_description_weighs_less_than_any_other_text_field(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        _piece(session, "Cuenco sintético A", "Decoración de Quinua en el borde.")
        _piece(session, "Cuenco sintético B", "Sin decoración.", provenance="Quinua, Ayacucho")
        session.commit()

    assert _ranked(session, "quinua") == [
        ("Cuenco sintético B", ["provenance"]),
        ("Cuenco sintético A", ["description"]),
    ]
