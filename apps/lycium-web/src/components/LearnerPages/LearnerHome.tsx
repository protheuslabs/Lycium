import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import learningWorld from "../../assets/learning-world.webp";
import mobileLearningWorld from "../../assets/learning-world-mobile.webp";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel } from "@lycium/contracts";
import { COURSE_CATALOG_PATH, MY_LEARNING_PATH } from "../../utils/courseRouting";
import { selectDiscoveryCourses, type LearningLibrary } from "../../utils/learningLibrary";
import LearningCourseCard from "./LearningCourseCard";
import ContinueLearning from "./ContinueLearning";

type LearnerHomeProps = { library: LearningLibrary; onOpenCourse: (course: CourseEntry) => void };

export default function LearnerHome({ library, onOpenCourse }: LearnerHomeProps) {
  const [category, setCategory] = useState("all");
  const categories = Array.from(
    new Set(library.items.map(({ course }) => course.data.category).filter(Boolean)),
  );
  const featured = selectDiscoveryCourses(library.items, category);
  return (
    <main id="main-content" tabIndex={-1} className="learner-home">
      <section
        className="learner-home-hero"
        style={{ "--home-artwork": `url(${learningWorld.src})`, "--home-mobile-artwork": `url(${mobileLearningWorld.src})` } as CSSProperties}
        aria-labelledby="home-title"
      >
        <div className="learner-hero-content">
          <h1 id="home-title">Knowledge without barriers.</h1>
          <p className="learner-hero-intro">Follow structured courses, test your understanding, and build knowledge that lasts.</p>
          <div className="learner-hero-actions">
            <Link href={COURSE_CATALOG_PATH} className="learner-primary-link">
              Explore courses
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href={MY_LEARNING_PATH} className="learner-hero-secondary">
              My Learning
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <div className="learner-page-inner">
        {library.active.length > 0 && (
          <section className="home-continue" aria-labelledby="home-continue-title">
            <div>
              <h2 id="home-continue-title">Continue learning</h2>
            </div>
            <ContinueLearning item={library.active[0]} onOpenCourse={onOpenCourse} />
          </section>
        )}
        <section className="home-course-section" aria-labelledby="home-courses-title">
          <header className="learner-section-heading">
            <div>
              <h2 id="home-courses-title">Find your next course</h2>
            </div>
            <div className="home-course-controls">
              <select
                aria-label="Filter home courses by subject"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All subjects</option>
                {categories.map((id) => (
                  <option value={id} key={id}>
                    {getCourseCategoryLabel(id)}
                  </option>
                ))}
              </select>
              <Link href={COURSE_CATALOG_PATH}>
                View catalog
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </header>
          {featured.length > 0 ? (
            <div className="learning-course-grid home-course-grid">
              {featured.map((item) => (
                <LearningCourseCard key={item.course.key} item={item} onOpenCourse={onOpenCourse} />
              ))}
            </div>
          ) : (
            <div className="learner-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h3>The library is taking shape</h3>
              <p>No courses are available yet.</p>
              <Link href={COURSE_CATALOG_PATH}>
                Go to catalog
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
