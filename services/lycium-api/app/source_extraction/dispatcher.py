from __future__ import annotations

from typing import Any, Protocol

from app.config import SETTINGS
from app.source_extraction.contracts import EXTERNAL_EXTRACTOR_NAME
from app.source_extraction.local import (
    extract_source_file as extract_source_file_local,
    extract_source_files as extract_source_files_local,
)
from app.source_extraction.service_client import (
    SourceExtractorClient,
    SourceExtractorCommandClient,
    SourceExtractorClientError,
)


class SourceExtractorClientLike(Protocol):
    def extract_files(self, files: list[dict[str, Any]] | None) -> dict[str, Any]: ...


def _remote_extraction_client() -> SourceExtractorClientLike | None:
    if SETTINGS.source_extractor_command:
        cwd = str(SETTINGS.source_extractor_working_dir) if SETTINGS.source_extractor_working_dir else None
        return SourceExtractorCommandClient(
            command=SETTINGS.source_extractor_command,
            cwd=cwd,
            timeout_seconds=SETTINGS.source_extractor_timeout_seconds,
        )
    if SETTINGS.source_extractor_api_url:
        return SourceExtractorClient(
            base_url=SETTINGS.source_extractor_api_url,
            timeout_seconds=SETTINGS.source_extractor_timeout_seconds,
        )
    return None


def _with_external_fallback_metadata(run: dict[str, Any], exc: SourceExtractorClientError) -> dict[str, Any]:
    warnings = run.get("warnings") if isinstance(run.get("warnings"), list) else []
    return {
        **run,
        "warnings": [*warnings, "external_extractor_failed_local_fallback_used"],
        "externalExtractor": {
            "provider": EXTERNAL_EXTRACTOR_NAME,
            "status": "fallback",
            "error": str(exc),
            "statusCode": exc.status_code,
        },
    }


def extract_source_files(
    files: list[dict[str, Any]] | None,
    *,
    extractor_client: SourceExtractorClientLike | None = None,
) -> dict[str, Any]:
    client = extractor_client or _remote_extraction_client()
    if client is not None:
        try:
            return client.extract_files(files)
        except SourceExtractorClientError as exc:
            if not SETTINGS.source_extractor_local_fallback_enabled:
                raise
            return _with_external_fallback_metadata(extract_source_files_local(files), exc)

    return extract_source_files_local(files)


def extract_source_file(
    file_payload: dict[str, Any],
    *,
    index: int = 1,
    extractor_client: SourceExtractorClientLike | None = None,
) -> dict[str, Any]:
    if extractor_client is None and not (SETTINGS.source_extractor_command or SETTINGS.source_extractor_api_url):
        return extract_source_file_local(file_payload, index=index)

    run = extract_source_files([file_payload], extractor_client=extractor_client)
    documents = [document for document in run.get("normalizedDocuments", []) if isinstance(document, dict)]
    if documents:
        return documents[0]
    return extract_source_file_local(file_payload, index=index)
