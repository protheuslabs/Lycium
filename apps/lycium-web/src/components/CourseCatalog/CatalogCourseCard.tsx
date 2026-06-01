import type { CourseEntry } from "../../courseTypes";
import CatalogActionCard from "./CatalogActionCard";
import CatalogProgressMeter from "./CatalogProgressMeter";
import type { CatalogVisibleCourse } from "./catalogUtils";
import { hasBlockingSourceGaps, sourceGapSummary } from "../../utils/courseSourceGaps";

type CatalogCourseCardProps = {
  visibleCourse: CatalogVisibleCourse;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onOpenSourceGaps: (course: CourseEntry) => void;
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
  onOpenSourceGaps,
  isPublishing,
}: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity, unmetPrerequisites } = visibleCourse;
  const isReadyForReview = course.status === "ready_for_review";
  const needsSources = hasBlockingSourceGaps(course);
  const sourceSummary = sourceGapSummary(course);
  const requiresPrerequisites = !hasCourseActivity && unmetPrerequisites.length > 0;

  const handleCourseOpen = () => {
    if (needsSources) {
      onOpenSourceGaps(course);
      return;
    }
    if (!requiresPrerequisites) {
      onOpenCourse(course);
    }
  };

  return (
    <CatalogActionCard
      className={`course-card ${requiresPrerequisites ? "course-card--locked" : ""} ${needsSources ? "course-card--needs-sources" : ""}`}
      disabled={requiresPrerequisites && !needsSources}
      onActivate={handleCourseOpen}
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
        {needsSources && <span className="course-source-gap-badge">Needs sources</span>}
      </h3>
      {bookmarkedSection && (
        <p className="course-active-subheader">
          <span>{bookmarkedSection.moduleTitle}</span>
          <span>{bookmarkedSection.sectionTitle}</span>
        </p>
      )}
      {course.data.shortDescription && <p className="course-short-description">{course.data.shortDescription}</p>}
      {needsSources ? (
        <p className="course-progress-percentage course-progress-empty course-progress-required course-progress-needs-sources">
          <span>Needs sources: {sourceSummary.blockingGaps.length} blocking gap{sourceSummary.blockingGaps.length === 1 ? "" : "s"}</span>
        </p>
      ) : !hasCourseActivity ? (
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
        <CatalogProgressMeter
          progress={courseProgress}
          variant="course"
        />
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
    </CatalogActionCard>
  );
}
