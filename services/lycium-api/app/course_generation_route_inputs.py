from __future__ import annotations

from typing import Any

from app.course_generation_readiness import build_generation_readiness_report
from app.schemas import GenerateCourseRequest


def generation_source_urls(payload: GenerateCourseRequest) -> list[str]:
    urls = [str(url) for url in payload.source_urls]
    packet_urls = payload.source_packet.get("source_urls") if isinstance(payload.source_packet, dict) else None
    if not urls and isinstance(packet_urls, list):
        urls = [str(url) for url in packet_urls if str(url).strip()]
    return urls


def generation_readiness_for_request(payload: GenerateCourseRequest, source_urls: list[str]) -> dict[str, Any]:
    return build_generation_readiness_report(
        source_urls=source_urls,
        input_artifacts=payload.input_artifacts,
        source_packet=payload.source_packet,
    )
