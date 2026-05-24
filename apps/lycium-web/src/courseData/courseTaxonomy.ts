export type CourseTaxonomyItem = {
  id: string;
  label: string;
};

export const courseCategories: CourseTaxonomyItem[] = [
  { id: "arts-humanities", label: "College of Arts and Humanities" },
  { id: "fine-performing-arts", label: "College of Fine and Performing Arts" },
  { id: "business-management", label: "College of Business and Management" },
  { id: "education", label: "College of Education" },
  { id: "engineering", label: "College of Engineering" },
  { id: "computing-information-sciences", label: "College of Computing and Information Sciences" },
  { id: "natural-sciences-mathematics", label: "College of Natural Sciences and Mathematics" },
  { id: "social-sciences", label: "College of Social Sciences" },
  { id: "health-sciences", label: "College of Health Sciences" },
  { id: "medicine", label: "School of Medicine" },
  { id: "nursing", label: "School of Nursing" },
  { id: "public-health", label: "School of Public Health" },
  { id: "law", label: "School of Law" },
  { id: "agriculture-environmental-sciences", label: "College of Agriculture and Environmental Sciences" },
  { id: "architecture-planning-design", label: "College of Architecture, Planning, and Design" },
  { id: "communication-media", label: "College of Communication and Media" },
  { id: "public-policy-government", label: "School of Public Policy and Government" },
  { id: "social-work-human-services", label: "School of Social Work and Human Services" },
  { id: "continuing-professional-studies", label: "School of Continuing and Professional Studies" },
  { id: "interdisciplinary-studies", label: "College of Interdisciplinary Studies" },
];

export const courseTags: CourseTaxonomyItem[] = [
  { id: "writing", label: "Writing" },
  { id: "rhetoric", label: "Rhetoric" },
  { id: "literature", label: "Literature" },
  { id: "philosophy", label: "Philosophy" },
  { id: "history", label: "History" },
  { id: "ethics", label: "Ethics" },
  { id: "visual-arts", label: "Visual arts" },
  { id: "music", label: "Music" },
  { id: "theater", label: "Theater" },
  { id: "mathematics", label: "Mathematics" },
  { id: "statistics", label: "Statistics" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
  { id: "earth-science", label: "Earth science" },
  { id: "environmental-science", label: "Environmental science" },
  { id: "computer-science", label: "Computer science" },
  { id: "programming", label: "Programming" },
  { id: "python", label: "Python" },
  { id: "software-engineering", label: "Software engineering" },
  { id: "software-architecture", label: "Software architecture" },
  { id: "web-development", label: "Web development" },
  { id: "accessibility", label: "Accessibility" },
  { id: "apis", label: "APIs" },
  { id: "data-science", label: "Data science" },
  { id: "artificial-intelligence", label: "Artificial intelligence" },
  { id: "machine-learning", label: "Machine learning" },
  { id: "mlops", label: "MLOps" },
  { id: "systems", label: "Systems" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "information-systems", label: "Information systems" },
  { id: "electrical-engineering", label: "Electrical engineering" },
  { id: "mechanical-engineering", label: "Mechanical engineering" },
  { id: "civil-engineering", label: "Civil engineering" },
  { id: "biomedical-engineering", label: "Biomedical engineering" },
  { id: "accounting", label: "Accounting" },
  { id: "finance", label: "Finance" },
  { id: "marketing", label: "Marketing" },
  { id: "entrepreneurship", label: "Entrepreneurship" },
  { id: "economics", label: "Economics" },
  { id: "psychology", label: "Psychology" },
  { id: "sociology", label: "Sociology" },
  { id: "anthropology", label: "Anthropology" },
  { id: "political-science", label: "Political science" },
  { id: "public-policy", label: "Public policy" },
  { id: "law", label: "Law" },
  { id: "education", label: "Education" },
  { id: "instructional-design", label: "Instructional design" },
  { id: "medicine", label: "Medicine" },
  { id: "nursing", label: "Nursing" },
  { id: "public-health", label: "Public health" },
  { id: "anatomy", label: "Anatomy" },
  { id: "architecture", label: "Architecture" },
  { id: "design", label: "Design" },
  { id: "documentation", label: "Documentation" },
  { id: "media-studies", label: "Media studies" },
  { id: "journalism", label: "Journalism" },
  { id: "agriculture", label: "Agriculture" },
];

const categoryLabels = new Map(courseCategories.map((category) => [category.id, category.label]));
const tagLabels = new Map(courseTags.map((tag) => [tag.id, tag.label]));

export function getCourseCategoryLabel(categoryId?: string) {
  return categoryId ? categoryLabels.get(categoryId) ?? categoryId : "Not categorized";
}

export function getCourseTagLabels(tagIds?: string[]) {
  return (tagIds ?? []).map((tagId) => tagLabels.get(tagId) ?? tagId);
}
