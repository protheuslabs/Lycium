from __future__ import annotations

from typing import Any

from app import db
from app.course_agent_types import CourseAgentResult
from app.jobs import run_agent_course_generation_job
from app.models import Job
from app.program_validation import validate_program_contract


def _install_source_fetch_mock(monkeypatch, mapping: dict[str, str]) -> None:
    def fake_fetch(url: str) -> tuple[str, str]:
        return mapping[url], "text/html"

    monkeypatch.setattr("app.ingestion.fetch_url", fake_fetch)


def _flatten_requirements(requirements: list[dict]) -> list[dict]:
    flattened: list[dict] = []
    for requirement in requirements:
        flattened.append(requirement)
        if requirement.get("type") == "requirement_set":
            flattened.extend(_flatten_requirements(requirement.get("requirements") or []))
    return flattened


def _course_requirements(program: dict) -> list[dict]:
    rows: list[dict] = []
    for group in program.get("requirementGroups") or []:
        rows.extend(_flatten_requirements(group.get("requirements") or []))
    return [row for row in rows if row.get("type") == "complete_course"]


def _source_gap_concepts(shell: dict[str, Any]) -> list[str]:
    metadata = shell["structure"].get("metadata") if isinstance(shell["structure"].get("metadata"), dict) else {}
    gaps = metadata.get("sourceGaps") if isinstance(metadata.get("sourceGaps"), list) else []
    needs = gaps[0].get("conceptSourceNeeds") if gaps and isinstance(gaps[0], dict) else []
    concepts = []
    for need in needs if isinstance(needs, list) else []:
        if isinstance(need, dict):
            text = " ".join(str(value) for value in need.values() if isinstance(value, str))
            if text.strip():
                concepts.append(text.strip())
    return concepts or [str(shell["title"])]


def _source_packet_for_shell(shell: dict[str, Any]) -> dict[str, Any]:
    concepts = _source_gap_concepts(shell)
    concept_text = "; ".join(concepts)
    documents = [
        {
            "url": f"https://example.edu/source-packets/{shell['id']}/overview",
            "title": f"{shell['title']} overview",
            "text": f"This source covers {concept_text}. It explains definitions, prerequisite context, worked examples, and assessment expectations.",
        },
        {
            "url": f"https://example.edu/source-packets/{shell['id']}/practice",
            "title": f"{shell['title']} practice",
            "text": f"This source covers {concept_text}. It includes practice tasks, project evidence, lab-style reasoning, and source-backed review.",
        },
        {
            "url": f"https://example.edu/source-packets/{shell['id']}/assessment",
            "title": f"{shell['title']} assessment",
            "text": f"This source covers {concept_text}. It supports quiz questions, mastery checks, summary concepts, and capstone preparation.",
        },
    ]
    return {
        "contract_version": "source-packet-v1",
        "source_urls": [document["url"] for document in documents],
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "conceptCandidateCount": len(concepts),
            "coveredConceptCandidateCount": len(concepts),
            "uncoveredConceptCandidates": [],
        },
        "source_documents": documents,
    }


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"q{index}",
            "question": f"Which answer best applies {topic} in a source-backed course? {index}",
            "options": [f"{topic} source-backed reasoning", "Unrelated campus logistics", "Unsupported opinion", "Placeholder response"],
            "answers": [0],
        }
        for index in range(1, 11)
    ]


def _generated_course_from_shell(resume_course: dict[str, Any], source_packet: dict[str, Any]) -> dict[str, Any]:
    title = str(resume_course.get("title") or "Generated shell course")
    source_records = [
        {
            "id": f"input-source-{index}",
            "type": "web",
            "title": str(document.get("title") or f"Source {index}"),
            "url": str(document.get("url")),
        }
        for index, document in enumerate(source_packet["source_documents"], start=1)
    ]
    source_ids = [source["id"] for source in source_records]
    topics = [f"{title} foundations", f"{title} practice", f"{title} assessment"]
    modules = []
    for index, topic in enumerate(topics, start=1):
        section_id = f"module-{index}-lesson"
        explanation = (
            f"{topic} connects the submitted source packet to a teachable course sequence. Learners begin by identifying "
            "the core terms, then compare source-backed examples, then practice applying the idea under realistic constraints. "
            "The important move is not memorizing a label; it is using evidence from the accepted sources to explain what the "
            "concept means, where it applies, what assumptions shape it, and how a learner would demonstrate mastery. "
            "This section asks the learner to produce a short explanation, solve one applied prompt, and cite which source "
            "supports the reasoning."
        )
        modules.append(
            {
                "id": f"module-{index}",
                "title": f"Module {index}: {topic.title()}",
                "sourceIds": source_ids,
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": explanation, "sourceIds": [source_ids[0]]},
                            {
                                "type": "text",
                                "heading": "Worked example",
                                "value": (
                                    f"Example: a learner uses {topic} to compare two source-backed claims, identify the strongest evidence, "
                                    "and explain what additional information would change the decision."
                                ),
                                "sourceIds": [source_ids[1]],
                            },
                            {
                                "type": "text",
                                "heading": "Practice",
                                "value": (
                                    f"Practice: write a short source-backed explanation of {topic}, then convert the explanation into one "
                                    "quiz question and one portfolio artifact requirement."
                                ),
                                "sourceIds": [source_ids[2]],
                            },
                            {"type": "heading", "title": "Concepts introduced", "sourceIds": source_ids},
                            {
                                "type": "conceptCard",
                                "title": topic.title(),
                                "description": f"A source-backed concept used to build capability in {title}.",
                                "sourceIds": [source_ids[0]],
                            },
                        ],
                    },
                    {
                        "id": f"module-{index}-quiz",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": [source_ids[0]],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": [source_ids[0]]}],
                    },
                    {
                        "id": f"module-{index}-summary",
                        "title": f"Module {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "heading", "title": "Module concepts", "sourceIds": source_ids},
                            {
                                "type": "conceptCard",
                                "title": topic.title(),
                                "description": f"Review concept for {topic}.",
                                "sourceSectionId": section_id,
                                "sourceIds": [source_ids[0]],
                            },
                        ],
                    },
                ],
            }
        )
    return {
        "title": title,
        "shortDescription": f"A generated source-backed buildout of the program course shell {title}.",
        "difficultyLevel": str(resume_course.get("difficultyLevel") or "undergrad"),
        "category": str(resume_course.get("category") or "natural-sciences-mathematics"),
        "department": str(resume_course.get("department") or "biology"),
        "tags": ["program shell", "source-backed", "generated"],
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": {
            **(resume_course.get("metadata") if isinstance(resume_course.get("metadata"), dict) else {}),
            "sourceGaps": [],
            "status": "generated",
            "pacingLabel": "Module",
            "scope": {
                "audience": "self-directed learner",
                "level": str(resume_course.get("difficultyLevel") or "undergrad"),
                "duration": "240 minutes",
                "outcome": f"Build source-backed capability in {title}.",
            },
            "requirementOrigins": [
                {
                    "requirementId": f"req-{index}",
                    "originType": "expert_review",
                    "evidenceRefs": [source_id],
                }
                for index, source_id in enumerate(source_ids, start=1)
            ],
            "sourceSlots": [
                {
                    "requiredConceptId": f"concept-{index}",
                    "title": topic.title(),
                    "primarySourceId": source_ids[0],
                    "fallbackSourceIds": source_ids[1:],
                    "replacementPolicy": "review_required",
                }
                for index, topic in enumerate(topics, start=1)
            ],
            "sourceCorpusSynthesis": {
                "sourcePacket": {
                    "contractVersion": "source-packet-v1",
                    "quality": source_packet["quality"],
                }
            },
        },
        "modules": modules,
    }


def test_source_index_to_program_generation_creates_quality_gated_course_shell_handoff(client, monkeypatch) -> None:
    biology_url = "https://catalog.example.edu/pre-med/biology-chemistry"
    health_url = "https://catalog.example.edu/pre-med/health-ethics-lab"
    _install_source_fetch_mock(
        monkeypatch,
        {
            biology_url: """
            <html><head><title>Pre-Medical Preparation Curriculum</title></head><body>
            <h1>Pre-Medical Preparation</h1>
            <h2>Course Description</h2>
            <p>
              Pre-medical preparation builds college biology, general chemistry, organic chemistry,
              physics, calculus, statistics, writing, psychology, sociology, and laboratory research foundations.
            </p>
            <h2>Learning Outcomes</h2>
            <ul>
              <li>Apply general biology to cells, genetics, evolution, physiology, and organismal systems.</li>
              <li>Use general chemistry and organic chemistry to reason about reactions, bonding, energetics, and molecules.</li>
              <li>Apply physics, calculus, and statistics to biological and clinical problem solving.</li>
              <li>Explain psychology, sociology, ethics, and health disparities in patient-centered contexts.</li>
            </ul>
            <h2>Prerequisites</h2>
            <p>College algebra, high school biology, and high school chemistry are recommended.</p>
            </body></html>
            """,
            health_url: """
            <html><head><title>Pre-Health Laboratory and Professional Practice</title></head><body>
            <h1>Pre-Health Laboratory and Professional Practice</h1>
            <h2>Course Description</h2>
            <p>
              Students complete laboratory practice, research literacy, clinical communication, technical writing,
              evidence review, teamwork, service learning, and capstone preparation for medical school readiness.
            </p>
            <h2>Learning Outcomes</h2>
            <ul>
              <li>Document lab work with safety, measurement, uncertainty, analysis, and evidence-based conclusions.</li>
              <li>Read biomedical research, identify claims, and evaluate evidence quality.</li>
              <li>Create a capstone portfolio with reflective writing, source-backed explanations, and project evidence.</li>
            </ul>
            <h2>Assessment</h2>
            <p>Assessment includes quizzes, laboratory reports, research summaries, communication tasks, and a capstone portfolio.</p>
            </body></html>
            """,
        },
    )

    for url in (biology_url, health_url):
        ingested = client.post(
            "/v1/sources/ingest",
            json={"url": url, "source_type": "catalog", "license": "cc-by", "is_free": True},
        )
        assert ingested.status_code == 201, ingested.text

    learner = client.post(
        "/v1/learners",
        json={"name": "Program E2E Learner", "goal": "Prepare for medical school", "level": "beginner", "preferences": {}},
    )
    assert learner.status_code == 201, learner.text

    response = client.post(
        "/v1/programs/generate",
        json={
            "goal": "Create a pre-medical preparation program with biology, chemistry, physics, math, psychology, sociology, labs, writing, ethics, and capstone evidence.",
            "learner_id": learner.json()["id"],
            "level": "beginner",
            "free_only": True,
            "source_policy": "free-only",
            "trust_min": 0.1,
            "desired_course_count": 8,
            "source_urls": [biology_url, health_url],
        },
    )

    assert response.status_code == 201, response.text
    snapshot = response.json()
    structure = snapshot["structure"]
    program = structure["program"]
    trace = structure["generationTrace"]
    scaffold = trace["programSynthesis"]["courseScaffoldPlan"]
    quality = structure["qualityReport"]
    timeline = trace["timeline"]
    shell_readiness = scaffold["courseShellReadinessReport"]
    action_plan = scaffold["courseShellActionPlan"]
    source_acquisition = scaffold["sourceAcquisitionPlan"]
    course_requirements = _course_requirements(program)
    scaffold_courses = scaffold["courses"]
    materialized_courses = [course for course in scaffold_courses if course.get("action") == "create_empty_course"]

    assert snapshot["status"] == "ready_for_review"
    assert structure["contractValidation"]["passed"] is True
    assert validate_program_contract(program) == []
    assert quality["passed"] is True
    assert quality["metrics"]["groupCount"] >= 3
    assert quality["metrics"]["courseRequirementCoverageRatio"] >= 0.8
    assert trace["sourceIndexSnapshotDocumentCount"] == 2
    assert trace["curriculumBenchmarkContext"]["curriculumBenchmarks"]
    assert trace["curriculumBenchmarkContext"]["requirementOrigins"]
    assert program["dependencyGraph"]["edges"]
    assert any(group.get("groupKind") == "capstone" for group in program["requirementGroups"])
    assert any(requirement.get("type") == "submit_project" for group in program["requirementGroups"] for requirement in group.get("requirements", []))
    assert scaffold["clusterCount"] >= 3
    assert scaffold["courseCount"] >= len(course_requirements)
    assert materialized_courses
    assert all(course.get("materializedSnapshotId") for course in materialized_courses)
    assert all(course.get("courseBuildTask") for course in scaffold_courses)
    assert shell_readiness["status"] == "needs_sources"
    assert shell_readiness["missingCourseBuildTaskCount"] == 0
    assert action_plan["status"] == "needs_sources"
    assert action_plan["actionCounts"]["attach_source_packet"] == len(materialized_courses)
    assert action_plan["nextActions"][0]["sourceRequest"]["requiredConcepts"]
    assert source_acquisition["status"] == "needs_sources"
    assert source_acquisition["sourceIndexSearchPlan"]["status"] == "ready"
    assert source_acquisition["sourceIndexSearchPlan"]["nextTasks"][0]["intent"] == "find_source_packet_evidence"
    assert timeline["status"] == "passed"
    assert timeline["events"][-1]["payload"]["sourcePacketRequiredCount"] == len(materialized_courses)

    courses = client.get("/v1/courses", params={"limit": 100, "status": "all"})
    assert courses.status_code == 200, courses.text
    generated_shell_ids = {course["materializedSnapshotId"] for course in materialized_courses}
    returned_shells = [row for row in courses.json() if row["id"] in generated_shell_ids]
    assert len(returned_shells) == len(generated_shell_ids)
    assert all(row["status"] == "needs_sources" for row in returned_shells)
    assert all(row["structure"]["metadata"]["sourceGaps"] for row in returned_shells)
    assert all(row["structure"]["metadata"]["generationReadiness"]["status"] == "needs_sources" for row in returned_shells)


def test_program_course_shell_resumes_with_source_packet_into_quality_gated_course(client, monkeypatch) -> None:
    biology_url = "https://catalog.example.edu/pre-med/biology-chemistry"
    health_url = "https://catalog.example.edu/pre-med/health-ethics-lab"
    _install_source_fetch_mock(
        monkeypatch,
        {
            biology_url: """
            <html><body>
            <h1>Pre-Medical Preparation</h1>
            <h2>Learning Outcomes</h2>
            <ul>
              <li>Apply biology, chemistry, physics, statistics, psychology, sociology, and ethics to medical preparation.</li>
              <li>Complete laboratory practice, research literacy, writing, and capstone portfolio evidence.</li>
            </ul>
            </body></html>
            """,
            health_url: """
            <html><body>
            <h1>Pre-Health Professional Practice</h1>
            <h2>Learning Outcomes</h2>
            <ul>
              <li>Use clinical communication, evidence review, and health equity reasoning in patient-centered scenarios.</li>
              <li>Document source-backed projects, laboratory results, and professional reflections.</li>
            </ul>
            </body></html>
            """,
        },
    )
    for url in (biology_url, health_url):
        ingested = client.post(
            "/v1/sources/ingest",
            json={"url": url, "source_type": "catalog", "license": "cc-by", "is_free": True},
        )
        assert ingested.status_code == 201, ingested.text

    learner = client.post(
        "/v1/learners",
        json={"name": "Shell Resume Learner", "goal": "Prepare for medical school", "level": "beginner", "preferences": {}},
    )
    assert learner.status_code == 201, learner.text

    program_response = client.post(
        "/v1/programs/generate",
        json={
            "goal": "Create a pre-medical preparation program with biology, chemistry, physics, math, psychology, sociology, labs, writing, ethics, and capstone evidence.",
            "learner_id": learner.json()["id"],
            "level": "beginner",
            "free_only": True,
            "source_policy": "free-only",
            "trust_min": 0.1,
            "desired_course_count": 8,
            "source_urls": [biology_url, health_url],
        },
    )
    assert program_response.status_code == 201, program_response.text
    scaffold_courses = program_response.json()["structure"]["generationTrace"]["programSynthesis"]["courseScaffoldPlan"]["courses"]
    shell_id = next(course["materializedSnapshotId"] for course in scaffold_courses if course.get("action") == "create_empty_course")
    shell_response = client.get(f"/v1/courses/{shell_id}")
    assert shell_response.status_code == 200, shell_response.text
    shell = shell_response.json()
    source_packet = _source_packet_for_shell(shell)

    monkeypatch.setattr(
        "app.routes.course_source_gap_routes.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.routes.course_source_gap_routes.run_agent_course_generation_job", lambda _job_id: None)
    resume_response = client.post(
        f"/v1/courses/{shell_id}/source-gaps/resume",
        json={"source_packet": source_packet},
    )
    assert resume_response.status_code == 202, resume_response.text
    queued_job = resume_response.json()
    assert queued_job["status"] == "queued"
    assert queued_job["request"]["resume_course"]["metadata"]["courseBuildTask"]["status"] == "section_generation_ready"
    prior_readiness = queued_job["request"]["resume_course"]["metadata"].get("generationReadiness")
    assert prior_readiness["status"] == "ready"
    prior_trace_readiness = queued_job["request"].get("resume_trace", {}).get("generation_readiness")
    assert prior_trace_readiness["status"] == "ready"
    assert queued_job["request"]["generation_readiness"]["status"] == "ready"
    assert queued_job["request"]["source_packet"]["quality"]["status"] == "usable"

    def fake_generate_course_with_agent_staged(**kwargs: Any) -> CourseAgentResult:
        assert kwargs["resume_course"]["metadata"]["courseBuildTask"]["status"] == "section_generation_ready"
        return CourseAgentResult(
            course=_generated_course_from_shell(kwargs["resume_course"], kwargs["source_packet"]),
            trace={
                "mode": "test-agent",
                "generation_readiness": {
                    "contractVersion": "course-generation-readiness-v1",
                    "status": "ready",
                    "ready": True,
                    "sourceEvidence": {"submittedEvidenceCount": 3, "minimumCourseSources": 3},
                    "conceptCoverage": {
                        "status": "ready",
                        "coverageRatio": kwargs["source_packet"]["quality"]["conceptCoverageRatio"],
                        "uncoveredConcepts": [],
                    },
                    "issues": [],
                },
                "source_corpus_synthesis": {
                    "sourcePacket": {
                        "contractVersion": "source-packet-v1",
                        "quality": kwargs["source_packet"]["quality"],
                    }
                },
                "course_build_task": kwargs["resume_course"]["metadata"]["courseBuildTask"],
            },
        )

    monkeypatch.setattr(
        "app.jobs.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.jobs.generate_course_with_agent_staged", fake_generate_course_with_agent_staged)
    run_agent_course_generation_job(queued_job["id"])

    with db.SessionLocal() as session:
        job = session.get(Job, queued_job["id"])
        assert job is not None
        assert job.status == "completed", {"error": job.error, "result": job.result}
        assert job.result["accepted"] is True
        assert job.result["quality_report"]["passed"] is True
        generated_snapshot = job.result["course_snapshot"]
        assert generated_snapshot["status"] == "ready_for_review"
        assert generated_snapshot["structure"]["metadata"]["courseHealth"]["status"] in {"healthy", "watch"}
        assert generated_snapshot["structure"]["metadata"]["generationReadiness"]["status"] == "ready"
        assert generated_snapshot["generation_trace"]["quality_report"]["passed"] is True
        assert generated_snapshot["generation_trace"]["generation_readiness"]["status"] == "ready"
        assert generated_snapshot["generation_trace"]["source_corpus_synthesis"]["sourcePacket"]["quality"]["status"] == "usable"
