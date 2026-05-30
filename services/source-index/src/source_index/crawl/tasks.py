from __future__ import annotations

from typing import Any

from source_index.crawl.contracts import CrawlTask


def build_seed_tasks(
    *,
    crawl_run_id: int,
    policy_id: int,
    seed_urls: list[str],
    policy: dict[str, Any],
) -> list[CrawlTask]:
    return [
        CrawlTask(
            crawl_run_id=crawl_run_id,
            policy_id=policy_id,
            url=url,
            depth=0,
            policy=policy,
            trace={"seed_index": index, "source": "crawl_run.seed_urls"},
        )
        for index, url in enumerate(seed_urls)
    ]


def crawl_task_payload(task: CrawlTask) -> dict[str, Any]:
    return task.model_dump(mode="json")
