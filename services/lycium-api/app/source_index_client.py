from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import SETTINGS


class SourceIndexClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def source_index_client_configured() -> bool:
    return bool(SETTINGS.source_index_api_url)


SOURCE_INDEX_PACKET_ENDPOINT = "/v1/source-packets"
LEGACY_LYCIUM_PACKET_ENDPOINT = "/v1/index/source-packets"
PACKET_ENDPOINT_COMPATIBILITY_STATUSES = {404, 405, 422}

SOURCE_INDEX_TARGET_STOPWORDS = {
    "about",
    "basic",
    "basics",
    "build",
    "class",
    "course",
    "create",
    "curriculum",
    "for",
    "from",
    "generate",
    "intro",
    "introduction",
    "introductory",
    "learn",
    "make",
    "module",
    "modules",
    "principle",
    "principles",
    "section",
    "sections",
    "teach",
    "undergrad",
    "undergraduate",
    "with",
}


def _slug(value: str) -> str:
    slug = "-".join(re.findall(r"[a-z0-9]+", value.lower()))
    return slug[:96].strip("-") or "generated-course"


def _prompt_concepts(prompt: str, *, limit: int = 12) -> list[str]:
    concepts: list[str] = []
    seen: set[str] = set()
    for raw_token in re.findall(r"[A-Za-z][A-Za-z0-9+#-]{2,}", prompt):
        token = raw_token.strip("-").lower()
        if token in SOURCE_INDEX_TARGET_STOPWORDS or token in seen:
            continue
        seen.add(token)
        concepts.append(raw_token.strip())
        if len(concepts) >= limit:
            break
    return concepts


def source_index_target_from_prompt(
    *,
    prompt: str,
    context_id: str,
    source_urls: list[str] | None = None,
) -> dict[str, Any]:
    title = " ".join(prompt.split())[:140] or context_id
    concepts = _prompt_concepts(prompt)
    metadata: dict[str, Any] = {"prompt": prompt}
    if source_urls:
        metadata["submitted_source_urls"] = [str(url) for url in source_urls]
    return {
        "target_id": f"course:{_slug(title)}",
        "target_type": "course",
        "title": title,
        "description": prompt,
        "concepts": concepts,
        "requirements": [
            "support course template generation",
            "support module planning",
            "support section-level lesson evidence",
        ],
        "metadata": metadata,
    }


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

    def import_source_batch(self, *, batch_id: str | None = None, sources: list[dict[str, Any]]) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/source-imports",
            json={
                "batch_id": batch_id,
                "sources": sources,
            },
        )

    def search_index(self, *, query: str, filters: dict[str, Any] | None = None, limit: int = 12) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/search",
            json={
                "query": query,
                "filters": filters or {},
                "limit": limit,
            },
        )

    def analyze_source_fit(
        self,
        *,
        sources: list[dict[str, Any]],
        targets: list[dict[str, Any]],
        limit: int = 20,
        minimum_score: float = 0.15,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/index/source-fit",
            json={
                "sources": sources,
                "targets": targets,
                "limit": limit,
                "minimum_score": minimum_score,
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

    def get_source_packet(self, packet_id: int | str) -> dict[str, Any]:
        try:
            return self._request("GET", f"{SOURCE_INDEX_PACKET_ENDPOINT}/{packet_id}")
        except SourceIndexClientError as exc:
            if exc.status_code not in PACKET_ENDPOINT_COMPATIBILITY_STATUSES:
                raise
        return self._request("GET", f"{LEGACY_LYCIUM_PACKET_ENDPOINT}/{packet_id}")

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
        target: dict[str, Any] | None = None,
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        legacy_payload = {
            "consumer": consumer,
            "context_id": context_id,
            "prompt": prompt,
            "source_urls": source_urls,
            "fetch_sources": fetch_sources,
            "source_documents": source_documents or [],
            "snapshot_limit": snapshot_limit,
        }
        packet_constraints = {
            "minimum_quality_tier": "usable",
            "preferred_source_roles": ["open_textbook", "open_courseware", "syllabus", "curriculum_benchmark", "lesson_evidence"],
            "metadata": {
                "submitted_source_urls": source_urls,
                "fetch_sources": fetch_sources,
                "snapshot_limit": snapshot_limit,
                "source_document_count": len(source_documents or []),
            },
        }
        if constraints:
            packet_constraints = {
                **packet_constraints,
                **constraints,
                "metadata": {
                    **packet_constraints["metadata"],
                    **(constraints.get("metadata") if isinstance(constraints.get("metadata"), dict) else {}),
                },
            }
        try:
            return self._request(
                "POST",
                SOURCE_INDEX_PACKET_ENDPOINT,
                json={
                    "consumer": consumer,
                    "context_id": context_id,
                    "target": target
                    or source_index_target_from_prompt(
                        prompt=prompt,
                        context_id=context_id,
                        source_urls=source_urls,
                    ),
                    "constraints": packet_constraints,
                },
            )
        except SourceIndexClientError as exc:
            if exc.status_code not in PACKET_ENDPOINT_COMPATIBILITY_STATUSES:
                raise
        return self._request(
            "POST",
            LEGACY_LYCIUM_PACKET_ENDPOINT,
            json=legacy_payload,
        )

    def create_legacy_source_packet(
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
            LEGACY_LYCIUM_PACKET_ENDPOINT,
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
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            detail = ""
            try:
                body = exc.response.json()
                detail_value = body.get("detail") if isinstance(body, dict) else body
                detail = f": {detail_value}" if detail_value else ""
            except ValueError:
                if exc.response.text:
                    detail = f": {exc.response.text[:300]}"
            raise SourceIndexClientError(
                f"Source Index request failed: {status_code} {exc.response.reason_phrase}{detail}",
                status_code=status_code,
            ) from exc
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
