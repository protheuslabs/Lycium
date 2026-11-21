import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock, Layers } from "lucide-react";
import Link from "next/link";
import type { CourseEntry, CourseSection } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import { COURSE_CATALOG_PATH } from "../../utils/courseRouting";
import { courseAssessmentCounts, courseDurationLabel, courseLearningOutcomes, courseLevelLabel } from "../../utils/coursePresentation";
import { getCourseTagLabels } from "@lycium/contracts";
import CourseArtwork from "./CourseArtwork";
import CourseCurriculum from "./CourseCurriculum";
import OverviewNavigation from "./OverviewNavigation";
import CatalogFooter from "../CatalogFooter/CatalogFooter";

export default function CourseOverview({ course, onOpenCourse, onOpenSection }: {
  course: CourseEntry;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
}) {
  const library = useLearningLibrary([course]);
  const item = library.items[0];
  const sections = course.data.modules.flatMap((module) => module.sections);
  const duration = courseDurationLabel(course);
  const level = courseLevelLabel(course);
  const outcomes = courseLearningOutcomes(course);
  const topics = getCourseTagLabels(course.data.tags);
  const counts = courseAssessmentCounts(course);
  const assessments = [
    counts.quizzes > 0 ? `${counts.quizzes} ${counts.quizzes === 1 ? "quiz" : "quizzes"}` : "",
    counts.projects > 0 ? `${counts.projects} ${counts.projects === 1 ? "project" : "projects"}` : "",
    counts.assessments > 0 ? `${counts.assessments} other ${counts.assessments === 1 ? "assessment" : "assessments"}` : "",
  ].filter(Boolean).join(" · ");
  const hasRequirements = Boolean(course.data.prerequisites?.length);

  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="course-overview">
        <header id="overview" className="overview-masthead">
          <div className="overview-heading learner-page-inner">
            <Link href={COURSE_CATALOG_PATH} className="overview-back"><ArrowLeft size={16} aria-hidden="true" />Catalog</Link>
            <div className="overview-course-identity">
              <CourseArtwork course={course} />
              <span className="course-subject-label">{item?.department ?? "Course"}</span>
            </div>
            <h1>{course.title}</h1>
            {course.data.shortDescription && <p className="overview-description">{course.data.shortDescription}</p>}
            <button type="button" className="learner-primary-link" disabled={!sections.length} onClick={() => onOpenCourse(course)}>
              {item?.completed ? "Review course" : item?.started ? "Resume course" : "Start course"}<ArrowRight size={18} aria-hidden="true" />
            </button>
            <dl className="overview-facts">
              <div><dt><Layers size={16} aria-hidden="true" />Curriculum</dt><dd>{course.data.modules.length} modules · {sections.length} sections</dd></div>
              {level && <div><dt>Level</dt><dd>{level}</dd></div>}
              {duration && <div><dt><Clock size={16} aria-hidden="true" />Estimated effort</dt><dd>{duration}</dd></div>}
              {assessments && <div><dt><ClipboardCheck size={16} aria-hidden="true" />Assessments</dt><dd>{assessments}</dd></div>}
            </dl>
          </div>
        </header>
        <OverviewNavigation hasOutcomes={outcomes.length > 0} hasRequirements={hasRequirements} />
        <div className="overview-content learner-page-inner">
          {outcomes.length > 0 && (
            <section id="learning-outcomes" className="overview-outcomes" aria-labelledby="outcomes-title">
              <h2 id="outcomes-title">What you&apos;ll learn</h2>
              <ul>{outcomes.map((outcome) => <li key={outcome}><Check size={18} aria-hidden="true" /><span>{outcome}</span></li>)}</ul>
            </section>
          )}
          {topics.length > 0 && (
            <section className="overview-topics" aria-labelledby="topics-title">
              <h2 id="topics-title">Topics you&apos;ll explore</h2>
              <ul>{topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            </section>
          )}
          {hasRequirements && (
            <section id="requirements" className="overview-prerequisites" aria-labelledby="prerequisites-title">
              <h2 id="prerequisites-title">Before you begin</h2>
              <ul>{course.data.prerequisites?.map((requirement, index) => <li key={index}>{requirement.title}</li>)}</ul>
            </section>
          )}
          <CourseCurriculum key={course.key} course={course} sectionStatuses={item?.sectionStatuses} onOpenSection={onOpenSection} />
        </div>
      </main>
      <CatalogFooter />
    </div>
  );
}
