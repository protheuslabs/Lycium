import { useMemo } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock, Layers } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CourseEntry, CourseSection } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import { COURSE_CATALOG_PATH, LYCIUM_ROUTE_ROOT, MY_LEARNING_PATH } from "../../utils/courseRouting";
import { courseAssessmentCounts, courseDurationLabel, courseLearningOutcomes, courseLevelLabel } from "../../utils/coursePresentation";
import { getCourseTagLabels } from "@lycium/contracts";
import CourseArtwork from "./CourseArtwork";
import CourseCurriculum from "./CourseCurriculum";
import OverviewNavigation from "./OverviewNavigation";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import CourseProgress from "../CourseCard/CourseProgress";
import CourseMaterials from "./CourseMaterials";
import type { SourceRecord } from "../ContentView/contentViewTypes";
import { mergeSourceRecords, normalizeCourseSourceRecords } from "../CourseEditing/courseEditPrimitives";
import { collectReferencedCourseSourceIds } from "../CourseLearningLayout/sourceReferences";

export default function CourseOverview({ course, sources, onOpenCourse, onOpenSection }: {
  course: CourseEntry;
  sources: SourceRecord[];
  onOpenCourse: (course: CourseEntry) => void;
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
}) {
  const searchParams = useSearchParams();
  const returnPath = searchParams.get("from") === "learning" ? MY_LEARNING_PATH : searchParams.get("from") === "home" ? LYCIUM_ROUTE_ROOT : COURSE_CATALOG_PATH;
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
  const hasRequirements = Array.isArray(course.data.prerequisites);
  const hasProgress = Boolean(item?.started);
  const materialSources = useMemo(() => {
    const referencedIds = collectReferencedCourseSourceIds(course.data, course.data.modules);
    return mergeSourceRecords(sources.filter((source) => referencedIds.has(source.id)), normalizeCourseSourceRecords(course));
  }, [course, sources]);
  const lessonCount = sections.filter((section) => section.pageType !== "apply" && section.sectionType !== "summary").length;
  const reviewCount = sections.filter((section) => section.sectionType === "summary").length;
  const instruction = [
    lessonCount ? `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}` : "",
    reviewCount ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="learner-page-shell">
      <main id="main-content" tabIndex={-1} className="course-overview">
        <header id="overview" className="overview-masthead">
          <div className="overview-heading learner-page-inner">
            <Link href={returnPath ?? COURSE_CATALOG_PATH} className="overview-back"><ArrowLeft size={16} aria-hidden="true" />Back</Link>
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
              {instruction && <div><dt>Instruction</dt><dd>{instruction}</dd></div>}
            </dl>
          </div>
        </header>
        <OverviewNavigation hasOutcomes={outcomes.length > 0} hasRequirements={hasRequirements} hasProgress={hasProgress} hasMaterials={materialSources.length > 0} />
        <div className="overview-content learner-page-inner">
          {item?.started && (
            <section id="progress" className="overview-progress" aria-labelledby="course-progress-title">
              <div className="overview-progress-copy">
                <h2 id="course-progress-title">Your progress</h2>
                {item.bookmark && <p>Saved lesson: <strong>{item.bookmark.title}</strong></p>}
              </div>
              <CourseProgress title={course.title} completed={item.progress.completed} total={item.progress.total} />
              <button type="button" className="learner-primary-link" onClick={() => onOpenCourse(course)}>{item.completed ? "Review course" : "Resume saved lesson"}<ArrowRight size={18} aria-hidden="true" /></button>
            </section>
          )}
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
          <CourseMaterials sources={materialSources} />
          {hasRequirements && (
            <section id="requirements" className="overview-prerequisites" aria-labelledby="prerequisites-title">
              <h2 id="prerequisites-title">Before you begin</h2>
              {course.data.prerequisites?.length ? <ul>{course.data.prerequisites.map((requirement, index) => <li key={index}>{requirement.title}</li>)}</ul> : <p>No prerequisites listed.</p>}
            </section>
          )}
          <CourseCurriculum key={course.key} course={course} sectionStatuses={item?.sectionStatuses} onOpenSection={onOpenSection} />
        </div>
      </main>
      <CatalogFooter />
    </div>
  );
}
