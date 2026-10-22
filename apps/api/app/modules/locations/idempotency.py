"""Idempotency keys for batch operations on a slow connection (design D3, RNF-005)."""

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid, utcnow
from app.modules.locations.models import IdempotencyKey

TTL = timedelta(hours=24)


def _aware(value: datetime) -> datetime:
    """SQLite (unit tests) returns naive datetimes even for `DateTime(timezone=True)`."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def request_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def find_valid(session: Session, *, scope: str, key: str) -> IdempotencyKey | None:
    record = session.scalar(
        select(IdempotencyKey).where(IdempotencyKey.scope == scope, IdempotencyKey.key == key)
    )
    if record is None or _aware(record.expires_at) < utcnow():
        return None
    return record


def store(
    session: Session,
    *,
    scope: str,
    key: str,
    user_id: uuid.UUID | None,
    payload_hash: str,
    response_status: int,
    response_body: dict[str, Any],
) -> None:
    session.add(
        IdempotencyKey(
            id=new_uuid(),
            key=key,
            scope=scope,
            user_id=user_id,
            request_hash=payload_hash,
            response_status=response_status,
            response_body=response_body,
            expires_at=utcnow() + TTL,
        )
    )
