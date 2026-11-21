import type { ReactNode } from "react";
import { BookOpen, Layers } from "lucide-react";
import { getCourseCategoryLabel, getCourseDepartmentLabel } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import CourseArtwork from "../LearnerPages/CourseArtwork";
import { courseDurationLabel, courseLevelLabel } from "../../utils/coursePresentation";

type CourseCardProps = {
  course: CourseEntry;
  title: ReactNode;
  className?: string;
  context?: ReactNode;
  progress?: ReactNode;
  footer: ReactNode;
  tools?: ReactNode;
  action?: {
    label: string;
    onActivate: () => void;
    disabled?: boolean;
    selected?: boolean;
  };
};

export default function CourseCard({
  course, title, className = "", context, progress, footer, tools, action,
}: CourseCardProps) {
  const subject = course.data.department
    ? getCourseDepartmentLabel(course.data.category, course.data.department)
    : course.data.category
      ? getCourseCategoryLabel(course.data.category).replace(/^College of /, "")
      : "Independent study";
  const sections = course.data.modules.reduce((total, module) => total + module.sections.length, 0);
  const duration = courseDurationLabel(course);
  const level = courseLevelLabel(course);
  return (
    <article
      className={`course-tile ${className}`}
      data-category={course.data.category}
      data-disabled={action?.disabled || undefined}
    >
      {action && (
        <button
          className="course-tile-hit-target catalog-card-action"
          type="button"
          aria-label={action.label}
          aria-pressed={action.selected}
          disabled={action.disabled}
          onClick={action.onActivate}
        />
      )}
      <CourseArtwork course={course} />
      {tools && <div className="course-tile-tools">{tools}</div>}
      <div className="course-tile-body">
        <p className="course-tile-subject">
          <BookOpen size={16} aria-hidden="true" />
          <span>{subject}</span>
        </p>
        <h3 className="course-tile-title">{title}</h3>
        {course.data.shortDescription && (
          <p className="course-tile-description">{course.data.shortDescription}</p>
        )}
        {context && <div className="course-tile-context">{context}</div>}
        {(level || duration) && (
          <p className="course-tile-fit">
            {level && <span>{level}</span>}
            {duration && <span>{duration}</span>}
          </p>
        )}
        <p className="course-tile-size">
          <Layers size={14} aria-hidden="true" />
          <span>{course.data.modules.length} {course.data.modules.length === 1 ? "module" : "modules"}</span>
          <span aria-hidden="true">/</span>
          <span>{sections} {sections === 1 ? "section" : "sections"}</span>
        </p>
        {progress}
        <div className="course-tile-footer">{footer}</div>
      </div>
    </article>
  );
}
