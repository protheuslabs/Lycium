import { useEffect, useMemo, useState } from "react";
import type { CourseBlock, CourseData, CourseEntry, CourseModule, CourseSection, SectionStatus } from "../../courseTypes";
import ContentView from "../ContentView/ContentView";
import type { SourceRecord } from "../ContentView/ContentView";
import type { ContentBlock } from "../ContentView/contentViewTypes";
import type { SectionRegenerationRequest } from "../../hooks/useCourseSectionRegenerationActions";
import Sidebar from "../Sidebar/Sidebar";
import CourseSettingsModal, { type CourseSettingsDraft } from "./CourseSettingsModal";
import {
  cloneModules,
  courseAllowsLocalEdit,
  courseLearnersCanFork,
  createEmptyModule,
  createEmptySection,
  deleteSectionFromModules,
  flatSectionIndexForModule,
  formatModuleTitle,
  mergeSourceRecords,
  moveBlock,
  moveSectionInModules,
  normalizeCourseSourceRecords,
  sourceIdFromUrl,
  stripModulePrefix,
  stripSectionPrefix,
  titleFromUrl,
} from "../CourseEditing/courseEditPrimitives";

type DisplaySection = CourseSection & { moduleId?: string; moduleIndex: number; moduleTitle: string; displayNumber: string };
type ProgressSummary = { percentage: number; viewedPercentage: number };

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
  canUseAiRefresh?: boolean;
  onRegenerateSection?: (request: SectionRegenerationRequest) => Promise<CourseEntry>;
};
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
  canUseAiRefresh = false,
  onRegenerateSection,
}: CourseLearningLayoutProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCourseSettingsOpen, setIsCourseSettingsOpen] = useState(false);
  const [isCourseSourcesPageActive, setIsCourseSourcesPageActive] = useState(false);
  const [draftCourseTitle, setDraftCourseTitle] = useState("");
  const [draftCourseSettings, setDraftCourseSettings] = useState<CourseSettingsDraft>({
    orderMandatory: false,
    learnersCanFork: true,
  });
  const [draftModuleTitles, setDraftModuleTitles] = useState<Record<number, string>>({});
  const [draftSectionTitles, setDraftSectionTitles] = useState<Record<string, string>>({});
  const [draftBlocks, setDraftBlocks] = useState<Record<string, Record<number, ContentBlock>>>({});
  const [draftModules, setDraftModules] = useState<CourseModule[] | null>(null);
  const [draftSourceRecords, setDraftSourceRecords] = useState<SourceRecord[] | null>(null);
  const [editSectionIndex, setEditSectionIndex] = useState<number | null>(null);
  const canEditCourse = courseAllowsLocalEdit(selectedCourse);
  const displayedCourseTitle = draftCourseTitle || selectedCourse?.data?.title || "Course";
  const activeEditMode = isEditMode && canEditCourse;
  const effectiveOrderMandatory = activeEditMode ? draftCourseSettings.orderMandatory : orderMandatory;
  const sourceModules = draftModules ?? selectedCourse?.data.modules ?? [];
  const courseSourceRecords = useMemo(() => normalizeCourseSourceRecords(selectedCourse), [selectedCourse]);
  const referencedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    const addIds = (sourceIds?: string[]) => sourceIds?.forEach((sourceId) => ids.add(sourceId));

    addIds((selectedCourse?.data as { sourceIds?: string[] } | undefined)?.sourceIds);
    sourceModules.forEach((module) => {
      addIds((module as { sourceIds?: string[] }).sourceIds);
      module.sections.forEach((section) => {
        addIds((section as { sourceIds?: string[] }).sourceIds);
        section.content.forEach((block) => addIds((block as { sourceIds?: string[] }).sourceIds));
      });
    });

    return ids;
  }, [selectedCourse?.data, sourceModules]);
  const referencedCentralSources = useMemo(
    () => sources.filter((source) => referencedSourceIds.has(source.id)),
    [referencedSourceIds, sources],
  );
  const displayedSources = useMemo(
    () => mergeSourceRecords(referencedCentralSources, draftSourceRecords ?? courseSourceRecords),
    [courseSourceRecords, draftSourceRecords, referencedCentralSources],
  );
  const displayedSections = useMemo(
    () => {
      if (!selectedCourse) {
        return sections;
      }

      return sourceModules.flatMap((module, moduleIndex) =>
        module.sections.map((section, sectionIndex) => ({
          ...section,
          moduleId: module.id,
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
    setDraftCourseSettings({
      orderMandatory: selectedCourse?.data.orderMandatory ?? false,
      learnersCanFork: courseLearnersCanFork(selectedCourse),
    });
    setDraftModuleTitles({});
    setDraftSectionTitles({});
    setDraftBlocks({});
    setDraftModules(null);
    setDraftSourceRecords(null);
    setEditSectionIndex(null);
    setIsCourseSettingsOpen(false);
    setIsCourseSourcesPageActive(false);
  };

  useEffect(() => {
    setIsEditMode(false);
    resetDraft();
  }, [selectedCourse?.key]);

  const handleStartEdit = () => {
    setDraftModules(cloneModules(selectedCourse?.data.modules ?? []));
    setDraftSourceRecords(normalizeCourseSourceRecords(selectedCourse));
    setDraftCourseSettings({
      orderMandatory: selectedCourse?.data.orderMandatory ?? false,
      learnersCanFork: courseLearnersCanFork(selectedCourse),
    });
    setEditSectionIndex(visibleSectionIndex);
    setIsEditMode(true);
  };

  const handleSectionSelect = (index: number) => {
    setIsCourseSourcesPageActive(false);

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
                content: section.content.map((currentBlock, index) => (index === blockIndex ? (block as unknown as CourseBlock) : currentBlock)),
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

  const handleSourceCreate = (sourceUrl: string) => {
    const cleanUrl = sourceUrl.trim();

    if (!cleanUrl) {
      return null;
    }

    const newSource: SourceRecord = {
      id: sourceIdFromUrl(cleanUrl),
      type: "web",
      title: titleFromUrl(cleanUrl),
      url: cleanUrl,
      usedByCourseIds: selectedCourse?.key ? [selectedCourse.key] : undefined,
      usedByCourseTitles: selectedCourse?.data.title ? [selectedCourse.data.title] : undefined,
    };

    setDraftSourceRecords((current) => mergeSourceRecords(current ?? courseSourceRecords, [newSource]));
    return newSource;
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
    setDraftModuleTitles({});
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

  const handleMoveSection = (sectionId: string, targetModuleIndex: number, targetSectionIndex: number) => {
    setDraftModules((current) => {
      const modules = cloneModules(current ?? selectedCourse?.data.modules ?? []);
      const moveResult = moveSectionInModules(modules, sectionId, targetModuleIndex, targetSectionIndex);
      setEditSectionIndex(flatSectionIndexForModule(moveResult.modules, moveResult.movedModuleIndex, moveResult.movedSectionIndex));
      return moveResult.modules;
    });
    setDraftModuleTitles({});
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

  const handleCourseSourcesSelect = () => {
    setIsCourseSourcesPageActive(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCourse) {
      setIsEditMode(false);
      resetDraft();
      return;
    }

    const modulesToSave = draftModules ?? selectedCourse.data.modules;
    const sourceRecordsToSave = draftSourceRecords ?? normalizeCourseSourceRecords(selectedCourse);
    const sourceIdsToSave = Array.from(new Set([...(selectedCourse.data.sourceIds ?? []), ...sourceRecordsToSave.map((source) => source.id)]));
    onSaveCourseDraft(selectedCourse.key, {
      ...selectedCourse.data,
      title: displayedCourseTitle,
      orderMandatory: draftCourseSettings.orderMandatory,
      metadata: {
        ...(selectedCourse.data.metadata ?? {}),
        editPolicy: {
          ...(selectedCourse.data.metadata?.editPolicy ?? {}),
          learnersCanFork: draftCourseSettings.learnersCanFork,
        },
      },
      sourceIds: sourceIdsToSave,
      sourceRecords: sourceRecordsToSave,
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

  const handleCourseSettingsSave = (settings: CourseSettingsDraft) => {
    setDraftCourseSettings(settings);
    setIsCourseSettingsOpen(false);
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
        isSourcesActive={isCourseSourcesPageActive}
        sourceCount={displayedSources.length}
        canEditCourse={canEditCourse}
        isEditMode={activeEditMode}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onOpenCourseSettings={() => setIsCourseSettingsOpen(true)}
        onSourcesSelect={handleCourseSourcesSelect}
        onAddSection={handleAddSection}
        onDeleteSection={handleDeleteSection}
        onMoveSection={handleMoveSection}
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
          orderMandatory={effectiveOrderMandatory}
          onSectionTimedStatusChange={onSectionTimedStatusChange}
          sources={displayedSources}
          showCourseSourcesPage={isCourseSourcesPageActive}
          isEditMode={activeEditMode}
          onCourseTitleChange={setDraftCourseTitle}
          onModuleTitleChange={handleModuleTitleChange}
          onSectionTitleChange={handleSectionTitleChange}
          onBlockChange={handleBlockChange}
          onBlockAdd={handleBlockAdd}
          onBlockDelete={handleBlockDelete}
          onBlockMove={handleBlockMove}
          onSourceCreate={handleSourceCreate}
          canRegenerateSection={Boolean(selectedCourse?.snapshotId) && canUseAiRefresh}
          onRegenerateSection={
            selectedCourse && displayedCurrentSection?.moduleId && onRegenerateSection
              ? (payload) =>
                  onRegenerateSection({
                    course: selectedCourse,
                    moduleId: displayedCurrentSection.moduleId ?? "",
                    sectionId: displayedCurrentSection.id,
                    ...payload,
                  })
              : undefined
          }
        />
      </div>
      <CourseSettingsModal
        isOpen={isCourseSettingsOpen && activeEditMode}
        settings={draftCourseSettings}
        canEditCourse={canEditCourse}
        onClose={() => setIsCourseSettingsOpen(false)}
        onSave={handleCourseSettingsSave}
      />
    </div>
  );
}
