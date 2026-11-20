import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Clock, Layers, LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { CourseEntry, CourseSection } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import { stripModulePrefix } from "../CourseEditing/courseEditPrimitives";
import CourseArtwork from "./CourseArtwork";
import CatalogFooter from "../CatalogFooter/CatalogFooter";

export default function CourseOverview({ course, onOpenCourse, onOpenSection }: {
  course: CourseEntry;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
}) {
  const library = useLearningLibrary([course]);
  const item = library.items[0];
  const sections = course.data.modules.flatMap((module) => module.sections);
  const minutes = course.data.estimatedMinutes ?? (course.data.estimatedHours ? course.data.estimatedHours * 60 : 0);
  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="course-overview learner-page-inner">
        <Link href={COURSE_CATALOG_PATH} className="overview-back"><ArrowLeft size={16} aria-hidden="true" />Catalog</Link>
        <header className="overview-heading">
          <div className="overview-introduction">
            <span className="course-subject-label">{item?.department ?? "Course"}</span>
            <h1>{course.title}</h1>
            {course.data.shortDescription && <p>{course.data.shortDescription}</p>}
            <div className="overview-facts">
              {course.data.difficultyLevel && <span>{course.data.difficultyLevel}</span>}
              <span><Layers size={16} aria-hidden="true" />{course.data.modules.length} modules</span>
              <span><BookOpen size={16} aria-hidden="true" />{sections.length} sections</span>
              {minutes > 0 && <span><Clock size={16} aria-hidden="true" />{Math.round(minutes / 60)} hours</span>}
            </div>
            <button type="button" className="learner-primary-link" disabled={!sections.length} onClick={() => onOpenCourse(course)}>
              {item?.completed ? "Review course" : item?.started ? "Resume course" : "Start course"}<ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <CourseArtwork course={course} />
        </header>
        {!!course.data.prerequisites?.length && <section className="overview-prerequisites" aria-labelledby="prerequisites-title">
          <h2 id="prerequisites-title">Before you begin</h2>
          <ul>{course.data.prerequisites.map((requirement, index) => <li key={index}>{requirement.title}</li>)}</ul>
        </section>}
        <section className="overview-curriculum" aria-labelledby="curriculum-title">
          <h2 id="curriculum-title">Course curriculum</h2>
          {course.data.modules.map((module, index) => (
            <details className="overview-module" key={module.id} open={index === 0}>
              <summary><span className="overview-module-number">{String(index + 1).padStart(2, "0")}</span><span>{stripModulePrefix(module.title)}</span><small>{module.sections.length} sections</small><ChevronDown size={18} aria-hidden="true" /></summary>
              <ol>{module.sections.map((section, sectionIndex) => {
                const locked = item?.sectionStatuses[section.id] === "locked";
                return <li key={section.id}><button type="button" disabled={locked} onClick={() => onOpenSection(course, section)}>
                  <span className="overview-section-number">{index + 1}.{sectionIndex + 1}</span><span>{section.title}</span>{locked ? <LockKeyhole size={16} aria-label="Locked" /> : <ArrowRight size={16} aria-hidden="true" />}
                </button></li>;
              })}</ol>
            </details>
          ))}
        </section>
      </main>
      <CatalogFooter />
    </div>
  );
}
