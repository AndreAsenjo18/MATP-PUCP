"""Smoke test for search performance load testing tool (RF-038).

Validates that generate_catalog creates 1 000 pieces and search_load runs
against the in-process API using ASGI transport, calculating accurate percentiles and SLA.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

try:
    import httpx
except ImportError:
    import httpx2 as httpx

from app.core.db import make_session_factory
from tests.api.conftest import SeededApi

# Ensure repo root containing `scripts` is in sys.path
repo_root = Path(__file__).resolve()
while not (repo_root / "scripts").is_dir() and repo_root.parent != repo_root:
    repo_root = repo_root.parent

if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from scripts.perf.generate_catalog import generate_catalog  # noqa: E402
from scripts.perf.search_load import run_load_test  # noqa: E402


@pytest.mark.anyio
async def test_perf_smoke_1000_pieces(seeded_api: SeededApi) -> None:
    """Smoke test: 1 000 synthetic pieces and search load benchmark."""
    factory = make_session_factory(seeded_api.engine)

    # 1. Generate 1 000 pieces in the SQLite test database
    with factory() as session:
        created = generate_catalog(
            session=session,
            count=1000,
            seed=20260917,
            batch_size=500,
            clean=False,
        )
        assert created == 1000

    # 2. Run ASGI in-process load test with 1 user for 3 seconds (avoiding SQLite multi-thread lock)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=seeded_api.app),
        base_url="http://testserver",
    ) as client:
        results = await run_load_test(
            base_url="http://testserver",
            concurrency=1,
            duration_seconds=3.0,
            auth_header="CATALOGUER",
            client=client,
        )

    # 3. Assertions on results structure and SLA
    assert results["total_requests"] > 0
    assert results["successful_requests"] > 0
    assert results["error_requests"] == 0
    assert results["error_rate_pct"] == 0.0

    # Verify percentiles are calculated
    lats = results["latencies_ms"]
    assert lats["min"] > 0.0
    assert lats["p50"] > 0.0
    assert lats["p95"] > 0.0
    assert lats["p99"] > 0.0

    # Verify SLA is met (target <= 2000 ms)
    assert lats["p95"] <= 2000.0
    assert results["sla_p95_under_2000ms"] is True

    # Verify query breakdown
    by_type = results["latencies_by_type"]
    assert "code" in by_type
    assert "text" in by_type
    assert "filters" in by_type
