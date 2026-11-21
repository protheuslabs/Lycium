import type { CourseEntry, CourseSection } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import LearnerHome from "./LearnerHome";
import MyLearning from "./MyLearning";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";

type LearnerPagesProps = {
  page: "landing" | "learning";
  courses: CourseEntry[];
  onOpenCourse: (course: CourseEntry) => void;
  onOpenSection: (course: CourseEntry, section: CourseSection) => void;
};

export default function LearnerPages({ page, courses, onOpenCourse, onOpenSection }: LearnerPagesProps) {
  const library = useLearningLibrary(courses);
  const publicCourses = useMemo(() => courses.filter((course) => getCourseLifecycleSummary(course).status === "published"), [courses]);
  const discoveryLibrary = useLearningLibrary(publicCourses);
  return (
    <div className="learner-page-shell">
      {page === "landing" ? (
        <LearnerHome library={discoveryLibrary} onOpenCourse={onOpenCourse} />
      ) : (
        <MyLearning library={library} onOpenCourse={onOpenCourse} onOpenSection={onOpenSection} />
      )}
      <CatalogFooter />
    </div>
  );
}
import { useMemo } from "react";
