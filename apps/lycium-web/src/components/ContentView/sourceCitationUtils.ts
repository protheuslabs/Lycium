import type { Section, SourceRecord } from "./contentViewTypes";

export type CourseSourceIndex = Map<string, number>;

export function buildCourseSourceIndex(sources: SourceRecord[]): CourseSourceIndex {
  const sourceIndex: CourseSourceIndex = new Map();

  for (const source of sources) {
    if (source.id && !sourceIndex.has(source.id)) {
      sourceIndex.set(source.id, sourceIndex.size + 1);
    }
  }

  return sourceIndex;
}

export function sourceCitationNumber(sourceId: string | undefined, courseSourceIndex: CourseSourceIndex) {
  if (!sourceId) {
    return null;
  }

  return courseSourceIndex.get(sourceId) ?? null;
}

export function getSourcesByIds(sourceIds: string[] | undefined, sources: SourceRecord[], courseSourceIndex?: CourseSourceIndex) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return [];
  }

  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const sourceIdSet = new Set<string>();

  for (const sourceId of sourceIds) {
    if (sourceId) {
      sourceIdSet.add(sourceId);
    }
  }

  return Array.from(sourceIdSet)
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is SourceRecord => Boolean(source))
    .sort((first, second) => {
      if (!courseSourceIndex) {
        return 0;
      }

      return (courseSourceIndex.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (courseSourceIndex.get(second.id) ?? Number.MAX_SAFE_INTEGER);
    });
}

export function getSectionSources(section: Section, sources: SourceRecord[], courseSourceIndex: CourseSourceIndex) {
  if (section.pageType === "apply" || ["assessment", "quiz", "project"].includes((section.sectionType ?? "").toLowerCase())) {
    return [];
  }

  const sourceIds = new Set(section.sourceIds ?? []);

  for (const block of section.content) {
    for (const sourceId of block.sourceIds ?? []) {
      sourceIds.add(sourceId);
    }
  }

  return getSourcesByIds(Array.from(sourceIds), sources, courseSourceIndex);
}
