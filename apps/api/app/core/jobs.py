"""Background work inside the API process (ADR-010, point 4). No Redis, no Celery in phase 1.

Shared by every change that runs long work: the first one to need it creates this module
(``deteccion-duplicados-y-cola-revision``) and the others reuse it (import pipeline, exports, AI
batches). It knows nothing about any table: each module keeps its own job state in the database.

The pattern:

1. The request stores the job state (``RUNNING`` + ``started_at``) and returns ``202``; the work
   runs after the response with FastAPI ``BackgroundTasks`` (``run_in_background``), with its own
   session from ``app.state.session_factory`` because the request session is already closed.
2. While it runs, the job refreshes a ``heartbeat_at`` column through ``Heartbeat``. A job whose
   heartbeat is older than ``HEARTBEAT_TIMEOUT`` (``is_stale``) was interrupted, e.g. by a
   restart, and may be marked failed or resumed.
3. On startup the app calls ``recover_interrupted``, which runs the recoveries registered with
   ``register_recovery``. Stages must be idempotent: a recovered job can run again.
4. Queues that are fed by ordinary writes (not by a request) are drained by a ``PollingWorker``
   registered with ``register_worker``. It wakes up every ``interval`` seconds or as soon as
   ``notify(name)`` is called, e.g. after a commit that enqueued work. Workers start with the app
   (``start_workers``) except in the test environment, where tests drain queues explicitly.

One API process is assumed (Docker Compose in phase 1): a worker does not lock rows across
processes.
"""

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session, sessionmaker

from app.core.models_base import utcnow

logger = logging.getLogger(__name__)

#: A job whose heartbeat is older than this is considered interrupted.
HEARTBEAT_TIMEOUT = timedelta(minutes=2)
#: Minimum time between two heartbeat writes of the same job.
HEARTBEAT_EVERY = timedelta(seconds=15)

SessionFactory = sessionmaker[Session]
Recovery = Callable[[SessionFactory], int]
Drain = Callable[[SessionFactory], int]


def is_stale(
    heartbeat_at: datetime | None,
    *,
    now: datetime | None = None,
    timeout: timedelta = HEARTBEAT_TIMEOUT,
) -> bool:
    """True when a running job stopped beating (or never did) for longer than ``timeout``."""
    if heartbeat_at is None:
        return True
    current = now or utcnow()
    if heartbeat_at.tzinfo is None:  # SQLite returns naive datetimes
        current = current.replace(tzinfo=None)
    return current - heartbeat_at > timeout


class Heartbeat:
    """Calls ``beat`` at most once every ``every``; call ``tick()`` often from the job loop."""

    def __init__(self, beat: Callable[[], None], every: timedelta = HEARTBEAT_EVERY) -> None:
        self._beat = beat
        self._every = every
        self._last: datetime | None = None

    def tick(self, *, force: bool = False) -> None:
        now = utcnow()
        if force or self._last is None or now - self._last >= self._every:
            self._beat()
            self._last = now


def run_in_background[**P](
    tasks: BackgroundTasks, work: Callable[P, None], /, *args: P.args, **kwargs: P.kwargs
) -> None:
    """Run ``work`` after the response. It must open its own session and record its own state."""
    tasks.add_task(work, *args, **kwargs)


_recoveries: dict[str, Recovery] = {}


def register_recovery(name: str, recovery: Recovery) -> None:
    """Register (idempotently, by name) a function that repairs interrupted jobs on startup."""
    _recoveries[name] = recovery


def recover_interrupted(factory: SessionFactory) -> dict[str, int]:
    """Run every registered recovery; a failing one is logged and never stops the app."""
    results: dict[str, int] = {}
    for name, recovery in _recoveries.items():
        try:
            results[name] = recovery(factory)
        except Exception:  # startup must go on; the next run retries
            logger.exception("No se pudo recuperar los trabajos interrumpidos de %s", name)
    return results


class PollingWorker:
    """A daemon thread that calls ``drain`` every ``interval`` seconds or when woken up."""

    def __init__(self, name: str, drain: Drain, factory: SessionFactory, interval: float) -> None:
        self.name = name
        self._drain = drain
        self._factory = factory
        self._interval = interval
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name=f"worker-{self.name}", daemon=True)
        self._thread.start()

    def wake(self) -> None:
        self._wake.set()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout)
            self._thread = None

    def _run(self) -> None:
        while not self._stop.is_set():
            self._wake.wait(self._interval)
            self._wake.clear()
            if self._stop.is_set():
                break
            try:
                self._drain(self._factory)
            except Exception:  # keep the worker alive; items stay queued
                logger.exception("Error en el trabajo en segundo plano %s", self.name)


@dataclass(frozen=True)
class _WorkerSpec:
    drain: Drain
    interval: float


_worker_specs: dict[str, _WorkerSpec] = {}
_running: dict[str, PollingWorker] = {}


def register_worker(name: str, drain: Drain, *, interval: float = 30.0) -> None:
    """Register (idempotently, by name) a queue drained by a ``PollingWorker``."""
    _worker_specs[name] = _WorkerSpec(drain, interval)


def start_workers(factory: SessionFactory) -> list[PollingWorker]:
    """Start one worker per registered queue (called from the app lifespan)."""
    started: list[PollingWorker] = []
    for name, spec in _worker_specs.items():
        if name in _running:
            continue
        worker = PollingWorker(name, spec.drain, factory, spec.interval)
        worker.start()
        _running[name] = worker
        started.append(worker)
    return started


def stop_workers() -> None:
    for name in list(_running):
        _running.pop(name).stop()


def notify(name: str) -> None:
    """Wake the worker of ``name`` now; a no-op when it is not running (tests, scripts)."""
    worker = _running.get(name)
    if worker is not None:
        worker.wake()
