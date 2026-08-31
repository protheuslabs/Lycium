from __future__ import annotations

from app.course_source_packet_mapping import source_records_from_inputs


def test_source_records_from_inputs_preserve_file_citation_metadata_without_source_text() -> None:
    records = source_records_from_inputs(
        ["artifact://file-machine-learning-systems"],
        "Machine Learning Systems",
        source_documents=[
            {
                "url": "artifact://file-machine-learning-systems",
                "title": "Machine Learning Systems.pdf",
                "filename": "Machine Learning Systems.pdf",
                "mimeType": "application/pdf",
                "sourceDocumentUrl": "artifact://file-machine-learning-systems",
                "text": "Large extracted text should remain in the source packet, not the source record.",
                "fetchStatus": "provided",
                "inputArtifactId": "file-machine-learning-systems",
                "inputArtifactKind": "pdf",
                "inputArtifactOrigin": "uploaded_file",
                "sourceRef": "file:sha256:abc123",
                "normalizedDocumentId": "file-machine-learning-systems",
                "evidenceChunks": [{"chunkId": "chunk-1"}, {"chunkId": "chunk-2"}],
                "citation": {
                    "contractVersion": "source-citation-v1",
                    "title": "Machine Learning Systems",
                    "filename": "Machine Learning Systems.pdf",
                    "sourceRef": "file:sha256:abc123",
                },
                "reader": {"adapter": "lycium-docling-wrapper"},
                "extractor": {"adapter": "docling"},
            }
        ],
        source_corpus_synthesis={
            "includedSources": [
                {
                    "url": "artifact://file-machine-learning-systems",
                    "sourceId": "input-source-1",
                }
            ]
        },
    )

    assert records == [
        {
            "id": "input-source-1",
            "type": "pdf",
            "title": "Machine Learning Systems.pdf",
            "url": "artifact://file-machine-learning-systems",
            "usedByCourseTitles": ["Machine Learning Systems"],
            "filename": "Machine Learning Systems.pdf",
            "mimeType": "application/pdf",
            "sourceDocumentUrl": "artifact://file-machine-learning-systems",
            "inputArtifactId": "file-machine-learning-systems",
            "inputArtifactKind": "pdf",
            "inputArtifactOrigin": "uploaded_file",
            "sourceRef": "file:sha256:abc123",
            "normalizedDocumentId": "file-machine-learning-systems",
            "fetchStatus": "provided",
            "citation": {
                "contractVersion": "source-citation-v1",
                "title": "Machine Learning Systems",
                "filename": "Machine Learning Systems.pdf",
                "sourceRef": "file:sha256:abc123",
            },
            "extractor": {"adapter": "docling"},
            "reader": {"adapter": "lycium-docling-wrapper"},
            "evidenceChunkCount": 2,
        }
    ]
    assert "text" not in records[0]
