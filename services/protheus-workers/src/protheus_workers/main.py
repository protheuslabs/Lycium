from __future__ import annotations

import argparse
import os
import time
from datetime import UTC, datetime
from typing import Any

import httpx


def _api_base() -> str:
    return os.getenv("PROTHEUS_API_URL", "http://127.0.0.1:8000").rstrip("/")


def fetch_pending_jobs(client: httpx.Client, *, limit: int) -> list[dict[str, Any]]:
    response = client.get("/v1/jobs", params={"status": "pending", "limit": limit})
    response.raise_for_status()
    return response.json()


def run_job(client: httpx.Client, job_id: int) -> dict[str, Any]:
    response = client.post(f"/v1/jobs/{job_id}/run")
    response.raise_for_status()
    return response.json()


def run_cycle(*, once: bool, max_jobs: int, sleep_seconds: float) -> int:
    processed = 0
    started_at = datetime.now(UTC).isoformat()
    print(f"[protheus-workers] started at {started_at}")

    with httpx.Client(base_url=_api_base(), timeout=30.0) as client:
        while True:
            jobs = fetch_pending_jobs(client, limit=max_jobs)
            if not jobs:
                if once:
                    break
                time.sleep(sleep_seconds)
                continue

            for job in jobs:
                result = run_job(client, int(job["id"]))
                processed += 1
                print(
                    "[protheus-workers] processed job "
                    f"id={result['id']} type={result['job_type']} status={result['status']}"
                )
                if processed >= max_jobs and once:
                    break

            if once:
                break

    ended_at = datetime.now(UTC).isoformat()
    print(f"[protheus-workers] finished at {ended_at} processed={processed}")
    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Protheus async worker loop.")
    parser.add_argument("--once", action="store_true", help="Run one poll cycle and exit.")
    parser.add_argument(
        "--max-jobs",
        type=int,
        default=10,
        help="Maximum jobs to process per run (or per cycle in loop mode).",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=5.0,
        help="Polling interval in seconds when running continuously.",
    )
    args = parser.parse_args()
    run_cycle(once=args.once, max_jobs=max(1, args.max_jobs), sleep_seconds=max(0.25, args.sleep_seconds))


if __name__ == "__main__":
    main()
