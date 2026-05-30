from __future__ import annotations

import hashlib


def stable_source_public_id(canonical_url: str) -> str:
    return f"src_{hashlib.sha256(canonical_url.encode('utf-8')).hexdigest()[:20]}"


def stable_snapshot_public_id(source_public_id: str, content_hash: str) -> str:
    return f"snap_{hashlib.sha256(f'{source_public_id}:{content_hash}'.encode('utf-8')).hexdigest()[:20]}"
