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

from tests.api.conftest import ADMIN, CATALOGUER, SeededApi, as_user
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
