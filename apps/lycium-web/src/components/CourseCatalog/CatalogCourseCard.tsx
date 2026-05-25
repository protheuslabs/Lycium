import type { KeyboardEvent } from "react";
import type { CourseEntry } from "../../courseTypes";
import type { CatalogVisibleCourse } from "./catalogUtils";

type CatalogCourseCardProps = {
  visibleCourse: CatalogVisibleCourse;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
};

export default function CatalogCourseCard({ visibleCourse, onOpenCourse, onOpenInfo }: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity } = visibleCourse;

  const handleCourseKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenCourse(course);
    }
  };

  return (
    <article
      className="course-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenCourse(course)}
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
      <h3>{course.title}</h3>
      {bookmarkedSection && (
        <p className="course-active-subheader">
          <span>{bookmarkedSection.moduleTitle}</span>
          <span>{bookmarkedSection.sectionTitle}</span>
        </p>
      )}
      {course.data.shortDescription && <p className="course-short-description">{course.data.shortDescription}</p>}
      {!hasCourseActivity ? (
        <p className="course-progress-percentage course-progress-empty">Course not started</p>
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
    </article>
  );
}
