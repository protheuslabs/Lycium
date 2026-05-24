import { useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import Dropdown from "../Dropdown/Dropdown";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";
import "./CourseCatalog.css";
import "./CourseCatalog.create.css";
import "./CourseCatalog.info.css";

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

type CatalogSortMode = "college" | "completion-desc" | "completion-asc";

function getGeneratingCourseTitle(prompt: string): string {
  const title = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!title) {
    return "New course";
  }

  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreSearchField(fieldValue: string | undefined, query: string, weight: number): number {
  const value = fieldValue?.toLowerCase() ?? "";

  if (!query || !value) {
    return 0;
  }

  if (value === query) {
    return weight * 4;
  }

  if (value.startsWith(query)) {
    return weight * 3;
  }

  if (value.includes(query)) {
    return weight * 2;
  }

  return 0;
}

function getCourseSearchScore(course: CourseEntry, query: string): number {
  if (!query) {
    return 0;
  }

  const tagScore = [...(course.data.tags ?? []), ...getCourseTagLabels(course.data.tags)]
    .reduce((total, tag) => total + scoreSearchField(tag, query, 6), 0);
  const titleScore =
    scoreSearchField(course.title, query, 10) +
    scoreSearchField(course.data.title, query, 10);
  const descriptionScore = scoreSearchField(course.data.shortDescription, query, 2);

  return titleScore + tagScore + descriptionScore;
}

function compareCourseTitles(a: CourseEntry, b: CourseEntry): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

function getCollegeFilterLabel(label: string): string {
  return label.replace(/^College of\s+/i, "");
}

function compareCatalogSort(
  a: { course: CourseEntry; courseProgress: ReturnType<typeof getCourseProgress>; collegeLabel: string },
  b: { course: CourseEntry; courseProgress: ReturnType<typeof getCourseProgress>; collegeLabel: string },
  sortMode: CatalogSortMode
): number {
  if (sortMode === "completion-desc") {
    return b.courseProgress.percentage - a.courseProgress.percentage || compareCourseTitles(a.course, b.course);
  }

  if (sortMode === "completion-asc") {
    return a.courseProgress.percentage - b.courseProgress.percentage || compareCourseTitles(a.course, b.course);
  }

  return (
    a.collegeLabel.localeCompare(b.collegeLabel, undefined, { sensitivity: "base" }) ||
    compareCourseTitles(a.course, b.course)
  );
}

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sourceLinks, setSourceLinks] = useState([""]);
  const [infoCourse, setInfoCourse] = useState<CourseEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<CatalogSortMode>("college");
  const infoTagLabels = infoCourse ? getCourseTagLabels(infoCourse.data.tags) : [];
  const infoLearningTypes = infoCourse?.data.learningTypes ?? [];
  const isGeneratingCourse = generateStatus === "loading";
  const generatingCourseTitle = getGeneratingCourseTitle(prompt);
  const collegeOptions = useMemo(() => {
    const categories = new Map<string, string>();

    for (const course of courses) {
      if (course.data.category) {
        categories.set(course.data.category, getCourseCategoryLabel(course.data.category));
      }
    }

    return Array.from(categories, ([value, label]) => ({ value, label: getCollegeFilterLabel(label) })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [courses]);
  const collegeFilterOptions = useMemo(
    () => [{ value: "all", label: "All colleges" }, ...collegeOptions],
    [collegeOptions]
  );
  const sortOptions = useMemo(
    () => [
      { value: "college", label: "Type" },
      { value: "completion-desc", label: "Completion highest to lowest" },
      { value: "completion-asc", label: "Completion lowest to highest" },
    ],
    []
  );
  const levelOptions = useMemo(
    () => [
      { value: "", label: "Any level" },
      { value: "elementary", label: "Elementary" },
      { value: "highschool", label: "High school" },
      { value: "undergrad", label: "Undergrad" },
      { value: "postgrad", label: "Post-grad" },
    ],
    []
  );
  const visibleCourses = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return courses
      .map((course) => {
        const courseProgress = getCourseProgress(course);
        const bookmarkedSection = getBookmarkedModuleSection(course);
        const hasActiveCoursePage = Boolean(bookmarkedSection);
        const hasCourseActivity = hasActiveCoursePage || courseProgress.viewed > 0 || courseProgress.completed > 0;
        const searchScore = getCourseSearchScore(course, query);

        return {
          course,
          courseProgress,
          bookmarkedSection,
          hasCourseActivity,
          collegeLabel: getCourseCategoryLabel(course.data.category),
          searchScore,
        };
      })
      .filter(({ course, searchScore }) => {
        const matchesCollege = collegeFilter === "all" || course.data.category === collegeFilter;
        const matchesSearch = !query || searchScore > 0;
        return matchesCollege && matchesSearch;
      })
      .sort((a, b) => {
        if (query) {
          return b.searchScore - a.searchScore || compareCatalogSort(a, b, sortMode);
        }

        return compareCatalogSort(a, b, sortMode);
      });
  }, [collegeFilter, courses, searchQuery, sortMode]);

  const handleCourseKeyDown = (event: KeyboardEvent<HTMLElement>, course: CourseEntry) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenCourse(course);
    }
  };

  const handleCreateCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsCreateModalOpen(true);
    }
  };

  const handleCreateBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsCreateModalOpen(false);
    }
  };

  const handleInfoBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setInfoCourse(null);
    }
  };

  const handleSourceLinkChange = (index: number, value: string) => {
    setSourceLinks((currentLinks) =>
      currentLinks.map((link, linkIndex) => (linkIndex === index ? value : link))
    );
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    onGenerateCourse(event);
    setIsCreateModalOpen(false);
  };

  return (
    <>
      <main className="home-page">
        <section className="catalog-page">
          <div className="catalog-toolbar">
            <h2>Catalog</h2>
            <label className="catalog-search-field">
              <span className="catalog-control-label">Search courses</span>
              <input
                type="search"
                placeholder="Search names and tags"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="catalog-dropdown-row">
              <label className="catalog-dropdown-field">
                <span className="catalog-control-label">Filter by college</span>
                <Dropdown
                  className="catalog-dropdown"
                  value={collegeFilter}
                  options={collegeFilterOptions}
                  onChange={setCollegeFilter}
                  ariaLabel="Filter by college"
                />
              </label>
              <label className="catalog-dropdown-field">
                <span className="catalog-control-label">Sort courses</span>
                <Dropdown
                  className="catalog-dropdown catalog-sort-dropdown"
                  value={sortMode}
                  options={sortOptions}
                  onChange={(nextSortMode) => setSortMode(nextSortMode as CatalogSortMode)}
                  ariaLabel="Sort courses"
                />
              </label>
            </div>
          </div>
          <div className="course-grid">
            <article
              className="course-card create-course-card"
              role="button"
              tabIndex={0}
              onClick={() => setIsCreateModalOpen(true)}
              onKeyDown={handleCreateCardKeyDown}
            >
              <div className="create-course-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
                </svg>
              </div>
              <h3>Create Course</h3>
            </article>
            {isGeneratingCourse && (
              <article className="course-card course-card--generating" aria-live="polite" aria-busy="true">
                <h3>{generatingCourseTitle}</h3>
                <div className="generating-course-spinner" aria-hidden="true" />
                <p className="course-generating-status">Course Generating</p>
              </article>
            )}
            {visibleCourses.length === 0 && (
              <article className="course-card course-card--empty" aria-live="polite">
                <h3>No matching courses</h3>
                <p className="course-short-description">
                  Try a different search term, college, or sort option.
                </p>
              </article>
            )}
            {visibleCourses.map(({ course, courseProgress, bookmarkedSection, hasCourseActivity }) => {
              return (
                <article
                  key={course.key}
                  className="course-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenCourse(course)}
                  onKeyDown={(event) => handleCourseKeyDown(event, course)}
                >
                  <button
                    className="course-info-button"
                    type="button"
                    aria-label={`More info about ${course.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setInfoCourse(course);
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
                  {course.data.shortDescription && (
                    <p className="course-short-description">{course.data.shortDescription}</p>
                  )}
                  {!hasCourseActivity ? (
                    <p className="course-progress-percentage course-progress-empty">Course not started</p>
                  ) : (
                    <div className="course-progress">
                      <div className="course-progress-bar">
                        <div className="course-progress-viewed-fill" style={{ width: `${courseProgress.viewedPercentage}%` }} />
                        <div className="course-progress-fill" style={{ width: `${courseProgress.percentage}%` }} />
                      </div>
                      <p className="course-progress-percentage">
                        {Math.round(courseProgress.percentage)}% complete · {Math.round(courseProgress.viewedPercentage)}% viewed
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {isCreateModalOpen && (
        <div className="create-course-modal-backdrop" role="presentation" onMouseDown={handleCreateBackdropMouseDown}>
          <section
            className="create-course-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-course-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="create-course-close"
              type="button"
              aria-label="Close create course"
              onClick={() => setIsCreateModalOpen(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
              </svg>
            </button>
            <div className="create-course-header">
              <p>Create with Lycium</p>
              <h2 id="create-course-title">Create Course</h2>
            </div>
            <form className="create-course-form" onSubmit={handleCreateSubmit}>
              <label className="create-course-field">
                <span>Description</span>
                <textarea
                  className="create-course-textarea"
                  placeholder="Describe the course you want to build..."
                  value={prompt}
                  onChange={(event) => onPromptChange(event.target.value)}
                  rows={5}
                />
              </label>
              <div className="create-course-field">
                <span>Links</span>
                <div className="create-course-link-stack">
                  {sourceLinks.map((link, index) => (
                    <input
                      key={index}
                      className="create-course-input"
                      type="url"
                      placeholder="https://example.com/source"
                      value={link}
                      onChange={(event) => handleSourceLinkChange(index, event.target.value)}
                    />
                  ))}
                </div>
                <button
                  className="create-course-add-link"
                  type="button"
                  onClick={() => setSourceLinks((currentLinks) => [...currentLinks, ""])}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
                  </svg>
                  Add another link
                </button>
              </div>
              <label className="create-course-field">
                <span>Difficulty level</span>
                <Dropdown
                  className="create-course-dropdown"
                  value={level}
                  options={levelOptions}
                  onChange={onLevelChange}
                  ariaLabel="Difficulty level"
                />
              </label>
              <div className="create-course-files" aria-label="Add files placeholder">
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d="M7.5 18.5a5 5 0 0 1 0-7.07l6.72-6.72a3.5 3.5 0 0 1 4.95 4.95l-7.08 7.07a2 2 0 0 1-2.83-2.83l6.37-6.36a1 1 0 1 1 1.41 1.41l-6.36 6.37 1.41 1.41 7.07-7.07a5.5 5.5 0 0 0-7.78-7.78l-6.72 6.72a7 7 0 0 0 9.9 9.9l5.31-5.3a1 1 0 0 0-1.42-1.42l-5.3 5.31a5 5 0 0 1-7.07 0Z" />
                </svg>
                <div>
                  <strong>Add Files</strong>
                  <span>File uploads are coming soon.</span>
                </div>
              </div>
              <button className="create-course-submit" type="submit" disabled={!prompt.trim() || generateStatus === "loading"}>
                {generateStatus === "loading" ? "Generating..." : "Create course"}
              </button>
              {generateMessage && <p className={`generator-status generator-status-${generateStatus}`}>{generateMessage}</p>}
            </form>
          </section>
        </div>
      )}

      {infoCourse && (
        <div className="course-info-modal-backdrop" role="presentation" onMouseDown={handleInfoBackdropMouseDown}>
          <section
            className="course-info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="course-info-close"
              type="button"
              aria-label="Close course information"
              onClick={() => setInfoCourse(null)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
              </svg>
            </button>
            <div className="course-info-header">
              <p>Course info</p>
              <h2 id="course-info-title">{infoCourse.title}</h2>
              {infoCourse.data.shortDescription && (
                <p className="course-info-description">{infoCourse.data.shortDescription}</p>
              )}
            </div>
            <div className="course-info-facts">
              <article>
                <span>Difficulty level</span>
                <strong>{infoCourse.data.difficultyLevel ?? "Not set"}</strong>
              </article>
              <article>
                <span>Category</span>
                <strong>{getCourseCategoryLabel(infoCourse.data.category)}</strong>
              </article>
            </div>
            <section className="course-info-section">
              <h3>Tags</h3>
              {infoTagLabels.length > 0 ? (
                <div className="course-info-chip-row">
                  {infoTagLabels.map((tag) => (
                    <span className="course-info-chip" key={tag}>{tag}</span>
                  ))}
                </div>
              ) : (
                <p className="course-info-muted">No tags assigned.</p>
              )}
            </section>
            <section className="course-info-section">
              <h3>Learning Types</h3>
              <div className="course-info-learning-types">
                {infoLearningTypes.map((learningType) => (
                  <span className="course-info-chip" key={learningType}>{learningType}</span>
                ))}
              </div>
            </section>
          </section>
        </div>
      )}

      <CatalogFooter />
    </>
  );
}
