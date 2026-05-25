import { useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import Dropdown from "../Dropdown/Dropdown";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel } from "../../courseData/courseTaxonomy";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";
import CatalogCourseCard from "./CatalogCourseCard";
import CatalogPagination from "./CatalogPagination";
import CourseInfoModal from "./CourseInfoModal";
import CreateCourseModal from "./CreateCourseModal";
import {
  CATALOG_COURSES_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_SORT_OPTIONS,
  type CatalogSortMode,
  compareCatalogSort,
  getCollegeFilterLabel,
  getCourseSearchScore,
  getGeneratingCourseTitle,
  normalizeSearchText,
} from "./catalogUtils";

type CourseCatalogProps = {
  courses: CourseEntry[];
  prompt: string;
  level: string;
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onGenerateCourse: (event: FormEvent<HTMLFormElement>, sourceLinks: string[]) => void;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sourceLinks, setSourceLinks] = useState([""]);
  const [infoCourse, setInfoCourse] = useState<CourseEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<CatalogSortMode>("college");
  const [catalogPage, setCatalogPage] = useState(1);
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
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [courses]);

  const collegeFilterOptions = useMemo(
    () => [{ value: "all", label: "All colleges" }, ...collegeOptions],
    [collegeOptions],
  );

  const visibleCourses = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return courses
      .map((course) => {
        const courseProgress = getCourseProgress(course);
        const bookmarkedSection = getBookmarkedModuleSection(course);
        const hasActiveCoursePage = Boolean(bookmarkedSection);
        const hasCourseActivity = hasActiveCoursePage || courseProgress.viewed > 0 || courseProgress.completed > 0;

        return {
          course,
          courseProgress,
          bookmarkedSection,
          hasCourseActivity,
          collegeLabel: getCourseCategoryLabel(course.data.category),
          searchScore: getCourseSearchScore(course, query),
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

  const totalCatalogPages = Math.max(1, Math.ceil(visibleCourses.length / CATALOG_COURSES_PER_PAGE));
  const activeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const catalogPageStartIndex = (activeCatalogPage - 1) * CATALOG_COURSES_PER_PAGE;
  const catalogPageCourses = visibleCourses.slice(
    catalogPageStartIndex,
    catalogPageStartIndex + CATALOG_COURSES_PER_PAGE,
  );
  const firstVisibleResult = visibleCourses.length === 0 ? 0 : catalogPageStartIndex + 1;
  const lastVisibleResult = Math.min(catalogPageStartIndex + CATALOG_COURSES_PER_PAGE, visibleCourses.length);
  const shouldShowCatalogPagination = visibleCourses.length > CATALOG_COURSES_PER_PAGE;

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    setCatalogPage(1);
  };

  const handleCollegeFilterChange = (value: string) => {
    setCollegeFilter(value);
    setCatalogPage(1);
  };

  const handleSortModeChange = (value: string) => {
    setSortMode(value as CatalogSortMode);
    setCatalogPage(1);
  };

  const handleCreateCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsCreateModalOpen(true);
    }
  };

  const handleSourceLinkChange = (index: number, value: string) => {
    setSourceLinks((currentLinks) => currentLinks.map((link, linkIndex) => (linkIndex === index ? value : link)));
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    onGenerateCourse(
      event,
      sourceLinks.map((link) => link.trim()).filter(Boolean),
    );
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
                onChange={(event) => handleSearchQueryChange(event.target.value)}
              />
            </label>
            <div className="catalog-dropdown-row">
              <label className="catalog-dropdown-field">
                <span className="catalog-control-label">Filter by college</span>
                <Dropdown
                  className="catalog-dropdown"
                  value={collegeFilter}
                  options={collegeFilterOptions}
                  onChange={handleCollegeFilterChange}
                  ariaLabel="Filter by college"
                />
              </label>
              <label className="catalog-dropdown-field">
                <span className="catalog-control-label">Sort courses</span>
                <Dropdown
                  className="catalog-dropdown catalog-sort-dropdown"
                  value={sortMode}
                  options={CATALOG_SORT_OPTIONS}
                  onChange={handleSortModeChange}
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
                <p className="course-short-description">Try a different search term, college, or sort option.</p>
              </article>
            )}
            {catalogPageCourses.map((visibleCourse) => (
              <CatalogCourseCard
                key={visibleCourse.course.key}
                visibleCourse={visibleCourse}
                onOpenCourse={onOpenCourse}
                onOpenInfo={setInfoCourse}
              />
            ))}
          </div>
          {shouldShowCatalogPagination && (
            <CatalogPagination
              activePage={activeCatalogPage}
              firstVisibleResult={firstVisibleResult}
              lastVisibleResult={lastVisibleResult}
              totalPages={totalCatalogPages}
              totalResults={visibleCourses.length}
              onPageChange={setCatalogPage}
            />
          )}
        </section>
      </main>

      {isCreateModalOpen && (
        <CreateCourseModal
          prompt={prompt}
          level={level}
          sourceLinks={sourceLinks}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          levelOptions={CATALOG_LEVEL_OPTIONS}
          onPromptChange={onPromptChange}
          onLevelChange={onLevelChange}
          onSourceLinkChange={handleSourceLinkChange}
          onAddSourceLink={() => setSourceLinks((currentLinks) => [...currentLinks, ""])}
          onSubmit={handleCreateSubmit}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {infoCourse && <CourseInfoModal course={infoCourse} onClose={() => setInfoCourse(null)} />}

      <CatalogFooter />
    </>
  );
}
