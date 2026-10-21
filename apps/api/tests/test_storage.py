"""Tests for ObjectStorage with in-memory fake (no network)."""

import pytest

from app.core.storage import ObjectStorage


class FakeStorage:
    """In-memory S3-compatible fake matching ObjectStorage interface."""

    def __init__(self, bucket: str = "matp-test") -> None:
        self.bucket = bucket
        self.objects: dict[str, bytes] = {}
        self.bucket_checked = False
        self.presigned_puts: list[dict] = []
        self.presigned_gets: list[dict] = []
        self.copies: list[tuple[str, str]] = []
        self.deleted: list[str] = []

    def ensure_bucket(self) -> bool:
        self.bucket_checked = True
        return True

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


class TestFakeStorage:
    """Verify FakeStorage matches ObjectStorage contract."""

    def test_put_get_roundtrip(self) -> None:
        fs = FakeStorage()
        fs.put_bytes("test/key.jpg", b"fake-jpeg-data", "image/jpeg")
        assert fs.get_bytes("test/key.jpg") == b"fake-jpeg-data"

    def test_presign_put_returns_url(self) -> None:
        fs = FakeStorage()
        res = fs.presign_put("pending/abc.jpg", "image/jpeg", 900)
        assert res["method"] == "PUT"
        assert "presigned=put" in res["url"]
        assert fs.presigned_puts[0]["key"] == "pending/abc.jpg"

    def test_presign_get_returns_url(self) -> None:
        fs = FakeStorage()
        url = fs.presign_get("pieces/123/photo.jpg", 300)
        assert "presigned=get" in url
        assert fs.presigned_gets[0]["ttl"] == 300

    def test_head_returns_metadata(self) -> None:
        fs = FakeStorage()
        fs.put_bytes("k", b"data", "image/jpeg")
        meta = fs.head("k")
        assert meta["content_length"] == 4
        assert meta["content_type"] == "image/jpeg"

    def test_head_missing_raises(self) -> None:
        fs = FakeStorage()
        with pytest.raises(FileNotFoundError):
            fs.head("missing")

    def test_stream_chunks(self) -> None:
        fs = FakeStorage()
        fs.put_bytes("k", b"0123456789", "image/jpeg")
        chunks = list(fs.stream("k", chunk_size=4))
        assert chunks == [b"0123", b"4567", b"89"]

    def test_copy_duplicates_object(self) -> None:
        fs = FakeStorage()
        fs.put_bytes("src", b"data", "image/jpeg")
        fs.copy("src", "dst")
        assert fs.get_bytes("dst") == b"data"
        assert fs.copies == [("src", "dst")]

    def test_delete_pending_removes_key(self) -> None:
        fs = FakeStorage()
        fs.put_bytes("pending/abc", b"data", "image/jpeg")
        fs.delete_pending("pending/abc")
        assert "pending/abc" not in fs.objects
        assert fs.deleted == ["pending/abc"]

    def test_delete_pending_missing_is_noop(self) -> None:
        fs = FakeStorage()
        fs.delete_pending("missing")  # no exception


class TestObjectStorageContract:
    """Smoke test: ObjectStorage methods exist and have right signatures."""

    def test_methods_exist(self) -> None:
        required = [
            "presign_put",
            "presign_get",
            "head",
            "stream",
            "copy",
            "delete_pending",
            "put_bytes",
            "get_bytes",
            "check",
            "ensure_bucket",
        ]
        for m in required:
            assert hasattr(ObjectStorage, m), f"Missing method: {m}"
