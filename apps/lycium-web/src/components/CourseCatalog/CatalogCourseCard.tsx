import { useState } from "react";
import type { CourseEntry } from "../../courseTypes";
import Modal from "../Modal/Modal";
import CatalogActionCard from "./CatalogActionCard";
import CatalogProgressMeter from "./CatalogProgressMeter";
import type { CatalogVisibleCourse } from "./catalogUtils";
import { hasBlockingSourceGaps, sourceGapSummary } from "../../utils/courseSourceGaps";

type CatalogCourseCardProps = {
  visibleCourse: CatalogVisibleCourse;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onOpenSourceGaps: (course: CourseEntry) => void;
  onSearchPrerequisite: (query: string) => void;
  isPublishing: boolean;
};

export default function CatalogCourseCard({
  visibleCourse,
  onOpenCourse,
  onOpenInfo,
  onOpenSourceGaps,
  onSearchPrerequisite,
  isPublishing,
}: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity, unmetPrerequisites } = visibleCourse;
  const [isPrerequisiteModalOpen, setIsPrerequisiteModalOpen] = useState(false);
  const isReadyForReview = course.status === "ready_for_review";
  const needsSources = hasBlockingSourceGaps(course);
  const sourceSummary = sourceGapSummary(course);
  const requiresPrerequisites = !hasCourseActivity && unmetPrerequisites.length > 0;
  const requiredCourseLabel = `Requires ${unmetPrerequisites.length} course${unmetPrerequisites.length === 1 ? "" : "s"}`;

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
      {requiresPrerequisites && <span className="course-card-lock-watermark" aria-hidden="true" />}
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
            <button
              className="course-card-requires-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsPrerequisiteModalOpen(true);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {requiredCourseLabel}
            </button>
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
      {requiresPrerequisites && (
        <Modal
          isOpen={isPrerequisiteModalOpen}
          title={course.title}
          eyebrow="Prerequisites"
          labelledById={`course-prerequisites-${course.key}`}
          size="sm"
          className="course-prerequisite-modal"
          onClose={() => setIsPrerequisiteModalOpen(false)}
        >
          <p className="course-prerequisite-modal-intro">
            Complete the following course{unmetPrerequisites.length === 1 ? "" : "s"} before opening this course.
          </p>
          <div className="course-prerequisite-modal-list">
            {unmetPrerequisites.map((prerequisite) => (
              <button
                key={prerequisite.id}
                className="course-prerequisite-modal-link"
                type="button"
                onClick={() => {
                  setIsPrerequisiteModalOpen(false);
                  onSearchPrerequisite(prerequisite.title);
                }}
              >
                {prerequisite.title}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </CatalogActionCard>
  );
}
