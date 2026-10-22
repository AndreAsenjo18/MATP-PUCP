"""Tests for search ranking, match explanation, suggestions and alerts (RF-031, RF-032)."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import NotImplementedEndpoint
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    INVENTORY_CODE_TYPE,
    NormalizationStatus,
    PieceIdentifier,
)
from app.modules.search.filters import PieceFilter, register_alert_predicate
from app.modules.search.ranking import (
    generate_search_suggestions,
    rank_and_describe_pieces,
)


def test_scenario_exact_code_first(session: Session, act_as) -> None:
    """GIVEN una pieza con codigo MMZ 15 y otra con la palabra 'mmz15' en su denominacion,

    WHEN un usuario busca 'M.M.Z. 15',
    THEN la pieza con el codigo aparece primero indicando la coincidencia por codigo.
    """
    with act_as("CATALOGUER"):
        coll = Collection(name="Coleccion MMZ", acronym="MMZ", acronym_normalized="MMZ")
        session.add(coll)
        session.flush()

        # Piece A: has the identifier MMZ 15
        piece_a = Piece(
            denomination="Retablo tradicional",
            tenure_regime=TenureRegime.OWNED,
            collection_id=coll.id,
        )
        session.add(piece_a)
        session.flush()

        ident_a = PieceIdentifier(
            piece_id=piece_a.id,
            identifier_type_code="COLECCION",
            original_value="MMZ 15",
            normalized_value="MMZ 15",
            normalization_status=NormalizationStatus.NORMALIZED,
            is_current=True,
        )
        session.add(ident_a)

        # Piece B: has text 'mmz15' in denomination
        piece_b = Piece(
            denomination="Caja mmz15 de prueba",
            tenure_regime=TenureRegime.OWNED,
            collection_id=coll.id,
        )
        session.add(piece_b)
        session.flush()

        ident_b = PieceIdentifier(
            piece_id=piece_b.id,
            identifier_type_code=INVENTORY_CODE_TYPE,
            original_value="I-9999",
            normalized_value="I-9999",
            normalization_status=NormalizationStatus.NORMALIZED,
            is_current=True,
        )
        session.add(ident_b)
        session.commit()

    viewer = Viewer(permissions=frozenset({"pieces.read"}))
    reader = CatalogReader(session, viewer)

    # Search for 'M.M.Z. 15'
    f = PieceFilter(q="M.M.Z. 15")
    where_clause = f.to_where(session, viewer)
    matched_pieces = session.scalars(select(Piece).where(where_clause)).all()

    assert len(matched_pieces) >= 2
    summaries = reader.summaries(matched_pieces)
    hits = rank_and_describe_pieces(session, matched_pieces, summaries, "M.M.Z. 15")

    # Piece A MUST be first
    assert hits[0].piece.id == piece_a.id
    assert hits[0].match_type == "IDENTIFIER"
    assert hits[0].match_reason["kind"] == "identifier"
    assert hits[0].match_reason["type"] == "COLECCION"
    assert hits[0].match_reason["original"] == "MMZ 15"
    assert hits[0].match_reason["historical"] is False

    # Piece B is second, matched by denomination text
    assert hits[1].piece.id == piece_b.id
    assert hits[1].match_type == "TITLE"
    assert hits[1].match_reason["kind"] == "text"
    assert "denomination" in hits[1].match_reason["fields"]


def test_scenario_text_with_and_without_accents(session: Session, act_as) -> None:
    """WHEN un usuario busca 'CERAMICA huanuco',

    THEN encuentra piezas con 'Ceramica' y 'Huanuco'
e indica coincidencia en denominacion y procedencia.
    """
    with act_as("CATALOGUER"):
        piece = Piece(
            denomination="Cer\u00e1mica escult\u00f3rica zoomorfa",
            author="An\u00f3nimo",
            provenance="Provincia de Hu\u00e1nuco",
            tenure_regime=TenureRegime.OWNED,
        )
        session.add(piece)
        session.commit()

    viewer = Viewer(permissions=frozenset({"pieces.read"}))
    reader = CatalogReader(session, viewer)

    # Search with accents stripped and uppercase
    f = PieceFilter(q="CERAMICA huanuco")
    where_clause = f.to_where(session, viewer)
    matched_pieces = session.scalars(select(Piece).where(where_clause)).all()

    assert any(p.id == piece.id for p in matched_pieces)
    summaries = reader.summaries(matched_pieces)
    hits = rank_and_describe_pieces(session, matched_pieces, summaries, "CERAMICA huanuco")

    hit = next(h for h in hits if h.piece.id == piece.id)
    assert hit.match_reason["kind"] == "text"
    assert "denomination" in hit.match_reason["fields"]
    assert "provenance" in hit.match_reason["fields"]


def test_scenario_zero_results_with_suggestions(session: Session, act_as) -> None:
    """WHEN una busqueda con tres filtros activos no devuelve piezas,

    THEN la respuesta indica los filtros activos y sugiere acciones concretas.
    """
    with act_as("CATALOGUER"):
        coll = Collection(name="Coleccion Textil", acronym="TEX", acronym_normalized="TEX")
        session.add(coll)
        session.commit()

    # Search with 3 active filters: query, collection, tenure_regime
    f = PieceFilter(
        q="XYZ-INEXISTENTE-1234",
        collection_id=coll.id,
        tenure_regime=TenureRegime.LOAN_FOR_USE,
    )

    viewer = Viewer(permissions=frozenset({"pieces.read"}))
    where_clause = f.to_where(session, viewer)
    count = session.scalar(select(Piece.id).where(where_clause))
    assert count is None  # 0 hits

    suggestions, active_filters = generate_search_suggestions(f, "XYZ-INEXISTENTE-1234", total=0)

    # Active filters list is populated
    keys = {af.key for af in active_filters}
    assert "q" in keys
    assert "collection_id" in keys
    assert "tenure_regime" in keys

    # Suggestions provide actionable remove_filter and format checks
    assert "remove_filter:collection_id" in suggestions
    assert "remove_filter:tenure_regime" in suggestions
    assert "check_code_format" in suggestions
    assert "search_historical" in suggestions


def test_alert_filter_not_implemented_branch(session: Session) -> None:
    """Alert filter raises 501 when alertas-y-reporte-incompletas is not applied (RF-032)."""
    f = PieceFilter(has_alerts=True)
    with pytest.raises(NotImplementedEndpoint) as exc_info:
        f.to_where(session)
    assert exc_info.value.change == "alertas-y-reporte-incompletas"

    f2 = PieceFilter(alert_code="missing_photo")
    with pytest.raises(NotImplementedEndpoint) as exc_info2:
        f2.to_where(session)
    assert exc_info2.value.change == "alertas-y-reporte-incompletas"


def test_alert_filter_applied_branch(session: Session, act_as) -> None:
    """Alert filter applies predicate when registered (RF-032)."""
    with act_as("CATALOGUER"):
        p1 = Piece(denomination="Pieza con alerta", tenure_regime=TenureRegime.OWNED)
        p2 = Piece(denomination="Pieza normal", tenure_regime=TenureRegime.OWNED)
        session.add_all([p1, p2])
        session.commit()

    # Register mock predicate for missing_photo
    register_alert_predicate("missing_photo", lambda sess: Piece.id == p1.id)

    f = PieceFilter(alert_code="missing_photo")
    where_clause = f.to_where(session)
    pieces = session.scalars(select(Piece).where(where_clause)).all()
    assert len(pieces) == 1
    assert pieces[0].id == p1.id
