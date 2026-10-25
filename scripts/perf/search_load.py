"""Search performance load testing tool using asyncio + httpx (RF-038).

Simulates concurrent user load against the catalog search endpoints with a realistic query mix:
- 40% code search (normalized exact / historical codes)
- 30% free text search (denomination, author, provenance, unaccented)
- 30% combined filters (collection, category, tenure, period)

Computes latency percentiles (p50, p95, p99), error rate, and verifies the SLA (p95 <= 2s).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import time
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError:
    import httpx2 as httpx

# Vocabulary for realistic query mix
TEXT_QUERIES = [
    "tumi",
    "ceramica",
    "mascara",
    "vaso",
    "oro",
    "plata",
    "textil",
    "huaco",
    "danzante",
    "cuchillo",
    "retablo",
    "ceremonial",
    "maestro",
    "cusco",
    "ayacucho",
    "nazca",
]

COLLECTIONS_SAMPLE = ["MMZ", "RA", "RAB", "MBB", "AJB"]


def generate_query(rng: random.Random) -> tuple[str, dict[str, Any]]:
    """Select query type according to 40% code, 30% text, 30% filter mix."""
    roll = rng.random()

    if roll < 0.40:
        # 40% Code queries
        num = rng.randint(1, 20000)
        q = f"I-{num:06d}" if rng.random() > 0.3 else f"I-{num}"
        return "code", {"q": q, "limit": 20}

    elif roll < 0.70:
        # 30% Text queries
        term = rng.choice(TEXT_QUERIES)
        return "text", {"q": term, "limit": 20}

    else:
        # 30% Combined filters (q is required by contract, plus tenure_regime)
        filters: dict[str, Any] = {
            "q": rng.choice(TEXT_QUERIES),
            "limit": 20,
        }
        if rng.random() > 0.5:
            filters["tenure_regime"] = "Propiedad"
        if rng.random() > 0.5:
            filters["collection_code"] = rng.choice(COLLECTIONS_SAMPLE)
        return "filters", filters


async def worker(
    worker_id: int,
    base_url: str,
    headers: dict[str, str],
    end_time: float,
    latencies: list[float],
    latencies_by_type: dict[str, list[float]],
    errors: list[dict[str, Any]],
    rng: random.Random,
    client: httpx.AsyncClient,
) -> None:
    """Virtual user sending search requests concurrently."""
    while time.monotonic() < end_time:
        q_type, params = generate_query(rng)
        url = f"{base_url.rstrip('/')}/api/v1/search"
        start = time.perf_counter()

        try:
            resp = await client.get(url, params=params, headers=headers)
            duration_ms = (time.perf_counter() - start) * 1000.0

            if resp.status_code == 200:
                latencies.append(duration_ms)
                latencies_by_type[q_type].append(duration_ms)
            else:
                err_item = {
                    "worker": worker_id,
                    "type": q_type,
                    "status": resp.status_code,
                    "params": params,
                    "body": resp.text[:200],
                }
                errors.append(err_item)
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.perf_counter() - start) * 1000.0
            errors.append(
                {
                    "worker": worker_id,
                    "type": q_type,
                    "status": "exception",
                    "error": str(exc),
                }
            )

        # Brief think time (10ms - 50ms) to simulate realistic client pacing
        await asyncio.sleep(rng.uniform(0.01, 0.05))


def calculate_percentiles(values: list[float]) -> dict[str, float]:
    """Calculate min, max, avg, p50, p90, p95, p99 for a list of values."""
    if not values:
        return {
            "min": 0.0,
            "max": 0.0,
            "avg": 0.0,
            "p50": 0.0,
            "p90": 0.0,
            "p95": 0.0,
            "p99": 0.0,
        }

    s = sorted(values)
    n = len(s)

    def pct(p: float) -> float:
        k = (n - 1) * p
        f = int(k)
        c = f + 1
        if c < n:
            return s[f] + (k - f) * (s[c] - s[f])
        return s[f]

    return {
        "min": round(min(s), 2),
        "max": round(max(s), 2),
        "avg": round(sum(s) / n, 2),
        "p50": round(pct(0.50), 2),
        "p90": round(pct(0.90), 2),
        "p95": round(pct(0.95), 2),
        "p99": round(pct(0.99), 2),
    }


async def run_load_test(
    base_url: str = "http://localhost:8000",
    concurrency: int = 10,
    duration_seconds: float = 300.0,
    auth_header: str | None = None,
    output_path: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Run concurrent load test and return summary dictionary."""
    headers = {"Content-Type": "application/json"}
    role_map = {
        "ADMIN": "admin@matp.local",
        "CATALOGUER": "catalogador@matp.local",
        "MANAGER": "curadora@matp.local",
        "STORAGE": "deposito@matp.local",
        "VIEWER": "consulta@matp.local",
    }
    if auth_header:
        email = role_map.get(auth_header.upper(), auth_header)
        headers["X-MATP-User"] = email

    all_latencies: list[float] = []
    latencies_by_type: dict[str, list[float]] = {
        "code": [],
        "text": [],
        "filters": [],
    }
    errors: list[dict[str, Any]] = []

    print("\n==================================================")
    print(" MATP Search Performance Benchmark (RF-038)")
    print(f" Target: {base_url}")
    print(f" Concurrency: {concurrency} users")
    print(f" Duration: {duration_seconds}s")
    print(" Workload mix: 40% code, 30% text, 30% filters")
    print(" SLA Target: p95 <= 2000 ms")
    print("==================================================\n")

    start_wall = time.monotonic()
    end_time = start_wall + duration_seconds

    own_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0)
        own_client = True

    try:
        tasks = [
            worker(
                worker_id=i,
                base_url=base_url,
                headers=headers,
                end_time=end_time,
                latencies=all_latencies,
                latencies_by_type=latencies_by_type,
                errors=errors,
                rng=random.Random(20260917 + i),
                client=client,
            )
            for i in range(concurrency)
        ]
        await asyncio.gather(*tasks)
    finally:
        if own_client:
            await client.aclose()

    total_time = time.monotonic() - start_wall
    total_requests = len(all_latencies) + len(errors)
    rps = round(total_requests / total_time, 2) if total_time > 0 else 0.0
    err_rate = round((len(errors) / total_requests * 100.0), 2) if total_requests > 0 else 0.0

    global_stats = calculate_percentiles(all_latencies)
    type_stats = {k: calculate_percentiles(v) for k, v in latencies_by_type.items()}

    sla_met = global_stats["p95"] <= 2000.0 and err_rate < 1.0

    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": base_url,
        "concurrency": concurrency,
        "duration_seconds": round(total_time, 2),
        "total_requests": total_requests,
        "successful_requests": len(all_latencies),
        "error_requests": len(errors),
        "error_rate_pct": err_rate,
        "requests_per_second": rps,
        "latencies_ms": global_stats,
        "latencies_by_type": type_stats,
        "sla_p95_under_2000ms": sla_met,
    }

    # Print summary
    print("--- Benchmark Results ---")
    print(f"Total Requests:     {total_requests} ({rps} req/s)")
    print(f"Successful:         {len(all_latencies)}")
    print(f"Errors:             {len(errors)} ({err_rate}%)")
    print("\nLatency Distribution (ms):")
    print(f"  Min:  {global_stats['min']:>8.2f} ms")
    print(f"  Avg:  {global_stats['avg']:>8.2f} ms")
    print(f"  p50:  {global_stats['p50']:>8.2f} ms")
    print(f"  p90:  {global_stats['p90']:>8.2f} ms")
    print(f"  p95:  {global_stats['p95']:>8.2f} ms (Target <= 2000 ms)")
    print(f"  p99:  {global_stats['p99']:>8.2f} ms")
    print(f"  Max:  {global_stats['max']:>8.2f} ms")

    print("\nBy Query Category (p95):")
    code_p95 = type_stats["code"]["p95"]
    text_p95 = type_stats["text"]["p95"]
    filt_p95 = type_stats["filters"]["p95"]
    print(f"  Code (40%):    {code_p95:>8.2f} ms ({len(latencies_by_type['code'])} reqs)")
    print(f"  Text (30%):    {text_p95:>8.2f} ms ({len(latencies_by_type['text'])} reqs)")
    print(f"  Filters (30%): {filt_p95:>8.2f} ms ({len(latencies_by_type['filters'])} reqs)")

    print(f"\nSLA Verdict: {'PASS [OK]' if sla_met else 'FAIL [EXCEEDED]'}\n")

    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Reporte JSON guardado en: {out_file.resolve()}")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Prueba de carga asíncrona para búsqueda MATP")
    parser.add_argument(
        "--url", type=str, default="http://localhost:8000", help="URL base de la API"
    )
    parser.add_argument(
        "--users", type=int, default=10, help="Número de usuarios concurrentes (def: 10)"
    )
    parser.add_argument("--duration", type=int, default=300, help="Duración en segundos (def: 300)")
    parser.add_argument("--smoke", action="store_true", help="Modo smoke test rápido (30 segundos)")
    parser.add_argument(
        "--output",
        type=str,
        default="docs/perf_results.json",
        help="Ruta del archivo JSON de salida",
    )
    parser.add_argument(
        "--auth",
        type=str,
        default="cataloguer@matp.local",
        help="Email o dev user para autenticación",
    )

    args = parser.parse_args()
    dur = 30.0 if args.smoke else float(args.duration)

    asyncio.run(
        run_load_test(
            base_url=args.url,
            concurrency=args.users,
            duration_seconds=dur,
            auth_header=args.auth,
            output_path=args.output,
        )
    )


if __name__ == "__main__":
    main()
