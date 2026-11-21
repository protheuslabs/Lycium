import { useState } from "react";
import { ArrowRight, Check, Info } from "lucide-react";
import type { CourseEntry } from "../../courseTypes";
import { useClientMounted } from "../../hooks/useClientMounted";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";
import Modal from "../Modal/Modal";
import CourseCard from "../CourseCard/CourseCard";
import CourseProgress from "../CourseCard/CourseProgress";
import type { CatalogVisibleCourse } from "./catalogUtils";

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

export default function CatalogCourseCard({ visibleCourse, onOpenCourse, onOpenInfo, onSearchPrerequisite, isPublishing, selected = false, selectionMode = false, onToggleSelect }: CatalogCourseCardProps) {
  const { course, courseProgress, bookmarkedSection, hasCourseActivity, unmetPrerequisites, requirementContexts } = visibleCourse;
  const [isPrerequisiteModalOpen, setIsPrerequisiteModalOpen] = useState(false);
  const hasMounted = useClientMounted();
  const lifecycle = getCourseLifecycleSummary(course);
  const requiresPrerequisites = !hasCourseActivity && unmetPrerequisites.length > 0;
  const requiredCourseLabel = `Requires ${unmetPrerequisites.length} course${unmetPrerequisites.length === 1 ? "" : "s"}`;
  const canActivateCard = selectionMode || (!requiresPrerequisites && lifecycle.canOpen);
  const requirementLabel = requirementContexts.map((context) => context.title).join("; ");
  const canShowActivity = hasMounted && hasCourseActivity;

  const handleCourseOpen = () => {
    if (selectionMode) onToggleSelect?.(course.key);
    else if (!requiresPrerequisites && lifecycle.canOpen) onOpenCourse(course);
  };

  const footer = requiresPrerequisites && !selectionMode ? (
    <button className="course-tile-command course-card-requires-button" type="button" onClick={() => setIsPrerequisiteModalOpen(true)}>{requiredCourseLabel}<ArrowRight size={18} aria-hidden="true" /></button>
  ) : lifecycle.status === "failed" && !selectionMode ? (
    <button className="course-tile-command" type="button" disabled={isPublishing} onClick={() => onOpenInfo(course)}>{isPublishing ? "Publishing..." : lifecycle.actionLabel}<ArrowRight size={18} aria-hidden="true" /></button>
  ) : (
    <span className="course-tile-command"><span>{selectionMode ? selected ? "Selected" : "Select course" : "View course"}</span>{selected && selectionMode ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</span>
  );

  return <>
    <CourseCard
      course={course}
      title={course.title}
      className={`course-card ${requiresPrerequisites && !selectionMode ? "course-card--locked" : ""} ${selected ? "course-card--selected" : ""}`}
      action={{ label: `${selectionMode ? "Select" : "Open"} ${course.title}`, onActivate: handleCourseOpen, disabled: !canActivateCard, selected: selected || undefined }}
      tools={<button className="course-info-button" type="button" title="Course details" aria-label={`More info about ${course.title}`} onClick={() => onOpenInfo(course)}><Info size={18} aria-hidden="true" /></button>}
      context={(bookmarkedSection || requirementLabel) && <>
        {bookmarkedSection && <p>{bookmarkedSection.sectionTitle}</p>}
        {requirementLabel && <p>Satisfies: {requirementLabel}</p>}
      </>}
      progress={canShowActivity && <CourseProgress title={course.title} completed={courseProgress.completed} total={courseProgress.total} />}
      footer={footer}
    />
    {requiresPrerequisites && !selectionMode && <Modal
      isOpen={isPrerequisiteModalOpen}
      title={course.title}
      eyebrow="Prerequisites"
      labelledById={`course-prerequisites-${course.key}`}
      size="sm"
      className="course-prerequisite-modal"
      onClose={() => setIsPrerequisiteModalOpen(false)}
    >
      <p className="course-prerequisite-modal-intro">Complete the following course{unmetPrerequisites.length === 1 ? "" : "s"} before opening this course.</p>
      <div className="course-prerequisite-modal-list">{unmetPrerequisites.map((prerequisite) => <button className="course-prerequisite-modal-link" type="button" key={prerequisite.id} onClick={() => { setIsPrerequisiteModalOpen(false); onSearchPrerequisite(prerequisite.title); }}>{prerequisite.title}</button>)}</div>
    </Modal>}
  </>;
}
