from __future__ import annotations

import re
from typing import Any


from app.program_contract_group_rules import PROGRAM_GROUP_RULES
from app.program_course_scaffold import apply_existing_course_links, build_course_scaffold_plan
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
PROGRAM_BRIEF_CONTRACT_VERSION = "program-brief-v1"
FALLBACK_STOPWORDS = {
    "and",
    "become",
    "build",
    "course",
    "create",
    "for",
    "from",
    "learn",
    "learning",
    "pathway",
    "prepare",
    "program",
    "study",
    "the",
    "with",
}
TITLE_REPLACEMENTS = {
    "Api": "API",
    "Apis": "APIs",
    "Css": "CSS",
    "Ci Cd": "CI/CD",
    "Html": "HTML",
    "Http": "HTTP",
    "Javascript": "JavaScript",
    "Mcat": "MCAT",
    "Sql": "SQL",
    "Typescript": "TypeScript",
    "Ux": "UX",
}

REQUIREMENT_TITLE_PREFIX = re.compile(
    r"^(?:a|an|complete|apply|integrate|interpret|practice|build|prepare|create|use|explain|conduct|analyze|compare|define|solve|model|evaluate|submit)\s+",
    re.IGNORECASE,
)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "program"


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


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
    if any(term in value for term in ("pre-med", "premed", "pre medical", "pre-medical", "medical school")):
        return "career_path"
    if any(term in value for term in ("engineer", "developer", "analyst", "career", "professional")):
        return "career_path"
    if any(term in value for term in ("degree", "major", "college")):
        return "degree_equivalent"
    if any(term in value for term in ("certificate", "certification")):
        return "certificate"
    return "skill_path"


def _program_field_for_goal(goal: str) -> str:
    value = goal.lower()
    if any(term in value for term in ("pre-med", "premed", "pre medical", "pre-medical", "medical school")):
        return "Pre-Medical Studies"
    if any(term in value for term in ("medicine", "clinical", "patient")):
        return "Health Sciences"
    if any(term in value for term in ("chem", "stoichiometry", "molecule", "laboratory")):
        return "Chemistry"
    if any(term in value for term in ("health", "epidemiology", "biostatistics")):
        return "Public Health"
    if any(term in value for term in ("data", "analytics", "statistics", "machine learning")):
        return "Data Science"
    if any(term in value for term in ("software", "full-stack", "programming", "developer")):
        return "Software Engineering"
    if any(term in value for term in ("writing", "rhetoric", "composition", "creative")):
        return "Writing and Rhetoric"
    if any(term in value for term in ("music", "guitar", "piano", "performance", "songwriting")):
        return "Music"
    return "Interdisciplinary Studies"


def _readable_title(value: str) -> str:
    cleaned = re.sub(r"[_\-]+", " ", value or "program").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title() if cleaned else "Program"


def _smart_title(value: str) -> str:
    title = _readable_title(value)
    for source, replacement in TITLE_REPLACEMENTS.items():
        title = re.sub(rf"\b{re.escape(source)}\b", replacement, title)
    return title.replace("Full Stack", "Full-Stack")


def _goal_focus_title(goal: str) -> str:
    cleaned = re.sub(r"\s+", " ", goal or "").strip()
    cleaned = re.sub(
        r"^(?:i\s+want\s+to\s+|i\s+need\s+to\s+|i\s+would\s+like\s+to\s+|learn\s+to\s+|learn\s+|become\s+(?:a|an)?\s*|prepare\s+for\s+|create\s+|build\s+|study\s+)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    if re.search(r"\bmedical school\b", cleaned, re.IGNORECASE):
        return "Medical School Preparation"
    return _smart_title(cleaned or goal or "Program")


def _program_title_for_goal(goal: str) -> str:
    value = goal.lower()
    if any(term in value for term in ("full-stack", "full stack", "software engineer", "software developer")):
        return "Full-Stack Software Engineer Pathway"
    if any(term in value for term in ("pre-med", "premed", "pre medical", "pre-medical", "medical school")):
        return "Medical School Preparation Program"
    focus = _goal_focus_title(goal)
    if focus.lower().endswith(("pathway", "program", "preparation", "foundations")):
        return focus
    return f"{focus} Pathway"


def _origin_title(origin: dict[str, Any], index: int) -> str:
    for key in ("title", "requirementTitle", "topic", "name", "description"):
        value = origin.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().rstrip(".")
    requirement_id = origin.get("requirementId")
    if isinstance(requirement_id, str) and requirement_id.strip():
        return _readable_title(requirement_id)
    return f"Evidence-backed requirement {index}"


def _canonical_requirement_title(value: str) -> str:
    title = _readable_title(value)
    previous = ""
    while title != previous:
        previous = title
        title = REQUIREMENT_TITLE_PREFIX.sub("", title).strip()
    return title or _readable_title(value)


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
    deduped: dict[str, dict[str, Any]] = {}
    for index, origin in enumerate(origins, start=1):
        canonical_title = _canonical_requirement_title(_origin_title(origin, index))
        key = _slugify(canonical_title)
        if key not in deduped:
            deduped[key] = {**origin, "title": canonical_title}
            continue
        row = deduped[key]
        row_refs = row.setdefault("evidenceRefs", [])
        for evidence_ref in origin.get("evidenceRefs") or []:
            if isinstance(evidence_ref, str) and evidence_ref not in row_refs:
                row_refs.append(evidence_ref)
        row_benchmarks = row.setdefault("benchmarkIds", [])
        for benchmark_id in origin.get("benchmarkIds") or []:
            if isinstance(benchmark_id, str) and benchmark_id not in row_benchmarks:
                row_benchmarks.append(benchmark_id)
        row["frequency"] = max(float(row.get("frequency") or 0), float(origin.get("frequency") or 0))
        row["score"] = max(float(row.get("score") or 0), float(origin.get("score") or 0))
    origins = list(deduped.values())
    minimum = max(8, min(24, desired_course_count))
    return origins[: max(minimum, min(len(origins), desired_course_count))]


def _fallback_template_terms(goal: str, field: str) -> tuple[str, list[str]]:
    value = goal.lower()
    if field == "Software Engineering" or any(term in value for term in ("full-stack", "full stack", "software engineer", "developer")):
        return (
            "software_engineering",
            [
                "Computing and Command Line Foundations",
                "Git and Collaborative Workflow",
                "Programming Fundamentals",
                "Data Structures and Algorithms",
                "HTML, CSS, and JavaScript",
                "TypeScript and React",
                "Frontend Accessibility and UX",
                "Backend APIs and HTTP",
                "Databases and SQL",
                "Authentication and Application Security",
                "Testing and Quality Engineering",
                "Software Architecture and Design",
                "DevOps, Docker, and CI/CD",
                "Cloud Deployment and Operations",
                "Performance and Observability",
                "Maintenance and Technical Debt",
                "Professional Engineering Practice",
                "Full-Stack Portfolio Project",
            ],
        )
    if field == "Pre-Medical Studies":
        return (
            "pre_medical",
            [
                "Biology Foundations for Pre-Medical Study",
                "General Chemistry",
                "Organic Chemistry",
                "Physics for Life Sciences",
                "Calculus and Statistics",
                "Psychology and Sociology",
                "Biochemistry",
                "Cell and Molecular Biology",
                "Genetics and Physiology",
                "Medical Ethics and Patient Communication",
                "Laboratory Research and Scientific Writing",
                "MCAT Integrated Review",
                "Clinical Exposure and Service Learning",
                "Medical School Application Portfolio",
            ],
        )
    if field == "Data Science":
        return (
            "data_science",
            [
                "Statistics and Probability",
                "Python for Data Analysis",
                "SQL and Data Modeling",
                "Data Cleaning and Reproducible Workflows",
                "Exploratory Visualization and Dashboards",
                "Machine Learning Foundations",
                "Experimentation and Evaluation",
                "Data Ethics and Privacy",
                "Communication for Data Products",
                "Analytics Portfolio Project",
                "Data Engineering Foundations",
                "Capstone Data Product",
            ],
        )
    if field == "Public Health":
        return (
            "public_health",
            [
                "Foundations of Public Health",
                "Epidemiology",
                "Biostatistics",
                "Health Policy and Systems",
                "Community Health Assessment",
                "Environmental Health",
                "Health Equity and Social Determinants",
                "Program Evaluation",
                "Intervention Planning",
                "Stakeholder Communication",
                "Public Health Capstone",
            ],
        )
    if field == "Chemistry":
        return (
            "chemistry",
            [
                "Matter and Measurement",
                "Atomic Structure",
                "Periodic Trends",
                "Stoichiometry",
                "Chemical Reactions",
                "Thermochemistry",
                "Chemical Bonding",
                "Equilibrium",
                "Acids and Bases",
                "Laboratory Safety and Measurement",
                "Chemistry Lab Practice",
                "Chemistry Capstone Portfolio",
            ],
        )
    if field == "Writing and Rhetoric":
        return (
            "writing_rhetoric",
            [
                "Rhetoric, Audience, and Purpose",
                "Academic Research Methods",
                "Thesis, Argument, and Evidence",
                "Source Evaluation and Citation",
                "Revision and Peer Review",
                "Genre, Style, and Voice",
                "Creative Writing Workshop",
                "Publication and Professional Practice",
                "Writing Portfolio Development",
                "Capstone Manuscript",
            ],
        )
    if field == "Music":
        return (
            "music",
            [
                "Instrument Technique Foundations",
                "Music Theory and Ear Training",
                "Rhythm and Sight Reading",
                "Repertoire Study",
                "Improvisation and Composition",
                "Recording and Practice Workflow",
                "Performance Preparation",
                "Ensemble Musicianship",
                "Portfolio Recital",
                "Capstone Performance",
            ],
        )
    return ("generic", [])


def _concepts_from_title(title: str) -> list[str]:
    segments = [
        segment.strip(" -")
        for segment in re.split(r",|/|\band\b|&|:", title)
        if segment.strip(" -")
    ]
    return list(dict.fromkeys(segments or [title]))[:6]


def _fallback_course_terms(goal: str, desired_course_count: int, field: str | None = None) -> tuple[list[str], str]:
    focus = _goal_focus_title(goal)
    template_key, template_terms = _fallback_template_terms(goal, field or _program_field_for_goal(goal))
    fallback_terms = [
        f"Foundations of {focus}",
        f"{focus} Core Concepts",
        f"{focus} Tools and Methods",
        f"Applied {focus} Practice",
        f"{focus} Quality and Feedback",
        f"{focus} Communication and Documentation",
        f"{focus} Portfolio Evidence",
        f"{focus} Capstone Preparation",
    ]
    token_terms = [
        _smart_title(term)
        for term in re.split(r"[^a-zA-Z0-9+#/]+", goal.lower())
        if len(term) > 2 and term not in FALLBACK_STOPWORDS
    ]
    extension_terms = [
        f"Advanced {focus} Practice",
        f"{focus} Case Studies",
        f"{focus} Project Studio",
        f"{focus} Review and Remediation",
        f"{focus} Professional Practice",
    ]
    source_terms = [*token_terms, *fallback_terms] if template_key == "generic" else [*template_terms, *fallback_terms, *token_terms]
    terms: list[str] = []
    seen: set[str] = set()
    for term in [*source_terms, *extension_terms]:
        title = term.strip()
        key = _slugify(title)
        if title and key not in seen:
            terms.append(title)
            seen.add(key)
    return terms[: max(4, desired_course_count)], template_key


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


def _fallback_course_requirement(goal: str, title: str, index: int, *, template_key: str) -> dict[str, Any]:
    slug = _slugify(title)
    focus = _goal_focus_title(goal)
    return {
        "id": f"req-{index:02d}-{slug}",
        "type": "complete_course",
        "title": title,
        "description": f"Complete a course that develops {title.lower()} for {focus.lower()}.",
        "courseId": f"{_slugify(goal)[:40]}-{slug}".strip("-"),
        "required": True,
        "importance": "required",
        "estimatedHours": 40,
        "origin": {
            "originType": "generated_gap_fill",
            "fallbackTemplate": template_key,
            "title": title,
            "importance": "required",
            "concepts": _concepts_from_title(title),
            "evidenceRefs": [],
        },
    }


def _group_key_for_requirement(requirement: dict[str, Any], _goal: str) -> str:
    origin = requirement.get("origin") if isinstance(requirement.get("origin"), dict) else {}
    concepts = origin.get("concepts") if isinstance(origin.get("concepts"), list) else []
    haystack = " ".join([str(requirement.get("title") or ""), *(str(concept) for concept in concepts)]).lower()
    best_key = ""
    best_score = 0
    for key, _label, keywords in PROGRAM_GROUP_RULES:
        score = sum(
            1
            for keyword in keywords
            if re.search(rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])", haystack)
        )
        if score > best_score:
            best_key = key
            best_score = score
    if best_key:
        return best_key
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
                "displayName": label,
                "description": f"Develops {label.lower()} needed for {goal}.",
                "groupKind": "cluster",
                "clusterType": "core" if index <= 2 else "specialization",
                "purpose": f"Organize source-backed requirements into a coherent {label.lower()} cluster.",
                "learningOutcomes": [
                    {
                        "id": f"outcome-{index:02d}-explain-{_slugify(label)}",
                        "statement": f"Explain the important ideas in {label.lower()}.",
                    },
                    {
                        "id": f"outcome-{index:02d}-apply-{_slugify(label)}",
                        "statement": f"Apply {label.lower()} work to authentic problems in {goal}.",
                    },
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
        "displayName": "Integrated Assessment",
        "description": f"Checks whether learners can connect the major requirements in {goal}.",
        "groupKind": "cluster",
        "clusterType": "lab",
        "purpose": "Require explicit assessment evidence before capstone work.",
        "learningOutcomes": [
            {
                "id": "outcome-integrated-synthesis",
                "statement": "Synthesize required concepts across the program.",
            },
            {
                "id": "outcome-integrated-feedback",
                "statement": "Use assessment feedback to identify gaps.",
            },
        ],
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
        "displayName": "Capstone and Portfolio Evidence",
        "description": f"Requires learners to produce reviewable evidence that they can use {goal} in practice.",
        "groupKind": "capstone",
        "clusterType": "capstone",
        "purpose": "Turn learning into a durable portfolio artifact.",
        "learningOutcomes": [
            {
                "id": "outcome-capstone-plan",
                "statement": "Plan and complete an integrated capstone artifact.",
            },
            {
                "id": "outcome-capstone-evidence",
                "statement": "Explain evidence of mastery to reviewers.",
            },
        ],
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
        {"fromNodeId": previous["id"], "toNodeId": current["id"], "type": "recommended"}
        for previous, current in zip(groups, groups[1:])
    ]


def _target_audience_for(level: str, program_type: str, field: str) -> str:
    if program_type == "career_path":
        return f"learners preparing for entry-level or advancing professional work in {field.lower()}"
    if program_type == "degree_equivalent":
        return f"{level.replace('_', ' ')} learners seeking a structured {field.lower()} curriculum"
    if program_type == "certificate":
        return f"learners seeking a focused certificate-style path in {field.lower()}"
    return f"self-directed learners building capability in {field.lower()}"


def _brief_course_signals(
    *,
    goal: str,
    desired_course_count: int,
    field: str,
    benchmark_context: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], str, str | None]:
    origins = _extract_requirement_origins(benchmark_context, desired_course_count)
    if origins:
        requirements = [_course_requirement_from_origin(goal, origin, index) for index, origin in enumerate(origins, start=1)]
        return requirements, "benchmark_informed", None
    fallback_terms, fallback_template = _fallback_course_terms(goal, desired_course_count, field)
    requirements = [
        _fallback_course_requirement(goal, title, index, template_key=fallback_template)
        for index, title in enumerate(fallback_terms, start=1)
    ]
    return requirements, "prompt_inferred", fallback_template


def _brief_group_plan(goal: str, requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups = _group_requirements(_goal_focus_title(goal), requirements)
    group_plans: list[dict[str, Any]] = []
    for index, group in enumerate(groups, start=1):
        group_requirements = _items(group.get("requirements"))
        group_plans.append(
            {
                "id": f"brief-group-{index:02d}-{_slugify(str(group.get('title') or index))}",
                "title": str(group.get("displayName") or group.get("title") or f"Group {index}"),
                "description": str(group.get("description") or ""),
                "groupKind": str(group.get("groupKind") or "cluster"),
                "clusterType": str(group.get("clusterType") or "core"),
                "requirementThemeCount": len(group_requirements),
                "sampleTopics": [
                    str(requirement.get("title") or "")
                    for requirement in group_requirements[:4]
                    if str(requirement.get("title") or "").strip()
                ],
            }
        )
    return group_plans


def build_program_brief(
    goal: str,
    level: str | None,
    desired_course_count: int,
    benchmark_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    desired_course_count = max(4, min(32, desired_course_count))
    clean_goal = re.sub(r"\s+", " ", goal or "").strip()
    program_title = _program_title_for_goal(clean_goal)
    program_focus = _goal_focus_title(clean_goal)
    program_field = _program_field_for_goal(clean_goal)
    program_type = _program_type_for_goal(clean_goal)
    normalized_level = _normalize_program_level(level)
    course_signals, evidence_mode, fallback_template = _brief_course_signals(
        goal=clean_goal,
        desired_course_count=desired_course_count,
        field=program_field,
        benchmark_context=benchmark_context,
    )
    source_slots = benchmark_context.get("sourceSlots") if isinstance(benchmark_context, dict) else []
    benchmarks = benchmark_context.get("curriculumBenchmarks") if isinstance(benchmark_context, dict) else []
    origins = _extract_requirement_origins(benchmark_context, desired_course_count)
    target_audience = _target_audience_for(normalized_level, program_type, program_field)
    target_outcome = (
        f"Learners can demonstrate practical competence in {program_focus.lower()} "
        "through source-backed courses, integrated assessment, and portfolio evidence."
    )
    return {
        "contractVersion": PROGRAM_BRIEF_CONTRACT_VERSION,
        "sourceGoal": clean_goal,
        "title": program_title,
        "shortDescription": f"A structured, source-backed pathway for {program_focus.lower()}.",
        "description": (
            f"A structured, source-backed pathway for {program_focus.lower()}, "
            "organized around curriculum requirements, practice, assessment, and portfolio evidence."
        ),
        "programType": program_type,
        "field": program_field,
        "focus": program_focus,
        "level": normalized_level,
        "targetAudience": target_audience,
        "targetOutcome": target_outcome,
        "desiredCourseCount": desired_course_count,
        "learningOutcomes": [
            {
                "id": "outcome-program-foundations",
                "statement": f"Explain the foundational concepts behind {program_focus.lower()}.",
            },
            {
                "id": "outcome-program-practice",
                "statement": f"Apply {program_focus.lower()} skills to realistic practice or project work.",
            },
            {
                "id": "outcome-program-source-backed-requirements",
                "statement": "Complete source-backed requirements with traceable evidence and assessment checkpoints.",
            },
            {
                "id": "outcome-program-portfolio-evidence",
                "statement": "Produce portfolio or capstone evidence that can be reviewed by a human.",
            },
        ],
        "broadRequirementGroups": _brief_group_plan(clean_goal, course_signals),
        "evidence": {
            "mode": evidence_mode,
            "fallbackTemplate": fallback_template,
            "curriculumBenchmarkCount": len(benchmarks) if isinstance(benchmarks, list) else 0,
            "requirementOriginCount": len(origins),
            "sourceSlotCount": len(source_slots) if isinstance(source_slots, list) else 0,
            "courseSignalCount": len(course_signals),
        },
        "assumptions": [
            "Later workflows will turn this brief into requirement groups and course wrappers.",
            "Courses should remain source-backed before review or publication.",
            "Portfolio or capstone evidence is expected unless a reviewer marks it not applicable.",
        ],
    }


def build_program_contract(
    goal: str,
    level: str | None,
    desired_course_count: int,
    benchmark_context: dict[str, Any] | None = None,
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
    program_brief: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    desired_course_count = max(4, min(32, desired_course_count))
    brief = (
        dict(program_brief)
        if isinstance(program_brief, dict)
        else build_program_brief(goal, level, desired_course_count, benchmark_context)
    )
    program_title = str(brief.get("title") or _program_title_for_goal(goal))
    program_focus = str(brief.get("focus") or _goal_focus_title(goal))
    program_field = str(brief.get("field") or _program_field_for_goal(goal))
    program_type = str(brief.get("programType") or _program_type_for_goal(goal))
    program_level = str(brief.get("level") or _normalize_program_level(level))
    origins = _extract_requirement_origins(benchmark_context, desired_course_count)
    if origins:
        course_requirements = [_course_requirement_from_origin(goal, origin, index) for index, origin in enumerate(origins, start=1)]
        synthesis_mode = "benchmark_first"
        fallback_template = None
    else:
        fallback_terms, fallback_template = _fallback_course_terms(goal, desired_course_count, program_field)
        course_requirements = [
            _fallback_course_requirement(goal, title, index, template_key=fallback_template)
            for index, title in enumerate(fallback_terms, start=1)
        ]
        synthesis_mode = "goal_token_fallback"
    groups = _group_requirements(program_focus, course_requirements)
    groups.append(_checkpoint_group(program_focus, len(groups) + 1))
    groups.append(_capstone_group(program_focus, len(groups) + 1))
    course_scaffold_plan = build_course_scaffold_plan(groups, known_course_ids, known_courses)
    linked_existing_requirement_count = apply_existing_course_links(groups, course_scaffold_plan)
    source_slots = benchmark_context.get("sourceSlots") if isinstance(benchmark_context, dict) else []
    benchmarks = benchmark_context.get("curriculumBenchmarks") if isinstance(benchmark_context, dict) else []
    estimated_hours = sum(int(group.get("estimatedHours") or 0) for group in groups)
    program = {
        "id": f"program-{_slugify(goal)}",
        "title": program_title,
        "description": str(
            brief.get("description")
            or f"A structured, source-backed pathway for {program_focus.lower()}, organized around curriculum requirements and portfolio evidence."
        ),
        "programType": program_type,
        "field": program_field,
        "level": program_level,
        "targetOutcome": str(
            brief.get("targetOutcome")
            or f"Learners can demonstrate practical competence in {program_focus.lower()} through courses, assessments, and portfolio evidence."
        ),
        "learningOutcomes": _items(brief.get("learningOutcomes")) or [
            {
                "id": "outcome-foundational-concepts",
                "statement": f"Explain the foundational concepts behind {program_focus.lower()}.",
            },
            {
                "id": "outcome-source-backed-requirements",
                "statement": "Complete source-backed courses that satisfy program requirements.",
            },
            {
                "id": "outcome-assessment-and-evidence",
                "statement": "Pass integrated assessments and produce portfolio evidence.",
            },
        ],
        "entryRequirements": [
            {
                "id": "entry-general-readiness",
                "type": "demonstrate_competency",
                "competencyId": "general-learning-readiness",
                "title": "General learning readiness",
                "description": "Learners should be ready to read source material, complete practice, and revise work from feedback.",
            }
        ],
        "requirementGroups": groups,
        "dependencyGraph": {"edges": _dependency_edges(groups)},
        "estimatedHours": estimated_hours,
        "masteryPolicy": {
            "minimumMasteryPercent": 80,
            "minimumAssessmentPercent": 80,
            "requiresCapstone": True,
            "remediationPolicy": "recommended",
        },
        "credentialPolicy": {
            "credentialType": "portfolio_record",
            "title": f"{_readable_title(goal)} Portfolio Record",
            "issuer": "Lycium",
            "requiresHumanReview": True,
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
        "fallbackTemplate": fallback_template,
        "programBrief": brief,
        "field": program["field"],
        "programType": program["programType"],
        "estimatedHours": estimated_hours,
        "linkedExistingRequirementCount": linked_existing_requirement_count,
        "courseScaffoldPlan": course_scaffold_plan,
    }
    return program, course_requirements, synthesis
