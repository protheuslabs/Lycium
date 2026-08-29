# External Extractors

This directory is reserved for housed external extractor repos or thin wrapper scripts around them.

Lycium course generation should not import large extractor libraries directly. Instead, configure one of these integration points:

```text
LYCIUM_SOURCE_EXTRACTOR_COMMAND="python services/lycium-api/external-extractors/<repo-or-wrapper>/extract.py"
LYCIUM_SOURCE_EXTRACTOR_CWD=/absolute/path/to/Lyceum
```

or:

```text
LYCIUM_SOURCE_EXTRACTOR_API_URL=http://127.0.0.1:8010
```

A command wrapper must read `source-extraction-request-v1` JSON from stdin and write `source-extraction-run-v1` JSON to stdout. The external repo can use Docling, PyMuPDF, Unstructured, Tika, OCR tools, or any other extractor behind that wrapper.
