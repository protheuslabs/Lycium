import type { KeyboardEvent } from "react";
import type { CourseEntry } from "../../courseTypes";
import type { CatalogVisibleCourse } from "./catalogUtils";

type CatalogCourseCardProps = {
  visibleCourse: CatalogVisibleCourse;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  isPublishing: boolean;
};

function formatPrerequisiteTitles(titles: string[]): string {
  if (titles.length <= 1) {
    return titles[0] ?? "required course";
  }

  if (titles.length === 2) {
    return `${titles[0]} and ${titles[1]}`;
  }

  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

export default function CatalogCourseCard({
  visibleCourse,
  onOpenCourse,
  onOpenInfo,
  isPublishing,
}: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity, unmetPrerequisites } = visibleCourse;
  const isReadyForReview = course.status === "ready_for_review";
  const requiresPrerequisites = !hasCourseActivity && unmetPrerequisites.length > 0;

  const handleCourseOpen = () => {
    if (!requiresPrerequisites) {
      onOpenCourse(course);
    }
  };

  const handleCourseKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCourseOpen();
    }
  };

  return (
    <article
      className={`course-card ${requiresPrerequisites ? "course-card--locked" : ""}`}
      role="button"
      tabIndex={0}
      aria-disabled={requiresPrerequisites}
      onClick={handleCourseOpen}
      onKeyDown={handleCourseKeyDown}
    >
      <button
        className="course-info-button"
        type="button"
        aria-label={`More info about ${course.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenInfo(course);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        i
      </button>
      <h3>
        {course.title}
        {isReadyForReview && <span className="course-review-badge">Ready for review</span>}
      </h3>
      {bookmarkedSection && (
        <p className="course-active-subheader">
          <span>{bookmarkedSection.moduleTitle}</span>
          <span>{bookmarkedSection.sectionTitle}</span>
        </p>
      )}
      {course.data.shortDescription && <p className="course-short-description">{course.data.shortDescription}</p>}
      {!hasCourseActivity ? (
        <p className={`course-progress-percentage course-progress-empty ${requiresPrerequisites ? "course-progress-required" : ""}`}>
          {requiresPrerequisites ? (
            <>
              <span className="sidebar-lock-icon course-card-lock-icon" aria-hidden="true" />
              <span>Required: {formatPrerequisiteTitles(unmetPrerequisites)}</span>
            </>
          ) : (
            "Course not started"
          )}
        </p>
      ) : (
        <div className="course-progress">
          <div className="course-progress-bar">
            <div className="course-progress-viewed-fill" style={{ width: `${courseProgress.viewedPercentage}%` }} />
            <div className="course-progress-fill" style={{ width: `${courseProgress.percentage}%` }} />
          </div>
          <p className="course-progress-percentage">
            {Math.round(courseProgress.percentage)}% complete &middot; {Math.round(courseProgress.viewedPercentage)}% viewed
          </p>
        </div>
      )}
      {isReadyForReview && (
        <button
          className="course-publish-button"
          type="button"
          disabled={isPublishing}
          onClick={(event) => {
            event.stopPropagation();
            onOpenInfo(course);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {isPublishing ? "Publishing..." : "Review"}
        </button>
      )}
    </article>
  );
}
