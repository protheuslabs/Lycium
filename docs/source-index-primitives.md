# Source Index primitives

Source Index should stay useful outside Lycium course generation. The primitive flow is:

```text
curated source batch -> source import -> source packet -> downstream consumer
```

The source batch is not course-specific. A downstream consumer supplies the prompt, context id, and threshold expectations.

The formal portable contracts are:

- `@lycium/contracts/schemas/lycium-source-import-batch.schema.json`
- `@lycium/contracts/schemas/lycium-source-packet.schema.json`

Course generation should prefer source packets over loose URL lists when packet evidence is available. Loose URLs remain a fallback for quick experiments and legacy callers.

Each source packet includes a `quality` summary. Downstream generators should treat packets with `quality.status: "usable"` as generation-ready evidence. Packets marked `needs_review` or `empty` should stay inspectable, but should not be used as the only grounding evidence for a publishable course without reviewer approval.

The packet quality report is the first reusable evidence-health primitive for Lycium and future Protheus research systems. It reports document, snapshot, and evidence coverage; duplicate canonical URLs; broken-link counts; source type mix; average trust; freshness and verification coverage; stale verification count; curriculum-benchmark source count; benchmark usefulness ratio; and quality warnings.

## Direct source extraction

Source Index owns durable evidence identity and retrieval, but it should not be the mandatory extraction hop for sources Lycium already has. User-uploaded PDFs, text files, Markdown notes, pasted source text, and later fetched direct URLs should use the extractor path first:

```text
direct file/source -> extractor -> normalized-document-v1 -> Lycium generation
                                                 |
                                                 -> optional Source Index registration
```

The first extractor integration lives in the Lycium backend under `services/lycium-api/app/source_extraction/` and is shaped so an external extractor repo can replace the local reader. The current local reader supports plain text, Markdown, HTML-ish text payloads, and text-backed PDFs through `pypdf`; scanned PDF/OCR support should come from the external extractor path instead of custom Lycium parsing.

When `LYCIUM_SOURCE_EXTRACTOR_COMMAND` is configured, Lycium sends direct file extraction to that housed external repo wrapper over stdin/stdout JSON. When `LYCIUM_SOURCE_EXTRACTOR_API_URL` is configured, Lycium sends direct file extraction to `POST /v1/extractions`. If no external extractor is configured, the local reader remains available for offline development. See `docs/external-extractor-integration.md` for the integration contract and adapter strategy.

Extractor output should preserve citable evidence before any Source Index registration:

- `normalized-document-v1`: source locator, snapshot hash, extracted evidence chunks, citation metadata, extractor provenance, and extraction status.
- `evidence-chunk-v1`: bounded text chunks with document ID, source ref, content hash, location/page metadata, and citation metadata.
- `source-citation-v1`: title, filename or URL, source ref, and page when available.
- `source-registration-candidate-v1`: an optional handoff envelope for Source Index canonicalization and dedupe.

Lycium can generate from direct extracted evidence without waiting for Source Index. If Source Index later stores the same hash, Lycium can upgrade provenance to durable Source Index IDs without regenerating the course.

Every `source-packet-v1` has a portable root envelope:

- `packet_id`: a stable packet identifier derived from consumer, context, prompt, and included source URLs.
- `generated_at`: the timestamp when this packet payload was assembled.
- `producer`: service metadata containing the emitting service, contract version, and public schema id.

Downstream tools should use `packet_id` for logs, generation traces, and handoff records instead of relying on Source Index database IDs.

## Lycium API bridge

When `LYCIUM_SOURCE_INDEX_API_URL` is configured, Lycium course generation asks the standalone Source Index service for `POST /v1/source-packets`. The request is product-neutral: Lycium sends a course-shaped target descriptor derived from the prompt/context instead of Lycium course JSON.

Lycium keeps the packet boundary adapter-shaped:

- standalone Source Index packets are normalized into generation source documents, source-corpus synthesis, and source-strength evidence;
- packet IDs, source public IDs, snapshot/chunk IDs, evidence refs, quality, coverage, target metadata, and producer metadata are preserved in generation traces;
- course snapshots keep citation/display metadata and packet receipts for reproducibility, not a canonical copy of the Source Index database;
- if the standalone packet endpoint is unavailable but the old transitional Lycium endpoint exists, the client falls back to `/v1/index/source-packets`.

Metadata-only packets are valid planning and citation evidence, but they are not the same as source-text-backed lesson evidence. When `packet_text_allowed` is false, Lycium uses the packet as citation/source metadata and should not pretend it received full excerpts.

## Developer UI

When the web app is pointed at a local API, `/source-index` opens a small developer panel for pasting a generic batch, entering a prompt, importing sources, and generating a source packet.

## Smoke a batch

Run Lycium API or the standalone Source Index service, then run:

```bash
python scripts/source-index-smoke.py \
  fixtures/source-index/primitive-source-batch.json \
  --prompt "distributed systems reliability observability latency replication" \
  --batch-id primitive-source-index-smoke \
  --context-id primitive-source-index-smoke \
  --require-excluded
```

The smoke command imports the batch, builds a source packet, and exits non-zero if basic thresholds fail.

## Batch format

```json
{
  "batch_id": "optional-batch-id",
  "sources": [
    {
      "url": "https://example.edu/source",
      "title": "Optional title",
      "source_type": "open_courseware",
      "license": "cc-by",
      "raw_text": "Optional extracted or manually pasted source text.",
      "content_type": "text/plain",
      "metadata": {}
    }
  ]
}
```

Use `raw_text` when manually seeding the index. Without `raw_text`, the source is still indexed, but no snapshot-backed generation document is created unless a later fetch or snapshot step fills it in.

## Standalone CLI surface

The service exposes local CLI entry points so Source Index can be exercised without the Lycium web app:

```bash
source-index-import-batch fixtures/source-index/primitive-source-batch.json \
  --output /tmp/source-import-report.json

source-index-build-packet \
  --consumer lycium-course-generation \
  --context-id primitive-source-index-smoke \
  --prompt "distributed systems reliability observability latency replication" \
  --source-url https://example.edu/reliability \
  --no-fetch \
  --output /tmp/source-packet.json

source-index-import-packet /tmp/source-packet.json \
  --dry-run \
  --output /tmp/source-packet-import-report.json

source-index-service-contract --output /tmp/source-index-service-contract.json

source-index-openapi --output /tmp/source-index-openapi.json
```

These commands intentionally speak stable JSON contracts instead of Lycium UI concepts. The service contract manifest declares ownership boundaries, stable endpoints, and command surfaces so the index can be detached for InfRing and future Protheus systems.

## Packet import report

`POST /v1/index/source-packet-imports` and `source-index-import-packet` both return `source-packet-import-report-v1`.

The report records:

- whether the packet envelope is valid,
- source and document counts,
- imported source and snapshot counts,
- source refs created or matched during import,
- validation errors and warnings.

Use `dry_run: true` or `--dry-run` to validate a packet before mutating a Source Index database.
