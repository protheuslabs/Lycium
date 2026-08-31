# External Extractor Integration

Lycium should integrate with a proven external extractor repo instead of building its own extraction engine right now.

## Goal

Turn direct inputs into citable evidence that AI workflows can use:

```text
PDF/text/source input -> external extractor repo -> normalized-document-v1 -> Lycium or Source Index
```

Lycium can keep a small local reader for development and legacy tests, but the durable integration point is `external-source-extractor`: an adapter boundary that can call an external repo housed under the backend.

## Lycium Integration

Lycium supports two external integration modes.

Use a command when the external repo is downloaded into the backend and exposed through a wrapper script:

```text
LYCIUM_SOURCE_EXTRACTOR_COMMAND="/absolute/path/to/services/lycium-api/external-extractors/docling-wrapper/.venv/bin/python -m docling_wrapper.extract"
LYCIUM_SOURCE_EXTRACTOR_CWD=/absolute/path/to/services/lycium-api/external-extractors/docling-wrapper
```

Use HTTP when the external extractor repo ships or is wrapped as a server:

```text
LYCIUM_SOURCE_EXTRACTOR_API_URL=http://localhost:8010
```

Both integrations speak the same JSON contract. The command receives request JSON on stdin and returns response JSON on stdout. The HTTP service receives:

```text
POST /v1/extractions
```

If no external extractor is configured, Lycium uses the existing local plain-text and `pypdf` reader as an offline fallback. If an external extractor is configured and fails, Lycium should fail visibly by default. Set `LYCIUM_SOURCE_EXTRACTOR_LOCAL_FALLBACK=true` only for development sessions where fallback is preferred.

`LYCIUM_SOURCE_EXTRACTOR_COMMAND` is parsed with shell-style argument splitting. Quote any path segment that contains spaces.

## Request Contract

```json
{
  "contractVersion": "source-extraction-request-v1",
  "consumer": "lycium-course-generation",
  "files": [
    {
      "filename": "course-source.pdf",
      "mimeType": "application/pdf",
      "base64": "..."
    }
  ],
  "requestedCapabilities": ["text", "layout", "tables"],
  "ocr": {
    "enabled": false,
    "mode": "explicit"
  }
}
```

OCR should stay explicit. A scanned PDF should return a clear status or warning such as `needs_ocr` or `pdf_text_empty_or_scanned` until OCR is requested.

## Response Contract

The service returns the same evidence contracts Lycium already consumes:

- `source-extraction-run-v1`
- `normalized-document-v1`
- `evidence-chunk-v1`
- `source-citation-v1`
- `source-registration-candidate-v1`

The normalized document is the important portable object. It should include source locator metadata, snapshot hash, bounded evidence chunks, page or structural location metadata, citation metadata, extractor provenance, warnings, and extraction status.

## Large-Source Roadmap

Large sources such as textbooks, long PDFs, manuals, and book-length reports should eventually return a compact document map alongside evidence chunks. Early course planning stages should prefer that map over rereading the whole extracted text.

Future extractor capabilities should attempt to preserve:

- table of contents entries and hierarchy;
- chapter, heading, page, section, appendix, glossary, and index-term structure;
- figure, table, equation, example, exercise, and summary locations;
- a compact concept inventory and source digest derived from structural signals;
- stable chunk refs so course template, module outline, section planning, and section fill workflows can request the smallest useful evidence for their stage.

This should stay optional and adapter-shaped. If an extractor cannot emit a document map, Lycium should fall back to bounded evidence chunks and deterministic source-corpus summaries. The target future contract can be versioned separately, such as `document-map-v1` or `source-digest-v1`, without changing the base `normalized-document-v1` evidence contract.

## Adapter Strategy

The external repo or wrapper should choose adapters behind the contract:

- `plain-text`: direct text, Markdown, transcripts, and simple HTML-ish text.
- `pypdf`: fast fallback for text-backed PDFs.
- `docling`: preferred first external repo for richer PDF, Office document, table, and layout extraction.
- `pymupdf`: future PDF/OCR-heavy adapter path when page rendering or Tesseract-backed OCR is needed.
- `unstructured` or `tika`: possible later adapters for broad enterprise file coverage.

Lycium should not import these libraries directly in course generation. It should only call the housed external wrapper or HTTP adapter and consume `normalized-document-v1`.

## Source Index Relationship

Source Index should not be the mandatory extractor. It should receive `source-registration-candidate-v1` records when extracted evidence should become durable, canonical, searchable source inventory.

That means:

```text
Lycium direct upload -> Extractor -> usable generation evidence
                         |
                         -> optional Source Index registration
```

If Source Index later canonicalizes the same source hash, Lycium can upgrade provenance from local/direct evidence refs to durable Source Index IDs without regenerating course content.

## Build Order

1. Keep Lycium's local extractor as a simple fallback.
2. Add command and HTTP integration boundaries in Lycium.
3. Use `services/lycium-api/external-extractors/docling-wrapper/` as the first wrapper package.
4. Install Docling as that wrapper's dependency, not as a `lycium-api` dependency.
5. Run `corepack pnpm test:docling-wrapper` plus the file-backed course generation tests before using it in the app.
6. Add OCR as a separate explicit capability with its own tests, costs, warnings, and provenance.
7. Let Source Index ingest normalized documents after extraction rather than re-extracting the same source.
8. Add large-source document-map/source-digest extraction so book-length inputs can guide course template and module planning without sending full extracted text through every workflow.
