import LyciumClientShell from "../../LyciumClientShell";
import { localCourses } from "../../../courseData/localCourses";
import { getCoursePathSlug } from "../../../utils/courseRouting";

export function generateStaticParams() {
  return localCourses.map((course) => ({
    courseSlug: getCoursePathSlug(course),
  }));
}

export default function CoursePage() {
  return <LyciumClientShell />;
}
