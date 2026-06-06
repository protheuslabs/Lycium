import { useEffect, useMemo, useState } from "react";
import type { CourseData, CourseEntry, CourseSection, SectionStatus } from "../../courseTypes";
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
  const canEditCourse = courseAllowsLocalEdit(selectedCourse);
  const displayedCourseTitle = draftCourseTitle || selectedCourse?.data?.title || "Course";
  const displayedSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        moduleTitle: draftModuleTitles[section.moduleIndex] ?? section.moduleTitle,
        title: draftSectionTitles[section.id] ?? section.title,
        content: section.content.map((block, blockIndex) => draftBlocks[section.id]?.[blockIndex] ?? block),
      })),
    [draftBlocks, draftModuleTitles, draftSectionTitles, sections],
  );
  const displayedCurrentSection = displayedSections[visibleSectionIndex] ?? currentSection;
  const resetDraft = () => {
    setDraftCourseTitle("");
    setDraftModuleTitles({});
    setDraftSectionTitles({});
    setDraftBlocks({});
  };

  useEffect(() => {
    setIsEditMode(false);
    resetDraft();
  }, [selectedCourse?.key]);

  const handleBlockChange = (sectionId: string, blockIndex: number, block: ContentBlock) => {
    setDraftBlocks((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] ?? {}),
        [blockIndex]: block,
      },
    }));
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

    onSaveCourseDraft(selectedCourse.key, {
      ...selectedCourse.data,
      title: displayedCourseTitle,
      modules: selectedCourse.data.modules.map((module, moduleIndex) => ({
        ...module,
        title: draftModuleTitles[moduleIndex] ?? module.title,
        sections: module.sections.map((section) => ({
          ...section,
          title: draftSectionTitles[section.id] ?? section.title,
          content: section.content.map((block, blockIndex) => draftBlocks[section.id]?.[blockIndex] ?? block),
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
        currentSectionIndex={visibleSectionIndex}
        onSectionSelect={onSectionSelect}
        courseTitle={displayedCourseTitle}
        progressPercentage={courseProgress.percentage}
        viewedPercentage={courseProgress.viewedPercentage}
        sectionStatuses={resolvedSectionStatuses}
        canEditCourse={canEditCourse}
        isEditMode={isEditMode && canEditCourse}
        onStartEdit={() => setIsEditMode(true)}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
      />
      <div className="course-content-host">
        <ContentView
          courseKey={selectedCourse?.key ?? ""}
          courseTitle={displayedCourseTitle}
          section={displayedCurrentSection}
          moduleTitle={displayedCurrentSection?.moduleTitle ?? ""}
          moduleIndex={displayedCurrentSection?.moduleIndex ?? 0}
          onNext={() => onSectionSelect(Math.min(visibleSectionIndex + 1, sections.length - 1))}
          onPrev={() => onSectionSelect(Math.max(visibleSectionIndex - 1, 0))}
          nextSectionTitle={displayedSections[visibleSectionIndex + 1]?.title ?? null}
          isFirstSection={visibleSectionIndex === 0}
          isLastSection={visibleSectionIndex === sections.length - 1}
          progressPercentage={moduleProgress.percentage}
          viewedPercentage={moduleProgress.viewedPercentage}
          markComplete={onCompleteSection}
          isComplete={currentSection ? completedSectionIds.has(currentSection.id) : false}
          orderMandatory={orderMandatory}
          onSectionTimedStatusChange={onSectionTimedStatusChange}
          sources={sources}
          isEditMode={isEditMode && canEditCourse}
          onCourseTitleChange={setDraftCourseTitle}
          onModuleTitleChange={(moduleIndex, title) =>
            setDraftModuleTitles((current) => ({ ...current, [moduleIndex]: title }))
          }
          onSectionTitleChange={(sectionId, title) =>
            setDraftSectionTitles((current) => ({ ...current, [sectionId]: title }))
          }
          onBlockChange={handleBlockChange}
        />
      </div>
    </div>
  );
}
