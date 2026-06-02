from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from source_index.db import init_db, session_scope
from source_index.packet_service import create_source_packet, import_source_batch, import_source_packet


def _read_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _write_json(payload: dict[str, Any], output_path: str | None) -> None:
    text = json.dumps(payload, default=str, indent=2, sort_keys=True)
    if output_path:
        Path(output_path).write_text(f"{text}\n", encoding="utf-8")
        return
    print(text)


def import_batch_cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Import a source-index batch JSON file.")
    parser.add_argument("batch", help="Path to a source-import-batch JSON file.")
    parser.add_argument("--output", help="Optional path for the import report JSON.")
    args = parser.parse_args(argv)

    payload = _read_json(args.batch)
    init_db()
    with session_scope() as session:
        report = import_source_batch(
            session,
            batch_id=payload.get("batch_id"),
            sources=payload.get("sources") if isinstance(payload.get("sources"), list) else [],
        )
    _write_json(report, args.output)


def build_packet_cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build a source-packet-v1 JSON payload from indexed sources.")
    parser.add_argument("--consumer", default="manual", help="Downstream consumer name.")
    parser.add_argument("--context-id", required=True, help="Stable run or workflow context id.")
    parser.add_argument("--prompt", required=True, help="Prompt/context used to include or exclude sources.")
    parser.add_argument("--source-url", action="append", default=[], help="Source URL to consider. Repeat for multiple URLs.")
    parser.add_argument("--source-urls-file", help="Optional JSON file containing a list of URLs.")
    parser.add_argument("--no-fetch", action="store_true", help="Do not fetch URLs while building the packet.")
    parser.add_argument("--snapshot-limit", type=int, default=1, help="Snapshots per included source.")
    parser.add_argument("--output", help="Optional path for the packet JSON.")
    args = parser.parse_args(argv)

    source_urls = list(args.source_url)
    if args.source_urls_file:
        loaded = json.loads(Path(args.source_urls_file).read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            source_urls.extend(str(item) for item in loaded)

    init_db()
    with session_scope() as session:
        packet = create_source_packet(
            session,
            consumer=args.consumer,
            context_id=args.context_id,
            prompt=args.prompt,
            source_urls=source_urls,
            fetch_sources=not args.no_fetch,
            snapshot_limit=args.snapshot_limit,
        )
    _write_json(packet, args.output)


def import_packet_cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Import or validate a source-packet-v1 JSON file.")
    parser.add_argument("packet", help="Path to a source-packet-v1 JSON file.")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing sources or snapshots.")
    parser.add_argument("--no-snapshots", action="store_true", help="Import source rows without snapshot text.")
    parser.add_argument("--output", help="Optional path for the import report JSON.")
    args = parser.parse_args(argv)

    payload = _read_json(args.packet)
    init_db()
    with session_scope() as session:
        report = import_source_packet(
            session,
            packet=payload,
            import_snapshots=not args.no_snapshots,
            dry_run=args.dry_run,
        )
    _write_json(report, args.output)
    if not report.get("valid"):
        raise SystemExit(1)


if __name__ == "__main__":
    command = Path(sys.argv[0]).name
    if "import-packet" in command:
        import_packet_cli()
    elif "packet" in command:
        build_packet_cli()
    else:
        import_batch_cli()
