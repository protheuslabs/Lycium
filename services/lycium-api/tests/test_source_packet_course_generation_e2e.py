from __future__ import annotations

import re
from typing import Any

from app.course_quality import assess_course_quality


PROMPT_FILLER_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bthe model should\b",
        r"\bthe agent should\b",
        r"\bwrite (?:a|the) lesson\b",
        r"\bgenerate (?:instructional )?content\b",
        r"\bcontent goes here\b",
        r"\btodo\b",
        r"\bthis lesson supports the module objective\b",
        r"\bworking model studies\b",
    ]
]


def _chem_105_source_packet() -> dict[str, Any]:
    documents = [
        {
            "url": "https://example.edu/chem105/syllabus",
            "title": "CHEM 105 syllabus",
            "contentType": "text/plain",
            "fetchStatus": "provided",
            "text": (
                "CHEM 105 General Chemistry I introduces measurement, matter, atomic structure, periodic trends, "
                "chemical nomenclature, stoichiometry, limiting reactants, aqueous reactions, thermochemistry, "
                "chemical bonding, molecular geometry, gases, and laboratory safety."
            ),
        },
        {
            "url": "https://example.edu/chem105/lab-manual",
            "title": "CHEM 105 laboratory manual",
            "contentType": "text/plain",
            "fetchStatus": "provided",
            "text": (
                "Laboratory activities include density measurement, hydrate composition, reaction yield, calorimetry, "
                "titration, gas collection, laboratory notebook practice, uncertainty, and evidence-based analysis."
            ),
        },
        {
            "url": "https://example.edu/chem105/open-textbook",
            "title": "Open general chemistry textbook",
            "contentType": "text/plain",
            "fetchStatus": "provided",
            "text": (
                "Open general chemistry readings explain atoms, molecules, moles, balanced equations, energy changes, "
                "Lewis structures, VSEPR molecular shape, ideal gas law calculations, and solution concentration."
            ),
        },
    ]
    return {
        "contract_version": "source-packet-v1",
        "context_id": "chem-105-e2e-source-packet",
        "source_documents": documents,
        "source_urls": [str(document["url"]) for document in documents],
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1.0,
            "conceptCandidateCount": 8,
            "coveredConceptCandidateCount": 8,
            "uncoveredConceptCandidates": [],
        },
        "synthesis": {
            "workflowGate": "source_corpus_preflight",
            "includedSources": [
                {
                    "url": document["url"],
                    "decision": "included",
                    "reasonCode": "strong_relevance",
                    "matchedTerms": ["chem", "105", "chemistry"],
                }
                for document in documents
            ],
            "excludedSources": [],
            "metrics": {
                "submittedSourceCount": len(documents),
                "includedSourceCount": len(documents),
                "excludedSourceCount": 0,
            },
        },
    }


def _psych_input_artifacts() -> list[dict[str, str]]:
    return [
        {
            "id": "intro-psych-syllabus",
            "filename": "intro-psych-syllabus.txt",
            "mimeType": "text/plain",
            "text": (
                "Introductory psychology covers research methods, biological bases of behavior, sensation, "
                "perception, learning, memory, cognition, human development, personality, psychological disorders, "
                "therapy, and social psychology."
            ),
        },
        {
            "id": "psych-research-methods",
            "filename": "psych-research-methods.txt",
            "mimeType": "text/plain",
            "text": (
                "Psychology research methods include hypotheses, operational definitions, experiments, correlation, "
                "sampling, ethics, informed consent, validity, reliability, descriptive statistics, and replication."
            ),
        },
        {
            "id": "campus-parking",
            "filename": "campus-parking.txt",
            "mimeType": "text/plain",
            "text": "Parking permits, dining hall menus, athletic tickets, campus shuttle maps, and residence move-in times.",
        },
    ]


def _course_text(course: dict[str, Any]) -> str:
    parts: list[str] = []
    for module in course.get("modules", []):
        if not isinstance(module, dict):
            continue
        parts.append(str(module.get("title") or ""))
        for section in module.get("sections", []):
            if not isinstance(section, dict):
                continue
            parts.append(str(section.get("title") or ""))
            for block in section.get("content", []):
                if not isinstance(block, dict):
                    continue
                parts.extend(str(block.get(key) or "") for key in ("title", "heading", "value", "description"))
                for concept in block.get("concepts") or []:
                    if isinstance(concept, dict):
                        parts.extend(str(concept.get(key) or "") for key in ("name", "title", "description"))
                for question in block.get("questions") or block.get("questionBank") or []:
                    if isinstance(question, dict):
                        parts.append(str(question.get("question") or ""))
    return "\n".join(part for part in parts if part)


def _sections(course: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        section
        for module in course.get("modules", [])
        if isinstance(module, dict)
        for section in module.get("sections", [])
        if isinstance(section, dict)
    ]


def test_source_packet_to_generated_course_snapshot_runs_native_quality_path(client) -> None:
    response = client.post(
        "/v1/courses/generate",
        json={
            "prompt": "Create an undergraduate CHEM 105 General Chemistry I course with labs, quizzes, and source-backed summaries.",
            "level": "undergrad",
            "category": "natural-sciences-mathematics",
            "department": "chemistry",
            "desired_module_count": 3,
            "expected_duration_minutes": 240,
            "source_policy": "balanced",
            "free_only": True,
            "trust_min": 0.1,
            "source_packet": _chem_105_source_packet(),
        },
    )

    assert response.status_code == 201, response.text
    snapshot = response.json()
    course = snapshot["structure"]
    readiness = course["metadata"]["generationReadiness"]
    sections = _sections(course)
    quality = assess_course_quality(course, gate="review")

    assert snapshot["status"] in {"ready_for_review", "needs_revision"}
    assert readiness["contractVersion"] == "course-generation-readiness-v1"
    assert readiness["status"] == "ready"
    assert readiness["ready"] is True
    assert readiness["sourceEvidence"]["submittedEvidenceCount"] >= 3
    assert readiness["conceptCoverage"]["coverageRatio"] >= readiness["conceptCoverage"]["minimumCoverageRatio"]
    assert snapshot["generation_trace"]["generation_readiness"] == readiness
    assert len(course["sourceRecords"]) >= 3
    assert len(course["modules"]) >= 3
    assert any(section.get("pageType") == "apply" for section in sections)
    assert any(block.get("type") == "quiz" for section in sections for block in section.get("content", []) if isinstance(block, dict))
    assert all(module.get("sections", [])[-1].get("sectionType") == "summary" for module in course["modules"])
    assert quality["passed"] is True, quality
    assert not any(pattern.search(_course_text(course)) for pattern in PROMPT_FILLER_PATTERNS)


def test_mixed_url_and_file_inputs_exclude_noise_before_native_generation(client) -> None:
    useful_url = "https://example.edu/psychology/intro-psychology-syllabus-cognition-development-learning"
    noisy_url = "https://example.edu/parking-dining-athletics"
    response = client.post(
        "/v1/courses/generate",
        json={
            "prompt": (
                "Create an undergraduate introductory psychology course covering research methods, biological bases, "
                "learning, memory, cognition, development, psychological disorders, therapy, and social psychology."
            ),
            "level": "undergrad",
            "category": "social-sciences",
            "department": "psychology",
            "desired_module_count": 3,
            "expected_duration_minutes": 240,
            "source_policy": "balanced",
            "free_only": True,
            "trust_min": 0.1,
            "source_urls": [useful_url, noisy_url],
            "input_artifacts": _psych_input_artifacts(),
        },
    )

    assert response.status_code == 201, response.text
    snapshot = response.json()
    course = snapshot["structure"]
    metadata = course["metadata"]
    synthesis = metadata["sourceCorpusSynthesis"]
    readiness = metadata["generationReadiness"]
    included_urls = {source["url"] for source in synthesis["includedSources"]}
    excluded_urls = {source["url"] for source in synthesis["excludedSources"]}
    included_artifact_ids = {
        source.get("inputArtifactId")
        for source in synthesis["includedSources"]
        if source.get("inputArtifactId")
    }
    excluded_artifact_ids = {
        source.get("inputArtifactId")
        for source in synthesis["excludedSources"]
        if source.get("inputArtifactId")
    }
    quality = assess_course_quality(course, gate="review")

    assert synthesis["metrics"]["submittedSourceCount"] == 5
    assert synthesis["metrics"]["includedSourceCount"] == 3
    assert synthesis["metrics"]["excludedSourceCount"] == 2
    assert useful_url in included_urls
    assert noisy_url in excluded_urls
    assert {"intro-psych-syllabus", "psych-research-methods"}.issubset(included_artifact_ids)
    assert "campus-parking" in excluded_artifact_ids
    assert readiness["ready"] is True
    assert readiness["sourceEvidence"]["submittedEvidenceCount"] >= 3
    assert all(noisy_url != source.get("url") for source in course["sourceRecords"])
    assert all("campus-parking" not in source.get("id", "") for source in course["sourceRecords"])
    assert quality["passed"] is True, quality
    assert not any(pattern.search(_course_text(course)) for pattern in PROMPT_FILLER_PATTERNS)
