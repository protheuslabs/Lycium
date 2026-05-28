from __future__ import annotations

from typing import Any


CHEM_105_FLAGSHIP_BLUEPRINT: dict[str, Any] = {
    "id": "chem-105-general-chemistry",
    "title": "CHEM 105 General Chemistry I",
    "purpose": "Flagship proof target for source-backed, benchmark-grounded college course generation.",
    "scenario": {
        "label": "CHEM 105 General Chemistry I",
        "kind": "course",
        "expectedCategory": "college-of-sciences",
        "expectedDepartment": "chemistry",
        "minModules": 14,
        "minLearnSections": 14,
        "minQuizBlocks": 14,
        "minQuestionsPerQuiz": 10,
        "minSourceRecords": 6,
        "minModuleVideoCoverage": 0.8,
        "minRequiredKeywordCoverage": 0.82,
        "requiredKeywords": [
            "matter and measurement",
            "atomic structure",
            "periodic trends",
            "stoichiometry",
            "chemical reactions",
            "aqueous solutions",
            "thermochemistry",
            "chemical bonding",
            "molecular geometry",
            "intermolecular forces",
            "gases",
            "solutions",
            "kinetics",
            "equilibrium",
            "acid-base chemistry",
            "laboratory safety",
        ],
    },
    "benchmarkSources": [
        {
            "id": "benchmark-uaf-chem-f105x",
            "institution": "University of Alaska Fairbanks",
            "title": "CHEM F105X General Chemistry I syllabus",
            "url": "https://www.uaf.edu/chem/files/CHEM%20105%20Green.pdf",
            "evidence": [
                "standard one-year engineering and science-major general chemistry course",
                "measurements, calculations, atomic and molecular structure, gas laws, stoichiometry",
                "chemical bonding, intermolecular forces, reaction chemistry, thermochemistry, gases",
            ],
        },
        {
            "id": "benchmark-adrian-chem105",
            "institution": "Adrian College",
            "title": "CHEM105 General Chemistry I catalog entry",
            "url": "https://adrian.smartcatalogiq.com/en/2025-2026/catalog/courses/chem-chemistry/100/chem105",
            "evidence": [
                "units of measurement, physical properties of matter, atomic structure",
                "chemical reactions and stoichiometry, aqueous solutions, acids and bases",
                "chemical bonding and Lewis structures",
            ],
        },
        {
            "id": "benchmark-ole-miss-chem105",
            "institution": "University of Mississippi",
            "title": "CHEM 105 General Chemistry I catalog entry",
            "url": "https://catalog.olemiss.edu/2020/fall/chem-105",
            "evidence": [
                "atomic and molecular structure, stoichiometry, solutions",
                "gases, liquids, solids, chemical bonding, kinetics, thermodynamics, equilibrium",
            ],
        },
        {
            "id": "benchmark-usc-chem105a",
            "institution": "University of Southern California",
            "title": "CHEM 105aLg General Chemistry syllabus",
            "url": "https://web-app.usc.edu/soc/syllabus/20203/17223.pdf",
            "evidence": [
                "chemical bonding, reaction stoichiometry, properties of solutions and gases",
                "thermochemistry and modern atomic theory",
            ],
        },
    ],
    "freeSourceRecords": [
        {
            "id": "source-openstax-chemistry-2e",
            "title": "OpenStax Chemistry 2e",
            "type": "textbook",
            "url": "https://openstax.org/details/books/chemistry-2e",
            "license": "free textbook",
        },
        {
            "id": "source-libretexts-openstax-chemistry-2e",
            "title": "Chemistry LibreTexts: Chemistry 2e (OpenStax)",
            "type": "textbook",
            "url": "https://chem.libretexts.org/Bookshelves/General_Chemistry/Chemistry_2e_(OpenStax)",
            "license": "CC BY 4.0 source remix",
        },
        {
            "id": "source-khan-chemistry-archive",
            "title": "Khan Academy Chemistry archive",
            "type": "video-practice",
            "url": "https://www.khanacademy.org/chemistry",
            "license": "free educational access",
        },
        {
            "id": "source-mit-ocw-5111",
            "title": "MIT OpenCourseWare 5.111 Principles of Chemical Science",
            "type": "lecture-notes",
            "url": "https://ocw.mit.edu/courses/5-111-principles-of-chemical-science-fall-2008/",
            "license": "free educational access",
        },
        {
            "id": "source-chemcollective",
            "title": "ChemCollective virtual labs",
            "type": "virtual-lab",
            "url": "https://chemcollective.org/",
            "license": "free educational access",
        },
        {
            "id": "source-phet-chemistry",
            "title": "PhET chemistry simulations",
            "type": "simulation",
            "url": "https://phet.colorado.edu/en/simulations/filter?subjects=chemistry&type=html",
            "license": "free simulations",
        },
    ],
    "weekPlan": [
        ("matter and measurement", ["source-openstax-chemistry-2e", "source-khan-chemistry-archive"]),
        ("atomic structure", ["source-openstax-chemistry-2e", "source-mit-ocw-5111"]),
        ("periodic trends", ["source-libretexts-openstax-chemistry-2e", "source-khan-chemistry-archive"]),
        ("chemical formulas and nomenclature", ["source-openstax-chemistry-2e"]),
        ("stoichiometry", ["source-openstax-chemistry-2e", "source-chemcollective"]),
        ("aqueous reactions and solutions", ["source-libretexts-openstax-chemistry-2e", "source-chemcollective"]),
        ("thermochemistry", ["source-openstax-chemistry-2e", "source-chemcollective"]),
        ("chemical bonding", ["source-openstax-chemistry-2e", "source-mit-ocw-5111"]),
        ("molecular geometry", ["source-libretexts-openstax-chemistry-2e", "source-phet-chemistry"]),
        ("intermolecular forces", ["source-openstax-chemistry-2e", "source-phet-chemistry"]),
        ("gases", ["source-openstax-chemistry-2e", "source-khan-chemistry-archive"]),
        ("solutions and colligative properties", ["source-libretexts-openstax-chemistry-2e"]),
        ("kinetics and reaction rates", ["source-openstax-chemistry-2e", "source-mit-ocw-5111"]),
        ("equilibrium and acid-base chemistry", ["source-openstax-chemistry-2e", "source-khan-chemistry-archive"]),
    ],
    "qualityGates": {
        "minimumBenchmarkSources": 3,
        "minimumFreeSources": 6,
        "minimumWeeks": 14,
        "minimumQuizQuestionsPerWeek": 10,
        "sourceSlotPolicy": "Every required week must name at least one primary free source.",
        "reviewPolicy": "A course can be ready for review only after benchmark, source, assessment, media, summary, and schema gates pass.",
    },
}


def chem_105_source_slots() -> list[dict[str, Any]]:
    return [
        {
            "requiredConceptId": f"chem-105-week-{index:02d}-{topic.replace(' ', '-')}",
            "title": topic.title(),
            "primarySourceId": source_ids[0],
            "fallbackSourceIds": source_ids[1:],
            "replacementPolicy": "review_required",
        }
        for index, (topic, source_ids) in enumerate(CHEM_105_FLAGSHIP_BLUEPRINT["weekPlan"], start=1)
    ]
