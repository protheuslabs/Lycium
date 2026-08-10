from __future__ import annotations

import math
import re
from typing import Any

from app.generation_helpers import _stable_id, _title_from_prompt
from app.retrieval import tokenize

COURSE_COVERAGE_CHECKLIST_CONTRACT = "course-coverage-checklist-v1"
COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT = "course-coverage-allocation-report-v1"
COURSE_COVERAGE_OUTLINE_CONTRACT = "course-outline-from-coverage-checklist-v1"

GENERIC_FILLER_TERMS = {
    "application",
    "approach",
    "concept",
    "concepts",
    "context",
    "course",
    "essential",
    "essentials",
    "foundational",
    "foundation",
    "foundations",
    "matter",
    "matters",
    "method",
    "methods",
    "orientation",
    "practice",
    "process",
    "subject",
    "tool",
    "tools",
    "vocabulary",
}


def _slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return clean.strip("-") or "coverage-item"


def _unique(values: list[str], *, limit: int | None = None) -> list[str]:
    rows: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = str(value or "").strip()
        key = clean.lower()
        if not clean or key in seen:
            continue
        rows.append(clean)
        seen.add(key)
        if limit is not None and len(rows) >= limit:
            break
    return rows


def _is_chemistry_course(prompt: str, title: str) -> bool:
    text = f"{prompt} {title}".lower()
    return any(term in text for term in ("chem", "chemistry", "stoichiometry", "mole concept"))


def _section_plan(title: str, must_teach: list[str], objective: str | None = None) -> dict[str, Any]:
    return {
        "title": title,
        "mustTeach": must_teach,
        "learningObjective": objective or f"Explain {title.lower()} and use it in an intro-level problem.",
    }


def _coverage_item(
    item_id: str,
    title: str,
    *,
    description: str,
    must_teach: list[str],
    section_plans: list[dict[str, Any]],
    priority: str = "required",
    target_depth: str = "intro_college",
) -> dict[str, Any]:
    return {
        "id": item_id,
        "title": title,
        "description": description,
        "priority": priority,
        "targetDepth": target_depth,
        "mustTeach": must_teach,
        "sectionPlans": section_plans,
    }


def _intro_chemistry_items() -> list[dict[str, Any]]:
    return [
        _coverage_item(
            "measurement-scientific-method",
            "Scientific method, measurement, units, and significant figures",
            description="Start chemistry as a measurement-driven science with units, uncertainty, and dimensional analysis.",
            must_teach=[
                "scientific method",
                "hypothesis and experiment",
                "SI units",
                "dimensional analysis",
                "measurement uncertainty",
                "significant figures",
            ],
            section_plans=[
                _section_plan("Scientific method and chemical measurement", ["scientific method", "hypothesis and experiment", "measurement uncertainty"]),
                _section_plan("SI units and dimensional analysis", ["SI units", "unit conversion", "dimensional analysis"]),
                _section_plan("Significant figures and reporting measurements", ["significant figures", "precision", "accuracy"]),
            ],
        ),
        _coverage_item(
            "matter-atoms-isotopes",
            "Matter, atomic structure, isotopes, and ions",
            description="Explain what matter is made of and how atomic composition creates isotopes and ions.",
            must_teach=["matter", "atom", "proton", "neutron", "electron", "isotope", "ion", "atomic mass"],
            section_plans=[
                _section_plan("Classification of matter and chemical change", ["matter", "element", "compound", "mixture", "physical change", "chemical change"]),
                _section_plan("Atoms, subatomic particles, and nuclear symbols", ["atom", "proton", "neutron", "electron", "nuclear symbol"]),
                _section_plan("Isotopes, ions, and average atomic mass", ["isotope", "ion", "average atomic mass"]),
            ],
        ),
        _coverage_item(
            "periodic-table-electron-structure",
            "Periodic table, electron configuration, and periodic trends",
            description="Connect electron arrangement to periodic organization and chemical trends.",
            must_teach=["periodic table", "electron configuration", "valence electron", "atomic radius", "ionization energy", "electronegativity"],
            section_plans=[
                _section_plan("Periodic table organization", ["period", "group", "metal", "nonmetal", "metalloid"]),
                _section_plan("Electron configurations and valence electrons", ["electron configuration", "orbital", "valence electron"]),
                _section_plan("Periodic trends", ["atomic radius", "ionization energy", "electronegativity"]),
            ],
        ),
        _coverage_item(
            "formulas-nomenclature-molar-mass",
            "Chemical formulas, nomenclature, and molar mass",
            description="Teach learners to name compounds, write formulas, and connect formulas to measurable mass.",
            must_teach=["chemical formula", "ionic compound", "molecular compound", "nomenclature", "polyatomic ion", "molar mass"],
            section_plans=[
                _section_plan("Ionic formulas and charges", ["ionic compound", "charge balance", "polyatomic ion"]),
                _section_plan("Naming ionic and molecular compounds", ["nomenclature", "ionic nomenclature", "molecular nomenclature"]),
                _section_plan("Formula mass and molar mass", ["formula mass", "molar mass", "mole"]),
            ],
        ),
        _coverage_item(
            "bonding-lewis-geometry-hybridization",
            "Chemical bonding, Lewis structures, molecular geometry, and hybridization",
            description="Move from bonds and Lewis structures into shape, polarity, and hybrid orbitals.",
            must_teach=["ionic bond", "covalent bond", "Lewis structure", "formal charge", "resonance", "VSEPR", "molecular geometry", "hybridization"],
            section_plans=[
                _section_plan("Ionic and covalent bonding", ["ionic bond", "covalent bond", "electronegativity difference"]),
                _section_plan("Lewis structures, formal charge, and resonance", ["Lewis structure", "formal charge", "resonance"]),
                _section_plan("VSEPR geometry, polarity, and hybridization", ["VSEPR", "molecular geometry", "polarity", "hybridization"]),
            ],
        ),
        _coverage_item(
            "intermolecular-forces-states",
            "Intermolecular forces, liquids, solids, and phase changes",
            description="Explain how particle-level attractions shape physical properties and phase behavior.",
            must_teach=["intermolecular force", "dispersion force", "dipole-dipole force", "hydrogen bonding", "phase change", "vapor pressure"],
            section_plans=[
                _section_plan("Types of intermolecular forces", ["dispersion force", "dipole-dipole force", "hydrogen bonding"]),
                _section_plan("Liquids, solids, and physical properties", ["boiling point", "melting point", "viscosity", "surface tension"]),
                _section_plan("Heating curves and phase changes", ["phase change", "heating curve", "vapor pressure"]),
            ],
        ),
        _coverage_item(
            "chemical-reactions-equations",
            "Chemical reactions, balanced equations, and reaction classes",
            description="Use balanced chemical equations as the language for chemical change.",
            must_teach=["chemical equation", "law of conservation of mass", "balancing equations", "reaction type", "net ionic equation"],
            section_plans=[
                _section_plan("Writing and interpreting chemical equations", ["chemical equation", "reactant", "product"]),
                _section_plan("Balancing equations", ["law of conservation of mass", "coefficient", "balancing equations"]),
                _section_plan("Reaction types and net ionic equations", ["precipitation", "acid-base reaction", "redox reaction", "net ionic equation"]),
            ],
        ),
        _coverage_item(
            "stoichiometry",
            "Mole concept, stoichiometry, limiting reactants, and percent yield",
            description="Connect balanced equations to measurable quantities and reaction yields.",
            must_teach=["Avogadro's number", "mole", "mole ratio", "stoichiometry", "limiting reactant", "theoretical yield", "percent yield"],
            section_plans=[
                _section_plan("Moles, molar mass, and Avogadro's number", ["mole", "molar mass", "Avogadro's number"]),
                _section_plan("Mole ratios and stoichiometric calculations", ["balanced equation", "mole ratio", "stoichiometry"]),
                _section_plan("Limiting reactants and percent yield", ["limiting reactant", "theoretical yield", "percent yield"]),
            ],
        ),
        _coverage_item(
            "solutions-concentration",
            "Aqueous solutions, concentration, dilution, and solution stoichiometry",
            description="Teach solution composition and reactions in water.",
            must_teach=["solution", "solute", "solvent", "molarity", "dilution", "electrolyte", "precipitation", "titration"],
            section_plans=[
                _section_plan("Solutions, electrolytes, and solubility", ["solution", "electrolyte", "solubility"]),
                _section_plan("Molarity and dilution", ["molarity", "dilution", "stock solution"]),
                _section_plan("Solution stoichiometry and titration", ["solution stoichiometry", "titration", "equivalence point"]),
            ],
        ),
        _coverage_item(
            "gases",
            "Gas laws, ideal gases, and gas stoichiometry",
            description="Relate gas pressure, volume, amount, and temperature through particle models and equations.",
            must_teach=["pressure", "Boyle's law", "Charles's law", "Avogadro's law", "ideal gas law", "partial pressure", "gas stoichiometry"],
            section_plans=[
                _section_plan("Pressure, volume, temperature, and gas laws", ["pressure", "Boyle's law", "Charles's law", "Avogadro's law"]),
                _section_plan("Ideal gas law and molar mass of gases", ["ideal gas law", "moles", "molar mass"]),
                _section_plan("Partial pressures and gas stoichiometry", ["Dalton's law", "partial pressure", "gas stoichiometry"]),
            ],
        ),
        _coverage_item(
            "thermochemistry",
            "Thermochemistry, calorimetry, enthalpy, and Hess's law",
            description="Explain heat, energy transfer, and enthalpy changes in chemical systems.",
            must_teach=["heat", "temperature", "specific heat", "calorimetry", "enthalpy", "Hess's law", "enthalpy of reaction"],
            section_plans=[
                _section_plan("Heat, temperature, and specific heat", ["heat", "temperature", "specific heat"]),
                _section_plan("Calorimetry", ["calorimetry", "coffee-cup calorimeter", "heat capacity"]),
                _section_plan("Enthalpy and Hess's law", ["enthalpy", "enthalpy of reaction", "Hess's law"]),
            ],
        ),
        _coverage_item(
            "kinetics-equilibrium-acids-bases-redox",
            "Kinetics, equilibrium, acids and bases, and redox foundations",
            description="Close the course with rate, reversibility, acid-base chemistry, and electron-transfer foundations.",
            must_teach=["reaction rate", "activation energy", "chemical equilibrium", "Le Chatelier's principle", "acid", "base", "pH", "oxidation", "reduction"],
            section_plans=[
                _section_plan("Reaction rates and activation energy", ["reaction rate", "rate law", "activation energy", "catalyst"]),
                _section_plan("Chemical equilibrium and Le Chatelier's principle", ["chemical equilibrium", "equilibrium constant", "Le Chatelier's principle"]),
                _section_plan("Acids, bases, pH, and redox reactions", ["acid", "base", "pH", "oxidation", "reduction"]),
            ],
        ),
    ]


def _generic_items(prompt: str, title: str, goals: list[str]) -> list[dict[str, Any]]:
    seed_terms = _unique(
        [
            *[goal for goal in goals if goal],
            *[token for token in tokenize(f"{prompt} {title}") if len(token) > 3 and token not in GENERIC_FILLER_TERMS],
        ],
        limit=8,
    ) or [title]
    return [
        _coverage_item(
            f"prompt-topic-{index}",
            term.title(),
            description=f"Best-effort coverage item inferred from the course prompt: {term}.",
            must_teach=[term],
            section_plans=[
                _section_plan(f"Define {term}", [term]),
                _section_plan(f"Use {term} in context", [term]),
                _section_plan(f"Practice with {term}", [term]),
            ],
        )
        for index, term in enumerate(seed_terms, start=1)
    ]


def build_course_coverage_checklist(
    *,
    prompt: str,
    title: str | None = None,
    level: str | None = None,
    goals: list[str] | None = None,
) -> dict[str, Any]:
    resolved_title = title or _title_from_prompt(prompt)
    if _is_chemistry_course(prompt, resolved_title):
        items = _intro_chemistry_items()
        course_kind = "intro_college_chemistry"
        source = "domain_template"
    else:
        items = _generic_items(prompt, resolved_title, goals or [])
        course_kind = "prompt_inferred"
        source = "prompt_terms"
    return {
        "contractVersion": COURSE_COVERAGE_CHECKLIST_CONTRACT,
        "courseKind": course_kind,
        "title": resolved_title,
        "level": level or "unspecified",
        "source": source,
        "requiredItems": items,
        "policy": {
            "mustAssignEveryRequiredItemToModule": True,
            "mustAssignEveryRequiredItemToSection": True,
            "genericTitleTokensAreNotCoverage": sorted(GENERIC_FILLER_TERMS),
        },
    }


def _allocate_items(items: list[dict[str, Any]], module_count: int) -> list[list[dict[str, Any]]]:
    if not items:
        return []
    bucket_count = max(1, min(module_count, len(items)))
    buckets: list[list[dict[str, Any]]] = []
    for index in range(bucket_count):
        start = math.floor(index * len(items) / bucket_count)
        end = math.floor((index + 1) * len(items) / bucket_count)
        buckets.append(items[start:end] or [items[min(index, len(items) - 1)]])
    return buckets


def _module_title(bucket: list[dict[str, Any]], module_number: int) -> str:
    if len(bucket) == 1:
        return f"Module {module_number}: {bucket[0]['title']}"
    return f"Module {module_number}: {bucket[0]['title']} through {bucket[-1]['title']}"


def _keywords_for_section(plan: dict[str, Any], item: dict[str, Any]) -> list[str]:
    return _unique([*plan.get("mustTeach", []), *item.get("mustTeach", [])], limit=8)


def build_coverage_allocation_report(
    checklist: dict[str, Any],
    modules: list[dict[str, Any]],
) -> dict[str, Any]:
    required_ids = {
        str(item.get("id"))
        for item in checklist.get("requiredItems", [])
        if isinstance(item, dict) and item.get("id")
    }
    module_ids = {
        str(item_id)
        for module in modules
        for item_id in module.get("assignedCoverageItemIds", [])
        if str(item_id)
    }
    section_ids = {
        str(item_id)
        for module in modules
        for section in module.get("sections", [])
        if isinstance(section, dict)
        for item_id in section.get("assignedCoverageItemIds", [])
        if str(item_id)
    }
    unassigned_module_ids = sorted(required_ids - module_ids)
    unassigned_section_ids = sorted(required_ids - section_ids)
    duplicate_module_assignments = sorted(
        item_id
        for item_id in required_ids
        if sum(1 for module in modules if item_id in module.get("assignedCoverageItemIds", [])) > 1
    )
    return {
        "contractVersion": COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT,
        "status": "passed"
        if not unassigned_module_ids and not unassigned_section_ids and not duplicate_module_assignments
        else "failed",
        "requiredItemCount": len(required_ids),
        "moduleAssignedItemCount": len(module_ids),
        "sectionAssignedItemCount": len(section_ids),
        "unassignedModuleItemIds": unassigned_module_ids,
        "unassignedSectionItemIds": unassigned_section_ids,
        "duplicateModuleAssignmentIds": duplicate_module_assignments,
    }


def build_outline_from_coverage_checklist(
    *,
    prompt: str,
    desired_module_count: int,
    goals: list[str] | None = None,
    level: str | None = None,
    checklist: dict[str, Any] | None = None,
) -> dict[str, Any]:
    title = _title_from_prompt(prompt)
    checklist = checklist or build_course_coverage_checklist(
        prompt=prompt,
        title=title,
        level=level,
        goals=goals or [],
    )
    items = [item for item in checklist.get("requiredItems", []) if isinstance(item, dict)]
    modules: list[dict[str, Any]] = []
    for module_index, bucket in enumerate(_allocate_items(items, desired_module_count), start=1):
        assigned_ids = [str(item.get("id")) for item in bucket if item.get("id")]
        module_title = _module_title(bucket, module_index)
        module_id = _stable_id("m", title, module_title, str(module_index))
        sections: list[dict[str, Any]] = []
        for item in bucket:
            item_id = str(item.get("id") or _slug(str(item.get("title") or "coverage-item")))
            section_plans = [plan for plan in item.get("sectionPlans", []) if isinstance(plan, dict)]
            for section_index, plan in enumerate(section_plans or [_section_plan(str(item.get("title") or "Coverage item"), item.get("mustTeach", []))], start=1):
                section_title = str(plan.get("title") or item.get("title") or "Coverage section")
                section_id = _stable_id("s", module_id, item_id, section_title, str(section_index))
                keywords = _keywords_for_section(plan, item)
                sections.append(
                    {
                        "id": section_id,
                        "title": section_title,
                        "learning_objectives": [str(plan.get("learningObjective") or f"Explain {section_title.lower()}.")],
                        "concept_keywords": keywords,
                        "assignedCoverageItemIds": [item_id],
                        "coverageItemId": item_id,
                        "coverageMustTeach": keywords,
                        "estimated_minutes": 20,
                    }
                )
        modules.append(
            {
                "id": module_id,
                "title": module_title,
                "learning_objectives": [
                    f"Teach {item.get('title')} at {checklist.get('level') or 'intro'} depth."
                    for item in bucket
                    if item.get("title")
                ],
                "assignedCoverageItemIds": assigned_ids,
                "coverageAllocationStatus": "assigned",
                "sections": sections,
            }
        )
    allocation_report = build_coverage_allocation_report(checklist, modules)
    return {
        "contractVersion": COURSE_COVERAGE_OUTLINE_CONTRACT,
        "title": title,
        "shortDescription": f"A best-effort course outline covering required {checklist.get('courseKind', 'course')} topics for {title}.",
        "summary": f"A coverage-checklist outline for {title}; source review is still required before publication.",
        "modules": modules,
        "coverageChecklist": checklist,
        "coverageAllocationReport": allocation_report,
        "provenance": {
            "mode": "coverage-checklist-fallback",
            "courseKind": checklist.get("courseKind"),
            "coverageChecklistContract": checklist.get("contractVersion"),
            "coverageAllocationStatus": allocation_report.get("status"),
            "object_ids": [],
        },
    }
