import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel, getCourseDepartmentLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import CourseReviewPanel from "./CourseReviewPanel";

type CourseInfoModalProps = {
  course: CourseEntry;
  isPublishing: boolean;
  onClose: () => void;
  onPublishCourse: (course: CourseEntry) => void;
  onForkCourse: (course: CourseEntry) => void;
};

export default function CourseInfoModal({ course, isPublishing, onClose, onPublishCourse, onForkCourse }: CourseInfoModalProps) {
  const tagLabels = getCourseTagLabels(course.data.tags);
  const learningTypes = course.data.learningTypes ?? [];
  const courseEquivalencies = course.data.courseEquivalencies ?? [];
  const isGeneratedCourse = course.source === "remote" || Boolean(course.generation_trace);

  return (
    <Modal
      isOpen
      title={course.title}
      eyebrow="Course info"
      labelledById="course-info-title"
      size={isGeneratedCourse ? "lg" : "md"}
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
        {isGeneratedCourse && (
          <CourseReviewPanel course={course} isPublishing={isPublishing} onPublishCourse={onPublishCourse} />
        )}
        <section className="course-info-section course-fork-section">
          <Button type="button" variant="nav" className="course-fork-button" onClick={() => onForkCourse(course)}>
            Fork course
          </Button>
          <p className="course-info-muted">Creates a local editable copy titled "Fork of {course.title}".</p>
        </section>
    </Modal>
  );
}
