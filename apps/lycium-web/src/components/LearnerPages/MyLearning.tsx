import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import type { CourseEntry } from "../../courseTypes";
import type { LearningLibrary } from "../../utils/learningLibrary";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import LearningCourseCard from "./LearningCourseCard";
import ContinueLearning from "./ContinueLearning";

type MyLearningProps = { library: LearningLibrary; onOpenCourse: (course: CourseEntry) => void };

export default function MyLearning({ library, onOpenCourse }: MyLearningProps) {
  const [view, setView] = useState<"active" | "completed">("active");
  const [query, setQuery] = useState("");
  const items = library[view].filter(({ course }) => course.title.toLowerCase().includes(query.trim().toLowerCase()));
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
        <div className="learning-course-toolbar">
          <div className="learning-tabs" role="group" aria-label="Course status">
            <button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>In progress</button>
            <button type="button" aria-pressed={view === "completed"} onClick={() => setView("completed")}>Completed</button>
          </div>
          <label className="learning-search"><Search size={17} aria-hidden="true" />
            <input type="search" aria-label="Search your courses" placeholder="Search your courses" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {items.length > 0 ? (
          <div className="learning-course-grid">
            {items.map((item) => <LearningCourseCard key={item.course.key} item={item} showProgress onOpenCourse={onOpenCourse} />)}
          </div>
        ) : (
          <div className="learner-empty">
            <BookOpen size={32} aria-hidden="true" />
            <h3>{query ? "No matching courses" : !hasLearning ? "Find your first course" : view === "completed" ? "No completed courses yet" : "You're all caught up"}</h3>
            <p>{query ? "No courses match this search." : !hasLearning ? "You haven't started a course yet." : view === "completed" ? "Completed courses will appear here." : "There are no courses in progress."}</p>
            {!query && <Link className="learner-primary-link" href={COURSE_CATALOG_PATH}>Explore courses<ArrowRight size={18} aria-hidden="true" /></Link>}
          </div>
        )}
        <p className="learner-storage-label">Progress saved on this device</p>
      </section>
    </main>
  );
}
