"""Identity providers: local password today, PUCP account tomorrow (ADR-009, decision D8).

RNF-012 asks for the system to be ready to sign in with the institutional PUCP account
"without redoing the management of roles". The seam that makes that possible is this one:
authentication answers *who* the person is (:class:`ExternalIdentity`), and authorization stays
local — roles and the permission matrix always live in this database, keyed by ``app_user``.

Only :class:`LocalPasswordProvider` is implemented. :class:`OidcProvider` is a documented stub
that raises, so the wiring, the configuration switch and the tests exist before the protocol
does; turning it on is a change of its own (and an ADR for the OIDC library).
"""

import enum
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.core.config import Settings
from app.core.errors import DomainError


class IdentityProviderKind(enum.StrEnum):
    """Value of ``AUTH_PROVIDER``; the local provider is the only one usable in phase 1."""

    LOCAL = "local"
    OIDC = "oidc"


@dataclass(frozen=True)
class Credentials:
    """What the user typed in, carried only as far as the provider."""

    email: str
    password: str


@dataclass(frozen=True)
class ExternalIdentity:
    """Who the provider says this is, before any local lookup.

    ``subject`` is the stable identifier of the account at the provider: for the local
    provider it is the normalized e-mail, and for OIDC it will be the ``sub`` claim, matched
    against ``app_user.external_subject``.
    """

    subject: str
    email: str
    provider: IdentityProviderKind
    full_name: str | None = None


class IdentityProviderUnavailable(DomainError):
    """The configured provider cannot authenticate anyone yet (OIDC stub)."""

    code = "identity_provider_unavailable"


@runtime_checkable
class IdentityProvider(Protocol):
    """Contract every provider implements. Roles are never provided here (RNF-012)."""

    kind: IdentityProviderKind

    def authenticate(self, credentials: Credentials | None) -> ExternalIdentity:
        """Return the external identity, or raise a :class:`DomainError` if it cannot."""
        ...


class LocalPasswordProvider:
    """E-mail and password checked against ``app_user.password_hash`` (Argon2).

    It only normalizes and shapes the identity: verifying the hash, counting failures and
    locking the account stay in the session service, which is the piece that owns the
    database and the :class:`~app.modules.users.models.AuthEvent` ledger (decision D3).
    """

    kind = IdentityProviderKind.LOCAL

    def authenticate(self, credentials: Credentials | None) -> ExternalIdentity:
        if credentials is None or not credentials.email.strip():
            raise IdentityProviderUnavailable(
                "Debe indicar su correo y contraseña para iniciar sesión.",
                code="credentials_required",
            )
        email = credentials.email.strip().lower()
        return ExternalIdentity(subject=email, email=email, provider=self.kind)


class OidcProvider:
    """Stub for the institutional PUCP account (OpenID Connect). Not implemented.

    When it is built it will, on top of this same interface: redirect to the PUCP provider,
    validate the returned ``id_token`` (issuer, audience, signature and nonce), read the
    ``sub`` and ``email`` claims and hand back an :class:`ExternalIdentity` whose ``subject``
    is matched against ``app_user.external_subject`` — creating no user on its own, because a
    person only gets in once an administrator has given them a local account with roles.
    Out of scope here (proposal "Fuera de este change"); it needs its own ADR for the library.
    """

    kind = IdentityProviderKind.OIDC

    def __init__(self, issuer: str | None = None, client_id: str | None = None) -> None:
        self.issuer = issuer
        self.client_id = client_id

    def authenticate(self, credentials: Credentials | None) -> ExternalIdentity:
        raise IdentityProviderUnavailable(
            "El inicio de sesión con la cuenta PUCP aún no está disponible; use su correo y "
            "contraseña del sistema.",
        )


PROVIDERS: dict[IdentityProviderKind, type[LocalPasswordProvider] | type[OidcProvider]] = {
    IdentityProviderKind.LOCAL: LocalPasswordProvider,
    IdentityProviderKind.OIDC: OidcProvider,
}


def get_identity_provider(settings: Settings) -> IdentityProvider:
    """Build the provider named by configuration (``AUTH_PROVIDER``; RNF-012)."""
    return PROVIDERS[IdentityProviderKind(settings.auth_provider)]()
