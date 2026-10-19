"""Spec busqueda-reportes / catalogo-piezas — lectura de piezas, filtros AND y búsqueda básica."""

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import Collection, Piece, PieceIdentifier
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.normalization import TYPE_INVENTORY
from tests.api.conftest import ADMIN, CATALOGUER, SeededApi, as_user

H = as_user(CATALOGUER)


def test_list_excludes_soft_deleted_and_paginates(seeded_api: SeededApi) -> None:
    summary = seeded_api.summary
    client = seeded_api.client
    first = client.get("/api/v1/pieces?page_size=50", headers=H).json()
    assert first["total"] == summary.pieces - summary.soft_deleted_pieces
    assert len(first["items"]) == 50
    second = client.get("/api/v1/pieces?page_size=50&page=2", headers=H).json()
    assert {p["id"] for p in first["items"]}.isdisjoint({p["id"] for p in second["items"]})
    titles = [p["title"] for p in first["items"]]
    assert titles == sorted(titles)


def test_deleted_piece_detail_is_404(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        deleted = session.scalar(
            select(Piece.id)
            .where(Piece.deleted_at.is_not(None))
            .execution_options(**{INCLUDE_DELETED: True})
            .limit(1)
        )
    response = seeded_api.client.get(f"/api/v1/pieces/{deleted}", headers=H)
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert "title" not in response.json()


def test_combined_filters_are_and(client: TestClient) -> None:
    response = client.get(
        "/api/v1/pieces?tenure_regime=Comodato&has_inventory_code=false&page_size=100",
        headers=H,
    ).json()
    assert response["total"] > 0
    for item in response["items"]:
        assert item["tenure_regime"] == "Comodato"
        assert item["inventory_code"] is None
    impossible = client.get(
        "/api/v1/pieces?tenure_regime=Comodato&has_inventory_code=true", headers=H
    ).json()
    assert impossible["total"] == 0  # RN-003: comodato nunca tiene I


def test_collection_filter_includes_subcollections(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        parent = session.scalar(select(Collection).where(Collection.acronym_normalized == "RA"))
        child = session.scalar(select(Collection).where(Collection.acronym_normalized == "RAB"))
    client = seeded_api.client
    parent_total = client.get(f"/api/v1/pieces?collection_id={parent.id}", headers=H).json()
    child_total = client.get(f"/api/v1/pieces?collection_id={child.id}", headers=H).json()
    assert child_total["total"] > 0
    assert parent_total["total"] > child_total["total"]
    loose = client.get("/api/v1/pieces?without_collection=true&page_size=100", headers=H).json()
    assert loose["total"] > 0
    assert all(item["collection"] is None for item in loose["items"])


def _piece_with_inventory_code(seeded_api: SeededApi) -> PieceIdentifier:
    with seeded_api.session() as session:
        identifier = session.scalar(
            select(PieceIdentifier)
            .join(Piece, Piece.id == PieceIdentifier.piece_id)
            .where(
                PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
                PieceIdentifier.is_current.is_(True),
                PieceIdentifier.normalized_value.is_not(None),
                Piece.deleted_at.is_(None),
            )
            .limit(1)
        )
        assert identifier is not None
        session.expunge(identifier)
        return identifier


def test_search_by_code_written_differently(seeded_api: SeededApi) -> None:
    identifier = _piece_with_inventory_code(seeded_api)
    number = identifier.normalized_value.split("-")[1]
    dirty = f"i  {number.zfill(5)}"  # other separator, lowercase, leading zeros
    response = seeded_api.client.get("/api/v1/search", params={"q": dirty}, headers=H)
    assert response.status_code == 200
    hits = response.json()["items"]
    match = next(hit for hit in hits if hit["piece"]["id"] == str(identifier.piece_id))
    assert match["match_type"] == "IDENTIFIER"
    assert match["matched_identifier"]["normalized_value"] == identifier.normalized_value

    listed = seeded_api.client.get("/api/v1/pieces", params={"q": dirty}, headers=H).json()
    assert str(identifier.piece_id) in {item["id"] for item in listed["items"]}


def test_search_by_title_fragment(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        title = session.scalar(
            select(Piece.denomination).where(Piece.deleted_at.is_(None)).limit(1)
        )
    fragment = title.split()[0].lower()
    hits = seeded_api.client.get("/api/v1/search", params={"q": fragment}, headers=H).json()
    assert hits["total"] > 0
    assert any(hit["match_type"] == "TITLE" for hit in hits["items"])


def test_search_without_results(client: TestClient) -> None:
    body = client.get("/api/v1/search", params={"q": "ZZZ-NO-EXISTE-999"}, headers=H).json()
    assert body == {"items": [], "total": 0, "page": 1, "limit": 20}


def test_search_combines_collection_and_tenure_regime_filters(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        piece = session.scalar(
            select(Piece)
            .join(Collection, Collection.id == Piece.collection_id)
            .where(
                Collection.acronym_normalized == "AJB",
                Piece.tenure_regime == TenureRegime.LOAN_FOR_USE,
                Piece.deleted_at.is_(None),
            )
            .limit(1)
        )
        assert piece is not None
        fragment = piece.denomination.split()[0].lower()

    response = seeded_api.client.get(
        "/api/v1/search",
        params={
            "q": fragment,
            "collection_code": "A.J.B.",  # código "sucio": debe normalizar igual que "AJB"
            "tenure_regime": "Comodato",
        },
        headers=H,
    ).json()
    assert response["total"] > 0
    for hit in response["items"]:
        assert hit["piece"]["tenure_regime"] == "Comodato"

    # Un régimen que no coincide con la colección filtrada no debe devolver nada.
    mismatched = seeded_api.client.get(
        "/api/v1/search",
        params={"q": fragment, "collection_code": "AJB", "tenure_regime": "Propiedad"},
        headers=H,
    ).json()
    assert mismatched["total"] == 0


def test_search_unknown_collection_code_returns_empty(client: TestClient) -> None:
    body = client.get(
        "/api/v1/search", params={"q": "cualquiera", "collection_code": "NO-EXISTE"}, headers=H
    ).json()
    assert body == {"items": [], "total": 0, "page": 1, "limit": 20}


def test_search_pagination_respects_limit_and_page(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        title = session.scalar(
            select(Piece.denomination).where(Piece.deleted_at.is_(None)).limit(1)
        )
    fragment = title.split()[0].lower()
    client = seeded_api.client

    first = client.get(
        "/api/v1/search", params={"q": fragment, "limit": 1, "page": 1}, headers=H
    ).json()
    assert first["limit"] == 1
    assert first["page"] == 1
    assert len(first["items"]) <= 1

    if first["total"] > 1:
        second = client.get(
            "/api/v1/search", params={"q": fragment, "limit": 1, "page": 2}, headers=H
        ).json()
        assert second["items"][0]["piece"]["id"] != first["items"][0]["piece"]["id"]


def test_piece_detail_and_sub_resources(seeded_api: SeededApi) -> None:
    identifier = _piece_with_inventory_code(seeded_api)
    client = seeded_api.client
    piece_id = identifier.piece_id
    detail = client.get(f"/api/v1/pieces/{piece_id}", headers=as_user(ADMIN)).json()
    assert detail["inventory_code"] == identifier.original_value
    assert detail["period"].keys() >= {"text", "type", "year_from", "year_to"}
    locked = [item for item in detail["identifiers"] if item["identifier_type_code"] == "I"]
    assert locked and locked[0]["is_locked"] is True

    identifiers = client.get(
        f"/api/v1/pieces/{piece_id}/identifiers?include_history=true", headers=H
    )
    assert identifiers.status_code == 200
    assert len(identifiers.json()) >= len(detail["identifiers"])

    media = client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    assert len(media) == detail["media_count"]
    assert [m["sort_order"] for m in media] == sorted(m["sort_order"] for m in media)

    assert client.get(f"/api/v1/pieces/{piece_id}/location-history", headers=H).status_code == 200
    assert client.get(f"/api/v1/pieces/{piece_id}/source-records", headers=H).status_code == 200


def test_normalize_preview_splits_compound_cell(client: TestClient) -> None:
    body = client.post(
        "/api/v1/identifiers/normalize", json={"value": "I 2362 / M.M.Z. 015"}, headers=H
    ).json()
    assert [(p["type_code"], p["normalized"]) for p in body["proposals"]] == [
        ("I", "I-2362"),
        ("COLECCION", "MMZ 15"),
    ]
    assert all(p["requires_confirmation"] for p in body["proposals"])
    absent = client.post("/api/v1/identifiers/normalize", json={"value": "S/N"}, headers=H).json()
    assert absent["is_absence_marker"] is True
    assert absent["proposals"] == []
