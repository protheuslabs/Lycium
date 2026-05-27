import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel, getCourseDepartmentLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";
import Modal from "../Modal/Modal";

type CourseInfoModalProps = {
  course: CourseEntry;
  onClose: () => void;
};

export default function CourseInfoModal({ course, onClose }: CourseInfoModalProps) {
  const tagLabels = getCourseTagLabels(course.data.tags);
  const learningTypes = course.data.learningTypes ?? [];
  const courseEquivalencies = course.data.courseEquivalencies ?? [];

  return (
    <Modal
      isOpen
      title={course.title}
      eyebrow="Course info"
      labelledById="course-info-title"
      size="md"
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
    </Modal>
  );
}
