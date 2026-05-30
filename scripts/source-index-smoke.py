#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def _load_batch(path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    payload = json.loads(raw)
    if isinstance(payload, list):
        return {"sources": payload}
    if isinstance(payload, dict) and isinstance(payload.get("sources"), list):
        return payload
    raise SystemExit("Batch payload must be a JSON array or an object with a 'sources' array.")


def _post_json(api_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"POST {path} failed with HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"POST {path} failed: {exc}") from exc


def _canonical_urls(import_report: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    for row in import_report.get("sources", []):
        if not isinstance(row, dict):
            continue
        source = row.get("source")
        if not isinstance(source, dict):
            continue
        url = str(source.get("canonical_url") or "").strip()
        if url:
            urls.append(url)
    return urls


def _packet_payload(
    *,
    import_report: dict[str, Any],
    prompt: str,
    context_id: str,
    consumer: str,
) -> dict[str, Any]:
    return {
        "consumer": consumer,
        "context_id": context_id,
        "prompt": prompt,
        "source_urls": _canonical_urls(import_report),
        "fetch_sources": False,
        "snapshot_limit": 1,
    }


def _summary(import_report: dict[str, Any], packet: dict[str, Any], failures: list[str]) -> dict[str, Any]:
    corpus_run = packet.get("corpus_run") if isinstance(packet.get("corpus_run"), dict) else {}
    return {
        "status": "failed" if failures else "passed",
        "failures": failures,
        "import": {
            "batchId": import_report.get("batch_id"),
            "submittedCount": import_report.get("submitted_count"),
            "importedCount": import_report.get("imported_count"),
            "snapshotCount": import_report.get("snapshot_count"),
            "warnings": import_report.get("warnings") or [],
        },
        "packet": {
            "contractVersion": packet.get("contract_version"),
            "contextId": packet.get("context_id"),
            "sourceCount": len(packet.get("sources", []) if isinstance(packet.get("sources"), list) else []),
            "sourceDocumentCount": len(
                packet.get("source_documents", []) if isinstance(packet.get("source_documents"), list) else []
            ),
            "includedSourceCount": corpus_run.get("included_source_count"),
            "excludedSourceCount": corpus_run.get("excluded_source_count"),
            "warnings": packet.get("warnings") or [],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Primitive Source Index smoke: import any source batch, build a generation packet, and check thresholds."
    )
    parser.add_argument("file", help="JSON batch file path, or '-' to read from stdin.")
    parser.add_argument("--prompt", required=True, help="Prompt used to filter imported sources into a packet.")
    parser.add_argument(
        "--api-url",
        default=os.getenv("LYCIUM_API_URL", "http://127.0.0.1:8000"),
        help="Lycium API or Source Index base URL. Defaults to LYCIUM_API_URL or http://127.0.0.1:8000.",
    )
    parser.add_argument("--batch-id", help="Optional import batch id.")
    parser.add_argument("--context-id", default="source-index-smoke", help="Packet context id.")
    parser.add_argument("--consumer", default="lycium-source-index-smoke", help="Consumer label recorded in packet metadata.")
    parser.add_argument("--min-imported", type=int, default=1, help="Minimum imported source count.")
    parser.add_argument("--min-snapshots", type=int, default=1, help="Minimum imported snapshot count.")
    parser.add_argument("--min-included", type=int, default=1, help="Minimum source packet included count.")
    parser.add_argument("--min-documents", type=int, default=1, help="Minimum packet source document count.")
    parser.add_argument("--require-excluded", action="store_true", help="Require at least one excluded source.")
    args = parser.parse_args()

    import_payload = _load_batch(args.file)
    if args.batch_id:
        import_payload["batch_id"] = args.batch_id

    import_report = _post_json(args.api_url, "/v1/index/source-imports", import_payload)
    packet = _post_json(
        args.api_url,
        "/v1/index/source-packets",
        _packet_payload(
            import_report=import_report,
            prompt=args.prompt,
            context_id=args.context_id,
            consumer=args.consumer,
        ),
    )

    corpus_run = packet.get("corpus_run") if isinstance(packet.get("corpus_run"), dict) else {}
    failures: list[str] = []
    if int(import_report.get("imported_count") or 0) < args.min_imported:
        failures.append(f"Imported fewer than {args.min_imported} sources.")
    if int(import_report.get("snapshot_count") or 0) < args.min_snapshots:
        failures.append(f"Created fewer than {args.min_snapshots} snapshots.")
    if int(corpus_run.get("included_source_count") or 0) < args.min_included:
        failures.append(f"Packet included fewer than {args.min_included} sources.")
    if len(packet.get("source_documents", []) if isinstance(packet.get("source_documents"), list) else []) < args.min_documents:
        failures.append(f"Packet returned fewer than {args.min_documents} source documents.")
    if args.require_excluded and int(corpus_run.get("excluded_source_count") or 0) < 1:
        failures.append("Packet did not exclude any submitted source.")

    print(json.dumps(_summary(import_report, packet, failures), indent=2, sort_keys=True))
    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
