import LyciumClientShell from "../../../../LyciumClientShell";
import { localCourses } from "../../../../../courseData/localCourses";
import { getCoursePathSlug, getFlatCourseSections, getSectionPathSlug } from "../../../../../utils/courseRouting";

export function generateStaticParams() {
  return localCourses.flatMap((course) =>
    getFlatCourseSections(course).map((section) => ({
      courseSlug: getCoursePathSlug(course),
      unitSlug: getSectionPathSlug(section),
    })),
  );
}

export default function CourseUnitPage() {
  return <LyciumClientShell />;
}
