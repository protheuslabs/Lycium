import type { CourseData, CourseEntry, CourseSection, SectionStatus } from "../../courseTypes";
import type { SectionRegenerationRequest } from "../../hooks/useCourseSectionRegenerationActions";
import type { SourceRecord } from "../ContentView/ContentView";

export type DisplaySection = CourseSection & {
  moduleId?: string;
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

export type ProgressSummary = {
  percentage: number;
  viewedPercentage: number;
};

export type CourseLearningLayoutProps = {
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
  aiConnectionLockReason?: string;
  onRegenerateSection?: (request: SectionRegenerationRequest) => Promise<CourseEntry>;
};
