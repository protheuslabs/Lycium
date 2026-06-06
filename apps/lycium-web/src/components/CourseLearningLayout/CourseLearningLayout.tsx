import { useEffect, useMemo, useState } from "react";
import type { CourseBlock, CourseData, CourseEntry, CourseModule, CourseSection, SectionStatus } from "../../courseTypes";
import ContentView from "../ContentView/ContentView";
import type { SourceRecord } from "../ContentView/ContentView";
import type { ContentBlock } from "../ContentView/contentViewTypes";
import Sidebar from "../Sidebar/Sidebar";

type DisplaySection = CourseSection & {
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

type ProgressSummary = {
  percentage: number;
  viewedPercentage: number;
};

type CourseLearningLayoutProps = {
  sections: DisplaySection[];
  visibleSectionIndex: number;
  selectedCourse: CourseEntry | undefined;
  currentSection: DisplaySection | null;
  courseProgress: ProgressSummary;
  moduleProgress: ProgressSummary;
  resolvedSectionStatuses: Record<string, SectionStatus>;
  completedSectionIds: Set<string>;
  orderMandatory: boolean;
  sources: SourceRecord[];
  onSectionSelect: (index: number) => void;
  onCompleteSection: (sectionId: string) => void;
  onSectionTimedStatusChange: (sectionId: string, hasTimedQuizInProgress: boolean) => void;
  onSaveCourseDraft: (courseKey: string, data: CourseData) => void;
};

function courseAllowsLocalEdit(course: CourseEntry | undefined) {
  const metadata = course?.data.metadata;
  const editPolicy = metadata?.editPolicy as { editable?: boolean; ownerCanEdit?: boolean } | undefined;
  if (!course || editPolicy?.editable === false || editPolicy?.ownerCanEdit === false) {
    return false;
  }

  return course.source === "local" || course.status === "draft" || course.status === "generated";
}

function stripModulePrefix(title: string) {
  return title.replace(/^\s*(Module|Week)\s+\d+\s*:?\s*/i, "").trim() || "Module title";
}

function stripSectionPrefix(title: string) {
  return title.replace(/^\s*\d+(?:\.\d+)+\s*:?\s*/i, "").trim() || "Section title";
}

function formatModuleTitle(moduleIndex: number, title: string) {
  return `Module ${moduleIndex + 1}: ${stripModulePrefix(title)}`;
}

function cloneModules(modules: CourseModule[]): CourseModule[] {
  return modules.map((module) => ({
    ...module,
    sections: module.sections.map((section) => ({
      ...section,
      content: section.content.map((block) => ({ ...block })),
    })),
  }));
}

function newDraftId(courseKey: string, label: string, moduleIndex: number, sectionIndex = 0) {
  const cleanCourseKey = courseKey.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "course";
  return `${cleanCourseKey}-${label}-${moduleIndex + 1}-${sectionIndex + 1}-${Date.now()}`;
}

function createConceptCardBlock(): ContentBlock {
  return {
    type: "conceptCard",
    title: "Concept title",
    description: "Lorem ipsum dolor sit amet. Replace this with a concise concept definition.",
    sourceIds: [],
  };
}

function createConceptHeadingBlock(): ContentBlock {
  return {
    type: "heading",
    title: "Concepts introduced",
    sourceIds: [],
  };
}

function createEmptySection(courseKey: string, moduleIndex: number, sectionIndex: number): CourseSection {
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
      },
      createConceptHeadingBlock() as CourseBlock,
      createConceptCardBlock() as CourseBlock,
    ],
  };
}

function createEmptyModule(courseKey: string, moduleIndex: number): CourseModule {
  return {
    id: newDraftId(courseKey, "module", moduleIndex),
    title: "Module title",
    sourceIds: [],
    sections: [createEmptySection(courseKey, moduleIndex, 0)],
  };
}

function flatSectionIndexForModule(modules: CourseModule[], moduleIndex: number, sectionIndex: number) {
  return modules.slice(0, moduleIndex).reduce((total, module) => total + module.sections.length, 0) + sectionIndex;
}

function deleteSectionFromModules(modules: CourseModule[], sectionId: string) {
  return modules
    .map((module) => ({
      ...module,
      sections: module.sections.filter((section) => section.id !== sectionId),
    }))
    .filter((module) => module.sections.length > 0);
}

function moveBlock(blocks: CourseBlock[], fromIndex: number, toIndex: number) {
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

export default function CourseLearningLayout({
  sections,
  visibleSectionIndex,
  selectedCourse,
  currentSection,
  courseProgress,
  moduleProgress,
  resolvedSectionStatuses,
  completedSectionIds,
  orderMandatory,
  sources,
  onSectionSelect,
  onCompleteSection,
  onSectionTimedStatusChange,
  onSaveCourseDraft,
}: CourseLearningLayoutProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftCourseTitle, setDraftCourseTitle] = useState("");
  const [draftModuleTitles, setDraftModuleTitles] = useState<Record<number, string>>({});
  const [draftSectionTitles, setDraftSectionTitles] = useState<Record<string, string>>({});
  const [draftBlocks, setDraftBlocks] = useState<Record<string, Record<number, ContentBlock>>>({});
  const [draftModules, setDraftModules] = useState<CourseModule[] | null>(null);
  const [editSectionIndex, setEditSectionIndex] = useState<number | null>(null);
  const canEditCourse = courseAllowsLocalEdit(selectedCourse);
  const displayedCourseTitle = draftCourseTitle || selectedCourse?.data?.title || "Course";
  const activeEditMode = isEditMode && canEditCourse;
  const sourceModules = draftModules ?? selectedCourse?.data.modules ?? [];
  const displayedSections = useMemo(
    () => {
      if (!selectedCourse) {
        return sections;
      }

      return sourceModules.flatMap((module, moduleIndex) =>
        module.sections.map((section, sectionIndex) => ({
          ...section,
          moduleIndex,
          moduleTitle: formatModuleTitle(moduleIndex, draftModuleTitles[moduleIndex] ?? module.title),
          title: stripSectionPrefix(draftSectionTitles[section.id] ?? section.title),
          displayNumber: `${moduleIndex + 1}.${sectionIndex + 1}`,
          content: section.content.map((block, blockIndex) => draftBlocks[section.id]?.[blockIndex] ?? block),
        })),
      );
    },
    [draftBlocks, draftModuleTitles, draftSectionTitles, sections, selectedCourse, sourceModules],
  );
  const effectiveSectionIndex = activeEditMode ? editSectionIndex ?? visibleSectionIndex : visibleSectionIndex;
  const displayedCurrentSection = displayedSections[effectiveSectionIndex] ?? displayedSections[0] ?? currentSection;
  const resetDraft = () => {
    setDraftCourseTitle("");
    setDraftModuleTitles({});
    setDraftSectionTitles({});
    setDraftBlocks({});
    setDraftModules(null);
    setEditSectionIndex(null);
  };

  useEffect(() => {
    setIsEditMode(false);
    resetDraft();
  }, [selectedCourse?.key]);

  const handleStartEdit = () => {
    setDraftModules(cloneModules(selectedCourse?.data.modules ?? []));
    setEditSectionIndex(visibleSectionIndex);
    setIsEditMode(true);
  };

  const handleSectionSelect = (index: number) => {
    if (activeEditMode) {
      setEditSectionIndex(index);
      return;
    }

    onSectionSelect(index);
  };

  const handleBlockChange = (sectionId: string, blockIndex: number, block: ContentBlock) => {
    setDraftBlocks((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] ?? {}),
        [blockIndex]: block,
      },
    }));
    setDraftModules((current) =>
      current?.map((module) => ({
        ...module,
        sections: module.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                content: section.content.map((currentBlock, index) => (index === blockIndex ? block : currentBlock)),
              }
            : section,
        ),
      })) ?? null,
    );
  };

  const clearSectionDraftBlocks = (sectionId: string) => {
    setDraftBlocks((current) => {
      if (!current[sectionId]) {
        return current;
      }

      const next = { ...current };
      delete next[sectionId];
      return next;
    });
  };

  const handleBlockAdd = (sectionId: string, block: ContentBlock) => {
    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);

      return modules.map((module) => ({
        ...module,
        sections: module.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                content: [...section.content, block as CourseBlock],
              }
            : section,
        ),
      }));
    });
    clearSectionDraftBlocks(sectionId);
  };

  const handleBlockDelete = (sectionId: string, blockIndex: number) => {
    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);

      return modules.map((module) => ({
        ...module,
        sections: module.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                content: section.content
                  .map((block, index) => (draftBlocks[sectionId]?.[index] ?? block) as CourseBlock)
                  .filter((_, index) => index !== blockIndex),
              }
            : section,
        ),
      }));
    });
    clearSectionDraftBlocks(sectionId);
  };

  const handleBlockMove = (sectionId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);

      return modules.map((module) => ({
        ...module,
        sections: module.sections.map((section) => {
          if (section.id !== sectionId) {
            return section;
          }

          const blocks = section.content.map((block, blockIndex) => (draftBlocks[sectionId]?.[blockIndex] ?? block) as CourseBlock);
          return {
            ...section,
            content: moveBlock(blocks, fromIndex, toIndex),
          };
        }),
      }));
    });
    clearSectionDraftBlocks(sectionId);
  };

  const handleModuleTitleChange = (moduleIndex: number, title: string) => {
    const cleanTitle = stripModulePrefix(title);
    setDraftModuleTitles((current) => ({ ...current, [moduleIndex]: cleanTitle }));
    setDraftModules((current) =>
      current?.map((module, index) => (index === moduleIndex ? { ...module, title: cleanTitle } : module)) ?? null,
    );
  };

  const handleSectionTitleChange = (sectionId: string, title: string) => {
    const cleanTitle = stripSectionPrefix(title);
    setDraftSectionTitles((current) => ({ ...current, [sectionId]: cleanTitle }));
    setDraftModules((current) =>
      current?.map((module) => ({
        ...module,
        sections: module.sections.map((section) => (section.id === sectionId ? { ...section, title: cleanTitle } : section)),
      })) ?? null,
    );
  };

  const handleAddSection = (moduleIndex: number) => {
    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);
      const targetModule = modules[moduleIndex];
      if (!targetModule) {
        return modules;
      }
      const sectionIndex = targetModule.sections.length;
      targetModule.sections = [...targetModule.sections, createEmptySection(selectedCourse?.key ?? "course", moduleIndex, sectionIndex)];
      setEditSectionIndex(flatSectionIndexForModule(modules, moduleIndex, sectionIndex));
      return modules;
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    setDraftModules((current) => {
      const modules = deleteSectionFromModules(cloneModules(current ?? selectedCourse?.data.modules ?? []), sectionId);
      const nextSectionIndex = Math.min(editSectionIndex ?? visibleSectionIndex, Math.max(0, modules.flatMap((module) => module.sections).length - 1));
      setEditSectionIndex(nextSectionIndex);
      return modules;
    });
    setDraftSectionTitles((current) => {
      if (!current[sectionId]) {
        return current;
      }

      const next = { ...current };
      delete next[sectionId];
      return next;
    });
    clearSectionDraftBlocks(sectionId);
  };

  const handleAddModule = () => {
    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);
      const moduleIndex = modules.length;
      const nextModules = [...modules, createEmptyModule(selectedCourse?.key ?? "course", moduleIndex)];
      setEditSectionIndex(flatSectionIndexForModule(nextModules, moduleIndex, 0));
      return nextModules;
    });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    resetDraft();
  };

  const handleSaveEdit = () => {
    if (!selectedCourse) {
      setIsEditMode(false);
      resetDraft();
      return;
    }

    const modulesToSave = draftModules ?? selectedCourse.data.modules;
    onSaveCourseDraft(selectedCourse.key, {
      ...selectedCourse.data,
      title: displayedCourseTitle,
      modules: modulesToSave.map((module, moduleIndex) => ({
        ...module,
        title: stripModulePrefix(draftModuleTitles[moduleIndex] ?? module.title),
        sections: module.sections.map((section) => ({
          ...section,
          title: stripSectionPrefix(draftSectionTitles[section.id] ?? section.title),
          content: section.content.map((block, blockIndex) => (draftBlocks[section.id]?.[blockIndex] ?? block) as CourseBlock),
        })),
      })),
    });
    setIsEditMode(false);
    resetDraft();
  };

  return (
    <div className="main-layout">
      <Sidebar
        sections={displayedSections}
        currentSectionIndex={effectiveSectionIndex}
        onSectionSelect={handleSectionSelect}
        courseTitle={displayedCourseTitle}
        progressPercentage={courseProgress.percentage}
        viewedPercentage={courseProgress.viewedPercentage}
        sectionStatuses={resolvedSectionStatuses}
        canEditCourse={canEditCourse}
        isEditMode={activeEditMode}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onAddSection={handleAddSection}
        onDeleteSection={handleDeleteSection}
        onAddModule={handleAddModule}
      />
      <div className="course-content-host">
        <ContentView
          courseKey={selectedCourse?.key ?? ""}
          courseTitle={displayedCourseTitle}
          section={displayedCurrentSection}
          moduleTitle={displayedCurrentSection?.moduleTitle ?? ""}
          moduleIndex={displayedCurrentSection?.moduleIndex ?? 0}
          onNext={() => handleSectionSelect(Math.min(effectiveSectionIndex + 1, displayedSections.length - 1))}
          onPrev={() => handleSectionSelect(Math.max(effectiveSectionIndex - 1, 0))}
          nextSectionTitle={displayedSections[effectiveSectionIndex + 1]?.title ?? null}
          isFirstSection={effectiveSectionIndex === 0}
          isLastSection={effectiveSectionIndex === displayedSections.length - 1}
          progressPercentage={moduleProgress.percentage}
          viewedPercentage={moduleProgress.viewedPercentage}
          markComplete={onCompleteSection}
          isComplete={currentSection ? completedSectionIds.has(currentSection.id) : false}
          orderMandatory={orderMandatory}
          onSectionTimedStatusChange={onSectionTimedStatusChange}
          sources={sources}
          isEditMode={activeEditMode}
          onCourseTitleChange={setDraftCourseTitle}
          onModuleTitleChange={handleModuleTitleChange}
          onSectionTitleChange={handleSectionTitleChange}
          onBlockChange={handleBlockChange}
          onBlockAdd={handleBlockAdd}
          onBlockDelete={handleBlockDelete}
          onBlockMove={handleBlockMove}
        />
      </div>
    </div>
  );
}
