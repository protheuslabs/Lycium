import LyciumClientShell from "../../LyciumClientShell";
import { localCourses } from "../../../courseData/localCourses";
import { getCoursePathSlug } from "../../../utils/courseRouting";

const EMPTY_COURSE_SLUG = "__lycium-empty-course__";

export function generateStaticParams() {
  const params = localCourses.map((course) => ({
    courseSlug: getCoursePathSlug(course),
  }));
  return params.length || process.env.NEXT_OUTPUT !== "export" ? params : [{ courseSlug: EMPTY_COURSE_SLUG }];
}

export default function CoursePage() {
  return <LyciumClientShell />;
}
