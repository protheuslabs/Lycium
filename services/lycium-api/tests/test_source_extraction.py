from __future__ import annotations

import base64
import json
import sys
from dataclasses import replace
from typing import Any

import httpx
import pytest

from app.file_input_reader import read_generation_input_files
from app.source_corpus import compile_generation_source_corpus
from app.source_extraction import (
    SourceExtractorClient,
    SourceExtractorClientError,
    SourceExtractorCommandClient,
    extract_source_file,
    extract_source_files,
    source_documents_from_normalized_documents,
)
from app.source_extraction import dispatcher as dispatcher_module


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _remote_normalized_document() -> dict[str, Any]:
    return {
        "contractVersion": "normalized-document-v1",
        "documentId": "remote-doc-1",
        "status": "extracted",
        "source": {
            "sourceRef": "file:sha256:remote-doc-hash",
            "title": "Remote document",
            "locator": {
                "type": "uploaded_file",
                "kind": "pdf",
                "filename": "remote.pdf",
                "mimeType": "application/pdf",
                "sourceDocumentUrl": "artifact://remote-doc-1",
            },
        },
        "snapshot": {
            "contentHash": "remote-doc-hash",
            "mimeType": "application/pdf",
            "byteLength": 27,
            "textLength": 42,
        },
        "citation": {
            "contractVersion": "source-citation-v1",
            "title": "Remote document",
            "filename": "remote.pdf",
            "sourceRef": "file:sha256:remote-doc-hash",
            "page": 2,
        },
        "evidence": [
            {
                "contractVersion": "evidence-chunk-v1",
                "chunkId": "remote-doc-1-chunk-1",
                "documentId": "remote-doc-1",
                "sourceRef": "file:sha256:remote-doc-hash",
                "heading": "Page 2",
                "text": "Remote extractor preserved table-aware source evidence.",
                "location": {"chunkIndex": 1, "page": 2},
                "citation": {
                    "contractVersion": "source-citation-v1",
                    "title": "Remote document",
                    "filename": "remote.pdf",
                    "sourceRef": "file:sha256:remote-doc-hash",
                    "page": 2,
                },
                "contentHash": "remote-chunk-hash",
                "snapshotContentHash": "remote-doc-hash",
            }
        ],
        "extractor": {
            "contractVersion": "source-extraction-run-v1",
            "name": "external-source-extractor",
            "version": "extractor-service-v1",
            "adapter": "docling",
            "replaceableBy": "extractor-adapter-stack",
        },
        "warnings": [],
        "extractedAt": "2026-08-28T00:00:00+00:00",
    }


def test_text_source_extraction_returns_normalized_document_contract() -> None:
    document = extract_source_file(
        {
            "filename": "macro-notes.txt",
            "mimeType": "text/plain",
            "text": "GDP measures final goods and services. Inflation tracks changes in price levels.",
        }
    )

    assert document["contractVersion"] == "normalized-document-v1"
    assert document["status"] == "extracted"
    assert document["documentId"].startswith("file-")
    assert document["source"]["sourceRef"].startswith("file:sha256:")
    assert document["snapshot"]["textLength"] > 0
    assert document["citation"]["filename"] == "macro-notes.txt"
    assert document["evidence"][0]["contractVersion"] == "evidence-chunk-v1"
    assert "GDP measures" in document["evidence"][0]["text"]
    assert document["extractor"]["replaceableBy"] == "external-source-extractor"


def test_pdf_source_extraction_preserves_page_citations(monkeypatch) -> None:
    class FakePage:
        def __init__(self, text: str) -> None:
            self.text = text

        def extract_text(self) -> str:
            return self.text

    class FakePdfReader:
        def __init__(self, _stream: Any) -> None:
            self.pages = [
                FakePage("Vectors resolve forces into components."),
                FakePage("Equilibrium requires sum of forces and moments to equal zero."),
            ]

    monkeypatch.setattr("app.source_extraction.local.PdfReader", FakePdfReader)

    document = extract_source_file(
        {
            "filename": "statics-notes.pdf",
            "mimeType": "application/pdf",
            "base64": _b64(b"%PDF fake bytes"),
        }
    )

    assert document["status"] == "extracted"
    assert document["extractor"]["adapter"] == "pypdf"
    assert [chunk["location"]["page"] for chunk in document["evidence"]] == [1, 2]
    assert document["evidence"][1]["citation"]["page"] == 2
    assert "moments" in document["evidence"][1]["text"]


def test_http_extractor_client_uses_external_contract_and_normalizes_response() -> None:
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content.decode("utf-8")))
        assert request.url.path == "/v1/extractions"
        return httpx.Response(200, json={"normalizedDocuments": [_remote_normalized_document()]})

    client = SourceExtractorClient(base_url="http://extractor.test", transport=httpx.MockTransport(handler))
    result = extract_source_files(
        [{"filename": "remote.pdf", "mimeType": "application/pdf", "base64": _b64(b"%PDF remote fake")}],
        extractor_client=client,
    )

    assert requests[0]["contractVersion"] == "source-extraction-request-v1"
    assert requests[0]["consumer"] == "lycium-course-generation"
    assert requests[0]["ocr"] == {"enabled": False, "mode": "explicit"}
    assert result["provider"] == "external-source-extractor"
    assert result["documentContractVersion"] == "normalized-document-v1"
    assert result["normalizedDocuments"][0]["extractor"]["adapter"] == "docling"
    assert result["sourceRegistrationCandidates"][0]["handoffPolicy"]["sourceIndexShouldNotReExtract"] is True


def test_command_extractor_client_supports_housed_external_repo_wrapper(tmp_path) -> None:
    wrapper = tmp_path / "extractor_wrapper.py"
    wrapper.write_text(
        """
import json
import sys

request = json.loads(sys.stdin.read())
assert request["contractVersion"] == "source-extraction-request-v1"
print(json.dumps({"provider": "housed-docling-wrapper", "normalizedDocuments": [
    {
        "contractVersion": "normalized-document-v1",
        "documentId": "command-doc-1",
        "status": "extracted",
        "source": {
            "sourceRef": "file:sha256:command-doc-hash",
            "title": "Command document",
            "locator": {
                "type": "uploaded_file",
                "kind": "pdf",
                "filename": "command.pdf",
                "mimeType": "application/pdf",
                "sourceDocumentUrl": "artifact://command-doc-1"
            }
        },
        "snapshot": {
            "contentHash": "command-doc-hash",
            "mimeType": "application/pdf",
            "byteLength": 27,
            "textLength": 37
        },
        "citation": {
            "contractVersion": "source-citation-v1",
            "title": "Command document",
            "filename": "command.pdf",
            "sourceRef": "file:sha256:command-doc-hash"
        },
        "evidence": [
            {
                "contractVersion": "evidence-chunk-v1",
                "chunkId": "command-doc-1-chunk-1",
                "documentId": "command-doc-1",
                "sourceRef": "file:sha256:command-doc-hash",
                "heading": "Page 1",
                "text": "Command wrapper extraction works.",
                "location": {"chunkIndex": 1, "page": 1},
                "citation": {
                    "contractVersion": "source-citation-v1",
                    "title": "Command document",
                    "filename": "command.pdf",
                    "sourceRef": "file:sha256:command-doc-hash",
                    "page": 1
                },
                "contentHash": "command-chunk-hash",
                "snapshotContentHash": "command-doc-hash"
            }
        ],
        "extractor": {
            "contractVersion": "source-extraction-run-v1",
            "name": "housed-docling-wrapper",
            "version": "test-wrapper-v1",
            "adapter": "docling",
            "replaceableBy": "external-source-extractor"
        },
        "warnings": [],
        "extractedAt": "2026-08-28T00:00:00+00:00"
    }
]}))
""".strip()
    )

    client = SourceExtractorCommandClient(
        command=f"{sys.executable} {wrapper}",
        timeout_seconds=5,
    )
    result = extract_source_files(
        [{"filename": "command.pdf", "mimeType": "application/pdf", "base64": _b64(b"%PDF command fake")}],
        extractor_client=client,
    )

    assert result["provider"] == "housed-docling-wrapper"
    assert result["normalizedDocuments"][0]["extractor"]["adapter"] == "docling"
    assert result["sourceRegistrationCandidates"][0]["sourceRef"] == "file:sha256:command-doc-hash"


def test_remote_extractor_failure_falls_back_to_local_extraction_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(
        dispatcher_module,
        "SETTINGS",
        replace(dispatcher_module.SETTINGS, source_extractor_local_fallback_enabled=True),
    )

    class FailingExtractorClient:
        def extract_files(self, _files: list[dict[str, Any]] | None) -> dict[str, Any]:
            raise SourceExtractorClientError("Source Extractor request failed: connection refused")

    result = extract_source_files(
        [{"filename": "fallback-notes.txt", "mimeType": "text/plain", "text": "Fallback extraction still works."}],
        extractor_client=FailingExtractorClient(),
    )

    assert result["provider"] == "lycium-local"
    assert result["externalExtractor"]["status"] == "fallback"
    assert result["externalExtractor"]["provider"] == "external-source-extractor"
    assert "external_extractor_failed_local_fallback_used" in result["warnings"]
    assert result["normalizedDocuments"][0]["status"] == "extracted"


def test_remote_extractor_failure_raises_without_local_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        dispatcher_module,
        "SETTINGS",
        replace(dispatcher_module.SETTINGS, source_extractor_local_fallback_enabled=False),
    )

    class FailingExtractorClient:
        def extract_files(self, _files: list[dict[str, Any]] | None) -> dict[str, Any]:
            raise SourceExtractorClientError("Source Extractor request failed: connection refused")

    with pytest.raises(SourceExtractorClientError, match="connection refused"):
        extract_source_files(
            [{"filename": "fallback-notes.txt", "mimeType": "text/plain", "text": "Fallback extraction is disabled."}],
            extractor_client=FailingExtractorClient(),
        )


def test_file_input_reader_keeps_legacy_artifacts_and_normalized_documents() -> None:
    result = read_generation_input_files(
        [
            {
                "filename": "chemistry-notes.md",
                "mimeType": "text/markdown",
                "content": "Stoichiometry uses mole ratios to connect balanced reactions to quantities.",
            }
        ]
    )
    artifact = result["artifacts"][0]
    normalized_document = result["normalizedDocuments"][0]

    assert result["contractVersion"] == "lycium-file-reader-v1"
    assert result["replaceableBy"] == "external-source-extractor"
    assert result["extractedArtifactCount"] == 1
    assert artifact["sourceDocumentUrl"].startswith("artifact://")
    assert artifact["normalizedDocumentId"] == normalized_document["documentId"]
    assert artifact["normalizedDocument"]["contractVersion"] == "normalized-document-v1"
    assert result["sourceRegistrationCandidates"][0]["handoffPolicy"]["registrationRequiredForGeneration"] is False


def test_input_artifact_reader_endpoint_returns_normalized_documents(client) -> None:
    response = client.post(
        "/v1/input-artifacts/read",
        json={
            "files": [
                {
                    "filename": "economics-notes.txt",
                    "mimeType": "text/plain",
                    "base64": _b64(b"GDP, inflation, unemployment, and monetary policy."),
                }
            ]
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["artifacts"][0]["extractionStatus"] == "extracted"
    assert payload["normalizedDocuments"][0]["contractVersion"] == "normalized-document-v1"
    assert payload["sourceRegistrationCandidates"][0]["contractVersion"] == "source-registration-candidate-v1"


def test_normalized_documents_adapt_to_generation_source_documents() -> None:
    reader_result = read_generation_input_files(
        [
            {
                "filename": "macroeconomics-syllabus.txt",
                "mimeType": "text/plain",
                "text": (
                    "Macroeconomics principles cover GDP, inflation, unemployment, "
                    "aggregate demand, fiscal policy, and monetary policy."
                ),
            }
        ]
    )
    source_documents = source_documents_from_normalized_documents(reader_result["normalizedDocuments"])

    assert len(source_documents) == 1
    assert source_documents[0]["sourceType"] == "direct_evidence"
    assert source_documents[0]["filename"] == "macroeconomics-syllabus.txt"
    assert source_documents[0]["mimeType"] == "text/plain"
    assert source_documents[0]["sourceDocumentUrl"].startswith("artifact://")
    assert source_documents[0]["normalizedDocumentId"] == reader_result["normalizedDocuments"][0]["documentId"]
    assert source_documents[0]["evidenceChunks"][0]["citation"]["filename"] == "macroeconomics-syllabus.txt"


def test_source_corpus_preflight_preserves_direct_evidence_metadata() -> None:
    reader_result = read_generation_input_files(
        [
            {
                "filename": "macroeconomics-syllabus.txt",
                "mimeType": "text/plain",
                "text": (
                    "Macroeconomics principles cover GDP, inflation, unemployment, "
                    "aggregate demand, fiscal policy, and monetary policy."
                ),
            }
        ]
    )
    corpus = compile_generation_source_corpus(
        prompt="macroeconomics principles GDP inflation unemployment monetary policy course",
        source_urls=[],
        fetch_sources=False,
        input_artifacts=reader_result["artifacts"],
    )

    assert corpus.synthesis["metrics"]["includedInputArtifactCount"] == 1
    assert corpus.source_documents[0]["sourceType"] == "direct_evidence"
    assert corpus.source_documents[0]["filename"] == "macroeconomics-syllabus.txt"
    assert corpus.source_documents[0]["directEvidenceRef"].startswith("file:sha256:")
    assert corpus.source_documents[0]["evidenceChunks"][0]["contractVersion"] == "evidence-chunk-v1"
