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


def _load_json(path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    payload = json.loads(raw)
    if isinstance(payload, list):
        return {"sources": payload}
    if isinstance(payload, dict) and isinstance(payload.get("sources"), list):
        return payload
    raise SystemExit("Import payload must be a JSON array or an object with a 'sources' array.")


def _post_json(api_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"POST {path} failed with HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"POST {path} failed: {exc}") from exc


def _packet_payload(import_report: dict[str, Any], prompt: str, context_id: str | None) -> dict[str, Any]:
    source_urls = [
        str(row.get("source", {}).get("canonical_url"))
        for row in import_report.get("sources", [])
        if isinstance(row, dict) and str(row.get("source", {}).get("canonical_url") or "").strip()
    ]
    return {
        "consumer": "lycium-source-import-cli",
        "context_id": context_id or str(import_report.get("batch_id") or "source-import-cli"),
        "prompt": prompt,
        "source_urls": source_urls,
        "fetch_sources": False,
        "snapshot_limit": 1,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a curated source batch into Lycium Source Index.")
    parser.add_argument("file", help="JSON file path, or '-' to read JSON from stdin.")
    parser.add_argument(
        "--api-url",
        default=os.getenv("LYCIUM_API_URL", "http://127.0.0.1:8000"),
        help="Lycium API or Source Index base URL. Defaults to LYCIUM_API_URL or http://127.0.0.1:8000.",
    )
    parser.add_argument("--batch-id", help="Optional batch id to attach to the import.")
    parser.add_argument("--packet-prompt", help="Optional prompt used to build a generation source packet after import.")
    parser.add_argument("--packet-context-id", help="Optional context id for the generated source packet.")
    args = parser.parse_args()

    import_payload = _load_json(args.file)
    if args.batch_id:
        import_payload["batch_id"] = args.batch_id

    import_report = _post_json(args.api_url, "/v1/index/source-imports", import_payload)
    output: dict[str, Any] = {"import": import_report}

    if args.packet_prompt:
        output["packet"] = _post_json(
            args.api_url,
            "/v1/index/source-packets",
            _packet_payload(import_report, args.packet_prompt, args.packet_context_id),
        )

    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
