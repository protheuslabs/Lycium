import LyciumClientShell from "../../../../LyciumClientShell";
import { localCourses } from "../../../../../courseData/localCourses";
import { getCoursePathSlug, getFlatCourseSections, getSectionPathSlug } from "../../../../../utils/courseRouting";

const EMPTY_COURSE_SLUG = "__lycium-empty-course__";
const EMPTY_UNIT_SLUG = "__lycium-empty-unit__";

export function generateStaticParams() {
  const params = localCourses.flatMap((course) =>
    getFlatCourseSections(course).map((section) => ({
      courseSlug: getCoursePathSlug(course),
      unitSlug: getSectionPathSlug(section),
    })),
  );
  return params.length || process.env.NEXT_OUTPUT !== "export" ? params : [{ courseSlug: EMPTY_COURSE_SLUG, unitSlug: EMPTY_UNIT_SLUG }];
}

export default function CourseUnitPage() {
  return <LyciumClientShell />;
}
