import type { CourseEntry } from "../courseTypes";
import { chem105CourseEntry } from "./chem105Course";
import { projectBasedCodingCourseEntry } from "./projectBasedCodingCourse";

export const localCourses: CourseEntry[] = [projectBasedCodingCourseEntry, chem105CourseEntry];
