"""Selección del proveedor de identidad por configuración (RNF-012).

Change de OpenSpec: autenticacion-y-matriz-permisos (tarea 2.5; ADR-009 decisión D8).
El proveedor local está implementado; el de la cuenta PUCP (OIDC) es un stub documentado.
"""

import pytest

from app.core.config import ConfigurationError, Settings, load_settings
from app.modules.users.identity import (
    Credentials,
    IdentityProvider,
    IdentityProviderKind,
    IdentityProviderUnavailable,
    LocalPasswordProvider,
    OidcProvider,
    get_identity_provider,
)

BASE = {
    "app_env": "test",
    "database_url": "sqlite+pysqlite:///:memory:",
    "s3_bucket": "matp-test",
}


def _settings(**overrides: object) -> Settings:
    return load_settings(**{**BASE, **overrides})


def test_local_provider_is_the_default() -> None:
    settings = _settings()
    assert settings.auth_provider == "local"
    provider = get_identity_provider(settings)
    assert isinstance(provider, LocalPasswordProvider)
    assert provider.kind is IdentityProviderKind.LOCAL


def test_configuration_selects_the_oidc_provider() -> None:
    provider = get_identity_provider(_settings(auth_provider="oidc"))
    assert isinstance(provider, OidcProvider)
    assert provider.kind is IdentityProviderKind.OIDC


def test_unknown_provider_is_rejected_by_configuration() -> None:
    with pytest.raises(ConfigurationError) as excinfo:
        _settings(auth_provider="saml")
    assert "AUTH_PROVIDER" in str(excinfo.value)


def test_both_providers_satisfy_the_interface() -> None:
    assert isinstance(LocalPasswordProvider(), IdentityProvider)
    assert isinstance(OidcProvider(), IdentityProvider)


def test_local_provider_normalizes_the_email_into_the_subject() -> None:
    identity = get_identity_provider(_settings()).authenticate(
        Credentials(email="  Catalogador@MATP.local  ", password="retablo-de-ayacucho-7")
    )
    assert identity.subject == "catalogador@matp.local"
    assert identity.email == "catalogador@matp.local"
    assert identity.provider is IdentityProviderKind.LOCAL
    # El proveedor nunca entrega roles: la autorización es siempre local (RNF-012).
    assert not hasattr(identity, "roles")


def test_local_provider_requires_credentials() -> None:
    provider = LocalPasswordProvider()
    with pytest.raises(IdentityProviderUnavailable) as excinfo:
        provider.authenticate(None)
    assert excinfo.value.code == "credentials_required"
    with pytest.raises(IdentityProviderUnavailable):
        provider.authenticate(Credentials(email="   ", password="x"))


def test_oidc_provider_is_a_stub_that_says_so_in_spanish() -> None:
    with pytest.raises(IdentityProviderUnavailable) as excinfo:
        get_identity_provider(_settings(auth_provider="oidc")).authenticate(
            Credentials(email="catalogador@matp.local", password="retablo-de-ayacucho-7")
        )
    assert excinfo.value.code == "identity_provider_unavailable"
    assert "PUCP" in excinfo.value.message
