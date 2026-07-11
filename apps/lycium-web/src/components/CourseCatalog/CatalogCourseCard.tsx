import { useState } from "react";
import type { CourseEntry } from "../../courseTypes";
import { useClientMounted } from "../../hooks/useClientMounted";
import Modal from "../Modal/Modal";
import CatalogActionCard from "./CatalogActionCard";
import CatalogProgressMeter from "./CatalogProgressMeter";
import type { CatalogVisibleCourse } from "./catalogUtils";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";
import { getLocalDraftMetadata } from "../../utils/localCourseDrafts";

type CatalogCourseCardProps = {
  visibleCourse: CatalogVisibleCourse;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenInfo: (course: CourseEntry) => void;
  onSearchPrerequisite: (query: string) => void;
  isPublishing: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (courseKey: string) => void;
};

export default function CatalogCourseCard({
  visibleCourse,
  onOpenCourse,
  onOpenInfo,
  onSearchPrerequisite,
  isPublishing,
  selected = false,
  selectionMode = false,
  onToggleSelect,
}: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity, unmetPrerequisites, requirementContexts } =
    visibleCourse;
  const [isPrerequisiteModalOpen, setIsPrerequisiteModalOpen] = useState(false);
  const hasMounted = useClientMounted();
  const localDraft = getLocalDraftMetadata(course);
  const lifecycle = getCourseLifecycleSummary(course);
  const catalogTone = lifecycle.needsSourceInput ? "draft" : lifecycle.tone;
  const requiresPrerequisites = !hasCourseActivity && unmetPrerequisites.length > 0;
  const requiredCourseLabel = `Requires ${unmetPrerequisites.length} course${unmetPrerequisites.length === 1 ? "" : "s"}`;
  const canActivateCard = selectionMode || (!requiresPrerequisites && lifecycle.canOpen);
  const shouldShowLifecycleAction = lifecycle.status === "failed";
  const requirementLabel = requirementContexts.map((context) => context.title).join("; ");
  const canShowActivity = hasMounted && hasCourseActivity;

  const handleCourseOpen = () => {
    if (selectionMode) {
      onToggleSelect?.(course.key);
      return;
    }
    if (!requiresPrerequisites && lifecycle.canOpen) {
      onOpenCourse(course);
    }
  };

  return (
    <CatalogActionCard
      className={`course-card course-card--lifecycle-${catalogTone} ${requiresPrerequisites && !selectionMode ? "course-card--locked" : ""} ${selectionMode ? "course-card--select-mode" : ""} ${selected ? "course-card--selected" : ""}`}
      disabled={!canActivateCard}
      onActivate={handleCourseOpen}
      pressed={selected || undefined}
    >
      {requiresPrerequisites && !selectionMode && <span className="course-card-lock-watermark" aria-hidden="true" />}
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
        {localDraft && <span className="course-draft-badge">{localDraft.parentCourseKey ? "Fork" : "Local draft"}</span>}
        {!lifecycle.needsSourceInput && (
          <span className={`course-lifecycle-badge course-lifecycle-badge-${lifecycle.tone}`}>{lifecycle.badgeLabel}</span>
        )}
      </h3>
      {(bookmarkedSection || requirementLabel) && (
        <p className="course-active-subheader">
          {bookmarkedSection && (
            <>
              <span>{bookmarkedSection.moduleTitle}</span>
              <span>{bookmarkedSection.sectionTitle}</span>
            </>
          )}
          {requirementLabel && <span className="course-requirement-context">Satisfies: {requirementLabel}</span>}
        </p>
      )}
      {course.data.shortDescription && <p className="course-short-description">{course.data.shortDescription}</p>}
      {!canShowActivity ? (
        <p className={`course-progress-percentage course-progress-empty ${requiresPrerequisites ? "course-progress-required" : ""}`}>
          {requiresPrerequisites && !selectionMode ? (
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
      {shouldShowLifecycleAction && (
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
          {isPublishing ? "Publishing..." : lifecycle.actionLabel}
        </button>
      )}
      {requiresPrerequisites && !selectionMode && (
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
