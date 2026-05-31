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
