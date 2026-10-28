"""Tests for POST /pieces/{piece_id}/media (fotografias-multiples-por-pieza 2.2)."""

import hashlib
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import select

from app.api.deps import CurrentUser
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.media.models import MediaAsset
from tests.api.conftest import CATALOGUER, VIEWER, SeededApi, as_user

H = as_user(CATALOGUER)
H_VIEWER = as_user(VIEWER)


def _jpeg_bytes(color: tuple[int, int, int] = (200, 30, 30)) -> bytes:
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (120, 90), color).save(buffer, format="JPEG")
    return buffer.getvalue()


def _piece_id(seeded_api: SeededApi, tenure: TenureRegime | None = None) -> uuid.UUID:
    with seeded_api.session() as session:
        statement = select(Piece.id).where(Piece.deleted_at.is_(None))
        if tenure is not None:
            statement = statement.where(Piece.tenure_regime == tenure)
        piece_id = session.scalar(statement.order_by(Piece.denomination))
        assert piece_id is not None
        return piece_id


def _fake_sha256() -> str:
    return "a" * 64


def _catalogador_user(seeded_api: SeededApi) -> "CurrentUser":
    """Get a CurrentUser for the catalogador user for audit context."""
    with seeded_api.session() as session:
        from app.modules.users.models import AppUser

        user = session.scalar(select(AppUser).where(AppUser.email == CATALOGUER))
        if user is None:
            raise ValueError("Catalogador user not found")
        return CurrentUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            roles=tuple(),
            permissions=frozenset(["media.upload"]),
        )


@pytest.fixture
def fake_storage(seeded_api: SeededApi) -> Iterator[dict]:
    """Mock storage for testing without network - replaces entire storage object.

    Not ``monkeypatch.setattr(app.state, ...)``: Starlette's ``State`` keeps its values in
    ``_state``, so recent pytest releases see no attribute to restore and *delete* ``storage`` on
    teardown, which breaks every later test that reads ``app.state.storage``.
    """
    objects: dict[str, bytes] = {}

    class FakeStorage:
        def __init__(self):
            self.objects = objects
            self.presigned_puts = []
            self.presigned_gets = []
            self.copies = []
            self.deleted = []

        def ensure_bucket(self) -> bool:
            return True

        def check(self) -> None:
            pass

        def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
            self.objects[key] = data

        def get_bytes(self, key: str) -> bytes:
            if key not in self.objects:
                raise FileNotFoundError(key)
            return self.objects[key]

        # --- Presigned (fake returns predictable URLs) ---
        def presign_put(self, key: str, content_type: str, ttl_seconds: int = 900) -> dict:
            fake_url = f"http://test-storage/{self.bucket}/{key}?presigned=put&ttl={ttl_seconds}"
            self.presigned_puts.append(
                {"key": key, "content_type": content_type, "ttl": ttl_seconds, "url": fake_url}
            )
            return {"url": fake_url, "method": "PUT", "headers": {"Content-Type": content_type}}

        def presign_get(self, key: str, ttl_seconds: int = 300) -> str:
            fake_url = f"http://test-storage/{self.bucket}/{key}?presigned=get&ttl={ttl_seconds}"
            self.presigned_gets.append({"key": key, "ttl": ttl_seconds, "url": fake_url})
            return fake_url

        # --- Metadata & streaming ---
        def head(self, key: str) -> dict:
            if key not in self.objects:
                raise FileNotFoundError(key)
            data = self.objects[key]
            return {"content_type": "image/jpeg", "content_length": len(data), "etag": "fake-etag"}

        def stream(self, key: str, chunk_size: int = 8192):
            if key not in self.objects:
                raise FileNotFoundError(key)
            data = self.objects[key]
            for i in range(0, len(data), chunk_size):
                yield data[i : i + chunk_size]

        # --- Copy & delete ---
        def copy(self, src_key: str, dst_key: str) -> None:
            if src_key not in self.objects:
                raise FileNotFoundError(src_key)
            self.objects[dst_key] = self.objects[src_key]
            self.copies.append((src_key, dst_key))

        def delete_pending(self, key: str) -> None:
            self.objects.pop(key, None)
            self.deleted.append(key)

    fake = FakeStorage()
    original = seeded_api.app.state.storage
    fake.bucket = original.bucket
    seeded_api.app.state.storage = fake
    try:
        yield {"objects": objects, "fake": fake}
    finally:
        seeded_api.app.state.storage = original


def _setup_audit_context(session, seeded_api: SeededApi):
    """Set up audit context for database writes."""

    catalogador_user = _catalogador_user(seeded_api)
    set_audit_context(
        session,
        AuditContext(origin=AuditOrigin.MANUAL, user_id=catalogador_user.id, reason="test"),
    )


def test_register_ok(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    data = _jpeg_bytes()
    pending_key = f"pieces/{piece_id}/pending/test.jpg"
    fake_storage["objects"][pending_key] = data

    with seeded_api.session() as session:
        _setup_audit_context(session, seeded_api)
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": f"pieces/{piece_id}/pending/test.jpg",
                "original_filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": len(_jpeg_bytes()),
                "content_sha256": hashlib.sha256(data).hexdigest(),
                "view_type_term_id": None,
            },
            headers=H,
        )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["piece_id"] == str(piece_id)
    assert body["content_sha256"] == hashlib.sha256(_jpeg_bytes()).hexdigest()
    assert body["is_primary"] is True
    assert body["sort_order"] == 0
    assert body["usage_restriction"] is None
    final_keys = [
        k
        for k in fake_storage["objects"]
        if k.startswith(f"pieces/{piece_id}/") and not k.startswith("pending/")
    ]
    # Original + thumb.webp + display.webp = 3 files
    assert len(final_keys) == 3


def test_register_pdf_disguised(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    data = b"%PDF-1.4 fake pdf"
    pending_key = f"pieces/{piece_id}/pending/fake.jpg"
    fake_storage["objects"][pending_key] = data
    # Use correct SHA256 for the PDF data so validation reaches Pillow check
    sha = hashlib.sha256(data).hexdigest()

    with seeded_api.session() as session:
        _setup_audit_context(session, seeded_api)
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": f"pieces/{piece_id}/pending/fake.jpg",
                "original_filename": "fake.jpg",
                "content_type": "image/jpeg",  # declared as JPEG
                "size_bytes": len(data),
                "content_sha256": sha,  # correct SHA for the PDF data
            },
            headers=H,
        )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_image"


def test_register_sha_mismatch(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    data = _jpeg_bytes()
    pending_key = f"pieces/{piece_id}/pending/test.jpg"
    fake_storage["objects"][pending_key] = data

    with seeded_api.session() as session:
        from sqlalchemy import select

        from app.modules.audit.context import AuditContext, set_audit_context
        from app.modules.audit.models import AuditOrigin
        from app.modules.users.models import AppUser

        catalogador_user = session.scalar(select(AppUser).where(AppUser.email == CATALOGUER))

        set_audit_context(
            session,
            AuditContext(origin=AuditOrigin.MANUAL, user_id=catalogador_user.id, reason="test"),
        )
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": f"pieces/{piece_id}/pending/test.jpg",
                "original_filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": len(_jpeg_bytes()),
                "content_sha256": "b" * 64,
            },
            headers=H,
        )
    assert response.status_code == 422
    assert response.json()["code"] == "sha256_mismatch"


def test_register_object_missing(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)

    with seeded_api.session() as session:
        _setup_audit_context(session, seeded_api)
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": "pieces/nonexistent/pending/test.jpg",
                "original_filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 100,
                "content_sha256": "a" * 64,
            },
            headers=H,
        )
    assert response.status_code == 422
    assert response.json()["code"] == "object_not_found"


def test_register_comodato_restriction(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.LOAN_FOR_USE)
    data = _jpeg_bytes()
    sha = hashlib.sha256(data).hexdigest()
    pending_key = f"pieces/{piece_id}/pending/test.jpg"
    fake_storage["objects"][pending_key] = data

    with seeded_api.session() as session:
        _setup_audit_context(session, seeded_api)
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": f"pieces/{piece_id}/pending/test.jpg",
                "original_filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": len(data),
                "content_sha256": sha,
            },
            headers=H,
        )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["usage_restriction"]["code"] == "NO_PUBLICAR"
    assert body["restriction_note"] is not None


def test_register_second_photo_not_primary(seeded_api: SeededApi, fake_storage: dict) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    # First create a primary photo
    with seeded_api.session() as session:
        from sqlalchemy import select

        from app.modules.audit.context import AuditContext, set_audit_context
        from app.modules.audit.models import AuditOrigin
        from app.modules.users.models import AppUser

        catalogador_user = session.scalar(select(AppUser).where(AppUser.email == CATALOGUER))
        set_audit_context(
            session,
            AuditContext(origin=AuditOrigin.MANUAL, user_id=catalogador_user.id, reason="test"),
        )
        asset1 = MediaAsset(
            id=uuid.uuid4(),
            piece_id=piece_id,
            storage_key=f"pieces/{piece_id}/first.jpg",
            content_type="image/jpeg",
            size_bytes=100,
            content_sha256="a" * 64,
            sort_order=0,
            is_primary=True,
        )
        session.add(asset1)
        session.commit()

    data = _jpeg_bytes((30, 120, 30))
    sha = hashlib.sha256(data).hexdigest()
    pending_key = f"pieces/{piece_id}/pending/second.jpg"
    fake_storage["objects"][pending_key] = data

    with seeded_api.session() as session:
        _setup_audit_context(session, seeded_api)
        response = seeded_api.client.post(
            f"/api/v1/pieces/{piece_id}/media",
            json={
                "storage_key": f"pieces/{piece_id}/pending/second.jpg",
                "original_filename": "second.jpg",
                "content_type": "image/jpeg",
                "size_bytes": len(data),
                "content_sha256": sha,
            },
            headers=H,
        )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["is_primary"] is False
    assert body["sort_order"] == 1


def test_register_viewer_without_permission(seeded_api: SeededApi) -> None:
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media",
        json={
            "storage_key": "pieces/test/pending/test.jpg",
            "original_filename": "test.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 100,
            "content_sha256": "a" * 64,
        },
        headers=as_user(VIEWER),
    )
    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"


def test_register_piece_not_found(seeded_api: SeededApi) -> None:
    fake_piece_id = uuid.uuid4()
    with seeded_api.session() as session:
        from sqlalchemy import select

        from app.modules.audit.context import AuditContext, set_audit_context
        from app.modules.audit.models import AuditOrigin
        from app.modules.users.models import AppUser

        catalogador_user = session.scalar(select(AppUser).where(AppUser.email == CATALOGUER))
        set_audit_context(
            session,
            AuditContext(origin=AuditOrigin.MANUAL, user_id=catalogador_user.id, reason="test"),
        )
        response = seeded_api.client.post(
            f"/api/v1/pieces/{fake_piece_id}/media",
            json={
                "storage_key": "pieces/test/pending/test.jpg",
                "original_filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 100,
                "content_sha256": "a" * 64,
            },
            headers=H,
        )
    assert response.status_code == 404
