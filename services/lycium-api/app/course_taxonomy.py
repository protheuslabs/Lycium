from __future__ import annotations

COURSE_TAXONOMY: dict[str, set[str]] = {
    "arts-humanities": {
        "classics",
        "comparative-literature",
        "english",
        "history",
        "philosophy",
        "religious-studies",
        "world-languages",
        "writing-rhetoric",
    },
    "fine-performing-arts": {
        "art-design",
        "art-history",
        "creative-writing",
        "dance",
        "film-media-arts",
        "music",
        "theatre",
    },
    "business-management": {
        "accounting",
        "business-analytics",
        "economics",
        "entrepreneurship",
        "finance",
        "hospitality-management",
        "information-systems",
        "management",
        "marketing",
        "supply-chain-management",
    },
    "education": {
        "counseling-human-development",
        "curriculum-instruction",
        "educational-leadership",
        "educational-psychology",
        "instructional-technology",
        "special-education",
        "teacher-education",
    },
    "computing-information-sciences": {
        "artificial-intelligence",
        "biomedical-engineering",
        "chemical-engineering",
        "civil-engineering",
        "computer-engineering",
        "computer-science",
        "cybersecurity",
        "data-science",
        "electrical-engineering",
        "human-computer-interaction",
        "industrial-engineering",
        "information-science",
        "information-technology",
        "mechanical-engineering",
        "software-engineering",
    },
    "natural-sciences-mathematics": {
        "astronomy",
        "biology",
        "chemistry",
        "earth-sciences",
        "environmental-science",
        "mathematics",
        "neuroscience",
        "physics",
        "statistics",
    },
    "social-sciences": {
        "anthropology",
        "criminology",
        "geography",
        "international-studies",
        "political-science",
        "psychology",
        "sociology",
        "urban-studies",
    },
    "health-sciences": {
        "clinical-laboratory-science",
        "health-administration",
        "kinesiology",
        "nutrition",
        "occupational-therapy",
        "physical-therapy",
        "speech-language-pathology",
    },
    "medicine": {
        "anesthesiology",
        "family-medicine",
        "internal-medicine",
        "neurology",
        "obstetrics-gynecology",
        "pathology",
        "pediatrics",
        "psychiatry",
        "radiology",
        "surgery",
    },
    "nursing": {
        "adult-gerontology-nursing",
        "community-health-nursing",
        "family-nurse-practitioner",
        "nursing-leadership",
        "pediatric-nursing",
        "psychiatric-mental-health-nursing",
    },
    "public-health": {
        "biostatistics",
        "community-health-sciences",
        "environmental-health",
        "epidemiology",
        "global-health",
        "health-policy-management",
    },
    "law": {
        "business-law",
        "constitutional-law",
        "criminal-law",
        "environmental-law",
        "health-law",
        "intellectual-property-law",
        "international-law",
        "public-interest-law",
    },
    "agriculture-environmental-sciences": {
        "agricultural-economics",
        "animal-science",
        "crop-soil-sciences",
        "environmental-sciences",
        "food-science",
        "forestry-natural-resources",
        "horticulture",
        "plant-pathology",
    },
    "architecture-planning-design": {
        "architecture",
        "industrial-design",
        "interior-architecture",
        "landscape-architecture",
        "real-estate-development",
        "urban-regional-planning",
    },
    "communication-media": {
        "advertising-public-relations",
        "communication-studies",
        "journalism",
        "media-production",
        "media-studies",
        "strategic-communication",
    },
    "public-policy-government": {
        "government",
        "international-affairs",
        "nonprofit-management",
        "public-administration",
        "public-policy",
        "security-studies",
    },
    "social-work-human-services": {
        "child-family-services",
        "community-practice",
        "gerontology",
        "human-services",
        "social-work",
    },
    "continuing-professional-studies": {
        "continuing-education",
        "organizational-leadership",
        "professional-studies",
        "project-management",
        "workforce-development",
    },
    "interdisciplinary-studies": {
        "data-society",
        "gender-studies",
        "interdisciplinary-studies",
        "liberal-studies",
        "science-technology-society",
        "sustainability-studies",
    },
}


def validate_course_taxonomy(course: dict) -> list[str]:
    category = course.get("category")
    department = course.get("department")

    if not isinstance(category, str) or not category.strip():
        return ["Course category is missing."]

    if category not in COURSE_TAXONOMY:
        return [f'Course category "{category}" is not in the taxonomy.']

    if not isinstance(department, str) or not department.strip():
        return ["Course department is missing."]

    if department not in COURSE_TAXONOMY[category]:
        return [f'Course department "{department}" is not in category "{category}".']

    return []
