"""Structured handoffs for model-backed curriculum and module planning."""

from __future__ import annotations

from collections import Counter
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.course_taxonomy import COURSE_TAXONOMY
from app.generation_helpers import _stable_id

PlanningText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class PlanningRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CourseWorkload(PlanningRecord):
    totalMinutes: int = Field(ge=30)
    durationOrigin: Literal["requested", "estimated"]
    credits: float | None = Field(default=None, gt=0)
    creditSystem: PlanningText | None = None
    creditOrigin: Literal["requested", "estimated"] | None = None
    basis: PlanningText

    @model_validator(mode="after")
    def credit_basis(self) -> CourseWorkload:
        if self.credits is not None and not (self.creditSystem and self.creditOrigin):
            raise ValueError("Credits need a named system and an origin.")
        return self


class CurriculumTopic(PlanningRecord):
    title: PlanningText
    outcome: PlanningText
    depth: Literal["recognize", "explain", "apply"]
    mustTeach: list[PlanningText] = Field(min_length=1, max_length=12)
    sourceIds: list[PlanningText] = Field(default_factory=list)


class CourseCurriculum(PlanningRecord):
    title: PlanningText
    shortDescription: PlanningText
    audience: PlanningText
    interpretation: PlanningText
    prerequisites: list[PlanningText]
    exclusions: list[PlanningText]
    outcome: PlanningText
    workload: CourseWorkload
    assumptions: list[PlanningText] = Field(default_factory=list)
    openIssues: list[PlanningText] = Field(default_factory=list)
    topics: list[CurriculumTopic] = Field(min_length=3, max_length=24)

    @model_validator(mode="after")
    def distinct_topics(self) -> CourseCurriculum:
        if len({topic.title.casefold() for topic in self.topics}) != len(self.topics):
            raise ValueError("Curriculum topics must have distinct titles.")
        return self

    def preserve_workload(
        self, *, minutes: int | None, credits: float | None, credit_system: str | None,
    ) -> CourseCurriculum:
        if minutes is not None and (self.workload.totalMinutes != minutes or self.workload.durationOrigin != "requested"):
            raise ValueError(f"Preserve the requested workload of {minutes} minutes and label it requested.")
        if credits is not None and (self.workload.credits != credits or self.workload.creditOrigin != "requested"):
            raise ValueError(f"Preserve the requested {credits:g} credits and label them requested.")
        if credit_system and self.workload.creditSystem != credit_system:
            raise ValueError(f"Preserve the requested credit system: {credit_system}.")
        return self

    def required_items(self, allowed_source_ids: set[str]) -> list[dict]:
        return [
            {
                "id": _stable_id("coverage", self.title, topic.title.casefold()),
                "title": topic.title,
                "description": topic.outcome,
                "priority": "required",
                "depth": topic.depth,
                "mustTeach": topic.mustTeach,
                "sourceIds": list(dict.fromkeys(ref for ref in topic.sourceIds if ref in allowed_source_ids)),
            }
            for topic in self.topics
        ]


class PlannedModule(PlanningRecord):
    id: PlanningText
    title: PlanningText
    learningObjectives: list[PlanningText] = Field(min_length=1, max_length=6)
    conceptKeywords: list[PlanningText] = Field(min_length=1, max_length=16)
    assignedCoverageItemIds: list[PlanningText] = Field(min_length=1)
    sourceIds: list[PlanningText] = Field(default_factory=list)


class CourseModulePlan(PlanningRecord):
    category: PlanningText
    department: PlanningText
    tags: list[PlanningText] = Field(max_length=12)
    modules: list[PlannedModule] = Field(min_length=1, max_length=20)

    def materialize(self, template: dict, *, module_limit: int) -> dict:
        items = {item["id"]: item for item in template["courseCoverageChecklist"]["requiredItems"]}
        assignments = Counter(ref for module in self.modules for ref in module.assignedCoverageItemIds)
        if assignments != Counter(items.keys()):
            missing = sorted(items.keys() - assignments.keys())
            unknown = sorted(assignments.keys() - items.keys())
            repeated = sorted(ref for ref, count in assignments.items() if count > 1)
            raise ValueError(f"Invalid coverage allocation. Missing: {missing}. Unknown: {unknown}. Repeated: {repeated}.")
        if len(self.modules) > module_limit:
            raise ValueError("Module plan exceeds the requested module count.")
        if len({module.id for module in self.modules}) != len(self.modules):
            raise ValueError("Module IDs must be unique.")
        if len({module.title.casefold() for module in self.modules}) != len(self.modules):
            raise ValueError("Module titles must be unique.")
        category = template.get("category") or self.category
        department = template.get("department") or self.department
        if department not in COURSE_TAXONOMY.get(category, {}):
            raise ValueError(f"Department {department!r} is outside category {category!r}.")

        allowed_sources = set(template["sourceIds"])
        plan = {**self.model_dump(), "category": category, "department": department}
        for module in plan["modules"]:
            assigned = [items[ref] for ref in module["assignedCoverageItemIds"]]
            source_ids = list(dict.fromkeys(
                ref for ref in [*module["sourceIds"], *(ref for item in assigned for ref in item["sourceIds"])]
                if ref in allowed_sources
            ))
            module.update({
                "sourceIds": source_ids,
                "coverageMustTeach": list(dict.fromkeys(term for item in assigned for term in item["mustTeach"])),
                "coverageItems": assigned,
                "planningSource": "model_curriculum",
            })
        plan.update({key: template[key] for key in ("title", "shortDescription", "scope")})
        return plan


class PlannedSection(PlanningRecord):
    title: PlanningText
    objective: PlanningText
    assignedCoverageItemIds: list[PlanningText] = Field(min_length=1)
    mustTeach: list[PlanningText] = Field(min_length=1)


class ModuleSectionPlan(PlanningRecord):
    moduleId: PlanningText
    sections: list[PlannedSection] = Field(min_length=1, max_length=6)

    def materialize(self, module: dict) -> list[dict]:
        items = {item["id"]: item for item in module["coverageItems"]}
        assigned = set()
        covered: set[tuple[str, str]] = set()
        titles: set[str] = set()
        outlines = []
        for index, section in enumerate(self.sections, 1):
            title = section.title.casefold()
            if title in titles:
                raise ValueError("Section titles must be distinct.")
            titles.add(title)
            refs = set(section.assignedCoverageItemIds)
            if unknown := refs - items.keys():
                raise ValueError(f"Unknown coverage IDs: {sorted(unknown)}.")
            required = {(ref, term) for ref in refs for term in items[ref]["mustTeach"]}
            terms = set(section.mustTeach)
            if extra := terms - {term for _, term in required}:
                raise ValueError(f"Unknown must-teach terms: {sorted(extra)}.")
            if any(not any((ref, term) in required for term in terms) for ref in refs):
                raise ValueError("Every section coverage ID must match at least one exact must-teach term.")
            assigned.update(refs)
            covered.update((ref, term) for ref, term in required if term in terms)
            outlines.append({
                "id": _stable_id("lesson", module["id"], str(index)),
                "title": section.title,
                "description": section.objective,
                "learningObjectives": [section.objective],
                "conceptKeywords": section.mustTeach,
                "assignedCoverageItemIds": section.assignedCoverageItemIds,
                "coverageMustTeach": section.mustTeach,
                "sourceIds": list(dict.fromkeys(
                    source for ref in section.assignedCoverageItemIds for source in items[ref]["sourceIds"]
                )),
                "planningSource": "model_curriculum",
            })
        missing = {(ref, term) for ref, item in items.items() for term in item["mustTeach"]} - covered
        if missing or assigned != items.keys():
            raise ValueError(f"Missing required section coverage: {sorted(missing)}.")
        return outlines


class CourseSectionPlans(PlanningRecord):
    modules: list[ModuleSectionPlan] = Field(min_length=1, max_length=20)

    def materialize(self, modules: list[dict]) -> dict[str, list[dict]]:
        if Counter(plan.moduleId for plan in self.modules) != Counter(module["id"] for module in modules):
            raise ValueError("Return one section plan for every supplied module ID.")
        by_id = {module["id"]: module for module in modules}
        return {plan.moduleId: plan.materialize(by_id[plan.moduleId]) for plan in self.modules}
