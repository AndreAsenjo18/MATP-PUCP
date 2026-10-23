"""Backup freshness for ``GET /health`` (change despliegue-vm-y-respaldos, design D4; RNF-011).

``scripts/backup/backup.sh`` writes a small JSON marker after every run::

    {"last_attempt_at": "2026-10-22T02:00:11Z", "last_success_at": "2026-10-22T02:03:40Z",
     "last_result": "ok"}

The API only reads it. It exposes *whether* the last successful backup is recent, never what was
backed up, so the field carries no catalogue data and `/health` stays safe to publish.

States: ``disabled`` (no marker configured: local development), ``ok``, and ``stale`` (the marker
is missing, unreadable, reports a failure, or the last success is older than the allowed age).
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

BackupState = Literal["disabled", "ok", "stale"]


class BackupStatus(BaseModel):
    status: BackupState
    last_success_at: datetime | None = None
    max_age_hours: int | None = None


def _parse(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def read_backup_status(
    marker: str | None, max_age_hours: int, *, now: datetime | None = None
) -> BackupStatus:
    """Read the marker written by the backup job; any problem reads as ``stale``."""
    if not marker:
        return BackupStatus(status="disabled")
    now = now or datetime.now(UTC)
    try:
        data = json.loads(Path(marker).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return BackupStatus(status="stale", max_age_hours=max_age_hours)
    if not isinstance(data, dict):
        return BackupStatus(status="stale", max_age_hours=max_age_hours)
    last_success = _parse(data.get("last_success_at"))
    fresh = last_success is not None and now - last_success <= timedelta(hours=max_age_hours)
    # A run that failed after an older success is already reflected by the age; an explicit
    # failure of the *latest* run is stale at once, so the alert does not wait for the clock.
    failed_last = data.get("last_result") == "failed"
    return BackupStatus(
        status="ok" if fresh and not failed_last else "stale",
        last_success_at=last_success,
        max_age_hours=max_age_hours,
    )
