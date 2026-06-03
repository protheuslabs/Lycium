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

Every `source-packet-v1` has a portable root envelope:

- `packet_id`: a stable packet identifier derived from consumer, context, prompt, and included source URLs.
- `generated_at`: the timestamp when this packet payload was assembled.
- `producer`: service metadata containing the emitting service, contract version, and public schema id.

Downstream tools should use `packet_id` for logs, generation traces, and handoff records instead of relying on Source Index database IDs.

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
