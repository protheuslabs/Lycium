import type { RefObject } from "react";
import type { CourseEntry } from "../../courseTypes";
import CatalogCourseCard from "./CatalogCourseCard";
import CatalogEmptyState from "./CatalogEmptyState";
import type { CatalogVisibleCourse } from "./catalogUtils";
import type { CatalogSelectionMode } from "../../utils/catalogSelection";

type CatalogCourseGridProps = {
  courseGridRef: RefObject<HTMLDivElement | null>;
  isGeneratingCourse: boolean;
  generatingCourseTitle: string;
  generateMessage: string;
  visibleCourses: CatalogVisibleCourse[];
  catalogPageCourses: CatalogVisibleCourse[];
  publishingCourseKey: string | null;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onOpenSourceGaps: (course: CourseEntry) => void;
  onSearchPrerequisite: (query: string) => void;
  selectionMode: CatalogSelectionMode;
  onToggleCourseSelection: (courseKey: string) => void;
};

export default function CatalogCourseGrid({
  courseGridRef,
  isGeneratingCourse,
  generatingCourseTitle,
  generateMessage,
  visibleCourses,
  catalogPageCourses,
  publishingCourseKey,
  onOpenCourse,
  onOpenInfo,
  onOpenSourceGaps,
  onSearchPrerequisite,
  selectionMode,
  onToggleCourseSelection,
}: CatalogCourseGridProps) {
  const selectedCourseKeys = selectionMode?.kind === "cluster" ? new Set(selectionMode.selectedCourseKeys) : null;

  return (
    <div className="course-grid" ref={courseGridRef}>
      {isGeneratingCourse && (
        <article className="course-card course-card--generating" aria-live="polite" aria-busy="true">
          <h3>{generatingCourseTitle}</h3>
          <div className="generating-course-spinner" aria-hidden="true" />
          <p className="course-generating-status">{generateMessage || "Course Generating"}</p>
        </article>
      )}
      {visibleCourses.length === 0 && (
        <CatalogEmptyState level="courses" />
      )}
      {catalogPageCourses.map((visibleCourse) => (
        <CatalogCourseCard
          key={visibleCourse.course.key}
          visibleCourse={visibleCourse}
          onOpenCourse={onOpenCourse}
          onOpenInfo={onOpenInfo}
          onOpenSourceGaps={onOpenSourceGaps}
          onSearchPrerequisite={onSearchPrerequisite}
          isPublishing={publishingCourseKey === visibleCourse.course.key}
          selectionMode={selectionMode?.kind === "cluster"}
          selected={selectedCourseKeys?.has(visibleCourse.course.key) ?? false}
          onToggleSelect={onToggleCourseSelection}
        />
      ))}
    </div>
  );
}
