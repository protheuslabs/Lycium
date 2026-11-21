"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CourseEntry } from "../../courseTypes";
import type { LearningCourse } from "../../utils/learningLibrary";
import { getCoursePath } from "../../utils/courseRouting";
import CourseCard from "../CourseCard/CourseCard";
import CourseProgress from "../CourseCard/CourseProgress";

type LearningCourseCardProps = {
  item: LearningCourse;
  showProgress?: boolean;
  returnTo?: "home" | "learning";
  onOpenCourse: (course: CourseEntry) => void;
};

export default function LearningCourseCard({
  item,
  showProgress = false,
  returnTo = "home",
  onOpenCourse,
}: LearningCourseCardProps) {
  const router = useRouter();
  const { course, progress, bookmark, completed } = item;
  const overviewPath = `${getCoursePath(course)}?from=${returnTo}`;
  const action = completed ? "Review" : item.started ? "Resume" : "Start";
  return (
    <CourseCard
      course={course}
      className="learning-course-card"
      action={{ label: `View ${course.title} course overview`, onActivate: () => router.push(overviewPath) }}
      title={<Link href={overviewPath} title={course.title}>{course.title}</Link>}
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
