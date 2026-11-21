import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { CourseEntry } from "../../courseTypes";
import { selectLearningCourses, type LearningLibrary, type LearningSort, type LearningView } from "../../utils/learningLibrary";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import LearningCourseCard from "./LearningCourseCard";
import ContinueLearning from "./ContinueLearning";
import MyLearningControls from "./MyLearningControls";

type MyLearningProps = { library: LearningLibrary; onOpenCourse: (course: CourseEntry) => void };

export default function MyLearning({ library, onOpenCourse }: MyLearningProps) {
  const [view, setView] = useState<LearningView>("active");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState<LearningSort>("title");
  const subjects = useMemo(() => Array.from(new Set(library.items.map((item) => item.department))).sort(), [library.items]);
  const items = useMemo(() => selectLearningCourses(library, view, query, subject, sort), [library, view, query, subject, sort]);
  const isFiltered = Boolean(query.trim()) || subject !== "all";
  const hasLearning = library.active.length + library.completed.length > 0;
  return (
    <main id="main-content" tabIndex={-1} className="my-learning learner-page-inner">
      <header className="my-learning-heading">
        <h1>My Learning</h1>
        <Link href={COURSE_CATALOG_PATH} className="learner-text-link">Explore courses<ArrowRight size={17} aria-hidden="true" /></Link>
      </header>
      {library.active[0] && (
        <section className="dashboard-continue" aria-labelledby="continue-heading">
          <h2 id="continue-heading">Continue learning</h2>
          <ContinueLearning item={library.active[0]} onOpenCourse={onOpenCourse} />
        </section>
      )}
      <section className="my-learning-courses" aria-labelledby="my-courses-heading">
        <header className="learner-section-heading"><h2 id="my-courses-heading">Your courses</h2></header>
        <MyLearningControls view={view} query={query} subject={subject} sort={sort} subjects={subjects} counts={{ active: library.active.length, completed: library.completed.length, all: library.active.length + library.completed.length }} onViewChange={setView} onQueryChange={setQuery} onSubjectChange={setSubject} onSortChange={setSort} />
        <section id="learning-course-panel" role="tabpanel" aria-labelledby={`learning-tab-${view}`}>
          {items.length > 0 ? <div className="learning-course-grid my-learning-list">{items.map((item) => <LearningCourseCard key={item.course.key} item={item} showProgress returnTo="learning" onOpenCourse={onOpenCourse} />)}</div> : <div className="learner-empty">
            <BookOpen size={32} aria-hidden="true" />
            <h3>{isFiltered ? "No matching courses" : !hasLearning ? "Find your first course" : view === "completed" ? "No completed courses yet" : view === "active" ? "You're all caught up" : "Your learning library"}</h3>
            <p>{isFiltered ? "Try a different title, topic, or subject." : !hasLearning ? "You haven't started a course yet." : view === "completed" ? "Completed courses will appear here." : view === "active" ? "There are no courses in progress." : "Start a course to save your progress here."}</p>
            {isFiltered ? <button type="button" className="learner-text-link" onClick={() => { setQuery(""); setSubject("all"); }}>Clear filters</button> : <Link className="learner-primary-link" href={COURSE_CATALOG_PATH}>Explore courses<ArrowRight size={18} aria-hidden="true" /></Link>}
          </div>}
        </section>
        <p className="learner-storage-label">Progress saved on this device</p>
      </section>
    </main>
  );
}
