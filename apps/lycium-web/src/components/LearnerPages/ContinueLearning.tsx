import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import type { CourseEntry } from "../../courseTypes";
import type { LearningCourse } from "../../utils/learningLibrary";
import { getCoursePath } from "../../utils/courseRouting";
import CourseArtwork from "./CourseArtwork";

export default function ContinueLearning({ item, onOpenCourse }: {
  item: LearningCourse;
  onOpenCourse: (course: CourseEntry) => void;
}) {
  const { course, bookmark, progress } = item;
  const lesson = bookmark ?? course.data.modules.flatMap((module) => module.sections)[0];
  return (
    <article className="continue-learning">
      <CourseArtwork course={course} />
      <div className="continue-learning-content">
        <span className="course-subject-label">{item.department}</span>
        <h3><Link href={getCoursePath(course)}>{course.title}</Link></h3>
        {lesson && <p className="continue-lesson"><Play size={15} aria-hidden="true" />{lesson.title}</p>}
        <div className="continue-learning-bottom">
          <div className="continue-progress">
            <span>{progress.completed} of {progress.total} sections complete</span>
            <progress value={progress.completed} max={progress.total} aria-label={`${course.title} completion`} />
          </div>
          <button type="button" className="learner-primary-link" onClick={() => onOpenCourse(course)} aria-label={`Resume ${course.title}`}>
            Continue learning<ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
