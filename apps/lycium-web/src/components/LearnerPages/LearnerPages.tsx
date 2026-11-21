import type { CourseEntry } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import LearnerHome from "./LearnerHome";
import MyLearning from "./MyLearning";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";

type LearnerPagesProps = {
  page: "landing" | "learning";
  courses: CourseEntry[];
  onOpenCourse: (course: CourseEntry) => void;
};

export default function LearnerPages({ page, courses, onOpenCourse }: LearnerPagesProps) {
  const library = useLearningLibrary(courses);
  const publicCourses = useMemo(() => courses.filter((course) => getCourseLifecycleSummary(course).status === "published"), [courses]);
  const discoveryLibrary = useLearningLibrary(publicCourses);
  return (
    <div className="learner-page-shell">
      {page === "landing" ? (
        <LearnerHome library={discoveryLibrary} onOpenCourse={onOpenCourse} />
      ) : (
        <MyLearning library={library} onOpenCourse={onOpenCourse} />
      )}
      <CatalogFooter />
    </div>
  );
}
import { useMemo } from "react";
