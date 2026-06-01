from __future__ import annotations

import argparse
import json
from pathlib import Path

from source_index.main import create_app


def export_cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Export the Source Index OpenAPI schema.")
    parser.add_argument("--output", help="Optional path for the OpenAPI JSON document.")
    args = parser.parse_args(argv)

    payload = create_app().openapi()
    text = json.dumps(payload, indent=2, sort_keys=True)
    if args.output:
        Path(args.output).write_text(f"{text}\n", encoding="utf-8")
    else:
        print(text)
