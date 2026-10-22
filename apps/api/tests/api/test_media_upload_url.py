"""Tests for POST /pieces/{piece_id}/media/upload-url (fotografias-multiples-por-pieza 2.1)."""

import uuid

import pytest
from sqlalchemy import select

from app.api.deps import CurrentUser, writer
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.media.models import MediaAsset
from app.modules.users.models import AppUser
from tests.api.conftest import CATALOGUER, VIEWER, SeededApi, as_user

H = as_user(CATALOGUER)
H_VIEWER = as_user(VIEWER)


def _piece_id(seeded_api: SeededApi, tenure: TenureRegime | None = None) -> uuid.UUID:
    with seeded_api.session() as session:
        statement = select(Piece.id).where(Piece.deleted_at.is_(None))
        if tenure is not None:
            statement = statement.where(Piece.tenure_regime == tenure)
        piece_id = session.scalar(statement.order_by(Piece.denomination))
        assert piece_id is not None
        return piece_id


@pytest.fixture
def fake_storage(seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch) -> dict[str, bytes]:
    """Mock storage for testing presigned URLs without network."""
    objects: dict[str, bytes] = {}
    presigned_puts: list[dict] = []

    def presign_put(key: str, content_type: str, ttl_seconds: int = 900) -> dict:
        fake_url = f"http://test-storage/{seeded_api.app.state.settings.s3_bucket}/{key}?presigned=put&ttl={ttl_seconds}"
        presigned_puts.append(
            {"key": key, "content_type": content_type, "ttl": ttl_seconds, "url": fake_url}
        )
        return {"url": fake_url, "method": "PUT", "headers": {"Content-Type": content_type}}

    monkeypatch.setattr(seeded_api.app.state.storage, "presign_put", presign_put)
    return {"presigned_puts": presigned_puts, "objects": objects}


def test_upload_url_ok(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media/upload-url",
        json={"filename": "test.jpg", "content_type": "image/jpeg", "size_bytes": 1024},
        headers=H,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["storage_key"].startswith(f"pieces/{piece_id}/pending/")
    assert body["storage_key"].endswith(".jpeg")
    assert body["method"] == "PUT"
    assert body["headers"]["Content-Type"] == "image/jpeg"
    assert "expires_at" in body
    assert fake_storage["presigned_puts"][0]["key"] == body["storage_key"]


def test_upload_url_unsupported_type(seeded_api: SeededApi) -> None:
    piece_id = _piece_id(seeded_api)
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media/upload-url",
        json={"filename": "test.pdf", "content_type": "application/pdf", "size_bytes": 1024},
        headers=H,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "unsupported_media_type"
    assert "image/jpeg" in response.json()["details"]["allowed"]


def test_upload_url_exceeds_max_bytes(seeded_api: SeededApi) -> None:
    piece_id = _piece_id(seeded_api)
    max_bytes = seeded_api.app.state.settings.media_max_bytes
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media/upload-url",
        json={"filename": "test.jpg", "content_type": "image/jpeg", "size_bytes": max_bytes + 1},
        headers=H,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "file_too_large"
    assert response.json()["details"]["max"] == max_bytes


def test_upload_url_duplicate_sha256_warning(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    sha = "a" * 64  # fake sha256
    # First create a media asset with this sha256
    with seeded_api.session() as session:
        catalogador_user = session.scalar(select(AppUser).where(AppUser.email == CATALOGUER))
        assert catalogador_user is not None
        writer(
            session,
            CurrentUser(
                id=catalogador_user.id,
                email=CATALOGUER,
                full_name=catalogador_user.full_name,
                roles=("CATALOGUER",),
            ),
        )
        asset = MediaAsset(
            id=uuid.uuid4(),
            piece_id=piece_id,
            storage_key=f"pieces/{piece_id}/orig.jpg",
            content_type="image/jpeg",
            size_bytes=100,
            content_sha256=sha,
        )
        session.add(asset)
        session.commit()

    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media/upload-url",
        json={
            "filename": "test2.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
            "content_sha256": sha,
        },
        headers=H,
    )
    assert response.status_code == 201, response.text
    assert response.headers.get("X-Warning") == "duplicate_content"


def test_upload_url_viewer_without_permission(seeded_api: SeededApi) -> None:
    piece_id = _piece_id(seeded_api)
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media/upload-url",
        json={"filename": "test.jpg", "content_type": "image/jpeg", "size_bytes": 1024},
        headers=H_VIEWER,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"


def test_upload_url_piece_not_found(seeded_api: SeededApi) -> None:
    fake_piece_id = uuid.uuid4()
    response = seeded_api.client.post(
        f"/api/v1/pieces/{fake_piece_id}/media/upload-url",
        json={"filename": "test.jpg", "content_type": "image/jpeg", "size_bytes": 1024},
        headers=H,
    )
    assert response.status_code == 404
