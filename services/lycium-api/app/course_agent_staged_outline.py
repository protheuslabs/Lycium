from __future__ import annotations

from app.course_outline_from_source_packet import build_outline_from_source_packet
from app.source_corpus import SOURCE_PACKET_CONTRACT_VERSION, SourceCorpusPreflight


def _course_build_outline_plan_from_outline(
    outline: dict | None,
    *,
    fallback_title: str,
    fallback_short_description: str = "",
    pacing_label: str | None = None,
    planning_source: str = "course_build_outline",
) -> dict | None:
    if not isinstance(outline, dict):
        return None
    modules = [module for module in outline.get("modules", []) if isinstance(module, dict)]
    if not modules:
        return None

    plan: dict = {
        "title": str(outline.get("title") or fallback_title or "Generated course"),
        "shortDescription": str(outline.get("shortDescription") or fallback_short_description or ""),
        "summary": str(outline.get("summary") or "Source-packet-derived course plan."),
        "modules": modules,
        "planningSource": planning_source,
        "sourceOutlineContract": outline.get("contractVersion"),
        "sourceOutline": outline,
    }
    if pacing_label:
        plan["pacingLabel"] = str(pacing_label)
    learning_objectives = outline.get("learningObjectives")
    if isinstance(learning_objectives, list):
        plan["learningObjectives"] = [str(objective) for objective in learning_objectives if objective]
    return plan


def _course_build_outline_plan_from_resume_course(resume_course: dict | None) -> dict | None:
    if not isinstance(resume_course, dict):
        return None
    metadata = resume_course.get("metadata") if isinstance(resume_course.get("metadata"), dict) else {}
    outline = metadata.get("courseBuildOutline")
    return _course_build_outline_plan_from_outline(
        outline,
        fallback_title=str(resume_course.get("title") or "Generated course"),
        fallback_short_description=str(resume_course.get("shortDescription") or ""),
        pacing_label=str(metadata.get("pacingLabel") or "") or None,
        planning_source="course_build_outline",
    )


def _course_build_outline_plan_from_source_packet(
    *,
    prompt: str,
    source_packet: dict | None,
    desired_module_count: int,
) -> dict | None:
    if not isinstance(source_packet, dict):
        return None
    outline = build_outline_from_source_packet(
        prompt=prompt,
        source_packet=source_packet,
        desired_module_count=desired_module_count,
        include_section_outlines=False,
    )
    return _course_build_outline_plan_from_outline(
        outline,
        fallback_title=prompt,
        planning_source="source_packet_outline",
    )


def _source_packet_for_outline(
    *,
    source_packet: dict | None,
    source_corpus: SourceCorpusPreflight,
) -> dict | None:
    if isinstance(source_packet, dict):
        return source_packet
    if not source_corpus.source_documents:
        return None
    synthesis_packet = source_corpus.synthesis.get("sourcePacket")
    synthesis_packet = synthesis_packet if isinstance(synthesis_packet, dict) else {}
    quality = synthesis_packet.get("quality") if isinstance(synthesis_packet.get("quality"), dict) else {}
    return {
        "contract_version": synthesis_packet.get("contractVersion") or SOURCE_PACKET_CONTRACT_VERSION,
        "context_id": synthesis_packet.get("contextId"),
        "quality": quality,
        "source_documents": source_corpus.source_documents,
    }


def _outline_planning_source(source_packet: dict | None, source_corpus: SourceCorpusPreflight) -> str:
    if isinstance(source_packet, dict):
        return "source_packet_outline"
    synthesis_packet = source_corpus.synthesis.get("sourcePacket")
    synthesis_packet = synthesis_packet if isinstance(synthesis_packet, dict) else {}
    quality = synthesis_packet.get("quality") if isinstance(synthesis_packet.get("quality"), dict) else {}
    return "source_packet_outline" if quality else "source_corpus_outline"
