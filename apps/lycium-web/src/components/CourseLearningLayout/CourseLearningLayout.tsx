import type { LyciumSourceRecord } from "@lycium/contracts";
import type { CourseEntry, CourseSection, SectionStatus } from "../../courseTypes";
import ContentView from "../ContentView/ContentView";
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
  sources: LyciumSourceRecord[];
  onSectionSelect: (index: number) => void;
  onCompleteSection: (sectionId: string) => void;
  onSectionTimedStatusChange: (sectionId: string, hasTimedQuizInProgress: boolean) => void;
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
}: CourseLearningLayoutProps) {
  return (
    <div className="main-layout">
      <Sidebar
        sections={sections}
        currentSectionIndex={visibleSectionIndex}
        onSectionSelect={onSectionSelect}
        courseTitle={selectedCourse?.data?.title ?? "Course"}
        progressPercentage={courseProgress.percentage}
        viewedPercentage={courseProgress.viewedPercentage}
        sectionStatuses={resolvedSectionStatuses}
      />
      <div className="course-content-host">
        <ContentView
          courseKey={selectedCourse?.key ?? ""}
          courseTitle={selectedCourse?.data?.title ?? "Course"}
          section={currentSection}
          moduleTitle={currentSection?.moduleTitle ?? ""}
          moduleIndex={currentSection?.moduleIndex ?? 0}
          onNext={() => onSectionSelect(Math.min(visibleSectionIndex + 1, sections.length - 1))}
          onPrev={() => onSectionSelect(Math.max(visibleSectionIndex - 1, 0))}
          nextSectionTitle={sections[visibleSectionIndex + 1]?.title ?? null}
          isFirstSection={visibleSectionIndex === 0}
          isLastSection={visibleSectionIndex === sections.length - 1}
          progressPercentage={moduleProgress.percentage}
          viewedPercentage={moduleProgress.viewedPercentage}
          markComplete={onCompleteSection}
          isComplete={currentSection ? completedSectionIds.has(currentSection.id) : false}
          orderMandatory={orderMandatory}
          onSectionTimedStatusChange={onSectionTimedStatusChange}
          sources={sources}
        />
      </div>
    </div>
  );
}
