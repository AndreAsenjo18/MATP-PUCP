"""S3-compatible object storage access. Binary files never go into the database."""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from app.core.config import Settings


class ObjectStorage:
    def __init__(self, client: Any, bucket: str, presign_client: Any | None = None) -> None:
        self._client = client
        # Presigned URLs are opened by the browser: they must name the endpoint it can reach.
        self._presign_client = presign_client or client
        self.bucket = bucket

    @classmethod
    def from_settings(cls, settings: Settings) -> ObjectStorage:
        timeout = settings.health_check_timeout_seconds
        # Explicit keys only when configured; otherwise boto3 uses its default credential
        # chain (AWS_* variables, shared profile or EC2 instance role — ADR-013).
        credentials: dict[str, Any] = {}
        if settings.s3_access_key_id is not None and settings.s3_secret_access_key is not None:
            credentials = {
                "aws_access_key_id": settings.s3_access_key_id,
                "aws_secret_access_key": settings.s3_secret_access_key,
            }
        config = Config(
            connect_timeout=timeout,
            read_timeout=max(timeout, 5),
            retries={"max_attempts": 1},
            # SigV4 always: R2 rejects SigV2, which botocore still uses for presigned URLs in
            # us-east-1 with a custom endpoint, and MinIO accepts both.
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        )

        def client_for(endpoint_url: str | None) -> Any:
            return boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                region_name=settings.s3_region,
                config=config,
                **credentials,
            )

        client = client_for(settings.s3_endpoint_url)
        # S3_PUBLIC_ENDPOINT_URL: the storage as the browser sees it (``localhost:9000`` in
        # compose, where the API reaches it as ``storage:9000``); empty = the same endpoint.
        public = settings.s3_public_endpoint_url
        presign_client = client_for(public) if public else None
        return cls(client, settings.s3_bucket, presign_client)

    def check(self) -> None:
        """Raise if the bucket is not reachable."""
        self._client.head_bucket(Bucket=self.bucket)

    def ensure_bucket(self) -> bool:
        """Create the bucket if it does not exist. Returns True when it was created."""
        try:
            self._client.head_bucket(Bucket=self.bucket)
            return False
        except ClientError:
            self._client.create_bucket(Bucket=self.bucket)
            return True

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get_bytes(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    # --- Presigned URLs (D1, D5) -------------------------------------------
    def presign_put(
        self,
        key: str,
        content_type: str,
        ttl_seconds: int = 900,
    ) -> dict[str, Any]:
        """URL prefirmada PUT para subida directa del navegador."""
        url = self._presign_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=ttl_seconds,
        )
        return {"url": url, "method": "PUT", "headers": {"Content-Type": content_type}}

    def presign_get(
        self,
        key: str,
        ttl_seconds: int = 300,
    ) -> str:
        """URL prefirmada GET para descarga/visualización."""
        return self._presign_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=ttl_seconds,
        )

    # --- Object metadata & streaming (D1 verification) -----------------------
    def head(self, key: str) -> dict[str, Any]:
        """HEAD object: existe, content_type, content_length, etag."""
        try:
            resp = self._client.head_object(Bucket=self.bucket, Key=key)
            return {
                "content_type": resp.get("ContentType"),
                "content_length": resp.get("ContentLength"),
                "etag": resp.get("ETag", "").strip('"'),
            }
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "404":
                raise FileNotFoundError(key) from exc
            raise

    def stream(self, key: str, chunk_size: int = 8192) -> Iterator[bytes]:
        """Stream object body in chunks (for SHA-256 recalculation)."""
        resp = self._client.get_object(Bucket=self.bucket, Key=key)
        body = resp["Body"]
        while chunk := body.read(chunk_size):
            yield chunk

    # --- Copy & delete pending (D1) ----------------------------------------
    def copy(self, src_key: str, dst_key: str) -> None:
        """Server-side copy within the same bucket."""
        self._client.copy_object(
            Bucket=self.bucket,
            CopySource={"Bucket": self.bucket, "Key": src_key},
            Key=dst_key,
        )

    def delete_pending(self, key: str) -> None:
        """Delete a pending upload object (no-op if missing)."""
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "404":
                raise
