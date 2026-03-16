from datetime import UTC, datetime


def main() -> None:
    started_at = datetime.now(UTC).isoformat()
    print(f"[protheus-workers] skeleton worker started at {started_at}")
    print("[protheus-workers] queue integration and job runners are not wired yet.")
