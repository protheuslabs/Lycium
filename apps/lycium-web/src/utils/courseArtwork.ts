import type { CourseEntry } from "../courseTypes";

export type CourseArtworkId = "learning" | "computing" | "humanities" | "finance" | "engineering" | "chemistry";

const departmentArtwork: Record<string, CourseArtworkId> = {
  finance: "finance",
  economics: "finance",
  accounting: "finance",
  "agricultural-economics": "finance",
  chemistry: "chemistry",
  "chemical-engineering": "chemistry",
  physics: "engineering",
  "mechanical-engineering": "engineering",
  "civil-engineering": "engineering",
  "biomedical-engineering": "engineering",
  "industrial-engineering": "engineering",
};

export function getCourseArtworkId(course: Pick<CourseEntry, "data">): CourseArtworkId {
  const department = course.data.department ?? "";
  if (departmentArtwork[department]) return departmentArtwork[department];
  for (const tag of course.data.tags ?? []) {
    const taggedArtwork = departmentArtwork[tag.toLowerCase().trim().replaceAll(" ", "-")];
    if (taggedArtwork) return taggedArtwork;
  }
  const category = course.data.category ?? "";
  if (category === "computing-information-sciences") return "computing";
  if (category === "arts-humanities" || category === "social-sciences") return "humanities";
  return "learning";
}
