"""Background work in the API process (ADR-010, point 4): heartbeat, recovery and workers."""

import threading
from datetime import UTC, datetime, timedelta

import pytest

from app.core import jobs


def test_a_job_without_heartbeat_or_with_an_old_one_is_stale() -> None:
    now = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)
    assert jobs.is_stale(None, now=now)
    assert jobs.is_stale(now - timedelta(minutes=3), now=now)
    assert not jobs.is_stale(now - timedelta(seconds=30), now=now)


def test_naive_datetimes_from_sqlite_are_compared_as_utc() -> None:
    now = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)
    assert not jobs.is_stale(datetime(2026, 10, 19, 11, 59), now=now)
    assert jobs.is_stale(datetime(2026, 10, 19, 11, 50), now=now)


def test_heartbeat_writes_at_most_once_per_interval() -> None:
    beats: list[int] = []
    heartbeat = jobs.Heartbeat(lambda: beats.append(1), every=timedelta(hours=1))
    for _ in range(5):
        heartbeat.tick()
    assert len(beats) == 1
    heartbeat.tick(force=True)
    assert len(beats) == 2


def test_recoveries_run_on_startup_and_a_failing_one_does_not_stop_the_rest(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(jobs, "_recoveries", {})

    def broken(_factory: object) -> int:
        raise RuntimeError("tabla no disponible")

    jobs.register_recovery("broken", broken)
    jobs.register_recovery("ok", lambda _factory: 2)
    assert jobs.recover_interrupted(None) == {"ok": 2}  # type: ignore[arg-type]
    assert "broken" in caplog.text


def test_worker_drains_when_notified_and_stops(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(jobs, "_worker_specs", {})
    monkeypatch.setattr(jobs, "_running", {})
    drained = threading.Event()

    def drain(_factory: object) -> int:
        drained.set()
        return 1

    jobs.register_worker("test-queue", drain, interval=3600)  # only a notification wakes it
    started = jobs.start_workers(None)  # type: ignore[arg-type]
    try:
        assert [worker.name for worker in started] == ["test-queue"]
        assert jobs.start_workers(None) == []  # type: ignore[arg-type]  # idempotent
        jobs.notify("test-queue")
        assert drained.wait(5)
    finally:
        jobs.stop_workers()
    assert jobs._running == {}


def test_notify_without_a_running_worker_is_a_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(jobs, "_running", {})
    jobs.notify("nobody")  # tests and scripts drain their queues explicitly


def test_a_failing_drain_keeps_the_worker_alive(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[int] = []
    second = threading.Event()

    def drain(_factory: object) -> int:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("fallo transitorio")
        second.set()
        return 0

    worker = jobs.PollingWorker("flaky", drain, None, interval=3600)  # type: ignore[arg-type]
    worker.start()
    try:
        worker.wake()
        for _ in range(50):
            if calls:
                break
            threading.Event().wait(0.05)
        worker.wake()
        assert second.wait(5)
    finally:
        worker.stop()
