"""``ObjectStorage`` with the boto3 clients of ``from_settings`` (fotografias-multiples 1.2).

Spec multimedia, «Subida verificada de fotografías…» and «Acceso a archivos con autorización de
corta duración». No network and no extra dependency: presigned URLs are computed locally by
botocore, and every other call goes through ``botocore.stub.Stubber``, which checks the exact
parameters sent to S3 and answers what MinIO or R2 would. The settings are those of compose:
the API reaches the storage as ``storage:9000`` and the browser as ``localhost:9000``. Real MinIO
(CORS, upload from a browser) is task 4.1, with Docker.
"""

import io
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from botocore.exceptions import ClientError
from botocore.response import StreamingBody
from botocore.stub import Stubber

from app.core.storage import ObjectStorage

BUCKET = "matp-prueba"
KEY = "pieces/0001/upload.jpeg"


def _settings(public: str | None = "http://localhost:9000") -> Any:
    return SimpleNamespace(
        health_check_timeout_seconds=2.0,
        s3_access_key_id="clave-sintetica",
        s3_secret_access_key="secreto-sintetico",
        s3_endpoint_url="http://storage:9000",
        s3_public_endpoint_url=public,
        s3_region="us-east-1",
        s3_bucket=BUCKET,
    )


@pytest.fixture
def storage() -> ObjectStorage:
    return ObjectStorage.from_settings(_settings())


@pytest.fixture
def stubbed(storage: ObjectStorage) -> Iterator[tuple[ObjectStorage, Stubber]]:
    with Stubber(storage._client) as stubber:
        yield storage, stubber
        stubber.assert_no_pending_responses()


def _query(url: str) -> dict[str, list[str]]:
    return parse_qs(urlparse(url).query)


def test_presign_put_names_the_public_endpoint_and_signs_type_and_ttl(
    storage: ObjectStorage,
) -> None:
    upload = storage.presign_put(KEY, "image/jpeg", ttl_seconds=600)

    assert upload["method"] == "PUT"
    assert upload["headers"] == {"Content-Type": "image/jpeg"}
    url = urlparse(upload["url"])
    assert (url.netloc, url.path) == ("localhost:9000", f"/{BUCKET}/{KEY}")
    query = _query(upload["url"])
    assert query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]  # SigV4, which R2 requires
    assert query["X-Amz-Expires"] == ["600"]
    assert "content-type" in query["X-Amz-SignedHeaders"][0].split(";")


def test_presign_get_uses_the_short_ttl(storage: ObjectStorage) -> None:
    url = storage.presign_get(KEY)

    assert urlparse(url).netloc == "localhost:9000"
    assert urlparse(url).path == f"/{BUCKET}/{KEY}"
    assert _query(url)["X-Amz-Expires"] == ["300"]


def test_without_public_endpoint_the_urls_name_the_api_endpoint() -> None:
    url = ObjectStorage.from_settings(_settings(public=None)).presign_get(KEY)

    assert urlparse(url).netloc == "storage:9000"


def test_head_returns_the_metadata_without_quotes(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    stubber.add_response(
        "head_object",
        {"ContentType": "image/jpeg", "ContentLength": 2048, "ETag": '"9f1a"'},
        {"Bucket": BUCKET, "Key": KEY},
    )

    assert storage.head(KEY) == {
        "content_type": "image/jpeg",
        "content_length": 2048,
        "etag": "9f1a",
    }


def test_head_of_a_missing_object_is_file_not_found(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    stubber.add_client_error("head_object", service_error_code="404", http_status_code=404)

    with pytest.raises(FileNotFoundError):
        storage.head(KEY)


def test_head_does_not_hide_other_storage_errors(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    stubber.add_client_error("head_object", service_error_code="403", http_status_code=403)

    with pytest.raises(ClientError):
        storage.head(KEY)


def test_stream_reads_the_body_in_chunks(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    data = b"0123456789"
    stubber.add_response(
        "get_object",
        {"Body": StreamingBody(io.BytesIO(data), len(data)), "ContentLength": len(data)},
        {"Bucket": BUCKET, "Key": KEY},
    )

    assert list(storage.stream(KEY, chunk_size=4)) == [b"0123", b"4567", b"89"]


def test_copy_is_a_server_side_copy_in_the_same_bucket(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    final = "pieces/0001/a1/original.jpeg"
    stubber.add_response(
        "copy_object",
        {},
        {"Bucket": BUCKET, "CopySource": {"Bucket": BUCKET, "Key": KEY}, "Key": final},
    )

    storage.copy(KEY, final)


def test_delete_pending_deletes_and_ignores_a_missing_object(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    stubber.add_response("delete_object", {}, {"Bucket": BUCKET, "Key": KEY})
    stubber.add_client_error("delete_object", service_error_code="404", http_status_code=404)

    storage.delete_pending(KEY)
    storage.delete_pending(KEY)


def test_delete_pending_does_not_hide_other_storage_errors(stubbed) -> None:  # type: ignore[no-untyped-def]
    storage, stubber = stubbed
    stubber.add_client_error(
        "delete_object", service_error_code="AccessDenied", http_status_code=403
    )

    with pytest.raises(ClientError):
        storage.delete_pending(KEY)
