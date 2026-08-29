from __future__ import annotations

import json
import shlex
import subprocess
from typing import Any

import httpx

from app.config import SETTINGS
from app.source_extraction.contracts import (
    EXTERNAL_EXTRACTOR_NAME,
    NORMALIZED_DOCUMENT_CONTRACT_VERSION,
    SOURCE_EXTRACTION_REQUEST_CONTRACT_VERSION,
    SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
    source_registration_candidate_from_document,
)


EXTRACTOR_SERVICE_ENDPOINT = "/v1/extractions"


class SourceExtractorClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def source_extractor_client_configured() -> bool:
    return bool(SETTINGS.source_extractor_api_url or SETTINGS.source_extractor_command)


def source_extraction_request_payload(
    files: list[dict[str, Any]] | None,
    *,
    consumer: str = "lycium-course-generation",
    requested_capabilities: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "contractVersion": SOURCE_EXTRACTION_REQUEST_CONTRACT_VERSION,
        "consumer": consumer,
        "files": files or [],
        "requestedCapabilities": requested_capabilities or ["text", "layout", "tables"],
        "ocr": {"enabled": False, "mode": "explicit"},
    }


class SourceExtractorClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = (base_url or SETTINGS.source_extractor_api_url or "").rstrip("/")
        self.timeout_seconds = timeout_seconds or SETTINGS.source_extractor_timeout_seconds
        self.transport = transport
        if not self.base_url:
            raise SourceExtractorClientError("LYCIUM_SOURCE_EXTRACTOR_API_URL is not configured.")

    def extract_files(
        self,
        files: list[dict[str, Any]] | None,
        *,
        consumer: str = "lycium-course-generation",
        requested_capabilities: list[str] | None = None,
    ) -> dict[str, Any]:
        payload = self._request(
            "POST",
            EXTRACTOR_SERVICE_ENDPOINT,
            json=source_extraction_request_payload(
                files,
                consumer=consumer,
                requested_capabilities=requested_capabilities,
            ),
        )
        return normalize_extraction_run_response(payload)

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
            raise SourceExtractorClientError(
                f"Source Extractor request failed: {status_code} {exc.response.reason_phrase}{detail}",
                status_code=status_code,
            ) from exc
        except httpx.HTTPError as exc:
            raise SourceExtractorClientError(f"Source Extractor request failed: {exc}") from exc


class SourceExtractorCommandClient:
    def __init__(
        self,
        *,
        command: str | None = None,
        cwd: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.command = command or SETTINGS.source_extractor_command or ""
        self.cwd = cwd
        if self.cwd is None and SETTINGS.source_extractor_working_dir is not None:
            self.cwd = str(SETTINGS.source_extractor_working_dir)
        self.timeout_seconds = timeout_seconds or SETTINGS.source_extractor_timeout_seconds
        if not self.command:
            raise SourceExtractorClientError("LYCIUM_SOURCE_EXTRACTOR_COMMAND is not configured.")

    def extract_files(
        self,
        files: list[dict[str, Any]] | None,
        *,
        consumer: str = "lycium-course-generation",
        requested_capabilities: list[str] | None = None,
    ) -> dict[str, Any]:
        request_payload = source_extraction_request_payload(
            files,
            consumer=consumer,
            requested_capabilities=requested_capabilities,
        )
        try:
            result = subprocess.run(
                shlex.split(self.command),
                input=json.dumps(request_payload),
                text=True,
                capture_output=True,
                cwd=self.cwd,
                timeout=self.timeout_seconds,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise SourceExtractorClientError(f"External extractor command failed: {exc}") from exc

        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()[:500]
            suffix = f": {detail}" if detail else ""
            raise SourceExtractorClientError(f"External extractor command exited with {result.returncode}{suffix}")

        try:
            payload = json.loads(result.stdout)
        except ValueError as exc:
            raise SourceExtractorClientError("External extractor command did not return valid JSON.") from exc

        return normalize_extraction_run_response(payload)


def normalize_extraction_run_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SourceExtractorClientError("Source Extractor response was not a JSON object.")

    documents = payload.get("normalizedDocuments")
    if documents is None:
        documents = payload.get("documents")
    if not isinstance(documents, list):
        raise SourceExtractorClientError("Source Extractor response did not include normalizedDocuments.")

    normalized_documents = [document for document in documents if isinstance(document, dict)]
    for document in normalized_documents:
        document.setdefault("contractVersion", NORMALIZED_DOCUMENT_CONTRACT_VERSION)

    extracted_documents = [document for document in normalized_documents if document.get("status") == "extracted"]
    candidates = payload.get("sourceRegistrationCandidates")
    if not isinstance(candidates, list):
        candidates = [source_registration_candidate_from_document(document) for document in extracted_documents]

    return {
        **payload,
        "contractVersion": payload.get("contractVersion") or SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
        "provider": payload.get("provider") or EXTERNAL_EXTRACTOR_NAME,
        "documentContractVersion": payload.get("documentContractVersion") or NORMALIZED_DOCUMENT_CONTRACT_VERSION,
        "documentCount": int(payload.get("documentCount") or len(normalized_documents)),
        "extractedDocumentCount": int(payload.get("extractedDocumentCount") or len(extracted_documents)),
        "normalizedDocuments": normalized_documents,
        "sourceRegistrationCandidates": candidates,
    }
