from __future__ import annotations

import re
from typing import Any


PROGRAM_GROUP_RULES: list[tuple[str, str, list[str]]] = [
    (
        "foundations",
        "Foundations",
        [
            "foundation",
            "foundations",
            "introduction",
            "overview",
            "basics",
            "orientation",
            "safety",
            "measurement",
            "matter",
            "computer",
            "command line",
            "git",
        ],
    ),
    (
        "programming",
        "Programming and Computational Practice",
        [
            "programming",
            "python",
            "javascript",
            "typescript",
            "algorithm",
            "data structure",
            "function",
            "variable",
            "object",
            "software",
        ],
    ),
    (
        "frontend",
        "Frontend and User Experience",
        ["html", "css", "react", "browser", "frontend", "accessibility", "interface", "user experience"],
    ),
    (
        "backend_data",
        "Backend, Data, and Infrastructure",
        [
            "api",
            "http",
            "authentication",
            "authorization",
            "server",
            "backend",
            "security",
            "database",
            "sql",
            "postgresql",
            "data",
            "deployment",
            "docker",
            "cloud",
            "operations",
        ],
    ),
    (
        "analysis_modeling",
        "Analysis, Modeling, and Systems",
        [
            "statistics",
            "model",
            "modeling",
            "machine learning",
            "architecture",
            "systems",
            "design",
            "visualization",
            "equilibrium",
            "thermochemistry",
            "bonding",
            "stoichiometry",
            "periodic",
            "atomic",
            "reaction",
        ],
    ),
    (
        "public_health",
        "Population, Policy, and Public Systems",
        [
            "epidemiology",
            "biostatistics",
            "policy",
            "community",
            "environmental health",
            "health equity",
            "intervention",
            "population",
        ],
    ),
    (
        "practice_lab",
        "Practice, Laboratory, and Quality",
        ["lab", "laboratory", "practice", "experiment", "simulation", "testing", "quality", "evaluation"],
    ),
    (
        "professional",
        "Professional Evidence and Communication",
        [
            "communication",
            "documentation",
            "code review",
            "presentation",
            "portfolio",
            "ethics",
            "professional",
            "maintenance",
        ],
    ),
]

IMPORTANCE_RANK = {
    "required": 0,
    "core": 0,
    "common": 0,
    "recommended": 1,
    "support": 1,
    "remedial": 2,
    "optional": 3,
    "enrichment": 3,
}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "program"


def _normalize_program_level(level: str | None) -> str:
    value = (level or "professional").strip().lower().replace(" ", "_")
    if value in {"elementary", "middle_school", "high_school", "foundational", "foundation", "beginner"}:
        return "foundational"
    if value in {"undergrad", "undergraduate", "college"}:
        return "undergraduate"
    if value in {"post_grad", "postgraduate", "graduate", "masters", "doctoral"}:
        return "graduate"
    return "professional"


def _program_type_for_goal(goal: str) -> str:
    value = goal.lower()
    if any(term in value for term in ("engineer", "developer", "analyst", "career", "professional")):
        return "career_path"
    if any(term in value for term in ("degree", "major", "college")):
        return "degree_equivalent"
    if any(term in value for term in ("certificate", "certification")):
        return "certificate"
    return "skill_path"


def _program_field_for_goal(goal: str) -> str:
    value = goal.lower()
    if any(term in value for term in ("chem", "stoichiometry", "molecule", "laboratory")):
        return "Chemistry"
    if any(term in value for term in ("health", "epidemiology", "biostatistics")):
        return "Public Health"
    if any(term in value for term in ("data", "analytics", "statistics", "machine learning")):
        return "Data Science"
    if any(term in value for term in ("software", "full-stack", "programming", "developer")):
        return "Software Engineering"
    return "Interdisciplinary Studies"


def _readable_title(value: str) -> str:
    cleaned = re.sub(r"[_\-]+", " ", value or "program").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title() if cleaned else "Program"


def _origin_title(origin: dict[str, Any], index: int) -> str:
    for key in ("title", "requirementTitle", "topic", "name", "description"):
        value = origin.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().rstrip(".")
    requirement_id = origin.get("requirementId")
    if isinstance(requirement_id, str) and requirement_id.strip():
        return _readable_title(requirement_id)
    return f"Evidence-backed requirement {index}"


def _origin_importance(origin: dict[str, Any]) -> str:
    value = str(origin.get("importance") or origin.get("requirementImportance") or origin.get("originType") or "required").lower()
    if "optional" in value or "elective" in value:
        return "optional"
    if "recommend" in value or "support" in value:
        return "recommended"
    if "remedial" in value or "bridge" in value:
        return "remedial"
    return "required"


def _origin_score(origin: dict[str, Any]) -> float:
    for key in ("score", "confidence", "frequency", "coveragePercent"):
        value = origin.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return 0.0


def _extract_requirement_origins(benchmark_context: dict[str, Any] | None, desired_course_count: int) -> list[dict[str, Any]]:
    if not isinstance(benchmark_context, dict):
        return []
    raw_origins = benchmark_context.get("requirementOrigins")
    if not isinstance(raw_origins, list):
        return []
    origins = [origin for origin in raw_origins if isinstance(origin, dict) and _origin_title(origin, 0)]
    origins.sort(
        key=lambda origin: (
            IMPORTANCE_RANK.get(_origin_importance(origin), 4),
            -_origin_score(origin),
            _origin_title(origin, 0).lower(),
        )
    )
    minimum = max(8, min(24, desired_course_count))
    return origins[: max(minimum, min(len(origins), desired_course_count))]


def _fallback_course_terms(goal: str, desired_course_count: int) -> list[str]:
    base_terms = [term for term in re.split(r"[^a-zA-Z0-9+#]+", goal.lower()) if len(term) > 2]
    generic_terms = [
        "foundations",
        "core concepts",
        "tools and methods",
        "applied practice",
        "quality and evaluation",
        "professional evidence",
        "capstone",
    ]
    terms: list[str] = []
    for term in [*base_terms, *generic_terms]:
        title = _readable_title(term)
        if title not in terms:
            terms.append(title)
    return terms[: max(4, desired_course_count)]


def _course_requirement_from_origin(goal: str, origin: dict[str, Any], index: int) -> dict[str, Any]:
    title = _origin_title(origin, index)
    importance = _origin_importance(origin)
    slug = _slugify(title)
    evidence_refs = origin.get("evidenceRefs") if isinstance(origin.get("evidenceRefs"), list) else []
    hours = origin.get("estimatedHours") if isinstance(origin.get("estimatedHours"), int) else None
    return {
        "id": f"req-{index:02d}-{slug}",
        "type": "complete_course",
        "title": title,
        "description": f"Complete a source-backed course covering {title} as part of {goal}.",
        "courseId": f"{_slugify(goal)[:40]}-{slug}".strip("-"),
        "required": importance != "optional",
        "importance": importance,
        "estimatedHours": hours or (45 if importance == "required" else 30),
        "origin": {**origin, "title": title, "importance": importance, "evidenceRefs": evidence_refs},
    }


def _fallback_course_requirement(goal: str, title: str, index: int) -> dict[str, Any]:
    slug = _slugify(title)
    return {
        "id": f"req-{index:02d}-{slug}",
        "type": "complete_course",
        "title": title,
        "description": f"Complete a course that develops {title.lower()} for {goal}.",
        "courseId": f"{_slugify(goal)[:40]}-{slug}".strip("-"),
        "required": True,
        "importance": "required",
        "estimatedHours": 40,
        "origin": {"originType": "generated_gap_fill", "title": title, "importance": "required", "evidenceRefs": []},
    }


def _group_key_for_requirement(requirement: dict[str, Any], goal: str) -> str:
    haystack = " ".join(str(requirement.get(key) or "") for key in ("title", "description", "courseId", "importance")).lower()
    haystack = f"{haystack} {goal.lower()}"
    for key, _label, keywords in PROGRAM_GROUP_RULES:
        if any(keyword in haystack for keyword in keywords):
            return key
    return "applied"


def _fallback_group_label(index: int) -> str:
    labels = ["Foundations", "Core Practice", "Applied Depth", "Professional Evidence"]
    return labels[min(index, len(labels) - 1)]


def _group_requirements(goal: str, course_requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for requirement in course_requirements:
        buckets.setdefault(_group_key_for_requirement(requirement, goal), []).append(requirement)
    ordered_keys = [key for key, _label, _keywords in PROGRAM_GROUP_RULES if key in buckets]
    if "applied" in buckets:
        ordered_keys.append("applied")
    if len(ordered_keys) < 3 and len(course_requirements) >= 4:
        chunk_count = min(3, len(course_requirements))
        chunk_size = max(1, (len(course_requirements) + chunk_count - 1) // chunk_count)
        buckets = {f"fallback-{index}": course_requirements[index * chunk_size : (index + 1) * chunk_size] for index in range(chunk_count)}
        ordered_keys = list(buckets)
    groups: list[dict[str, Any]] = []
    label_by_key = {key: label for key, label, _keywords in PROGRAM_GROUP_RULES}
    for index, key in enumerate(ordered_keys, start=1):
        requirements = buckets[key]
        label = label_by_key.get(key, _fallback_group_label(index - 1))
        groups.append(
            {
                "id": f"group-{index:02d}-{_slugify(label)}",
                "title": label,
                "description": f"Develops {label.lower()} needed for {goal}.",
                "groupKind": "cluster",
                "clusterType": "core" if index <= 2 else "specialization",
                "purpose": f"Organize source-backed requirements into a coherent {label.lower()} cluster.",
                "learningOutcomes": [
                    f"Explain the important ideas in {label.lower()}.",
                    f"Apply {label.lower()} work to authentic problems in {goal}.",
                ],
                "requirements": requirements,
                "completionRule": {"type": "complete_all"},
                "estimatedHours": sum(int(req.get("estimatedHours") or 40) for req in requirements),
            }
        )
    return groups


def _checkpoint_group(goal: str, index: int) -> dict[str, Any]:
    assessment_id = f"assessment-{_slugify(goal)}-integrated-checkpoint"
    return {
        "id": f"group-{index:02d}-checkpoint",
        "title": "Integrated Assessment",
        "description": f"Checks whether learners can connect the major requirements in {goal}.",
        "groupKind": "cluster",
        "clusterType": "lab",
        "purpose": "Require explicit assessment evidence before capstone work.",
        "learningOutcomes": ["Synthesize required concepts across the program.", "Use assessment feedback to identify gaps."],
        "requirements": [
            {
                "id": "req-integrated-assessment",
                "type": "pass_assessment",
                "title": "Integrated Program Checkpoint",
                "description": f"Pass a cumulative checkpoint covering the core requirements for {goal}.",
                "assessmentId": assessment_id,
                "minScore": 80,
                "required": True,
                "estimatedHours": 4,
            }
        ],
        "completionRule": {"type": "pass_assessment", "assessmentId": assessment_id, "minScore": 80},
        "estimatedHours": 4,
    }


def _capstone_group(goal: str, index: int) -> dict[str, Any]:
    project_id = f"project-{_slugify(goal)}-capstone"
    return {
        "id": f"group-{index:02d}-capstone",
        "title": "Capstone and Portfolio Evidence",
        "description": f"Requires learners to produce reviewable evidence that they can use {goal} in practice.",
        "groupKind": "capstone",
        "clusterType": "capstone",
        "purpose": "Turn learning into a durable portfolio artifact.",
        "learningOutcomes": ["Plan and complete an integrated capstone artifact.", "Explain evidence of mastery to reviewers."],
        "requirements": [
            {
                "id": "req-capstone-project",
                "type": "submit_project",
                "title": "Capstone Project",
                "description": f"Submit a capstone project that demonstrates the program outcomes for {goal}.",
                "projectId": project_id,
                "artifactType": "portfolio",
                "requiredEvidence": ["project artifact", "technical or reflective writeup", "source-backed rationale"],
                "required": True,
                "estimatedHours": 24,
            },
            {
                "id": "req-portfolio-review",
                "type": "pass_assessment",
                "title": "Portfolio Review",
                "description": "Pass a final review of the capstone evidence and supporting course artifacts.",
                "assessmentId": f"assessment-{_slugify(goal)}-portfolio-review",
                "minScore": 80,
                "required": True,
                "estimatedHours": 3,
            },
        ],
        "completionRule": {"type": "complete_all"},
        "estimatedHours": 27,
    }


def _dependency_edges(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"fromNodeId": previous["id"], "toNodeId": current["id"], "type": "recommended_sequence"}
        for previous, current in zip(groups, groups[1:])
    ]


def build_program_contract(
    goal: str,
    level: str | None,
    desired_course_count: int,
    benchmark_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    desired_course_count = max(4, min(32, desired_course_count))
    origins = _extract_requirement_origins(benchmark_context, desired_course_count)
    if origins:
        course_requirements = [_course_requirement_from_origin(goal, origin, index) for index, origin in enumerate(origins, start=1)]
        synthesis_mode = "benchmark_first"
    else:
        course_requirements = [_fallback_course_requirement(goal, title, index) for index, title in enumerate(_fallback_course_terms(goal, desired_course_count), start=1)]
        synthesis_mode = "goal_token_fallback"
    groups = _group_requirements(goal, course_requirements)
    groups.append(_checkpoint_group(goal, len(groups) + 1))
    groups.append(_capstone_group(goal, len(groups) + 1))
    source_slots = benchmark_context.get("sourceSlots") if isinstance(benchmark_context, dict) else []
    benchmarks = benchmark_context.get("curriculumBenchmarks") if isinstance(benchmark_context, dict) else []
    estimated_hours = sum(int(group.get("estimatedHours") or 0) for group in groups)
    program = {
        "id": f"program-{_slugify(goal)}",
        "title": _readable_title(goal),
        "description": f"A source-backed program for {goal}, organized around curriculum requirements and portfolio evidence.",
        "programType": _program_type_for_goal(goal),
        "field": _program_field_for_goal(goal),
        "level": _normalize_program_level(level),
        "targetOutcome": f"Learners can demonstrate practical competence in {goal}.",
        "learningOutcomes": [
            f"Explain the foundational concepts behind {goal}.",
            "Complete source-backed courses that satisfy program requirements.",
            "Pass integrated assessments and produce portfolio evidence.",
        ],
        "entryRequirements": [
            {
                "id": "entry-general-readiness",
                "type": "recommended",
                "title": "General learning readiness",
                "description": "Learners should be ready to read source material, complete practice, and revise work from feedback.",
            }
        ],
        "requirementGroups": groups,
        "dependencyGraph": {"edges": _dependency_edges(groups)},
        "estimatedHours": estimated_hours,
        "masteryPolicy": {
            "minimumAssessmentScorePercent": 80,
            "requiresCapstone": True,
            "requiresPortfolioEvidence": True,
            "requiresSourceBackedRequirements": True,
        },
        "credentialPolicy": {
            "credentialType": "portfolio_certificate",
            "awardWhen": "all_required_groups_complete",
            "evidenceRequired": ["course completions", "integrated assessment", "capstone project", "portfolio review"],
        },
        "sourceCoverage": {
            "benchmarkCount": len(benchmarks) if isinstance(benchmarks, list) else 0,
            "requirementOriginCount": len(origins),
            "sourceSlotCount": len(source_slots) if isinstance(source_slots, list) else 0,
        },
        "reviewStatus": "draft",
        "version": "0.1.0",
    }
    synthesis = {
        "mode": synthesis_mode,
        "desiredCourseCount": desired_course_count,
        "requirementOriginCount": len(origins),
        "usedRequirementOriginCount": len(course_requirements) if origins else 0,
        "courseRequirementCount": len(course_requirements),
        "requirementGroupCount": len(groups),
        "field": program["field"],
        "programType": program["programType"],
        "estimatedHours": estimated_hours,
    }
    return program, course_requirements, synthesis
