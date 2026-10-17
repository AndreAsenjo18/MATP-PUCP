"""Background work inside the API process (ADR-010, point 4; RNF-002).

No external queue in phase 1: a request marks its job in the database, answers at once and the
work runs in FastAPI ``BackgroundTasks``. Each module keeps its own job state (columns with a
heartbeat) and its own stages, which must be idempotent. This module only provides what all of
them share:

- ``run_job``: runs a job with a fresh session and logs the exception instead of losing it.
- ``is_stale``: whether a heartbeat is older than ``STALE_AFTER``.
- ``recover_interrupted``: called once at startup with the recovery hook of every module, so
  jobs cut by a restart go back to a stable state with a visible reason.
"""

import logging
from collections.abc import Callable, Sequence
from datetime import datetime, timedelta

from sqlalchemy.orm import Session, sessionmaker

from app.core.models_base import utcnow

logger = logging.getLogger("matp.jobs")

STALE_AFTER = timedelta(minutes=5)
HEARTBEAT_EVERY = 500  # rows processed between heartbeats

RecoveryHook = Callable[[Session, datetime], int]


def is_stale(heartbeat: datetime | None, now: datetime | None = None) -> bool:
    if heartbeat is None:
        return True
    if heartbeat.tzinfo is None:  # SQLite returns naive values; they are stored in UTC
        heartbeat = heartbeat.replace(tzinfo=(now or utcnow()).tzinfo)
    return (now or utcnow()) - heartbeat > STALE_AFTER


def run_job(
    name: str,
    session_factory: sessionmaker[Session],
    job: Callable[..., None],
    *args: object,
) -> None:
    """Run ``job(session, *args)``; the job commits its own work and handles its failures."""
    try:
        with session_factory() as session:
            job(session, *args)
    except Exception:
        logger.exception("Falló el trabajo en segundo plano %s", name)


def recover_interrupted(
    session_factory: sessionmaker[Session],
    hooks: Sequence[tuple[str, RecoveryHook]],
    now: datetime | None = None,
) -> dict[str, int]:
    """Run every recovery hook in its own transaction; returns how many jobs each recovered."""
    recovered: dict[str, int] = {}
    for name, hook in hooks:
        try:
            with session_factory() as session:
                recovered[name] = hook(session, now or utcnow())
                session.commit()
        except Exception:
            logger.exception("No se pudieron recuperar los trabajos interrumpidos de %s", name)
            continue
        if recovered[name]:
            logger.warning("%s: %d trabajos interrumpidos recuperados", name, recovered[name])
    return recovered
