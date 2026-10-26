"""Gallery of a piece and access to its files (fotografias-multiples-por-pieza 2.3 to 2.6).

Spec multimedia: «Acceso a archivos con autorización de corta duración», «Restricción efectiva
heredada y bloqueo de descarga externa», «Gestión de galería con foto principal única» and
«Operación de estimación del volumen fotográfico». The photos go through the real registration
(`POST /pieces/{piece_id}/media`) on the in-memory storage of `test_media_register`. Every test
creates its own piece. Synthetic data only (RNF-014).
"""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection
from app.modules.media.service import comodato_restriction_term_id
from tests.api.conftest import ADMIN, CATALOGUER, MANAGER, SeededApi, as_user
from tests.api.test_media_register import _jpeg_bytes, fake_storage  # noqa: F401

H = as_user(CATALOGUER)


def _new_piece(seeded_api: SeededApi, **extra: Any) -> str:
    created = seeded_api.client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza con galería (sintética)",
            "tenure_regime": "Propiedad",
            **extra,
        },
        headers=H,
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _delete(seeded_api: SeededApi, piece_id: str) -> None:
    """The seeded database is shared: the active total must not move."""
    response = seeded_api.client.delete(
        f"/api/v1/pieces/{piece_id}",
        params={"reason": "Limpieza de prueba"},
        headers=as_user(ADMIN),
    )
    assert response.status_code == 204, response.text


def _register(seeded_api: SeededApi, storage: dict, piece_id: str, shade: int) -> dict[str, Any]:
    data = _jpeg_bytes((shade, 40, 90))
    key = f"pieces/{piece_id}/pending/{uuid.uuid4().hex}.jpg"
    storage["objects"][key] = data
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media",
        json={
            "storage_key": key,
            "original_filename": f"vista-{shade}.jpg",
            "content_type": "image/jpeg",
            "size_bytes": len(data),
            "content_sha256": hashlib.sha256(data).hexdigest(),
            "view_type_term_id": None,
        },
        headers=H,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _download_url(
    client: TestClient, piece_id: str, media_id: str, purpose: str, headers: dict[str, str]
) -> Any:
    return client.get(
        f"/api/v1/pieces/{piece_id}/media/{media_id}/download-url",
        params={"purpose": purpose},
        headers=headers,
    )


def test_the_download_url_is_a_get_with_the_purpose_and_the_short_ttl(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    photo = _register(seeded_api, fake_storage, piece_id, 10)
    ttl = seeded_api.app.state.settings.media_url_ttl_seconds

    response = _download_url(seeded_api.client, piece_id, photo["id"], "internal", H)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["download_url"].startswith("http://test-storage/")
    assert f"ttl={ttl}" in body["download_url"]
    expires = datetime.fromisoformat(body["expires_at"])
    assert timedelta(0) < expires - datetime.now(UTC) <= timedelta(seconds=ttl)
    assert (body["effective_restriction"], body["restriction_origin"]) == (None, "ninguna")
    _delete(seeded_api, piece_id)


def _restricted_collection(seeded_api: SeededApi) -> str:
    """A collection whose photos default to «No publicar» [SUPUESTO B2: illustrative]."""
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            acronym = f"RST{uuid.uuid4().hex[:5].upper()}"
            collection = Collection(
                id=new_uuid(),
                name=f"Colección restringida {acronym} (sintética)",
                acronym=acronym,
                acronym_normalized=acronym,
                default_tenure_regime=TenureRegime.OWNED,
                default_usage_restriction_term_id=comodato_restriction_term_id(session),
            )
            session.add(collection)
            session.commit()
            return str(collection.id)


def test_an_external_download_blocked_by_the_collection_is_409_and_inside_it_is_seen(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api, collection_id=_restricted_collection(seeded_api))
    photo = _register(seeded_api, fake_storage, piece_id, 20)
    manager = as_user(MANAGER)

    external = _download_url(seeded_api.client, piece_id, photo["id"], "external", manager)
    internal = _download_url(seeded_api.client, piece_id, photo["id"], "internal", H)

    assert external.status_code == 409, external.text
    error = external.json()
    assert error["code"] == "usage_restricted"
    assert (error["details"]["restriction"], error["details"]["origin"]) == (
        "NO_PUBLICAR",
        "colección",
    )
    assert internal.status_code == 200, internal.text
    assert internal.json()["effective_restriction"]["code"] == "NO_PUBLICAR"
    assert internal.json()["restriction_origin"] == "colección"
    _delete(seeded_api, piece_id)


def test_the_409_of_a_loan_for_use_names_its_agreement(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(
        seeded_api, tenure_regime="Comodato", loan_agreement_ref="Acuerdo sintético 07-2026"
    )
    photo = _register(seeded_api, fake_storage, piece_id, 30)

    response = _download_url(seeded_api.client, piece_id, photo["id"], "external", as_user(MANAGER))

    assert response.status_code == 409, response.text
    details = response.json()["details"]
    assert (details["origin"], details["loan_agreement_ref"]) == (
        "foto",
        "Acuerdo sintético 07-2026",
    )
    assert "Acuerdo sintético 07-2026" in response.json()["message"]
    _delete(seeded_api, piece_id)


def test_a_new_photo_shows_the_restriction_inherited_from_its_collection(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    """Scenario «Herencia desde la colección en comodato»: no restriction of its own."""
    piece_id = _new_piece(seeded_api, collection_id=_restricted_collection(seeded_api))

    registered = _register(seeded_api, fake_storage, piece_id, 40)
    (listed,) = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()

    for photo in (registered, listed):
        assert photo["usage_restriction"] is None
        assert photo["effective_restriction"]["code"] == "NO_PUBLICAR"
        assert photo["restriction_origin"] == "colección"
    _delete(seeded_api, piece_id)
