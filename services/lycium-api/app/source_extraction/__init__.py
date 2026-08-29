from __future__ import annotations

from app.source_extraction.contracts import (
    EVIDENCE_CHUNK_CONTRACT_VERSION,
    EXTERNAL_EXTRACTOR_NAME,
    NORMALIZED_DOCUMENT_CONTRACT_VERSION,
    SOURCE_CITATION_CONTRACT_VERSION,
    SOURCE_EXTRACTION_REQUEST_CONTRACT_VERSION,
    SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION,
    SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
)
from app.source_extraction.dispatcher import extract_source_file, extract_source_files
from app.source_extraction.service_client import SourceExtractorClient, SourceExtractorClientError, SourceExtractorCommandClient
from app.source_extraction.source_packet_adapter import source_documents_from_normalized_documents

__all__ = [
    "EVIDENCE_CHUNK_CONTRACT_VERSION",
    "EXTERNAL_EXTRACTOR_NAME",
    "NORMALIZED_DOCUMENT_CONTRACT_VERSION",
    "SOURCE_CITATION_CONTRACT_VERSION",
    "SOURCE_EXTRACTION_REQUEST_CONTRACT_VERSION",
    "SOURCE_EXTRACTION_RUN_CONTRACT_VERSION",
    "SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION",
    "SourceExtractorClient",
    "SourceExtractorClientError",
    "SourceExtractorCommandClient",
    "extract_source_file",
    "extract_source_files",
    "source_documents_from_normalized_documents",
]
