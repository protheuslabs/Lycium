import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { CourseEntry } from "../../courseTypes";
import type { LearningCourse } from "../../utils/learningLibrary";
import { getCoursePath } from "../../utils/courseRouting";
import CourseCard from "../CourseCard/CourseCard";
import CourseProgress from "../CourseCard/CourseProgress";

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
  const { course, progress, bookmark, completed } = item;
  const action = completed ? "Review" : item.started ? "Resume" : "Start";
  return (
    <CourseCard
      course={course}
      className="learning-course-card"
      title={<Link href={getCoursePath(course)} title={course.title}>{course.title}</Link>}
      context={showProgress && bookmark ? bookmark.title : undefined}
      progress={showProgress && <CourseProgress title={course.title} completed={progress.completed} total={progress.total} />}
      footer={<button
        type="button"
        className="course-tile-command"
        onClick={() => onOpenCourse(course)}
        aria-label={`${action} ${course.title}`}
      >
        <span>
          {completed ? <Check size={16} aria-hidden="true" /> : null}
          {action}
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>}
    />
  );
}
