import type { MouseEvent } from "react";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";

type CourseInfoModalProps = {
  course: CourseEntry;
  onClose: () => void;
};

export default function CourseInfoModal({ course, onClose }: CourseInfoModalProps) {
  const tagLabels = getCourseTagLabels(course.data.tags);
  const learningTypes = course.data.learningTypes ?? [];
  const courseEquivalencies = course.data.courseEquivalencies ?? [];

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="course-info-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        className="course-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="course-info-close" type="button" aria-label="Close course information" onClick={onClose}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
        <div className="course-info-header">
          <p>Course info</p>
          <h2 id="course-info-title">{course.title}</h2>
          {course.data.shortDescription && <p className="course-info-description">{course.data.shortDescription}</p>}
        </div>
        <div className="course-info-facts">
          <article>
            <span>Difficulty level</span>
            <strong>{course.data.difficultyLevel ?? "Not set"}</strong>
          </article>
          <article>
            <span>Category</span>
            <strong>{getCourseCategoryLabel(course.data.category)}</strong>
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
      </section>
    </div>
  );
}
