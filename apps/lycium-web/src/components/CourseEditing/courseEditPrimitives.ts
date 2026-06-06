import type { CourseBlock, CourseEntry, CourseModule, CourseSection } from "../../courseTypes";
import type { ContentBlock, SourceRecord } from "../ContentView/contentViewTypes";
import type { CourseEditBlockKind } from "../ContentView/CourseEditControls";

export function courseAllowsLocalEdit(course: CourseEntry | undefined) {
  const metadata = course?.data.metadata;
  const editPolicy = metadata?.editPolicy as { editable?: boolean; ownerCanEdit?: boolean } | undefined;
  if (!course || editPolicy?.editable === false || editPolicy?.ownerCanEdit === false) {
    return false;
  }

  return course.source === "local" || course.status === "draft" || course.status === "generated";
}

export function courseLearnersCanFork(course: CourseEntry | undefined) {
  return course?.data.metadata?.editPolicy?.learnersCanFork !== false;
}

export function stripModulePrefix(title: string) {
  return title.replace(/^\s*(Module|Week)\s+\d+\s*:?\s*/i, "").trim() || "Module title";
}

export function stripSectionPrefix(title: string) {
  return title.replace(/^\s*\d+(?:\.\d+)+\s*:?\s*/i, "").trim() || "Section title";
}

export function formatModuleTitle(moduleIndex: number, title: string) {
  return `Module ${moduleIndex + 1}: ${stripModulePrefix(title)}`;
}

export function cloneModules(modules: CourseModule[]): CourseModule[] {
  return modules.map((module) => ({
    ...module,
    sections: module.sections.map((section) => ({
      ...section,
      content: section.content.map((block) => ({ ...block })),
    })),
  }));
}

export function sourceRecordFromUnknown(record: unknown): SourceRecord | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = record as Record<string, unknown>;

  if (typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  return {
    id: value.id,
    type: typeof value.type === "string" ? value.type : "web",
    title: value.title,
    author: typeof value.author === "string" ? value.author : undefined,
    publisher: typeof value.publisher === "string" ? value.publisher : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
    embedUrl: typeof value.embedUrl === "string" ? value.embedUrl : undefined,
    localPath: typeof value.localPath === "string" ? value.localPath : undefined,
    usedByCourseIds: Array.isArray(value.usedByCourseIds) ? value.usedByCourseIds.filter((item): item is string => typeof item === "string") : undefined,
    usedByCourseTitles: Array.isArray(value.usedByCourseTitles) ? value.usedByCourseTitles.filter((item): item is string => typeof item === "string") : undefined,
  };
}

export function normalizeCourseSourceRecords(course: CourseEntry | undefined): SourceRecord[] {
  const records = course?.data.sourceRecords;

  if (Array.isArray(records)) {
    return records.map(sourceRecordFromUnknown).filter((record): record is SourceRecord => record !== null);
  }

  if (records && typeof records === "object") {
    return Object.values(records).map(sourceRecordFromUnknown).filter((record): record is SourceRecord => record !== null);
  }

  return [];
}

export function mergeSourceRecords(...sourceGroups: SourceRecord[][]) {
  const sourceMap = new Map<string, SourceRecord>();

  for (const sourceGroup of sourceGroups) {
    for (const source of sourceGroup) {
      if (source?.id && !sourceMap.has(source.id)) {
        sourceMap.set(source.id, source);
      }
    }
  }

  return Array.from(sourceMap.values());
}

export function sourceIdFromUrl(url: string) {
  const cleanUrl = url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `local-source-${cleanUrl.slice(0, 48) || Date.now()}-${Date.now()}`;
}

export function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function newDraftId(courseKey: string, label: string, moduleIndex: number, sectionIndex = 0) {
  const cleanCourseKey = courseKey.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "course";
  return `${cleanCourseKey}-${label}-${moduleIndex + 1}-${sectionIndex + 1}-${Date.now()}`;
}

export function createConceptCardBlock(): ContentBlock {
  return {
    type: "conceptCard",
    title: "Concept title",
    description: "Lorem ipsum dolor sit amet. Replace this with a concise concept definition.",
    sourceIds: [],
  };
}

export function createConceptHeadingBlock(): ContentBlock {
  return {
    type: "heading",
    title: "Concepts introduced",
    sourceIds: [],
  };
}

export function createEmptySection(courseKey: string, moduleIndex: number, sectionIndex: number): CourseSection {
  return {
    id: newDraftId(courseKey, "section", moduleIndex, sectionIndex),
    title: "Section title",
    pageType: "learn",
    sectionType: "lesson",
    sourceIds: [],
    content: [
      {
        type: "text",
        heading: "Add textbox",
        value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Replace this text with learner-facing instruction.",
        sourceIds: [],
      } as CourseBlock,
      createConceptHeadingBlock() as CourseBlock,
      createConceptCardBlock() as CourseBlock,
    ],
  };
}

export function createEmptyModule(courseKey: string, moduleIndex: number): CourseModule {
  return {
    id: newDraftId(courseKey, "module", moduleIndex),
    title: "Module title",
    sourceIds: [],
    sections: [createEmptySection(courseKey, moduleIndex, 0)],
  };
}

export function flatSectionIndexForModule(modules: CourseModule[], moduleIndex: number, sectionIndex: number) {
  return modules.slice(0, moduleIndex).reduce((total, module) => total + module.sections.length, 0) + sectionIndex;
}

export function deleteSectionFromModules(modules: CourseModule[], sectionId: string) {
  return modules
    .map((module) => ({
      ...module,
      sections: module.sections.filter((section) => section.id !== sectionId),
    }))
    .filter((module) => module.sections.length > 0);
}

export function moveSectionInModules(
  modules: CourseModule[],
  sectionId: string,
  targetModuleIndex: number,
  targetSectionIndex: number,
) {
  const nextModules = cloneModules(modules);
  const sourceModuleIndex = nextModules.findIndex((module) => module.sections.some((section) => section.id === sectionId));

  if (sourceModuleIndex < 0) {
    return { modules: nextModules, movedModuleIndex: targetModuleIndex, movedSectionIndex: targetSectionIndex };
  }

  const sourceModule = nextModules[sourceModuleIndex];
  const sourceSectionIndex = sourceModule.sections.findIndex((section) => section.id === sectionId);

  if (sourceSectionIndex < 0) {
    return { modules: nextModules, movedModuleIndex: targetModuleIndex, movedSectionIndex: targetSectionIndex };
  }

  const [movedSection] = sourceModule.sections.splice(sourceSectionIndex, 1);
  let adjustedTargetModuleIndex = targetModuleIndex;
  let adjustedTargetSectionIndex = targetSectionIndex;

  if (sourceModule.sections.length === 0) {
    nextModules.splice(sourceModuleIndex, 1);
    if (nextModules.length === 0) {
      return {
        modules,
        movedModuleIndex: sourceModuleIndex,
        movedSectionIndex: sourceSectionIndex,
      };
    }
    if (sourceModuleIndex < adjustedTargetModuleIndex) {
      adjustedTargetModuleIndex -= 1;
    }
  } else if (sourceModuleIndex === adjustedTargetModuleIndex && sourceSectionIndex < adjustedTargetSectionIndex) {
    adjustedTargetSectionIndex -= 1;
  }

  adjustedTargetModuleIndex = Math.max(0, Math.min(adjustedTargetModuleIndex, nextModules.length - 1));
  const targetModule = nextModules[adjustedTargetModuleIndex];

  if (!targetModule) {
    return { modules: nextModules, movedModuleIndex: 0, movedSectionIndex: 0 };
  }

  adjustedTargetSectionIndex = Math.max(0, Math.min(adjustedTargetSectionIndex, targetModule.sections.length));
  targetModule.sections.splice(adjustedTargetSectionIndex, 0, movedSection);

  return {
    modules: nextModules,
    movedModuleIndex: adjustedTargetModuleIndex,
    movedSectionIndex: adjustedTargetSectionIndex,
  };
}

export function moveBlock(blocks: CourseBlock[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex >= blocks.length
  ) {
    return blocks;
  }

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(toIndex, 0, movedBlock);
  return nextBlocks;
}

export function createBlockTemplate(kind: CourseEditBlockKind, initialValue: string): ContentBlock {
  const value = initialValue.trim();

  switch (kind) {
    case "card":
      return {
        type: "conceptCard",
        title: "Concept title",
        description: value || "Lorem ipsum dolor sit amet. Replace this with a concise concept definition.",
        sourceIds: [],
      };
    case "video":
      return {
        type: "video",
        url: value,
        sourceIds: [],
      };
    case "iframe":
      return {
        type: "iframe",
        title: "Embedded resource title",
        url: value,
        sourceIds: [],
      };
    case "heading":
      return {
        type: "heading",
        title: value || "Heading title",
        sourceIds: [],
      };
    case "quiz":
      return {
        type: "quiz",
        title: value || "Quiz title",
        questions: [
          {
            question: "Replace this with the quiz question.",
            options: ["Answer option A", "Answer option B", "Answer option C", "Answer option D"],
            answer: 0,
          },
        ],
        questionsPerAttempt: 1,
        showAnswers: false,
      };
    case "text":
    default:
      return {
        type: "text",
        heading: "Text block title",
        value: value || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Replace this text with learner-facing instruction.",
        sourceIds: [],
      };
  }
}
