from __future__ import annotations

from typing import Any

from app.source_extraction import extract_source_file, extract_source_files
from app.source_extraction.contracts import LOCAL_EXTRACTOR_NAME, LOCAL_EXTRACTOR_REPLACEABLE_BY


FILE_READER_CONTRACT_VERSION = "lycium-file-reader-v1"


def _reader_adapter_from_document(document: dict[str, Any]) -> str:
    extractor = document.get("extractor") if isinstance(document.get("extractor"), dict) else {}
    extractor_name = str(extractor.get("name") or "").strip()
    if extractor_name == LOCAL_EXTRACTOR_NAME:
        return "lycium-local"
    return extractor_name or str(extractor.get("adapter") or "source-extractor").strip()


def generation_input_artifact_from_normalized_document(document: dict[str, Any]) -> dict[str, Any]:
    source = document.get("source") if isinstance(document.get("source"), dict) else {}
    locator = source.get("locator") if isinstance(source.get("locator"), dict) else {}
    snapshot = document.get("snapshot") if isinstance(document.get("snapshot"), dict) else {}
    evidence = document.get("evidence") if isinstance(document.get("evidence"), list) else []
    extracted_text = "\n\n".join(
        str(chunk.get("text") or "").strip()
        for chunk in evidence
        if isinstance(chunk, dict) and str(chunk.get("text") or "").strip()
    )
    artifact_kind = str(locator.get("kind") or "").strip()
    if not artifact_kind:
        artifact_kind = "pdf" if str(locator.get("filename") or "").lower().endswith(".pdf") else "document"
    return {
        "id": str(document.get("documentId") or ""),
        "kind": artifact_kind,
        "filename": str(locator.get("filename") or ""),
        "title": str(source.get("title") or document.get("documentId") or "Input artifact"),
        "mimeType": str(locator.get("mimeType") or snapshot.get("mimeType") or ""),
        "sourceUrl": str(locator.get("sourceUrl") or ""),
        "sourceDocumentUrl": str(locator.get("sourceDocumentUrl") or ""),
        "extractedText": extracted_text,
        "extractionStatus": str(document.get("status") or "failed"),
        "extractionWarnings": document.get("warnings") if isinstance(document.get("warnings"), list) else [],
        "textLength": int(snapshot.get("textLength") or len(extracted_text)),
        "contentHash": str(snapshot.get("contentHash") or ""),
        "normalizedDocumentId": str(document.get("documentId") or ""),
        "sourceRef": str(source.get("sourceRef") or ""),
        "evidenceChunkCount": len(evidence),
        "citation": document.get("citation") if isinstance(document.get("citation"), dict) else {},
        "normalizedDocument": document,
        "reader": {"contractVersion": FILE_READER_CONTRACT_VERSION, "adapter": _reader_adapter_from_document(document)},
    }


def read_generation_input_file(file_payload: dict[str, Any], *, index: int = 1) -> dict[str, Any]:
    return generation_input_artifact_from_normalized_document(extract_source_file(file_payload, index=index))


def read_generation_input_files(files: list[dict[str, Any]] | None) -> dict[str, Any]:
    extraction_run = extract_source_files(files)
    normalized_documents = extraction_run["normalizedDocuments"]
    artifacts = [
        generation_input_artifact_from_normalized_document(document)
        for document in normalized_documents
        if isinstance(document, dict)
    ]
    extracted_artifacts = [artifact for artifact in artifacts if artifact.get("extractionStatus") == "extracted"]
    return {
        "contractVersion": FILE_READER_CONTRACT_VERSION,
        "provider": str(extraction_run.get("provider") or "lycium-local"),
        "replaceableBy": extraction_run.get("replaceableBy") or LOCAL_EXTRACTOR_REPLACEABLE_BY,
        "artifactCount": len(artifacts),
        "extractedArtifactCount": len(extracted_artifacts),
        "artifacts": artifacts,
        "extractionRun": extraction_run,
        "normalizedDocuments": normalized_documents,
        "sourceRegistrationCandidates": extraction_run["sourceRegistrationCandidates"],
    }
