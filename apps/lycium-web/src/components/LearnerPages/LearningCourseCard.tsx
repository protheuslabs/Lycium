import { ArrowRight, BookOpen, Check, Layers } from "lucide-react";
import Link from "next/link";
import type { CourseEntry } from "../../courseTypes";
import type { LearningCourse } from "../../utils/learningLibrary";
import { getCoursePath } from "../../utils/courseRouting";
import CourseArtwork from "./CourseArtwork";

type LearningCourseCardProps = {
  item: LearningCourse;
  showProgress?: boolean;
  onOpenCourse: (course: CourseEntry) => void;
};

export default function LearningCourseCard({
  item,
  showProgress = false,
  onOpenCourse,
}: LearningCourseCardProps) {
  const { course, department, progress, bookmark, completed } = item;
  const action = completed ? "Review" : item.started ? "Resume" : "Start";
  return (
    <article className="learning-course-card" data-category={course.data.category}>
      <CourseArtwork course={course} />
      <div className="learning-course-body">
      <div className="learning-course-meta">
        <BookOpen size={17} aria-hidden="true" />
        <span>{department}</span>
      </div>
      <h3>
        <Link
          href={getCoursePath(course)}
          title={course.title}
        >
          {course.title}
        </Link>
      </h3>
      {showProgress && bookmark ? (
        <p className="learning-resume-section">{bookmark.title}</p>
      ) : (
        <p className="learning-course-description">{course.data.shortDescription}</p>
      )}
      <p className="learning-course-size">
        <Layers size={14} aria-hidden="true" />
        {course.data.modules.length} {course.data.modules.length === 1 ? "module" : "modules"}
        <span aria-hidden="true">/</span>
        {progress.total} {progress.total === 1 ? "section" : "sections"}
      </p>
      {showProgress && (
        <div className="learning-course-progress">
          <div>
            <span>
              {progress.completed} of {progress.total} sections complete
            </span>
            <strong>{Math.round(progress.percentage)}%</strong>
          </div>
          <progress
            value={progress.completed}
            max={progress.total}
            aria-label={`${course.title} completion`}
          />
        </div>
      )}
      <button
        type="button"
        className="learning-card-action"
        onClick={() => onOpenCourse(course)}
        aria-label={`${action} ${course.title}`}
      >
        <span>
          {completed ? <Check size={16} aria-hidden="true" /> : null}
          {action}
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      </div>
    </article>
  );
}
