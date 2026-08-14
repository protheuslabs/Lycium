from __future__ import annotations

from app.course_generation_scenarios import evaluate_course_generation_scenario
from app.course_quality import assess_course_quality
from app.course_source_integrity import assess_course_source_integrity
from tests.course_generation_fixture_builders import source_backed_course_from_scenario

def test_mixed_url_file_full_course_readiness_has_local_citations_and_quality_gate() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    base_source_ids = list(course["sourceIds"][:3])
    primary_source_id = base_source_ids[0]
    file_source = {
        "id": "source-uploaded-syllabus",
        "type": "document",
        "title": "Uploaded programming syllabus",
        "url": "artifact://intro-programming-syllabus",
    }
    lab_source = {
        "id": "source-uploaded-lab",
        "type": "document",
        "title": "Uploaded programming lab",
        "url": "artifact://intro-programming-lab",
    }
    course["sourceRecords"].extend([file_source, lab_source])
    course["sourceIds"].extend([file_source["id"], lab_source["id"]])
    course["metadata"]["inputArtifacts"] = [
        {
            "id": "intro-programming-syllabus",
            "filename": "intro-programming-syllabus.txt",
            "sourceDocumentUrl": file_source["url"],
        },
        {
            "id": "intro-programming-lab",
            "filename": "intro-programming-lab.txt",
            "sourceDocumentUrl": lab_source["url"],
        },
    ]
    course["metadata"]["sourceCorpusSynthesis"] = {
        "metrics": {
            "submittedSourceCount": 5,
            "submittedInputArtifactCount": 2,
            "usableInputArtifactCount": 2,
            "includedInputArtifactCount": 2,
            "includedSourceCount": 5,
            "excludedSourceCount": 0,
        },
        "includedSources": [*base_source_ids, file_source["id"], lab_source["id"]],
        "excludedSources": [],
        "commonThemes": ["variables", "functions", "testing", "source-backed practice"],
    }
    course["metadata"]["sourceSlots"].append(
        {
            "requiredConceptId": "intro-programming-foundations-variables-uploaded-syllabus",
            "title": "Variables",
            "primarySourceId": file_source["id"],
            "fallbackSourceIds": [primary_source_id],
            "replacementPolicy": "review_required",
        }
    )
    first_section = course["modules"][0]["sections"][0]
    first_section["sourceIds"] = [primary_source_id, file_source["id"]]
    first_section["content"][0]["value"] += " The uploaded syllabus confirms variables as a required first concept [4]."
    first_section["content"][0]["sourceIds"] = [primary_source_id, file_source["id"]]

    scenario_report = evaluate_course_generation_scenario(course, "intro-programming-foundations")
    quality_report = assess_course_quality(course, gate="generation")
    source_integrity = assess_course_source_integrity(course)

    assert course.get("status") != "needs_sources"
    assert scenario_report["status"] == "passed"
    assert quality_report["passed"] is True
    assert source_integrity["metrics"]["inlineCitationIssueCount"] == 0
    assert source_integrity["metrics"]["citationIssueCount"] == 0
    assert source_integrity["metrics"]["blanketSourceSectionCount"] == 0
    assert source_integrity["metrics"]["directConceptSourceCoveragePercent"] == 100.0


def test_mixed_url_file_readiness_rejects_enough_inputs_with_unmapped_coverage() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    base_source_ids = list(course["sourceIds"][:3])
    noisy_file_source = {
        "id": "source-uploaded-campus-parking",
        "type": "document",
        "title": "Uploaded campus parking guide",
        "url": "artifact://campus-parking-guide",
    }
    course["sourceRecords"].append(noisy_file_source)
    course["sourceIds"].append(noisy_file_source["id"])
    course["metadata"]["inputArtifacts"] = [
        {
            "id": "campus-parking-guide",
            "filename": "campus-parking-guide.txt",
            "sourceDocumentUrl": noisy_file_source["url"],
        }
    ]
    course["metadata"]["sourceCorpusSynthesis"] = {
        "metrics": {
            "submittedSourceCount": 4,
            "submittedInputArtifactCount": 1,
            "usableInputArtifactCount": 1,
            "includedInputArtifactCount": 0,
            "includedSourceCount": 3,
            "excludedSourceCount": 1,
        },
        "includedSources": base_source_ids,
        "excludedSources": [noisy_file_source["id"]],
        "commonThemes": ["variables", "functions", "testing"],
    }
    first_section = course["modules"][0]["sections"][0]
    first_section["sourceIds"] = [noisy_file_source["id"]]
    first_section["content"][0]["value"] += " The uploaded parking guide is cited even though it does not support programming concepts [4]."
    first_section["content"][0]["sourceIds"] = [noisy_file_source["id"]]

    scenario_report = evaluate_course_generation_scenario(course, "intro-programming-foundations")
    quality_report = assess_course_quality(course, gate="generation")
    source_integrity = assess_course_source_integrity(course)

    assert scenario_report["status"] == "failed"
    assert quality_report["passed"] is False
    assert source_integrity["metrics"]["citationIssueCount"] > 0
    assert any(
        "not mapped to its concepts" in finding["message"] or "Inline citation markers" in finding["message"]
        for finding in source_integrity["issues"]
    )
