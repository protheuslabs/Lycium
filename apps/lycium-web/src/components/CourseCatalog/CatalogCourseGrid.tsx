import type { RefObject } from "react";
import type { CourseEntry } from "../../courseTypes";
import CatalogCourseCard from "./CatalogCourseCard";
import CatalogEmptyState from "./CatalogEmptyState";
import type { CatalogVisibleCourse } from "./catalogUtils";
import type { CatalogSelectionMode } from "../../utils/catalogSelection";

type CatalogCourseGridProps = {
  courseGridRef: RefObject<HTMLDivElement | null>;
  generateStatus: "idle" | "loading" | "error" | "success";
  generatingCourseTitle: string;
  generateMessage: string;
  generateProgress: number;
  visibleCourses: CatalogVisibleCourse[];
  catalogPageCourses: CatalogVisibleCourse[];
  publishingCourseKey: string | null;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onOpenSettings: () => void;
  onRetryGenerate: () => void;
  onSearchPrerequisite: (query: string) => void;
  selectionMode: CatalogSelectionMode;
  onToggleCourseSelection: (courseKey: string) => void;
};

export default function CatalogCourseGrid({
  courseGridRef,
  generateStatus,
  generatingCourseTitle,
  generateMessage,
  generateProgress,
  visibleCourses,
  catalogPageCourses,
  publishingCourseKey,
  onOpenCourse,
  onOpenInfo,
  onOpenSettings,
  onRetryGenerate,
  onSearchPrerequisite,
  selectionMode,
  onToggleCourseSelection,
}: CatalogCourseGridProps) {
  const selectedCourseKeys = selectionMode?.kind === "cluster" ? new Set(selectionMode.selectedCourseKeys) : null;
  const progressPercent = Math.max(0, Math.min(100, Math.round(generateProgress * 100)));
  const isGeneratingCourse = generateStatus === "loading";
  const isGenerationFailed = generateStatus === "error";
  const shouldShowGenerationTile = isGeneratingCourse || isGenerationFailed;

  return (
    <div className="course-grid" ref={courseGridRef}>
      {shouldShowGenerationTile && (
        <article
          className={`course-card course-card--generating${isGenerationFailed ? " course-card--generation-error" : ""}`}
          aria-live="polite"
          aria-busy={isGeneratingCourse}
          aria-disabled={isGeneratingCourse ? "true" : undefined}
        >
          <h3>{generatingCourseTitle}</h3>
          {isGeneratingCourse ? (
            <div className="generating-course-spinner" aria-hidden="true" />
          ) : (
            <div className="generating-course-error-mark" aria-hidden="true">!</div>
          )}
          <div className="generating-course-footer">
            <p className="course-generating-status">
              {generateMessage || (isGenerationFailed ? "Course generation failed." : "Course Generating")}
            </p>
            {isGeneratingCourse ? (
              <div className="generating-course-progress-track">
                <span
                  className="generating-course-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : (
              <div className="generating-course-actions">
                <button type="button" className="generating-course-action" onClick={onOpenSettings}>
                  Settings
                </button>
                <button type="button" className="generating-course-action" onClick={onRetryGenerate}>
                  Try again
                </button>
              </div>
            )}
          </div>
          {isGeneratingCourse && (
            <div
              className="catalog-sr-only"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Course generation progress"
            />
          )}
        </article>
      )}
      {visibleCourses.length === 0 && !shouldShowGenerationTile && (
        <CatalogEmptyState level="courses" />
      )}
      {catalogPageCourses.map((visibleCourse) => (
        <CatalogCourseCard
          key={visibleCourse.course.key}
          visibleCourse={visibleCourse}
          onOpenCourse={onOpenCourse}
          onOpenInfo={onOpenInfo}
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
