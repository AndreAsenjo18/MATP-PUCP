"""S3-compatible object storage access. Binary files never go into the database."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from app.core.config import Settings


class ObjectStorage:
    def __init__(self, client: Any, bucket: str) -> None:
        self._client = client
        self.bucket = bucket

    @classmethod
    def from_settings(cls, settings: Settings) -> ObjectStorage:
        timeout = settings.health_check_timeout_seconds
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            config=Config(
                connect_timeout=timeout,
                read_timeout=max(timeout, 5),
                retries={"max_attempts": 1},
                s3={"addressing_style": "path"},
            ),
        )
        return cls(client, settings.s3_bucket)

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
