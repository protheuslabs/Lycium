import type { FormEvent, KeyboardEvent } from "react";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import type { CourseEntry } from "../../courseTypes";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";
import "./CourseCatalog.css";

type CourseCatalogProps = {
  courses: CourseEntry[];
  prompt: string;
  level: string;
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onGenerateCourse: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCourse: (course: CourseEntry) => void;
};

export default function CourseCatalog({
  courses,
  prompt,
  level,
  generateStatus,
  generateMessage,
  onPromptChange,
  onLevelChange,
  onGenerateCourse,
  onOpenCourse,
}: CourseCatalogProps) {
  const handleCourseKeyDown = (event: KeyboardEvent<HTMLElement>, course: CourseEntry) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenCourse(course);
    }
  };

  return (
    <>
      <main className="home-page">
        <section className="generator-bar">
          <form className="generator-form" onSubmit={onGenerateCourse}>
            <input
              className="generator-input"
              placeholder="Describe a course to generate (e.g. Beginner Python for data analysis)"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
            />
            <select className="generator-select" value={level} onChange={(event) => onLevelChange(event.target.value)}>
              <option value="">Any level</option>
              <option value="elementary">Elementary</option>
              <option value="highschool">High school</option>
              <option value="undergrad">Undergrad</option>
              <option value="postgrad">Post-grad</option>
            </select>
            <button className="generator-button" type="submit" disabled={!prompt.trim() || generateStatus === "loading"}>
              {generateStatus === "loading" ? "Generating..." : "Generate"}
            </button>
            {generateMessage && <span className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</span>}
          </form>
        </section>

        <section className="catalog-page">
          <h2>Available Courses</h2>
          <div className="course-grid">
            {courses.map((course) => {
              const courseProgress = getCourseProgress(course);
              const bookmarkedSection = getBookmarkedModuleSection(course);
              const hasActiveCoursePage = Boolean(bookmarkedSection);
              return (
                <article
                  key={course.key}
                  className="course-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenCourse(course)}
                  onKeyDown={(event) => handleCourseKeyDown(event, course)}
                >
                  <h3>{course.title}</h3>
                  {bookmarkedSection && (
                    <p className="course-active-subheader">
                      <span>{bookmarkedSection.moduleTitle}</span>
                      <span>{bookmarkedSection.sectionTitle}</span>
                    </p>
                  )}
                  {!hasActiveCoursePage ? (
                    <p className="course-progress-percentage course-progress-empty">Course not started</p>
                  ) : (
                    <div className="course-progress">
                      <div className="course-progress-bar">
                        <div className="course-progress-fill" style={{ width: `${courseProgress.percentage}%` }} />
                      </div>
                      <p className="course-progress-percentage">{Math.round(courseProgress.percentage)}% complete</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <CatalogFooter />
    </>
  );
}
