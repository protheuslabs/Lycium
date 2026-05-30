from __future__ import annotations

from typing import Any

import httpx

from app.config import SETTINGS


class SourceIndexClientError(RuntimeError):
    pass


def source_index_client_configured() -> bool:
    return bool(SETTINGS.source_index_api_url)


class SourceIndexClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = (base_url or SETTINGS.source_index_api_url or "").rstrip("/")
        self.timeout_seconds = timeout_seconds or SETTINGS.source_index_timeout_seconds
        self.transport = transport
        if not self.base_url:
            raise SourceIndexClientError("LYCIUM_SOURCE_INDEX_API_URL is not configured.")

    def create_source(
        self,
        *,
        url: str,
        title: str | None = None,
        source_type: str | None = None,
        license: str = "unknown",
        is_free: bool = True,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/sources",
            json={
                "url": url,
                "title": title,
                "source_type": source_type,
                "license": license,
                "is_free": is_free,
            },
        )

    def list_sources(
        self,
        *,
        query: str | None = None,
        domain: str | None = None,
        source_type: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        params = {
            key: value
            for key, value in {
                "query": query,
                "domain": domain,
                "source_type": source_type,
                "limit": limit,
            }.items()
            if value is not None
        }
        payload = self._request(
            "GET",
            "/v1/index/sources",
            params=params,
        )
        return payload if isinstance(payload, list) else []

    def get_source(self, source_id: int) -> dict[str, Any]:
        return self._request("GET", f"/v1/index/sources/{source_id}")

    def list_source_snapshots(self, source_id: int, *, limit: int = 50) -> list[dict[str, Any]]:
        payload = self._request("GET", f"/v1/index/sources/{source_id}/snapshots", params={"limit": limit})
        return payload if isinstance(payload, list) else []

    def create_corpus_run(
        self,
        *,
        consumer: str,
        context_id: str,
        prompt: str,
        source_urls: list[str],
        fetch_sources: bool = True,
        source_documents: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/corpus-runs",
            json={
                "consumer": consumer,
                "context_id": context_id,
                "prompt": prompt,
                "source_urls": source_urls,
                "fetch_sources": fetch_sources,
                "source_documents": source_documents or [],
            },
        )

    def get_corpus_run(self, run_id: int) -> dict[str, Any]:
        return self._request("GET", f"/v1/index/corpus-runs/{run_id}")

    def create_source_packet(
        self,
        *,
        consumer: str,
        context_id: str,
        prompt: str,
        source_urls: list[str],
        fetch_sources: bool = True,
        source_documents: list[dict[str, Any]] | None = None,
        snapshot_limit: int = 1,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/source-packets",
            json={
                "consumer": consumer,
                "context_id": context_id,
                "prompt": prompt,
                "source_urls": source_urls,
                "fetch_sources": fetch_sources,
                "source_documents": source_documents or [],
                "snapshot_limit": snapshot_limit,
            },
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            with httpx.Client(base_url=self.base_url, timeout=self.timeout_seconds, transport=self.transport) as client:
                response = client.request(method, path, **kwargs)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise SourceIndexClientError(f"Source Index request failed: {exc}") from exc


def normalize_remote_source_payload(payload: dict[str, Any]) -> dict[str, Any]:
    created_at = payload.get("created_at")
    updated_at = payload.get("updated_at")
    return {
        **payload,
        "archive_links": payload.get("archive_links") or [],
        "last_verified_at": payload.get("last_verified_at") or updated_at or created_at,
    }
