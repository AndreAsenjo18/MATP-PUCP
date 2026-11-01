"""`description` in GET /search and GET /pieces (fusion-busqueda-deposito 1.1; RF-031, RF-032).

Spec busqueda-reportes, «Búsqueda en la descripción de la pieza». The seed gives its pieces a
synthetic description («… Descripción sintética de demostración.»). Synthetic data only (RNF-014).
"""

from tests.api.conftest import LoginAs


def test_search_and_listing_filter_by_the_description(login_as: LoginAs) -> None:
    client = login_as("CATALOGUER")
    params = {"description": "DESCRIPCION sintetica de demostracion", "limit": 100}

    search = client.get("/api/v1/search", params=params)
    listing = client.get("/api/v1/pieces", params=params)
    everything = client.get("/api/v1/pieces", params={"limit": 1}).json()["total"]

    assert search.status_code == 200, search.text
    assert listing.status_code == 200, listing.text
    assert 0 < search.json()["total"] == listing.json()["total"] < everything


def test_no_result_lists_the_description_among_the_active_filters(login_as: LoginAs) -> None:
    client = login_as("CATALOGUER")

    page = client.get(
        "/api/v1/search",
        params={"description": "zzz-sin-coincidencias", "tenure_regime": "Comodato"},
    ).json()

    assert page["total"] == 0
    active = {item["key"]: item for item in page["active_filters"]}
    assert active["description"]["label"] == "Descripción"
    assert active["description"]["value_display"] == "zzz-sin-coincidencias"
    assert "remove_filter:description" in page["suggestions"]


def test_a_too_long_description_is_rejected(login_as: LoginAs) -> None:
    client = login_as("CATALOGUER")

    assert client.get("/api/v1/search", params={"description": "x" * 201}).status_code == 422
