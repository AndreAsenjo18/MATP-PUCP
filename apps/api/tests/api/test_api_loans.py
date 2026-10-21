"""Contract stubs for loans remain visible while K1 is pending."""

from tests.api.conftest import LoginAs


def test_loan_contract_stubs_return_501(login_as: LoginAs) -> None:
    client = login_as("ADMIN")
    for method, path in (
        ("get", "/api/v1/loans"),
        ("post", "/api/v1/loans"),
        ("put", "/api/v1/loans/01920000-0000-7000-8000-000000000040/status"),
    ):
        response = getattr(client, method)(path)
        assert response.status_code == 501
        assert response.json()["change"] == "prestamos-y-exposiciones"
