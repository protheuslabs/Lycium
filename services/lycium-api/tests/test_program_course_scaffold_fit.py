from __future__ import annotations

from app.program_course_scaffold import build_course_scaffold_plan


def _biology_group() -> list[dict]:
    return [
        {
            "id": "biology-core",
            "title": "Biology Core",
            "displayName": "Biology Core",
            "purpose": "biology foundations for pre-medical study",
            "requirements": [
                {
                    "id": "req-biology",
                    "type": "complete_course",
                    "courseId": "biology",
                    "title": "Biology",
                    "description": "Cell biology, genetics, evolution, and laboratory reasoning.",
                    "origin": {
                        "concepts": [
                            "cell biology",
                            "genetics",
                            "evolution",
                            "laboratory reasoning",
                        ]
                    },
                }
            ],
        }
    ]


def _first_course(known_course: dict) -> dict:
    plan = build_course_scaffold_plan(_biology_group(), known_courses=[known_course])
    return plan["courses"][0]


def test_scaffold_links_title_only_match_when_no_internal_evidence_exists() -> None:
    course = _first_course({"courseId": "existing-biology", "title": "Biology"})
    evidence = course["courseFitEvidence"]

    assert course["action"] == "link_existing_course"
    assert course["existingCourseId"] == "existing-biology"
    assert course["courseBuildTask"]["status"] == "linked_existing_course"
    assert evidence["status"] == "accepted"
    assert evidence["fitScore"] >= 0.7
    assert evidence["signals"]["titleMatch"] is True
    assert evidence["signals"]["contentEvidenceAvailable"] is False


def test_scaffold_links_existing_course_when_internal_evidence_matches_requirement_concepts() -> None:
    course = _first_course(
        {
            "courseId": "existing-biology",
            "title": "Biology",
            "shortDescription": "Biology foundations for pre-medical learners.",
            "moduleTitles": ["Cell biology and genetics"],
            "sectionTitles": ["Evolution and laboratory reasoning"],
            "conceptTitles": ["cell biology", "genetics", "evolution", "laboratory reasoning"],
            "tags": ["biology", "pre-medical"],
        }
    )
    evidence = course["courseFitEvidence"]
    signals = evidence["signals"]

    assert course["action"] == "link_existing_course"
    assert course["existingCourseId"] == "existing-biology"
    assert evidence["status"] == "accepted"
    assert evidence["fitScore"] >= 0.8
    assert signals["contentEvidenceAvailable"] is True
    assert signals["moduleTitleOverlap"] > 0
    assert signals["sectionTitleOverlap"] > 0
    assert signals["conceptTitleOverlap"] > 0
    assert signals["requirementTermCount"] >= 8


def test_scaffold_blocks_exact_title_match_when_internal_evidence_is_unrelated() -> None:
    course = _first_course(
        {
            "courseId": "existing-biology",
            "title": "Biology",
            "shortDescription": "A field survey course about fossil discovery.",
            "moduleTitles": ["Dinosaur taxonomy"],
            "sectionTitles": ["Fossil excavation"],
            "conceptTitles": ["cretaceous period", "stratigraphy"],
            "tags": ["paleontology"],
        }
    )
    evidence = course["courseFitEvidence"]
    signals = evidence["signals"]

    assert course["action"] == "create_empty_course"
    assert course["sourceRequest"]["requiredConcepts"]
    assert course["courseWrapper"]["status"] == "wrapper"
    assert evidence["status"] == "needs_review"
    assert evidence["fitScore"] < 0.7
    assert signals["titleMatch"] is True
    assert signals["contentEvidenceAvailable"] is True
    assert signals["moduleTitleOverlap"] == 0
    assert signals["sectionTitleOverlap"] == 0
    assert signals["conceptTitleOverlap"] == 0


def test_scaffold_blocks_near_title_false_positive_with_unrelated_internal_evidence() -> None:
    course = _first_course(
        {
            "courseId": "existing-dinosaur-biology",
            "title": "Biology of Dinosaurs",
            "shortDescription": "Dinosaur taxonomy, fossil excavation, and ancient environments.",
            "moduleTitles": ["Dinosaur taxonomy"],
            "sectionTitles": ["Fossil excavation"],
            "conceptTitles": ["cretaceous period", "stratigraphy"],
            "tags": ["paleontology"],
        }
    )
    evidence = course["courseFitEvidence"]
    signals = evidence["signals"]

    assert course["action"] == "create_empty_course"
    assert course["courseBuildTask"]["status"] == "source_gathering"
    assert evidence["status"] == "needs_review"
    assert evidence["fitScore"] < 0.7
    assert signals["titleMatch"] is False
    assert signals["contentEvidenceAvailable"] is True
    assert signals["moduleTitleOverlap"] == 0
    assert signals["sectionTitleOverlap"] == 0
    assert signals["conceptTitleOverlap"] == 0
