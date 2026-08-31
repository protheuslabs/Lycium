from __future__ import annotations

import base64
from typing import Any

import docling_wrapper.extract as extract_module
from docling_wrapper.extract import extract_payload


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def test_plain_text_payload_returns_normalized_document() -> None:
    result = extract_payload(
        {
            "contractVersion": "source-extraction-request-v1",
            "consumer": "lycium-course-generation",
            "files": [
                {
                    "filename": "macro-notes.txt",
                    "mimeType": "text/plain",
                    "text": "GDP measures final goods and services. Inflation tracks price levels.",
                }
            ],
        }
    )

    document = result["normalizedDocuments"][0]
    assert result["provider"] == "lycium-docling-wrapper"
    assert document["contractVersion"] == "normalized-document-v1"
    assert document["status"] == "extracted"
    assert document["extractor"]["adapter"] == "plain-text"
    assert "GDP measures" in document["evidence"][0]["text"]
    assert result["sourceRegistrationCandidates"][0]["handoffPolicy"]["sourceIndexShouldNotReExtract"] is True


def test_docling_payload_uses_converter_for_non_text_inputs() -> None:
    class FakeDocument:
        def export_to_markdown(self) -> str:
            return "# Statics\n\nForces resolve into components and moments measure rotational tendency."

    class FakeResult:
        document = FakeDocument()

    class FakeConverter:
        def convert(self, source: str) -> FakeResult:
            assert source.endswith(".pdf")
            return FakeResult()

    def converter_factory() -> Any:
        return FakeConverter()

    result = extract_payload(
        {
            "contractVersion": "source-extraction-request-v1",
            "consumer": "lycium-course-generation",
            "files": [
                {
                    "filename": "statics.pdf",
                    "mimeType": "application/pdf",
                    "base64": _b64(b"%PDF fake statics notes"),
                }
            ],
        },
        converter_factory=converter_factory,
    )

    document = result["normalizedDocuments"][0]
    assert document["status"] == "extracted"
    assert document["extractor"]["adapter"] == "docling"
    assert "Forces resolve" in document["evidence"][0]["text"]


def test_text_backed_pdf_uses_fast_pypdf_path(monkeypatch: Any) -> None:
    class FakePage:
        def __init__(self, text: str) -> None:
            self.text = text

        def extract_text(self) -> str:
            return self.text

    class FakePdfReader:
        def __init__(self, _stream: Any) -> None:
            self.pages = [
                FakePage("Training pipelines need data validation and reproducible runs."),
                FakePage("Deployment needs monitoring, scaling, and rollback plans."),
            ]

    def fail_converter() -> Any:
        raise AssertionError("Docling should not run when pypdf extracts text.")

    monkeypatch.setattr(extract_module, "PdfReader", FakePdfReader)

    result = extract_payload(
        {
            "contractVersion": "source-extraction-request-v1",
            "consumer": "lycium-course-generation",
            "files": [
                {
                    "filename": "ml-systems.pdf",
                    "mimeType": "application/pdf",
                    "base64": _b64(b"%PDF fake course notes"),
                }
            ],
        },
        converter_factory=fail_converter,
    )

    document = result["normalizedDocuments"][0]
    assert document["status"] == "extracted"
    assert document["extractor"]["adapter"] == "pypdf"
    assert "Training pipelines" in document["evidence"][0]["text"]
    assert "Deployment needs" in document["evidence"][0]["text"]


def test_docling_payload_disables_ocr_by_default(monkeypatch: Any) -> None:
    seen_ocr_flags: list[bool] = []

    class FakeDocument:
        def export_to_markdown(self) -> str:
            return "Text-first PDF content."

    class FakeResult:
        document = FakeDocument()

    class FakeConverter:
        def convert(self, source: str) -> FakeResult:
            assert source.endswith(".pdf")
            return FakeResult()

    def fake_docling_converter(*, ocr_enabled: bool = False) -> Any:
        seen_ocr_flags.append(ocr_enabled)
        return FakeConverter()

    monkeypatch.setattr(extract_module, "docling_converter", fake_docling_converter)

    result = extract_payload(
        {
            "contractVersion": "source-extraction-request-v1",
            "consumer": "lycium-course-generation",
            "files": [
                {
                    "filename": "course.pdf",
                    "mimeType": "application/pdf",
                    "base64": _b64(b"%PDF fake course notes"),
                }
            ],
        }
    )

    assert seen_ocr_flags == [False]
    assert result["normalizedDocuments"][0]["extractor"]["ocrEnabled"] is False


def test_docling_payload_can_enable_ocr(monkeypatch: Any) -> None:
    seen_ocr_flags: list[bool] = []

    class FakeDocument:
        def export_to_markdown(self) -> str:
            return "OCR-backed PDF content."

    class FakeResult:
        document = FakeDocument()

    class FakeConverter:
        def convert(self, source: str) -> FakeResult:
            assert source.endswith(".pdf")
            return FakeResult()

    def fake_docling_converter(*, ocr_enabled: bool = False) -> Any:
        seen_ocr_flags.append(ocr_enabled)
        return FakeConverter()

    monkeypatch.setattr(extract_module, "docling_converter", fake_docling_converter)

    result = extract_payload(
        {
            "contractVersion": "source-extraction-request-v1",
            "consumer": "lycium-course-generation",
            "ocr": {"enabled": True},
            "files": [
                {
                    "filename": "scanned-course.pdf",
                    "mimeType": "application/pdf",
                    "base64": _b64(b"%PDF fake scanned course notes"),
                }
            ],
        }
    )

    assert seen_ocr_flags == [True]
    assert result["ocr"] == {"enabled": True}
    assert result["normalizedDocuments"][0]["extractor"]["ocrEnabled"] is True
