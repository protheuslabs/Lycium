import type { CourseEntry } from "../../courseTypes";
import { useLearningLibrary } from "../../hooks/useLearningLibrary";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import LearnerHome from "./LearnerHome";
import MyLearning from "./MyLearning";

type LearnerPagesProps = {
  page: "landing" | "learning";
  courses: CourseEntry[];
  onOpenCourse: (course: CourseEntry) => void;
};

export default function LearnerPages({ page, courses, onOpenCourse }: LearnerPagesProps) {
  const library = useLearningLibrary(courses);
  return (
    <div className="learner-page-shell">
      {page === "landing" ? (
        <LearnerHome library={library} onOpenCourse={onOpenCourse} />
      ) : (
        <MyLearning library={library} onOpenCourse={onOpenCourse} />
      )}
      <CatalogFooter />
    </div>
  );
}
