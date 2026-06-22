import type { CourseData, CourseModule } from "../../courseTypes";

type SourceIdCarrier = {
  sourceIds?: string[];
};

export function collectReferencedCourseSourceIds(courseData: CourseData | undefined, modules: CourseModule[]) {
  const ids = new Set<string>();
  const addIds = (sourceIds?: string[]) => sourceIds?.forEach((sourceId) => ids.add(sourceId));

  addIds((courseData as SourceIdCarrier | undefined)?.sourceIds);
  modules.forEach((module) => {
    addIds((module as SourceIdCarrier).sourceIds);
    module.sections.forEach((section) => {
      addIds((section as SourceIdCarrier).sourceIds);
      section.content.forEach((block) => addIds((block as SourceIdCarrier).sourceIds));
    });
  });

  return ids;
}
