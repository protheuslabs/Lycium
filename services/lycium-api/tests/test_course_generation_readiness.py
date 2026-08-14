from __future__ import annotations

from app.course_generation_readiness import build_generation_readiness_report


def test_generation_readiness_passes_with_enough_source_evidence() -> None:
    report = build_generation_readiness_report(
        source_urls=[
            "https://example.edu/macroeconomics/syllabus",
            "https://example.edu/macroeconomics/data-guide",
            "https://example.edu/macroeconomics/textbook",
        ],
    )

    assert report["contractVersion"] == "course-generation-readiness-v1"
    assert report["ready"] is True
    assert report["status"] == "ready"
    assert report["sourceEvidence"]["submittedEvidenceCount"] == 3
    assert report["issues"] == []


def test_generation_readiness_counts_usable_files_without_double_counting_artifact_urls() -> None:
    report = build_generation_readiness_report(
        source_urls=[
            "https://example.edu/macroeconomics/syllabus",
            "https://example.edu/macroeconomics/data-guide",
            "artifact://macroeconomics-notes",
        ],
        input_artifacts=[
            {"id": "macroeconomics-notes", "filename": "macroeconomics-notes.txt", "text": "Inflation and monetary policy notes."}
        ],
    )

    assert report["ready"] is True
    assert report["sourceEvidence"]["sourceUrlCount"] == 3
    assert report["sourceEvidence"]["usableInputArtifactCount"] == 1
    assert report["sourceEvidence"]["submittedEvidenceCount"] == 3


def test_generation_readiness_blocks_low_source_packet_concept_coverage() -> None:
    report = build_generation_readiness_report(
        source_urls=[
            "https://example.edu/macroeconomics/syllabus",
            "https://example.edu/macroeconomics/data-guide",
            "https://example.edu/macroeconomics/textbook",
        ],
        source_packet={
            "quality": {
                "status": "needs_review",
                "conceptCoverageRatio": 0.33,
                "conceptCandidateCount": 3,
                "coveredConceptCandidateCount": 1,
                "uncoveredConceptCandidates": ["inflation", "monetary policy"],
            }
        },
    )

    assert report["ready"] is False
    assert report["status"] == "needs_sources"
    assert report["sourceEvidence"]["submittedEvidenceCount"] == 3
    assert report["conceptCoverage"]["coverageRatio"] == 0.33
    assert report["conceptCoverage"]["uncoveredConcepts"] == ["inflation", "monetary policy"]
    assert report["sourceGate"]["gate"] == "source_packet_quality"
    assert any(issue["code"] == "source_packet_quality" for issue in report["issues"])


def test_generation_readiness_blocks_too_little_evidence() -> None:
    report = build_generation_readiness_report(
        source_urls=["https://example.edu/macroeconomics/syllabus"],
        input_artifacts=[{"id": "empty-notes", "filename": "empty-notes.txt", "text": ""}],
    )

    assert report["ready"] is False
    assert report["status"] == "needs_sources"
    assert report["sourceEvidence"]["submittedEvidenceCount"] == 1
    assert report["sourceEvidence"]["minimumCourseSources"] == 3
    assert report["issues"][0]["code"] == "minimum_source_evidence"


def test_generation_readiness_accepts_one_assessed_strong_source() -> None:
    source_url = "https://example.edu/catalog/epidemiology"
    report = build_generation_readiness_report(
        source_urls=[source_url],
        source_corpus_synthesis={
            "includedSources": [{"url": source_url, "relevanceScore": 0.8}],
        },
        source_documents=[
            {
                "url": source_url,
                "text": "A source-backed epidemiology course covering outbreak investigation, surveillance, risk, and prevention.",
            }
        ],
    )

    assert report["sourceEvidence"]["submittedEvidenceCount"] == 1
    assert report["sourceStrength"]["ready"] is True
    assert report["ready"] is True
