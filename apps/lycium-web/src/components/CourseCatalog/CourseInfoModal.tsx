import { useRef } from "react";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel, getCourseDepartmentLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import CourseReviewPanel from "./CourseReviewPanel";
import { getLocalDraftMetadata } from "../../utils/localCourseDrafts";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";

type CourseInfoModalProps = {
  course: CourseEntry;
  isPublishing: boolean;
  onClose: () => void;
  onPublishCourse: (course: CourseEntry) => void;
  onForkCourse: (course: CourseEntry) => void;
  onDeleteCourseDraft: (course: CourseEntry) => void;
  onExportCourseDraft: (course: CourseEntry) => void;
  onImportCourseDraft: (file: File) => Promise<void>;
  onResetCourseDraft: (course: CourseEntry) => void;
};

export default function CourseInfoModal({
  course,
  isPublishing,
  onClose,
  onPublishCourse,
  onForkCourse,
  onDeleteCourseDraft,
  onExportCourseDraft,
  onImportCourseDraft,
  onResetCourseDraft,
}: CourseInfoModalProps) {
  const importDraftInputRef = useRef<HTMLInputElement | null>(null);
  const tagLabels = getCourseTagLabels(course.data.tags);
  const learningTypes = course.data.learningTypes ?? [];
  const courseEquivalencies = course.data.courseEquivalencies ?? [];
  const lifecycle = getCourseLifecycleSummary(course);
  const shouldShowReviewPanel = lifecycle.isReviewable && lifecycle.status !== "published";
  const learnersCanFork = course.data.metadata?.editPolicy?.learnersCanFork !== false;
  const localDraft = getLocalDraftMetadata(course);
  const localDraftDescription = localDraft
    ? localDraft.origin === "fork"
      ? `Forked from ${localDraft.parentCourseTitle ?? localDraft.forkedFromTitle ?? "another course"}.`
      : "Local editable draft."
    : "";

  return (
    <Modal
      isOpen
      title={course.title}
      eyebrow="Course info"
      labelledById="course-info-title"
      size={shouldShowReviewPanel ? "lg" : "md"}
      onClose={onClose}
    >
        {course.data.shortDescription && <p className="course-info-description">{course.data.shortDescription}</p>}
        <div className="course-info-facts">
          <article>
            <span>Difficulty level</span>
            <strong>{course.data.difficultyLevel ?? "Not set"}</strong>
          </article>
          <article>
            <span>College</span>
            <strong>{getCourseCategoryLabel(course.data.category)}</strong>
          </article>
          <article>
            <span>Department</span>
            <strong>{getCourseDepartmentLabel(course.data.category, course.data.department)}</strong>
          </article>
        </div>
        <section className="course-info-section">
          <h3>Tags</h3>
          {tagLabels.length > 0 ? (
            <div className="course-info-chip-row">
              {tagLabels.map((tag) => (
                <span className="course-info-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="course-info-muted">No tags assigned.</p>
          )}
        </section>
        <section className="course-info-section">
          <h3>Learning Types</h3>
          <div className="course-info-learning-types">
            {learningTypes.map((learningType) => (
              <span className="course-info-chip" key={learningType}>
                {learningType}
              </span>
            ))}
          </div>
        </section>
        {courseEquivalencies.length > 0 && (
          <section className="course-info-section">
            <h3>Course parity</h3>
            <div className="course-equivalency-list">
              {courseEquivalencies.map((equivalency, index) => {
                const heading = [equivalency.courseCode, equivalency.title].filter(Boolean).join(": ");

                return (
                  <article className="course-equivalency-card" key={`${heading}-${index}`}>
                    <div>
                      <strong>{heading || equivalency.title}</strong>
                      {equivalency.institution && <span>{equivalency.institution}</span>}
                    </div>
                    {(equivalency.department || equivalency.catalogYear || equivalency.notes) && (
                      <p>
                        {[equivalency.department, equivalency.catalogYear, equivalency.notes]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    )}
                    {equivalency.url && (
                      <a href={equivalency.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                        View catalog reference
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
            </section>
        )}
        {shouldShowReviewPanel && (
          <CourseReviewPanel course={course} isPublishing={isPublishing} onPublishCourse={onPublishCourse} />
        )}
        <section className="course-info-section course-draft-section">
            <h3>{localDraft ? "Local draft" : "Local drafts"}</h3>
            <p className="course-info-muted">
              {localDraft
                ? `${localDraftDescription} Revision ${localDraft.revision}.${
                    localDraft.updatedAt ? ` Last saved ${new Date(localDraft.updatedAt).toLocaleString()}.` : ""
                  }`
                : "Import a portable Lycium local draft file."}
            </p>
            <div className="course-draft-actions">
              {localDraft && (
                <Button type="button" variant="nav" onClick={() => onExportCourseDraft(course)}>
                  Export draft
                </Button>
              )}
              <Button type="button" variant="nav" onClick={() => importDraftInputRef.current?.click()}>
                Import draft
              </Button>
              {localDraft?.parentCourseKey && (
                <Button type="button" variant="nav" onClick={() => onResetCourseDraft(course)}>
                  Reset to original
                </Button>
              )}
              {localDraft && (
                <Button type="button" variant="nav" onClick={() => onDeleteCourseDraft(course)}>
                  Delete draft
                </Button>
              )}
              <input
                ref={importDraftInputRef}
                className="course-draft-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void onImportCourseDraft(file);
                }}
              />
            </div>
          </section>
        {learnersCanFork && (
          <section className="course-info-section course-fork-section">
            <Button type="button" variant="nav" className="course-fork-button" onClick={() => onForkCourse(course)}>
              Fork course
            </Button>
            <p className="course-info-muted">Creates a local editable copy titled "Fork of {course.title}".</p>
          </section>
        )}
    </Modal>
  );
}
