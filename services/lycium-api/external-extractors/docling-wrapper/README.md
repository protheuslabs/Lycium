# Lycium Docling Wrapper

This package adapts Docling into Lycium's external source extraction contract.

It is intentionally separate from `lycium-api` so Docling and its heavier parser/model dependencies do not become course-generation dependencies.

## Install

```bash
cd services/lycium-api/external-extractors/docling-wrapper
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
```

## Run

The wrapper reads `source-extraction-request-v1` JSON from stdin and writes `source-extraction-run-v1` JSON to stdout:

```bash
python -m docling_wrapper.extract < /tmp/source-extraction-request.json > /tmp/source-extraction-run.json
```

Point Lycium at it:

```bash
LYCIUM_SOURCE_EXTRACTOR_COMMAND="/absolute/path/to/services/lycium-api/external-extractors/docling-wrapper/.venv/bin/python -m docling_wrapper.extract"
LYCIUM_SOURCE_EXTRACTOR_CWD="/absolute/path/to/services/lycium-api/external-extractors/docling-wrapper"
```

Text-backed PDFs are read with a fast `pypdf` path first, then fall back to Docling when text extraction is empty or unavailable. Docling is used for Office documents, images, HTML, scanned PDFs, and other non-plain-text inputs. Plain text and Markdown are decoded directly to keep the wrapper fast for simple uploads.

OCR is disabled by default because Lycium treats OCR as an explicit, higher-cost extraction capability. Text-backed PDFs should extract normally; scanned PDFs or image-only inputs may return empty text until the extraction request includes `"ocr": { "enabled": true }`.
