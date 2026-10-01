"""Contract stubs for loans remain visible while K1 is pending."""

from fastapi.testclient import TestClient

from tests.api.conftest import ADMIN, as_user


def test_loan_contract_stubs_return_501(client: TestClient) -> None:
    for method, path in (
        ("get", "/api/v1/loans"),
        ("post", "/api/v1/loans"),
        ("put", "/api/v1/loans/01920000-0000-7000-8000-000000000040/status"),
    ):
        response = getattr(client, method)(path, headers=as_user(ADMIN))
        assert response.status_code == 501
        assert response.json()["change"] == "prestamos-y-exposiciones"
