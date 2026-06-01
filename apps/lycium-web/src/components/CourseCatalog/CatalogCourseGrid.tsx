import type { RefObject } from "react";
import type { CourseEntry } from "../../courseTypes";
import CatalogActionCard from "./CatalogActionCard";
import CatalogCourseCard from "./CatalogCourseCard";
import type { CatalogVisibleCourse } from "./catalogUtils";

type CatalogCourseGridProps = {
  courseGridRef: RefObject<HTMLDivElement | null>;
  isGeneratingCourse: boolean;
  generatingCourseTitle: string;
  generateMessage: string;
  visibleCourses: CatalogVisibleCourse[];
  catalogPageCourses: CatalogVisibleCourse[];
  publishingCourseKey: string | null;
  onCreateCourse: () => void;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onOpenSourceGaps: (course: CourseEntry) => void;
};

export default function CatalogCourseGrid({
  courseGridRef,
  isGeneratingCourse,
  generatingCourseTitle,
  generateMessage,
  visibleCourses,
  catalogPageCourses,
  publishingCourseKey,
  onCreateCourse,
  onOpenCourse,
  onOpenInfo,
  onOpenSourceGaps,
}: CatalogCourseGridProps) {
  return (
    <div className="course-grid" ref={courseGridRef}>
      <CatalogActionCard
        className="course-card create-course-card"
        onActivate={onCreateCourse}
      >
        <div className="create-course-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
          </svg>
        </div>
        <h3>Create Course</h3>
      </CatalogActionCard>
      {isGeneratingCourse && (
        <article className="course-card course-card--generating" aria-live="polite" aria-busy="true">
          <h3>{generatingCourseTitle}</h3>
          <div className="generating-course-spinner" aria-hidden="true" />
          <p className="course-generating-status">{generateMessage || "Course Generating"}</p>
        </article>
      )}
      {visibleCourses.length === 0 && (
        <article className="course-card course-card--empty" aria-live="polite">
          <h3>No matching courses</h3>
          <p className="course-short-description">Try a different search term, college, or sort option.</p>
        </article>
      )}
      {catalogPageCourses.map((visibleCourse) => (
        <CatalogCourseCard
          key={visibleCourse.course.key}
          visibleCourse={visibleCourse}
          onOpenCourse={onOpenCourse}
          onOpenInfo={onOpenInfo}
          onOpenSourceGaps={onOpenSourceGaps}
          isPublishing={publishingCourseKey === visibleCourse.course.key}
        />
      ))}
    </div>
  );
}
