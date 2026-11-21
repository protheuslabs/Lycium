import type { CourseEntry, CourseSection } from "../courseTypes";
import { estimateCourseTime } from "./curriculumTime";

const levelLabels: Record<string, string> = {
  elementary: "Elementary", highschool: "High school",
  undergrad: "Undergraduate", postgrad: "Postgraduate",
};

export function courseLevelLabel(course: CourseEntry): string | null {
  const level = course.data.difficultyLevel?.trim();
  return level ? levelLabels[level] ?? level : null;
}

export function courseDurationLabel(course: CourseEntry): string | null {
  const { minutes } = estimateCourseTime(course);
  if (minutes === null) return null;
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  const hours = Math.round(minutes / 60 * 10) / 10;
  return `~${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function sectionLearningType(section: Pick<CourseSection, "pageType" | "sectionType"> & { content: Array<{ type: string }> }): "Quiz" | "Project" | "Lesson" | "Assessment" | "Summary" {
  if (section.content.some((block) => block.type === "quiz")) return "Quiz";
  if (section.content.some((block) => block.type === "project")) return "Project";
  if (section.sectionType === "assessment" || section.pageType === "apply") return "Assessment";
  if (section.sectionType === "summary") return "Summary";
  return "Lesson";
}

export function courseLearningOutcomes(course: CourseEntry): string[] {
  const template = course.data.metadata?.courseTemplate;
  if (!template || typeof template !== "object" || !("learningOutcomes" in template)) return [];
  const outcomes = template.learningOutcomes;
  if (!Array.isArray(outcomes)) return [];
  return [...new Set(outcomes.flatMap((item: unknown) => {
    const text = typeof item === "string" ? item
      : item && typeof item === "object" && "outcome" in item ? item.outcome : null;
    return typeof text === "string" && text.trim() ? [text.trim()] : [];
  }))];
}

export function courseAssessmentCounts(course: CourseEntry) {
  const counts = { quizzes: 0, projects: 0, assessments: 0 };
  for (const module of course.data.modules) {
    for (const section of module.sections) {
      const quizzes = section.content.filter((block) => block.type === "quiz").length;
      const projects = section.content.filter((block) => block.type === "project").length;
      counts.quizzes += quizzes;
      counts.projects += projects;
      if (!quizzes && !projects && sectionLearningType(section) === "Assessment") counts.assessments += 1;
    }
  }
  return counts;
}
